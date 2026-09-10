-- Shareable read-only comparison.
--
-- `shareToken` is a bearer credential for a document containing someone's
-- budget, the area they live in, and how much they are about to spend. It is
-- deliberately nullable: a brief has no token until the customer asks for one,
-- and clearing the column revokes the link.
--
-- No RLS changes are needed or wanted here. `briefs` already has RLS enabled
-- and forced, with all privileges revoked from `anon` and `authenticated`, by
-- the 20260907180000_enable_rls_lockdown migration — every column added since
-- inherits that. The shared page reads through the server's own connection
-- after checking the token, which is the same path every other read takes.

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- CreateIndex
-- Unique, so a token collision is a database error rather than two briefs
-- quietly sharing a URL. Postgres already allows many NULLs in a unique index,
-- so unshared briefs cost nothing here.
--
-- Deliberately NOT a partial index on `shareToken IS NOT NULL`, which would be
-- slightly smaller: Prisma generates a plain unique index for `@unique`, and a
-- partial one would show up as schema drift on the next `migrate dev` and
-- invite someone to "fix" it under time pressure.
CREATE UNIQUE INDEX "briefs_shareToken_key" ON "briefs"("shareToken");
