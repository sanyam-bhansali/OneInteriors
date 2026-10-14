-- Customer milestones (owner, 12 Oct 2026; docs/studio-os/CUSTOMER-MILESTONES.md):
-- the customer's tracker shows each stage (name, status, % done, planned end)
-- and only the 2–3 steps the studio STARRED in it. Every other step is the
-- studio's own. Percentages still count every in-scope step.
--
-- * `home_checklist_items.customerMilestone`: the star. False by default, so
--   a step nobody starred never reaches the customer.
-- * Backfill: existing projects get the template's default stars, matched by
--   stage kind and step name (project/step-template.ts `milestone`,
--   studio-design/template.ts `milestone`). A renamed or added step stays
--   unstarred; the studio stars it on the Plan or Design tab.
--
-- Expand-only: one defaulted column and a data backfill of it. Nothing is
-- dropped or renamed. No new table, so no new row-level security:
-- `home_checklist_items` has had it since 20261011140000. Not applied to
-- production by this change.

-- AlterTable
ALTER TABLE "home_checklist_items" ADD COLUMN "customerMilestone" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the default stars, by stage kind and step name.
UPDATE "home_checklist_items" AS i
SET "customerMilestone" = true
FROM "home_project_stages" AS s
WHERE i."stageId" = s."id"
  AND (s."kind"::text, i."label") IN (
    -- Design: the studio's design steps (Hauspire's), and the one step of a plan made before them.
    ('DESIGN', 'Site visit and measurement'),
    ('DESIGN', 'First 3D and renders'),
    ('DESIGN', 'Design closure'),
    ('DESIGN', 'Final design and drawings signed off'),
    -- POP, civil and electricals
    ('CIVIL', 'POP, civil, fabrication and electrical work started'),
    ('CIVIL', 'POP sheets'),
    -- Carpentry
    ('CARPENTRY', 'Materials delivered from the factory'),
    ('CARPENTRY', 'Carcass complete with hardware'),
    ('CARPENTRY', 'Shutters delivered'),
    -- Finishing
    ('FINISH', 'Painting started'),
    ('FINISH', 'Painting complete'),
    -- Handover
    ('HANDOVER', 'Snags listed'),
    ('HANDOVER', 'Handover')
  );
