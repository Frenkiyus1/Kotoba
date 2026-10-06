-- Existing learners already have a level; only new registrations need onboarding.
-- Run once, only on databases without this column. Registration explicitly inserts 0.
ALTER TABLE preferences ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 1;
