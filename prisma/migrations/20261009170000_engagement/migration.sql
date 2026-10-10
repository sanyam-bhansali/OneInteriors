-- v79 engagement (9 Oct 2026): Home Coins, family and votes, dream board, weekly challenge.
-- New tables only; nothing existing changes.
-- CreateTable
CREATE TABLE "coin_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "ref" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "phone" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "userId" TEXT,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_votes" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_pins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoPath" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dream_pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_challenges" (
    "id" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "photoPath" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "radius" DOUBLE PRECISION NOT NULL,
    "answer" TEXT NOT NULL,
    "explain" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_answers" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_entries_userId_createdAt_idx" ON "coin_entries"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "coin_entries_userId_kind_ref_key" ON "coin_entries"("userId", "kind", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_inviteToken_key" ON "family_members"("inviteToken");

-- CreateIndex
CREATE INDEX "family_members_userId_idx" ON "family_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_projectId_phone_key" ON "family_members"("projectId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "decision_votes_decisionId_userId_key" ON "decision_votes"("decisionId", "userId");

-- CreateIndex
CREATE INDEX "dream_pins_userId_createdAt_idx" ON "dream_pins"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_challenges_weekOf_key" ON "weekly_challenges"("weekOf");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_answers_challengeId_userId_key" ON "challenge_answers"("challengeId", "userId");

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "home_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_answers" ADD CONSTRAINT "challenge_answers_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "weekly_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, as on every table: reached only through the server.
ALTER TABLE "coin_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coin_entries" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "coin_entries" FROM anon, authenticated;
ALTER TABLE "family_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "family_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "family_members" FROM anon, authenticated;
ALTER TABLE "decision_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decision_votes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "decision_votes" FROM anon, authenticated;
ALTER TABLE "dream_pins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dream_pins" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "dream_pins" FROM anon, authenticated;
ALTER TABLE "weekly_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weekly_challenges" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "weekly_challenges" FROM anon, authenticated;
ALTER TABLE "challenge_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_answers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "challenge_answers" FROM anon, authenticated;
