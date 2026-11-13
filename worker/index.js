import { readSession, revokeSession, makeSession, matchesAccessKey, sessionCookie } from './session.js';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, max-age=0' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });

async function ensureSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS checklist_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
}

function splitChecklists(data) {
  const rows = [];
  for (const [participantId, months] of Object.entries(data || {})) {
    if (!months || typeof months !== 'object') continue;
    for (const [monthKey, value] of Object.entries(months)) {
      if (/^\d{4}-\d{2}$/.test(monthKey)) rows.push({ key: `checklist:${participantId}:${monthKey}`, value });
    }
  }
  return rows;
}

async function writeRows(db, rows) {
  if (!rows.length) return 0;
  const now = new Date().toISOString();
  const statements = rows.map(({ key, value }) => db.prepare(`INSERT INTO checklist_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(key, JSON.stringify(value), now));
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
  return rows.length;
}

async function readChecklists(db) {
  const result = await db.prepare("SELECT key, value FROM checklist_state WHERE key LIKE 'checklist:%'").all();
  const output = {};
  for (const row of result.results || []) {
    const match = /^checklist:([^:]+):(\d{4}-\d{2})$/.exec(row.key);
    if (!match) continue;
    try { output[match[1]] ||= {}; output[match[1]][match[2]] = JSON.parse(row.value); } catch (_) {}
  }
  return output;
}

async function handleData(request, env, url) {
  await ensureSchema(env.DB);
  if (request.method === 'GET') {
    const key = url.searchParams.get('key');
    if (key === 'settings') {
      const row = await env.DB.prepare("SELECT value FROM checklist_state WHERE key = 'settings'").first();
      return json(row ? JSON.parse(row.value) : null);
    }
    if (key === 'checklists') return json(await readChecklists(env.DB));
    return json({ error: 'key는 settings 또는 checklists여야 합니다.' }, 400);
  }
  if (request.method === 'PUT') {
    const body = await request.json();
    if (body.key === 'settings') { await writeRows(env.DB, [{ key: 'settings', value: body.data }]); return json({ ok: true, rows: 1 }); }
    if (body.key === 'checklists') {
      let rows = splitChecklists(body.data);
      if (Array.isArray(body.scopes) && body.scopes.length) {
        const allowed = new Set(body.scopes.map(scope => `checklist:${scope}`));
        rows = rows.filter(row => allowed.has(row.key));
      }
      if (body.replaceAll === true) {
        const newKeys = new Set(rows.map(row => row.key));
        const old = await env.DB.prepare("SELECT key FROM checklist_state WHERE key LIKE 'checklist:%'").all();
        const deletes = (old.results || []).filter(row => !newKeys.has(row.key)).map(row => env.DB.prepare('DELETE FROM checklist_state WHERE key = ?').bind(row.key));
        for (let i = 0; i < deletes.length; i += 50) await env.DB.batch(deletes.slice(i, i + 50));
      }
      return json({ ok: true, rows: await writeRows(env.DB, rows) });
    }
    return json({ error: 'key는 settings 또는 checklists여야 합니다.' }, 400);
  }
  return json({ error: 'Method Not Allowed' }, 405);
}

export default { async fetch(request, env) {
  try {
    if (!env.DB) return json({ error: 'D1 연결(DB binding)이 없습니다.' }, 500);
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) {
        return json({ error: 'Forbidden' }, 403);
      }
      if (url.pathname === '/api/login' && request.method === 'POST') {
        if (!env.ROWOON_ACCESS_KEY || env.ROWOON_ACCESS_KEY.length < 8) {
          return json({ error: '접속키 설정이 필요합니다.' }, 503);
        }
        const { code, accessKey, remember, includeData } = await request.json();
        if (!await matchesAccessKey(env.ROWOON_ACCESS_KEY, accessKey)) {
          return json({ error: 'Unauthorized' }, 401);
        }
        await ensureSchema(env.DB);
        const row = await env.DB.prepare("SELECT value FROM checklist_state WHERE key = 'settings'").first();
        const settings = row ? JSON.parse(row.value) : null;
        const accounts = settings?.accounts;
        const account = Array.isArray(accounts) && accounts.find(item => item.code === code);
        if (!account) return json({ error: 'Unauthorized' }, 401);
        const identity = { name: account.name, teacherName: account.teacherName, role: account.role };
        const [cookie, checklists] = await Promise.all([
          makeSession(env.DB, env.ROWOON_ACCESS_KEY, identity, remember === true),
          includeData === true ? readChecklists(env.DB) : null
        ]);
        const payload = includeData === true ? { identity, settings, checklists } : identity;
        return new Response(JSON.stringify(payload), {
          headers: { ...JSON_HEADERS, 'set-cookie': cookie }
        });
      }
      if (url.pathname === '/api/logout' && request.method === 'POST') {
        await revokeSession(request, env.DB, env.ROWOON_ACCESS_KEY);
        return new Response(null, { status: 204, headers: { ...JSON_HEADERS, 'set-cookie': sessionCookie() } });
      }
      const identity = await readSession(request, env.DB, env.ROWOON_ACCESS_KEY);
      if (!identity) return json({ error: 'Unauthorized' }, 401);
      if (url.pathname === '/api/session' && request.method === 'GET') {
        if (url.searchParams.get('includeData') !== '1') return json(identity);
        const [settingsResponse, checklists] = await Promise.all([
          handleData(request, env, new URL('/api/data?key=settings', url)),
          readChecklists(env.DB)
        ]);
        return json({ identity, settings: await settingsResponse.json(), checklists });
      }
      if (url.pathname === '/api/attendance-template') {
        if (request.method === 'GET') {
          const row = await env.DB.prepare("SELECT value FROM checklist_state WHERE key = 'attendance-template'").first();
          return json({ template: row ? JSON.parse(row.value) : null });
        }
        if (request.method === 'PUT') {
          if (!['admin', 'manager'].includes(identity.role)) return json({ error: '관리자 또는 팀장만 양식을 등록할 수 있습니다.' }, 403);
          const { template } = await request.json();
          if (typeof template !== 'string' || template.length > 700000 || !/^UEsDB[A-Za-z0-9+/]+={0,2}$/.test(template)) {
            return json({ error: '500KB 이하의 엑셀 양식을 선택해 주세요.' }, 400);
          }
          const result = await env.DB.prepare("INSERT OR IGNORE INTO checklist_state (key, value, updated_at) VALUES ('attendance-template', ?, ?)")
            .bind(JSON.stringify(template), new Date().toISOString()).run();
          return result.meta.changes ? json({ ok: true }) : json({ error: '양식이 이미 등록됐어요. 출결 엑셀을 다시 눌러 주세요.' }, 409);
        }
        return json({ error: 'Method Not Allowed' }, 405);
      }
      if (url.pathname === '/api/data') return await handleData(request, env, url);
      return json({ error: 'Not found' }, 404);
    }
    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error(error);
    return json({ error: '공용 저장소 처리 중 오류가 발생했습니다.' }, 500);
  }
} };
