import { requireUser } from '../lib/auth.js';
import { json, readJson } from '../lib/http.js';
import { saveStateSection, stateFor } from '../lib/state.js';

/** GET /api/me */
export async function me(request, env) {
  const user = await requireUser(request, env);
  return json(user);
}

/** GET /api/state */
export async function getState(request, env) {
  const user = await requireUser(request, env);
  return json(await stateFor(env, user.id));
}

/** PUT /api/state/:section */
export async function putState(request, env, section) {
  const user = await requireUser(request, env);
  const body = await readJson(request);

  await saveStateSection(env, user.id, section, body.value);
  return json({ ok: true });
}
