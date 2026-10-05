import { HttpError, isPlainObject } from './http.js';

/**
 * Toàn bộ logic đọc/ghi trạng thái học tập trong D1.
 * Frontend cũ dùng localStorage; Worker đồng bộ các section này lên cloud.
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
    onboarding_completed: 0,
    goal: 'JLPT',
    minutes: '20',
    period: '夜',
    studyTime: '20:30',
    bioInterest: true,
  };
}

function prefsFromRow(row) {
  if (!row) return defaultPrefs();

  return {
    level: row.level,
    onboarding_completed: Number(row.onboarding_completed || 0),
    goal: row.goal,
    minutes: row.minutes,
    period: row.period,
    studyTime: row.study_time,
    bioInterest: Boolean(row.bio_interest),
  };
}

/** Tạo dữ liệu mẫu cho user mới để demo web có nội dung ngay sau khi đăng ký. */
export async function seedUser(env, userId) {
  const today = todayISO();

  const statements = [
    env.DB.prepare(
      `INSERT OR REPLACE INTO preferences
       (user_id, level, goal, minutes, period, study_time, bio_interest)
       VALUES(?, 'N5', 'JLPT', '25', '夜', '20:30', 1)`,
    ).bind(userId),

    env.DB.prepare(
      `INSERT OR IGNORE INTO vocabulary
       (user_id, term, reading, meaning, example, source, stage, interval_days,
        due, reviews, exposures, last_seen)
       VALUES(?, '学校', 'がっこう', 'trường học; nhà trường',
              '毎朝八時に学校へ行きます。', 'N5', 0, 0, ?, 0, 1, ?)`,
    ).bind(userId, today, today),

    env.DB.prepare(
      `INSERT OR IGNORE INTO vocabulary
       (user_id, term, reading, meaning, example, source, stage, interval_days,
        due, reviews, exposures, last_seen)
       VALUES(?, '昨日', 'きのう', 'hôm qua',
              '昨日、図書館へ行きました。', 'N5', 1, 1, ?, 1, 1, ?)`,
    ).bind(userId, today, today),

    env.DB.prepare(
      `INSERT OR IGNORE INTO vocabulary
       (user_id, term, reading, meaning, example, source, stage, interval_days,
        due, reviews, exposures, last_seen)
       VALUES(?, '友達', 'ともだち', 'bạn; bạn bè',
              '友達と一緒に昼ご飯を食べます。', 'N5', 0, 0, ?, 0, 1, ?)`,
    ).bind(userId, today, today),

    env.DB.prepare(
      `INSERT OR IGNORE INTO vocabulary
       (user_id, term, reading, meaning, example, source, stage, interval_days,
        due, reviews, exposures, last_seen)
       VALUES(?, '細胞膜', 'さいぼうまく', 'màng tế bào',
              '細胞膜は細胞の内側と外側を分けています。', '生物', 2, 3, ?, 2, 1, ?)`,
    ).bind(userId, today, today),

    env.DB.prepare(
      `INSERT OR IGNORE INTO errors(user_id, error_key, error_type, count)
       VALUES(?, 'は / が', '文法', 5)`,
    ).bind(userId),

    env.DB.prepare(
      `INSERT OR IGNORE INTO errors(user_id, error_key, error_type, count)
       VALUES(?, '過去形', '文法', 3)`,
    ).bind(userId),

    env.DB.prepare(
      `INSERT OR IGNORE INTO errors(user_id, error_key, error_type, count)
       VALUES(?, '聞き取り', '聴解', 2)`,
    ).bind(userId),

    env.DB.prepare(
      `INSERT OR REPLACE INTO activity(user_id, total_minutes, streak, days_json)
       VALUES(?, 186, 7, ?)`,
    ).bind(userId, JSON.stringify({ [today]: 12 })),
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

/** Trả toàn bộ state mà app.js cần sau khi login / refresh. */
export async function stateFor(env, userId) {
  const user = await env.DB.prepare(
    'SELECT id, name, email, created_at FROM users WHERE id = ?',
  )
    .bind(userId)
    .first();

  if (!user) throw new HttpError(401, 'ユーザーが見つかりません。');

  const [prefs, activity, dailyRows, deck, errors] = await Promise.all([
    env.DB.prepare('SELECT * FROM preferences WHERE user_id = ?').bind(userId).first(),
    env.DB.prepare('SELECT * FROM activity WHERE user_id = ?').bind(userId).first(),
    env.DB.prepare('SELECT study_date, tasks_json FROM daily WHERE user_id = ?').bind(userId).all(),
    vocabularyFor(env, userId),
    errorsFor(env, userId),
  ]);

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

/** Ghi một section state từ frontend vào D1. */
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
    if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(v.level)) {
      throw new HttpError(400, 'JLPTレベルを選択してください。');
    }

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
         onboarding_completed = MAX(preferences.onboarding_completed, excluded.onboarding_completed)`,
    )
      .bind(
        userId,
        v.level || 'N5',
        v.goal || 'JLPT',
        String(v.minutes || '20'),
        v.period || '夜',
        v.studyTime || '20:30',
        v.bioInterest === false ? 0 : 1,
        v.onboarding_completed === 1 ? 1 : 0,
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

  throw new HttpError(404, '不明なセクションです。');
}
