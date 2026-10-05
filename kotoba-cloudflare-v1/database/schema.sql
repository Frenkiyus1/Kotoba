-- ============================================================
-- KOTOBA / Cloudflare D1 schema
-- Chạy 1 lần khi tạo database:
-- npx wrangler d1 execute kotoba-db --remote --file=./database/schema.sql
-- ============================================================

PRAGMA foreign_keys = ON;

-- Tài khoản người học.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

-- Bearer session. Token được tạo ngẫu nhiên sau login/register.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Thiết lập onboarding / thói quen học.
CREATE TABLE IF NOT EXISTS preferences (
  user_id      INTEGER PRIMARY KEY,
  level        TEXT NOT NULL DEFAULT 'N5',
  goal         TEXT NOT NULL DEFAULT 'JLPT',
  minutes      TEXT NOT NULL DEFAULT '20',
  period       TEXT NOT NULL DEFAULT '夜',
  study_time   TEXT NOT NULL DEFAULT '20:30',
  bio_interest INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Từ vựng + contextual flashcard + SRS.
CREATE TABLE IF NOT EXISTS vocabulary (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  term          TEXT NOT NULL,
  reading       TEXT DEFAULT '',
  meaning       TEXT DEFAULT '',
  example       TEXT DEFAULT '',
  source        TEXT DEFAULT '学習',
  stage         INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  due           TEXT NOT NULL,
  reviews       INTEGER NOT NULL DEFAULT 0,
  exposures     INTEGER NOT NULL DEFAULT 1,
  last_seen     TEXT,
  UNIQUE(user_id, term),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- "Trí nhớ lỗi" dùng để tạo bài cá nhân hóa.
CREATE TABLE IF NOT EXISTS errors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  error_key  TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT '文法',
  count      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, error_key, error_type),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Checklist Kaizen mỗi ngày.
CREATE TABLE IF NOT EXISTS daily (
  user_id    INTEGER NOT NULL,
  study_date TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  PRIMARY KEY(user_id, study_date),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Streak + số phút học.
CREATE TABLE IF NOT EXISTS activity (
  user_id       INTEGER PRIMARY KEY,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  days_json     TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
