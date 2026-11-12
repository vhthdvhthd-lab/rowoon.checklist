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

export async function makeSession(secret) {
  const value = String(Math.floor(Date.now() / 1000) + lifetime) + '.' + crypto.randomUUID();
  return sessionCookie(value + '.' + await sign(secret, value), lifetime);
}

export function sessionCookie(value = '', age = 0) {
  return `${cookie}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}

export async function hasSession(request, secret) {
  if (!secret) return false;
  const entry = request.headers.get('cookie')?.split(/;\s*/).find(value => value.startsWith(cookie + '='));
  const token = entry?.slice(cookie.length + 1);
  if (!token || !/^\d{10}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, id, signature] = token.split('.');
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  return equal(signature, await sign(secret, expires + '.' + id));
}

export async function matchesAccessKey(secret, provided) {
  if (typeof secret !== 'string' || secret.length < 16 || typeof provided !== 'string' || provided.length > 256) return false;
  return equal(await sign(secret, provided), await sign(secret, secret));
}
