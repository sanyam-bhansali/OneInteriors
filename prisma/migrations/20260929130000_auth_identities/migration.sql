-- Social sign-in: which provider identity belongs to which user.
--
-- Google since 29 Sep 2026; Apple and Facebook will use the same table. Found
-- by (provider, subject), never by email — emails change and get recycled, a
-- provider's subject does not. Social sign-in only ever creates or reaches
-- CUSTOMER accounts (modules/auth/oauth-google.ts).
--
-- Generated offline with `prisma migrate diff`, plus the RLS block every
-- table-creating migration carries (tests/security-invariants.test.ts).

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'FACEBOOK');

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_subject_key" ON "auth_identities"("provider", "subject");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, matching the lockdown migration's posture. The table
-- links people to their Google accounts and is reached only through the
-- server, which connects as `postgres` and bypasses RLS.
ALTER TABLE "auth_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_identities" FORCE ROW LEVEL SECURITY;

-- The other half: Supabase's default privileges grant anon and authenticated
-- on tables created after the September sweep. This stops the grant existing.
REVOKE ALL ON "auth_identities" FROM anon, authenticated;
