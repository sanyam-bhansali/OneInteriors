-- Sales roles and teams (owner, 22 Oct 2026; docs/studio-os/SALES-ROLES.md):
-- editable sales roles with a reach per lead permission (own / team / all),
-- a reporting tree (a person's team is everyone below them), team pools, and
-- "New leads go to: a team's pool".
-- Expand only: one enum value, one new table, three nullable columns, indexes
-- and foreign keys. Nothing dropped or renamed. The data step creates the
-- three built-in roles for every studio and puts every existing SALES member
-- on "Sales rep" (reporting to the owner), which is exactly the Phase 1
-- salesperson: their own leads, and claims from the studio pool.
--
-- studio_sales_roles: one row per role. permissions is JSON
-- { "<key>": "own" | "team" | "all" | true }, read only through
-- studio/sales-permissions.ts readSalesPermissions (unknown keys or reaches
-- grant nothing). system = ADMIN | HEAD | REP marks the built-ins (renamable,
-- never deleted); unique (studioId, name) and (studioId, system).
--
-- studio_members.salesRoleId: SetNull. Null on a SALES member keeps Phase 1.
-- studio_members.reportsToId: self FK, SetNull (null = reports to the owner).
-- Same studio and no loops are checked by the app on every write.
--
-- studio_clients.poolTeamId: the head whose team pool an unassigned lead sits
-- in; null = the studio pool. SetNull: a head who leaves drops their pool's
-- leads into the studio pool. A plain index (studioId, poolTeamId): Prisma's
-- schema cannot express the partial WHERE "assignedToId" IS NULL one.
--
-- LeadRouteMode gains TEAM: the head is the existing member column
-- (studios.leadRouteMemberId / studio_lead_connections.routeMemberId).
-- ADD VALUE is not used by anything else in this migration.
--
-- RLS on, no policies, privileges revoked on the new table: reached only
-- through Prisma on the server, like every studio table.

-- AlterEnum
ALTER TYPE "LeadRouteMode" ADD VALUE 'TEAM';

-- AlterTable
ALTER TABLE "studio_members" ADD COLUMN     "reportsToId" TEXT,
ADD COLUMN     "salesRoleId" TEXT;

-- AlterTable
ALTER TABLE "studio_clients" ADD COLUMN     "poolTeamId" TEXT;

-- CreateTable
CREATE TABLE "studio_sales_roles" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "system" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_sales_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_sales_roles_studioId_sortOrder_idx" ON "studio_sales_roles"("studioId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "studio_sales_roles_studioId_name_key" ON "studio_sales_roles"("studioId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "studio_sales_roles_studioId_system_key" ON "studio_sales_roles"("studioId", "system");

-- CreateIndex
CREATE INDEX "studio_members_salesRoleId_idx" ON "studio_members"("salesRoleId");

-- CreateIndex
CREATE INDEX "studio_members_reportsToId_idx" ON "studio_members"("reportsToId");

-- CreateIndex
CREATE INDEX "studio_clients_studioId_poolTeamId_idx" ON "studio_clients"("studioId", "poolTeamId");

-- AddForeignKey
ALTER TABLE "studio_members" ADD CONSTRAINT "studio_members_salesRoleId_fkey" FOREIGN KEY ("salesRoleId") REFERENCES "studio_sales_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_members" ADD CONSTRAINT "studio_members_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_sales_roles" ADD CONSTRAINT "studio_sales_roles_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_clients" ADD CONSTRAINT "studio_clients_poolTeamId_fkey" FOREIGN KEY ("poolTeamId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data: the three built-in roles for every studio. The permission sets are
-- studio/sales-permissions.ts BUILT_IN_SALES_ROLES, word for word
-- (tests/studio-sales-permissions.test.ts reads this file and checks).
INSERT INTO "studio_sales_roles" ("id", "studioId", "name", "description", "permissions", "system", "sortOrder", "createdAt", "updatedAt")
SELECT
    'ssr_' || substr(md5(s."id" || ':' || b.system), 1, 24),
    s."id",
    b.name,
    b.description,
    b.permissions::jsonb,
    b.system,
    b.sort_order,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "studios" s
CROSS JOIN (
    VALUES
        ('ADMIN', 'Admin', 'Runs the whole sales side: every lead, every pool, the numbers, lead settings and the sales team.', 0,
         '{"leads.view":"all","leads.edit":"all","leads.add":true,"leads.merge":true,"leads.delete":true,"leads.import":true,"leads.bulk":"all","leads.pool":"all","leads.assign":"all","calls.log":"all","quotes.write":"all","quotes.salesFinal":"all","quotes.build":true,"analytics.view":"all","settings.leads":true,"team.manageSales":true}'),
        ('HEAD', 'Sales head', 'Runs a team: sees and works the leads of everyone below them, hands out their team pool, sees their team’s numbers.', 1,
         '{"leads.view":"team","leads.edit":"team","leads.add":true,"leads.bulk":"team","leads.pool":"team","leads.assign":"team","calls.log":"team","quotes.write":"team","quotes.salesFinal":"team","quotes.build":true,"analytics.view":"team"}'),
        ('REP', 'Sales rep', 'Works their own leads: calls, floor plans, quotations, the sales final. Claims leads from their team’s pool.', 2,
         '{"leads.view":"own","leads.edit":"own","leads.add":true,"leads.bulk":"own","leads.pool":"team","calls.log":"own","quotes.write":"own","quotes.salesFinal":"own"}')
) AS b(system, name, description, sort_order, permissions)
ON CONFLICT DO NOTHING;

-- Data: every existing salesperson is a Sales rep reporting to the owner
-- (reportsToId stays null). Owners need no sales role: an owner may do
-- everything, as before. Other roles are untouched.
UPDATE "studio_members" m
SET "salesRoleId" = r."id"
FROM "studio_sales_roles" r
WHERE r."studioId" = m."studioId"
  AND r."system" = 'REP'
  AND m."role" = 'SALES'
  AND m."salesRoleId" IS NULL;


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_sales_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_sales_roles" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_sales_roles" FROM anon, authenticated;
