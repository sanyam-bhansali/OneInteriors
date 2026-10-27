-- Password sign-in for studio staff (owner, 27 Oct 2026; auth/studio-password.ts):
-- mobile number + password until WhatsApp codes are live. The owner makes a
-- one-time password for each person in Settings, Team; they choose their own
-- at first sign-in.
--
-- Expand only: one column with a default. "users" is already under RLS.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordTemporary" BOOLEAN NOT NULL DEFAULT false;
