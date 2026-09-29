-- The customer's project tracker: a home project per signed introduction, and
-- its dated updates. Holds no money.


-- CreateTable
CREATE TABLE "home_projects" (
    "id" TEXT NOT NULL,
    "introductionId" TEXT NOT NULL,
    "startOn" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "doneStages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_project_updates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" TEXT,
    "note" TEXT NOT NULL,
    "postedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_project_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_projects_introductionId_key" ON "home_projects"("introductionId");

-- CreateIndex
CREATE INDEX "home_project_updates_projectId_createdAt_idx" ON "home_project_updates"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "home_projects" ADD CONSTRAINT "home_projects_introductionId_fkey" FOREIGN KEY ("introductionId") REFERENCES "introductions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_updates" ADD CONSTRAINT "home_project_updates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security: reached only through the server.
ALTER TABLE "home_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_projects" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_projects" FROM anon, authenticated;

ALTER TABLE "home_project_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_updates" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_updates" FROM anon, authenticated;
