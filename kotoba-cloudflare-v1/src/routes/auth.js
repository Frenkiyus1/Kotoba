import { createSession, deleteCurrentSession, hashPassword, verifyPassword } from '../lib/auth.js';
import { HttpError, json, readJson } from '../lib/http.js';
import { seedUser, stateFor } from '../lib/state.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/register */
export async function register(request, env) {
  const body = await readJson(request);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name) throw new HttpError(400, '名前を入力してください。');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'メールアドレスが正しくありません。');
  if (password.length < 6) throw new HttpError(400, 'パスワードは6文字以上にしてください。');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) throw new HttpError(409, 'このメールアドレスはすでに登録されています。');

  const passwordHash = await hashPassword(password);
  const createdAt = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO users(name, email, password_hash, created_at)
     VALUES(?, ?, ?, ?)`,
  )
    .bind(name, email, passwordHash, createdAt)
    .run();

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const userId = Number(user.id);

  await seedUser(env, userId);
  const token = await createSession(env, userId);

  return json({ token, state: await stateFor(env, userId) });
}

/** POST /api/auth/login */
export async function login(request, env) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE email = ?',
  )
    .bind(email)
    .first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'メールアドレスまたはパスワードが違います。');
  }

  const userId = Number(user.id);
  const token = await createSession(env, userId);

  return json({ token, state: await stateFor(env, userId) });
}

/** POST /api/auth/logout */
export async function logout(request, env) {
  await deleteCurrentSession(request, env);
  return json({ ok: true });
}
