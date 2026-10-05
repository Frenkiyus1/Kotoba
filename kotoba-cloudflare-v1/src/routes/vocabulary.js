import { requireUser } from '../lib/auth.js';
import { HttpError, json, readJson } from '../lib/http.js';
import { todayISO } from '../lib/state.js';

function addDays(isoDate, numberOfDays) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + numberOfDays);
  return date.toISOString().slice(0, 10);
}

/** POST /api/vocabulary/upsert */
export async function upsertVocabulary(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);

  const term = String(body.term || '').trim();
  if (!term) throw new HttpError(400, '単語が空です。');

  const today = todayISO();

  await env.DB.prepare(
    `INSERT INTO vocabulary
     (user_id, term, reading, meaning, example, source, stage, interval_days,
      due, reviews, exposures, last_seen)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, term) DO UPDATE SET
       reading = excluded.reading,
       meaning = excluded.meaning,
       example = excluded.example,
       source = excluded.source,
       exposures = vocabulary.exposures + 1,
       last_seen = excluded.last_seen`,
  )
    .bind(
      user.id,
      term,
      String(body.reading || ''),
      String(body.meaning || ''),
      String(body.example || ''),
      String(body.source || '学習'),
      Number(body.stage || 0),
      Number(body.interval || 0),
      body.due || today,
      Number(body.reviews || 0),
      Number(body.exposures || 1),
      body.lastSeen || today,
    )
    .run();

  return json({ ok: true });
}

/** POST /api/vocabulary/review */
export async function reviewVocabulary(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);

  const term = String(body.term || '').trim();
  const rating = String(body.rating || '');

  const card = await env.DB.prepare(
    'SELECT id, stage FROM vocabulary WHERE user_id = ? AND term = ?',
  )
    .bind(user.id, term)
    .first();

  if (!card) throw new HttpError(404, '単語が見つかりません。');

  let stage = Number(card.stage || 0);
  let intervalDays = 0;

  if (rating === 'again') {
    stage = Math.max(0, stage - 1);
    intervalDays = 0;
  } else if (rating === 'hard') {
    stage = Math.min(3, stage + 1);
    intervalDays = [1, 1, 3, 5][stage];
  } else if (rating === 'good') {
    stage = Math.min(3, stage + 1);
    intervalDays = [1, 3, 7, 14][stage];
  } else {
    throw new HttpError(400, 'rating は again / hard / good を指定してください。');
  }

  const due = addDays(todayISO(), intervalDays);

  await env.DB.prepare(
    `UPDATE vocabulary
     SET stage = ?, interval_days = ?, due = ?, reviews = reviews + 1
     WHERE id = ?`,
  )
    .bind(stage, intervalDays, due, card.id)
    .run();

  return json({ ok: true, stage, interval: intervalDays, due });
}
