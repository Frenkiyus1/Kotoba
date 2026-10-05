import { HttpError } from './http.js';

/**
 * Authentication trên Cloudflare Worker.
 *
 * - Password: PBKDF2-SHA256 bằng Web Crypto (không lưu password thô).
 * - Login session: token ngẫu nhiên được lưu trong D1.
 * - Frontend gửi token qua: Authorization: Bearer <token>.
 */

const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 ngày

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePasswordDigest(password, salt, iterations) {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    passwordKey,
    256,
  );

  return new Uint8Array(bits);
}

/** Tạo chuỗi password hash để lưu vào D1. */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePasswordDigest(password, salt, PASSWORD_ITERATIONS);

  return [
    'pbkdf2_sha256',
    PASSWORD_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(digest),
  ].join('$');
}

/** So sánh password người dùng nhập với hash trong D1. */
export async function verifyPassword(password, encodedHash) {
  try {
    const [scheme, iterationText, saltText, digestText] = encodedHash.split('$');
    if (scheme !== 'pbkdf2_sha256') return false;

    const iterations = Number(iterationText);
    const salt = base64UrlToBytes(saltText);
    const expected = base64UrlToBytes(digestText);
    const actual = await derivePasswordDigest(password, salt, iterations);

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function createRandomToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

/** Tạo login session mới và trả token cho frontend. */
export async function createSession(env, userId) {
  const token = createRandomToken();
  const now = unixNow();
  const expiresAt = now + SESSION_TTL_SECONDS;

  await env.DB.prepare(
    `INSERT INTO sessions(token, user_id, created_at, expires_at)
     VALUES(?, ?, ?, ?)`,
  )
    .bind(token, userId, now, expiresAt)
    .run();

  return token;
}

/** Lấy Bearer token từ request header. */
export function getBearerToken(request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim();
}

/**
 * Xác thực route cần login.
 * Trả object user tối thiểu để các route khác dùng user.id.
 */
export async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) throw new HttpError(401, 'ログインしてください。');

  const row = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.created_at, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
  )
    .bind(token)
    .first();

  if (!row) throw new HttpError(401, '認証情報が無効です。');

  if (Number(row.expires_at) < unixNow()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    throw new HttpError(401, 'ログインの有効期限が切れました。');
  }

  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    createdAt: Number(row.created_at),
  };
}

/** Logout: session token hiện tại bị xóa khỏi D1. */
export async function deleteCurrentSession(request, env) {
  const token = getBearerToken(request);
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}
