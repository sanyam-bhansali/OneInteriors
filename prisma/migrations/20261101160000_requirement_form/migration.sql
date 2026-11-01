-- The client's requirement form (walkthrough, 27 Oct 2026; owner, 1 Nov
-- 2026): Hauspire's pre-design client input and commitment form, filled in
-- the app instead of a Google Form.
--
-- Expand only: one new table, closed to the anon and authenticated roles.

-- CreateTable
CREATE TABLE "home_requirement_forms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "sentById" TEXT NOT NULL,
    "answers" JSONB,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_requirement_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_requirement_forms_projectId_key" ON "home_requirement_forms"("projectId");

-- CreateIndex
CREATE INDEX "home_requirement_forms_studioId_idx" ON "home_requirement_forms"("studioId");

-- AddForeignKey
ALTER TABLE "home_requirement_forms" ADD CONSTRAINT "home_requirement_forms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_requirement_forms" ADD CONSTRAINT "home_requirement_forms_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "home_requirement_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_requirement_forms" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_requirement_forms" FROM anon, authenticated;
