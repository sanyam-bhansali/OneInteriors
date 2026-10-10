-- CreateTable
CREATE TABLE "home_decisions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "options" JSONB NOT NULL,
    "chosenIndex" INTEGER,
    "chosenAt" TIMESTAMP(3),
    "chosenById" TEXT,
    "postedById" TEXT NOT NULL,
    "byStudio" BOOLEAN NOT NULL DEFAULT false,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_snags" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "room" TEXT,
    "note" TEXT,
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raisedById" TEXT NOT NULL,
    "raisedByStudio" BOOLEAN NOT NULL DEFAULT false,
    "fixBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fixedAt" TIMESTAMP(3),
    "fixedNote" TEXT,
    "fixedPhotoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_snags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_decisions_projectId_dueOn_idx" ON "home_decisions"("projectId", "dueOn");

-- CreateIndex
CREATE INDEX "home_snags_projectId_status_idx" ON "home_snags"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_userId_idx" ON "push_devices"("userId");

-- AddForeignKey
ALTER TABLE "home_decisions" ADD CONSTRAINT "home_decisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_snags" ADD CONSTRAINT "home_snags_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, as on every table: the app reaches Postgres as the
-- table owner through Prisma, and nothing reaches these through Supabase's
-- public API.
ALTER TABLE "home_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_decisions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_decisions" FROM anon, authenticated;

ALTER TABLE "home_snags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_snags" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_snags" FROM anon, authenticated;

ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_devices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "push_devices" FROM anon, authenticated;
