-- Password sign-in for ops accounts.
--
-- The table is "users", not "User" -- every model in this schema carries an
-- @@map to snake_case. Columns are NOT mapped and stay camelCase, which is why
-- "passwordHash" is correct here while "User" would not be.
-- See tests/migration-names.test.ts, which checks this mechanically.
--
-- All four columns are nullable or defaulted, so every existing row is valid
-- the moment this runs and nobody's sign-in changes. A studio account simply
-- has passwordHash NULL forever, and modules/auth/password.ts refuses password
-- sign-in on role regardless of what the column holds.
--
-- No RLS work needed: users already carries policies from the lockdown
-- migration and they apply to new columns unchanged.
ALTER TABLE "users"
  ADD COLUMN "passwordHash"  TEXT,
  ADD COLUMN "passwordSetAt" TIMESTAMP(3),
  ADD COLUMN "failedSignIns" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedOutAt"   TIMESTAMP(3);
