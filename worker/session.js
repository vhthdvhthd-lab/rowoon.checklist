const lifetime = 60 * 60 * 8;
const cookie = 'rowoon_session';
const encoder = new TextEncoder();

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

function equal(left, right) {
  let difference = left.length ^ right.length;
  for (let i = 0; i < right.length; i++) difference |= (left.charCodeAt(i) || 0) ^ right.charCodeAt(i);
  return difference === 0;
}

async function ensureSessions(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS worker_sessions (id TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL)').run();
}

function readToken(request) {
  const entry = request.headers.get('cookie')?.split(/;\s*/).find(value => value.startsWith(cookie + '='));
  const token = entry?.slice(cookie.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

export async function makeSession(db, secret, account, remember) {
  const age = remember ? 365 * 24 * 60 * 60 : lifetime;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const now = Math.floor(Date.now() / 1000);
  await ensureSessions(db);
  await db.batch([
    db.prepare('DELETE FROM worker_sessions WHERE expires <= ?').bind(now),
    db.prepare('INSERT INTO worker_sessions (id, account, expires) VALUES (?, ?, ?)').bind(
      await sign(secret, token), JSON.stringify(account), now + age
    )
  ]);
  return sessionCookie(token, remember ? age : undefined);
}

export function sessionCookie(value = '', age = value ? undefined : 0) {
  const maxAge = age === undefined ? '' : `; Max-Age=${age}`;
  return `${cookie}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${maxAge}`;
}

export async function readSession(request, db, secret) {
  const token = readToken(request);
  if (!secret || !token) return null;
  await ensureSessions(db);
  const row = await db.prepare('SELECT account FROM worker_sessions WHERE id = ? AND expires > ?')
    .bind(await sign(secret, token), Math.floor(Date.now() / 1000)).first();
  return row ? JSON.parse(row.account) : null;
}

export async function revokeSession(request, db, secret) {
  const token = readToken(request);
  if (!secret || !token) return;
  await ensureSessions(db);
  await db.prepare('DELETE FROM worker_sessions WHERE id = ?').bind(await sign(secret, token)).run();
}

export async function matchesAccessKey(secret, provided) {
  if (typeof secret !== 'string' || secret.length < 8 || typeof provided !== 'string' || provided.length > 256) return false;
  return equal(await sign(secret, provided), await sign(secret, secret));
}
