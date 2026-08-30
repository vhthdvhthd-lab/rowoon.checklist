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
    if (url.pathname === '/api/data') return await handleData(request, env, url);
    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error(error);
    return json({ error: '공용 저장소 처리 중 오류가 발생했습니다.', detail: String(error?.message || error) }, 500);
  }
} };
