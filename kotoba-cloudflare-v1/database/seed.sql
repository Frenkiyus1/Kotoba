-- ============================================================
-- Demo data cho KOTOBA
-- Account: demo@kotoba.jp
-- Password: kotoba123
-- Có thể chạy lại file này an toàn (INSERT OR IGNORE / OR REPLACE).
-- ============================================================

INSERT OR IGNORE INTO users(name, email, password_hash, created_at)
VALUES(
  'Bao',
  'demo@kotoba.jp',
  'pbkdf2_sha256$100000$S09UT0JBX0RFTU9fU0FMVA$xbafQeSmjdNSK1FnVi7Z83r1Ga2HcTBuSSn1CsGbisU',
  CAST(strftime('%s', 'now') AS INTEGER)
);

INSERT OR REPLACE INTO preferences(user_id, level, goal, minutes, period, study_time, bio_interest)
SELECT id, 'N5', 'JLPT', '25', '夜', '20:30', 1
FROM users
WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO vocabulary
(user_id, term, reading, meaning, example, source, stage, interval_days, due, reviews, exposures, last_seen)
SELECT id, '学校', 'がっこう', 'trường học; nhà trường', '毎朝八時に学校へ行きます。',
       'N5', 0, 0, date('now'), 0, 1, date('now')
FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO vocabulary
(user_id, term, reading, meaning, example, source, stage, interval_days, due, reviews, exposures, last_seen)
SELECT id, '昨日', 'きのう', 'hôm qua', '昨日、図書館へ行きました。',
       'N5', 1, 1, date('now'), 1, 1, date('now')
FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO vocabulary
(user_id, term, reading, meaning, example, source, stage, interval_days, due, reviews, exposures, last_seen)
SELECT id, '友達', 'ともだち', 'bạn; bạn bè', '友達と一緒に昼ご飯を食べます。',
       'N5', 0, 0, date('now'), 0, 1, date('now')
FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO vocabulary
(user_id, term, reading, meaning, example, source, stage, interval_days, due, reviews, exposures, last_seen)
SELECT id, '細胞膜', 'さいぼうまく', 'màng tế bào', '細胞膜は細胞の内側と外側を分けています。',
       '生物', 2, 3, date('now'), 2, 1, date('now')
FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO errors(user_id, error_key, error_type, count)
SELECT id, 'は / が', '文法', 5 FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO errors(user_id, error_key, error_type, count)
SELECT id, '過去形', '文法', 3 FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR IGNORE INTO errors(user_id, error_key, error_type, count)
SELECT id, '聞き取り', '聴解', 2 FROM users WHERE email = 'demo@kotoba.jp';

INSERT OR REPLACE INTO activity(user_id, total_minutes, streak, days_json)
SELECT id, 186, 7, json_object(date('now'), 12)
FROM users
WHERE email = 'demo@kotoba.jp';
