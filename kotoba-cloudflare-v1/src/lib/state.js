import { HttpError, isPlainObject } from './http.js';
import { STARTER_FLASHCARDS } from '../data/flashcards.js';

/**
 * D1-backed learner state for KOTOBA.
 * New accounts start with unreviewed starter cards and must complete JLPT onboarding.
 */

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value ?? '') ?? fallback;
  } catch {
    return fallback;
  }
}

export function defaultPrefs() {
  return {
    level: 'N5',
    goal: 'JLPT',
    minutes: '20',
    period: '夜',
    studyTime: '20:30',
    bioInterest: true,
    onboardingCompleted: false,
  };
}

function prefsFromRow(row) {
  if (!row) return defaultPrefs();

  return {
    level: row.level || 'N5',
    goal: row.goal || 'JLPT',
    minutes: row.minutes || '20',
    period: row.period || '夜',
    studyTime: row.study_time || '20:30',
    bioInterest: Boolean(row.bio_interest),
    onboardingCompleted: Boolean(row.onboarding_completed),
  };
}

/**
 * Create a CLEAN learner profile for a newly registered user.
 * Demo progress belongs in seed.sql; starter vocabulary is added when loading state.
 */
export async function seedUser(env, userId) {
  const statements = [
    env.DB.prepare(
      `INSERT OR REPLACE INTO preferences
       (user_id, level, goal, minutes, period, study_time, bio_interest, onboarding_completed)
       VALUES(?, 'N5', 'JLPT', '20', '夜', '20:30', 1, 0)`,
    ).bind(userId),

    env.DB.prepare(
      `INSERT OR REPLACE INTO activity(user_id, total_minutes, streak, days_json)
       VALUES(?, 0, 0, '{}')`,
    ).bind(userId),
  ];

  await env.DB.batch(statements);
}

async function vocabularyFor(env, userId) {
  const result = await env.DB.prepare(
    `SELECT term, reading, meaning, example, source, stage, interval_days,
            due, reviews, exposures, last_seen
     FROM vocabulary
     WHERE user_id = ?
     ORDER BY id`,
  )
    .bind(userId)
    .all();

  return (result.results || []).map((row) => ({
    term: row.term,
    reading: row.reading,
    meaning: row.meaning,
    example: row.example,
    source: row.source,
    stage: Number(row.stage),
    interval: Number(row.interval_days),
    due: row.due,
    reviews: Number(row.reviews),
    exposures: Number(row.exposures),
    lastSeen: row.last_seen,
  }));
}

async function errorsFor(env, userId) {
  const result = await env.DB.prepare(
    `SELECT error_key, error_type, count
     FROM errors
     WHERE user_id = ?
     ORDER BY count DESC, id`,
  )
    .bind(userId)
    .all();

  return (result.results || []).map((row) => ({
    key: row.error_key,
    type: row.error_type,
    count: Number(row.count),
  }));
}

async function withStarterVocabulary(env, userId, deck) {
  const existingTerms = new Set(deck.map(card => card.term));
  const missing = STARTER_FLASHCARDS.filter(card => !existingTerms.has(card.term));
  if (!missing.length) return deck;

  const today = todayISO();
  await env.DB.batch(missing.map(card => env.DB.prepare(
    `INSERT OR IGNORE INTO vocabulary
     (user_id, term, reading, meaning, example, source, stage, interval_days,
      due, reviews, exposures, last_seen)
     VALUES(?, ?, ?, ?, ?, ?, 0, 0, ?, 0, 1, ?)`,
  ).bind(userId, card.term, card.reading, card.meaning, card.example, card.source, today, today)));

  return vocabularyFor(env, userId);
}

/** Return complete app state after register/login/refresh. */
export async function stateFor(env, userId) {
  const user = await env.DB.prepare(
    'SELECT id, name, email, created_at FROM users WHERE id = ?',
  )
    .bind(userId)
    .first();

  if (!user) throw new HttpError(401, 'ユーザーが見つかりません。');

  const [prefs, activity, dailyRows, storedDeck, errors] = await Promise.all([
    env.DB.prepare('SELECT * FROM preferences WHERE user_id = ?').bind(userId).first(),
    env.DB.prepare('SELECT * FROM activity WHERE user_id = ?').bind(userId).first(),
    env.DB.prepare('SELECT study_date, tasks_json FROM daily WHERE user_id = ?').bind(userId).all(),
    vocabularyFor(env, userId),
    errorsFor(env, userId),
  ]);

  const deck = await withStarterVocabulary(env, userId, storedDeck);

  const daily = {};
  for (const row of dailyRows.results || []) {
    daily[row.study_date] = safeJsonParse(row.tasks_json, []);
  }

  return {
    user: {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      createdAt: Number(user.created_at),
    },
    prefs: prefsFromRow(prefs),
    daily,
    deck,
    errors,
    activity: {
      days: safeJsonParse(activity?.days_json, {}),
      totalMinutes: Number(activity?.total_minutes || 0),
      streak: Number(activity?.streak || 0),
    },
  };
}

/** Persist one app state section to D1. */
export async function saveStateSection(env, userId, section, value) {
  if (section === 'user') {
    if (isPlainObject(value) && String(value.name || '').trim()) {
      await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?')
        .bind(String(value.name).trim(), userId)
        .run();
    }
    return;
  }

  if (section === 'prefs') {
    const v = isPlainObject(value) ? value : {};
    const level = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(v.level) ? v.level : 'N5';

    await env.DB.prepare(
      `INSERT INTO preferences
       (user_id, level, goal, minutes, period, study_time, bio_interest, onboarding_completed)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         level = excluded.level,
         goal = excluded.goal,
         minutes = excluded.minutes,
         period = excluded.period,
         study_time = excluded.study_time,
         bio_interest = excluded.bio_interest,
         onboarding_completed = excluded.onboarding_completed`,
    )
      .bind(
        userId,
        level,
        v.goal || 'JLPT',
        String(v.minutes || '20'),
        v.period || '夜',
        v.studyTime || '20:30',
        v.bioInterest === false ? 0 : 1,
        v.onboardingCompleted ? 1 : 0,
      )
      .run();
    return;
  }

  if (section === 'daily') {
    if (!isPlainObject(value)) throw new HttpError(400, 'daily はオブジェクトで送信してください。');

    const statements = [env.DB.prepare('DELETE FROM daily WHERE user_id = ?').bind(userId)];
    for (const [day, tasks] of Object.entries(value)) {
      statements.push(
        env.DB.prepare(
          'INSERT INTO daily(user_id, study_date, tasks_json) VALUES(?, ?, ?)',
        ).bind(userId, day, JSON.stringify(tasks)),
      );
    }
    await env.DB.batch(statements);
    return;
  }

  if (section === 'activity') {
    const v = isPlainObject(value) ? value : {};

    await env.DB.prepare(
      `INSERT INTO activity(user_id, total_minutes, streak, days_json)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         total_minutes = excluded.total_minutes,
         streak = excluded.streak,
         days_json = excluded.days_json`,
    )
      .bind(
        userId,
        Number(v.totalMinutes || 0),
        Number(v.streak || 0),
        JSON.stringify(v.days || {}),
      )
      .run();
    return;
  }

  if (section === 'errors') {
    if (!Array.isArray(value)) throw new HttpError(400, 'errors は配列で送信してください。');

    const statements = [env.DB.prepare('DELETE FROM errors WHERE user_id = ?').bind(userId)];
    for (const item of value) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO errors(user_id, error_key, error_type, count)
           VALUES(?, ?, ?, ?)`,
        ).bind(
          userId,
          String(item.key || ''),
          String(item.type || '文法'),
          Number(item.count || 1),
        ),
      );
    }
    await env.DB.batch(statements);
    return;
  }

  if (section === 'deck') {
    if (!Array.isArray(value)) throw new HttpError(400, 'deck は配列で送信してください。');

    const statements = [env.DB.prepare('DELETE FROM vocabulary WHERE user_id = ?').bind(userId)];
    for (const card of value) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO vocabulary
           (user_id, term, reading, meaning, example, source, stage, interval_days,
            due, reviews, exposures, last_seen)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          userId,
          String(card.term || ''),
          String(card.reading || ''),
          String(card.meaning || ''),
          String(card.example || ''),
          String(card.source || '学習'),
          Number(card.stage || 0),
          Number(card.interval || 0),
          card.due || todayISO(),
          Number(card.reviews || 0),
          Number(card.exposures || 1),
          card.lastSeen || null,
        ),
      );
    }
    await env.DB.batch(statements);
    return;
  }

  throw new HttpError(404, '保存対象が見つかりません。');
}
