-- Studio workspace, Phases 2–5 foundation
-- (docs/studio-workspace/PHASES-2-5-FOUNDATION.md).
--
-- One migration for everything the four phases need, so none of them touches
-- the schema: the daily site log with photos, voice and crew (Phase 2); the
-- studio's working days, holidays and crew list; moved plan dates with their
-- reason (Phase 3); snag events, from which a snag's status is derived, and
-- who a snag is assigned to (Phase 4); decision options as rows, so the
-- studio's cost on an option can be kept back; payments received, confirmed
-- or disputed by the customer; recorded quote changes; and the append-only
-- project event log under all of it (Phase 5).
--
-- Expand-only: new enums, new tables, nullable or defaulted columns. Nothing
-- is dropped or renamed; `home_snags.status`, `home_decisions.options` /
-- `chosenIndex`, `decision_votes.optionIndex` and `home_projects.paidPhases`
-- stay and keep being written until every reader has moved. Safe to
-- `db:deploy`.
--
-- Backfills, at the end, each turning what is already there into the new
-- shape without changing what anybody sees today:
-- * decision options from the JSON into `home_decision_options` (mirroring
--   portal/decisions.ts `parseOptions`, so indexes line up), then the picked
--   option and each family vote by id, and one `home_quote_changes` row per
--   picked option;
-- * snag history: RAISED for every snag, ACCEPTED where a fix-by date was
--   set, FIXED where it was fixed, and AUTO_CLOSED where the fix is more
--   than the 7-day period old (owner, 11 Oct 2026);
-- * `home_project_payments` from the `paidPhases` marks, amount from the
--   signed stage, NOT confirmed by the customer (they never were asked).
-- `home_project_updates` is not migrated: several notes a day with no
-- reason or crew do not fit one site log per day. The customer keeps seeing
-- them beside the new site log. The event log starts empty.

-- CreateEnum
CREATE TYPE "SnagEventKind" AS ENUM ('RAISED', 'ACCEPTED', 'DISPUTED', 'FIXED', 'CONFIRMED', 'REOPENED', 'AUTO_CLOSED');

-- CreateEnum
CREATE TYPE "ProjectActorType" AS ENUM ('CUSTOMER', 'STUDIO', 'OPS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SiteLogKind" AS ENUM ('UPDATE', 'NOBODY', 'CORRECTION');

-- CreateEnum
CREATE TYPE "NobodyReason" AS ENUM ('WAITING_MATERIAL', 'WAITING_CUSTOMER_DECISION', 'CREW_ELSEWHERE', 'HOLIDAY', 'CUSTOMER_ASKED', 'OTHER');

-- CreateEnum
CREATE TYPE "DateChangeField" AS ENUM ('PLANNED_START', 'PLANNED_END', 'HANDOVER');

-- CreateEnum
CREATE TYPE "DelayReason" AS ENUM ('SUPPLIER', 'CUSTOMER_CHANGE', 'SITE_CONDITION', 'STUDIO', 'OTHER');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN "workingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[];

-- AlterTable
ALTER TABLE "home_checklist_items" ADD COLUMN "doneSiteLogId" TEXT;

-- AlterTable
ALTER TABLE "home_materials" ADD COLUMN "orderedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "home_decisions" ADD COLUMN "pickedOptionId" TEXT,
ADD COLUMN "quoteLineId" TEXT;

-- AlterTable
ALTER TABLE "decision_votes" ADD COLUMN "optionId" TEXT;

-- AlterTable
ALTER TABLE "home_snags" ADD COLUMN "assigneeId" TEXT;

-- CreateTable
CREATE TABLE "studio_crew_members" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_holidays" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_decision_options" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "photoPath" TEXT,
    "swatch" TEXT,
    "deltaPaise" BIGINT NOT NULL DEFAULT 0,
    "studioCostDeltaPaise" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_decision_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_snag_events" (
    "id" TEXT NOT NULL,
    "snagId" TEXT NOT NULL,
    "kind" "SnagEventKind" NOT NULL,
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "voicePath" TEXT,
    "transcript" TEXT,
    "transcriptLang" TEXT,
    "customerText" TEXT,
    "customerLang" TEXT,
    "note" TEXT,
    "internalNote" TEXT,
    "fixBy" TIMESTAMP(3),
    "assigneeId" TEXT,
    "actorType" "ProjectActorType" NOT NULL,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_snag_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_site_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "SiteLogKind" NOT NULL,
    "reason" "NobodyReason",
    "note" TEXT,
    "voicePath" TEXT,
    "transcript" TEXT,
    "transcriptLang" TEXT,
    "customerText" TEXT,
    "customerLang" TEXT,
    "stageId" TEXT,
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRef" TEXT,
    "correctsId" TEXT,

    CONSTRAINT "home_site_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_site_log_photos" (
    "id" TEXT NOT NULL,
    "siteLogId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "fromGallery" BOOLEAN NOT NULL DEFAULT false,
    "voicePath" TEXT,
    "transcript" TEXT,
    "transcriptLang" TEXT,
    "customerText" TEXT,
    "customerLang" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_site_log_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_site_log_crew" (
    "id" TEXT NOT NULL,
    "siteLogId" TEXT NOT NULL,
    "crewMemberId" TEXT,
    "crewName" TEXT NOT NULL,
    "crewRole" TEXT NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_site_log_crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_project_date_changes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "field" "DateChangeField" NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "reason" "DelayReason" NOT NULL,
    "decisionId" TEXT,
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_project_date_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_project_payments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "receivedOn" DATE NOT NULL,
    "mode" "PaymentMode",
    "receiptDocumentId" TEXT,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctsId" TEXT,
    "customerConfirmedAt" TIMESTAMP(3),
    "customerConfirmedById" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputedById" TEXT,
    "disputeNote" TEXT,

    CONSTRAINT "home_project_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_quote_changes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "decisionId" TEXT,
    "optionId" TEXT,
    "quoteLineId" TEXT,
    "label" TEXT NOT NULL,
    "deltaPaise" BIGINT NOT NULL,
    "stageIndex" INTEGER,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_quote_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_project_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ProjectActorType" NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT,

    CONSTRAINT "home_project_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_crew_members_studioId_active_idx" ON "studio_crew_members"("studioId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "studio_holidays_studioId_day_key" ON "studio_holidays"("studioId", "day");

-- CreateIndex
CREATE INDEX "home_decision_options_decisionId_sortOrder_idx" ON "home_decision_options"("decisionId", "sortOrder");

-- CreateIndex
CREATE INDEX "home_snag_events_snagId_at_idx" ON "home_snag_events"("snagId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "home_site_logs_clientRef_key" ON "home_site_logs"("clientRef");

-- CreateIndex
CREATE INDEX "home_site_logs_projectId_date_idx" ON "home_site_logs"("projectId", "date");

-- CreateIndex
CREATE INDEX "home_site_logs_stageId_idx" ON "home_site_logs"("stageId");

-- CreateIndex
CREATE INDEX "home_site_logs_correctsId_idx" ON "home_site_logs"("correctsId");

-- CreateIndex
CREATE INDEX "home_site_log_photos_siteLogId_sortOrder_idx" ON "home_site_log_photos"("siteLogId", "sortOrder");

-- CreateIndex
CREATE INDEX "home_site_log_crew_siteLogId_idx" ON "home_site_log_crew"("siteLogId");

-- CreateIndex
CREATE INDEX "home_site_log_crew_crewMemberId_idx" ON "home_site_log_crew"("crewMemberId");

-- CreateIndex
CREATE INDEX "home_project_date_changes_projectId_at_idx" ON "home_project_date_changes"("projectId", "at");

-- CreateIndex
CREATE INDEX "home_project_date_changes_stageId_idx" ON "home_project_date_changes"("stageId");

-- CreateIndex
CREATE INDEX "home_project_date_changes_decisionId_idx" ON "home_project_date_changes"("decisionId");

-- CreateIndex
CREATE INDEX "home_project_payments_projectId_stageIndex_idx" ON "home_project_payments"("projectId", "stageIndex");

-- CreateIndex
CREATE INDEX "home_project_payments_correctsId_idx" ON "home_project_payments"("correctsId");

-- CreateIndex
CREATE INDEX "home_project_payments_receiptDocumentId_idx" ON "home_project_payments"("receiptDocumentId");

-- CreateIndex
CREATE INDEX "home_quote_changes_projectId_at_idx" ON "home_quote_changes"("projectId", "at");

-- CreateIndex
CREATE INDEX "home_quote_changes_decisionId_idx" ON "home_quote_changes"("decisionId");

-- CreateIndex
CREATE INDEX "home_quote_changes_optionId_idx" ON "home_quote_changes"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "home_project_events_dedupeKey_key" ON "home_project_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "home_project_events_projectId_at_idx" ON "home_project_events"("projectId", "at");

-- CreateIndex
CREATE INDEX "home_project_events_type_at_idx" ON "home_project_events"("type", "at");

-- CreateIndex
CREATE INDEX "home_checklist_items_doneSiteLogId_idx" ON "home_checklist_items"("doneSiteLogId");

-- CreateIndex
CREATE INDEX "home_decisions_pickedOptionId_idx" ON "home_decisions"("pickedOptionId");

-- CreateIndex
CREATE INDEX "decision_votes_optionId_idx" ON "decision_votes"("optionId");

-- CreateIndex
CREATE INDEX "home_snags_assigneeId_idx" ON "home_snags"("assigneeId");

-- AddForeignKey
ALTER TABLE "studio_crew_members" ADD CONSTRAINT "studio_crew_members_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_holidays" ADD CONSTRAINT "studio_holidays_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_checklist_items" ADD CONSTRAINT "home_checklist_items_doneSiteLogId_fkey" FOREIGN KEY ("doneSiteLogId") REFERENCES "home_site_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_decisions" ADD CONSTRAINT "home_decisions_pickedOptionId_fkey" FOREIGN KEY ("pickedOptionId") REFERENCES "home_decision_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_decision_options" ADD CONSTRAINT "home_decision_options_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "home_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "home_decision_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_snags" ADD CONSTRAINT "home_snags_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_snag_events" ADD CONSTRAINT "home_snag_events_snagId_fkey" FOREIGN KEY ("snagId") REFERENCES "home_snags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_logs" ADD CONSTRAINT "home_site_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_logs" ADD CONSTRAINT "home_site_logs_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "home_project_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_logs" ADD CONSTRAINT "home_site_logs_correctsId_fkey" FOREIGN KEY ("correctsId") REFERENCES "home_site_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_log_photos" ADD CONSTRAINT "home_site_log_photos_siteLogId_fkey" FOREIGN KEY ("siteLogId") REFERENCES "home_site_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_log_crew" ADD CONSTRAINT "home_site_log_crew_siteLogId_fkey" FOREIGN KEY ("siteLogId") REFERENCES "home_site_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_site_log_crew" ADD CONSTRAINT "home_site_log_crew_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "studio_crew_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_date_changes" ADD CONSTRAINT "home_project_date_changes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_date_changes" ADD CONSTRAINT "home_project_date_changes_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "home_project_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_date_changes" ADD CONSTRAINT "home_project_date_changes_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "home_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_payments" ADD CONSTRAINT "home_project_payments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_payments" ADD CONSTRAINT "home_project_payments_receiptDocumentId_fkey" FOREIGN KEY ("receiptDocumentId") REFERENCES "home_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_payments" ADD CONSTRAINT "home_project_payments_correctsId_fkey" FOREIGN KEY ("correctsId") REFERENCES "home_project_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_quote_changes" ADD CONSTRAINT "home_quote_changes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_quote_changes" ADD CONSTRAINT "home_quote_changes_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "home_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_quote_changes" ADD CONSTRAINT "home_quote_changes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "home_decision_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_events" ADD CONSTRAINT "home_project_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One UPDATE or NOBODY per project per IST day; corrections are unlimited.
-- Raw SQL because Prisma cannot express a partial index (the schema carries
-- the plain (projectId, date) index beside it).
CREATE UNIQUE INDEX "home_site_logs_one_per_day_key"
  ON "home_site_logs"("projectId", "date")
  WHERE "kind" IN ('UPDATE', 'NOBODY');

-- A NOBODY says why; an UPDATE has no "why nobody" reason.
ALTER TABLE "home_site_logs" ADD CONSTRAINT "home_site_logs_reason_check"
  CHECK (("kind" <> 'NOBODY' OR "reason" IS NOT NULL) AND ("kind" <> 'UPDATE' OR "reason" IS NULL));

-- Money is never negative on a receipt, and a stage index is an index.
ALTER TABLE "home_project_payments" ADD CONSTRAINT "home_project_payments_amount_check"
  CHECK ("amountPaise" >= 0 AND "stageIndex" >= 0);

-- Working days are ISO weekdays.
ALTER TABLE "studios" ADD CONSTRAINT "studios_workingDays_check"
  CHECK ("workingDays" IS NULL OR "workingDays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[]);

-- ── Backfill: decision options as rows ─────────────────────────────
-- portal/decisions.ts parseOptions: the first six items; an item counts only
-- if it is an object with a non-empty string name; at least two must count
-- or the decision shows no options. Positions among the counted items are
-- what `chosenIndex` and `optionIndex` point at.
WITH raw AS (
  SELECT d."id" AS "decisionId", e.item, e.ord
  FROM "home_decisions" d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d."options") = 'array' THEN d."options" ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS e(item, ord)
  WHERE e.ord <= 6
),
named AS (
  SELECT r.*,
         CASE WHEN jsonb_typeof(r.item) = 'object' AND jsonb_typeof(r.item -> 'name') = 'string'
              THEN left(regexp_replace(btrim(r.item ->> 'name'), '\s+', ' ', 'g'), 60) END AS label
  FROM raw r
),
kept AS (
  SELECT n.*,
         (row_number() OVER (PARTITION BY n."decisionId" ORDER BY n.ord) - 1)::INTEGER AS position,
         count(*) OVER (PARTITION BY n."decisionId") AS usable
  FROM named n
  WHERE n.label IS NOT NULL AND n.label <> ''
)
INSERT INTO "home_decision_options"
  ("id", "decisionId", "sortOrder", "label", "detail", "swatch", "deltaPaise", "createdAt")
SELECT
  'hdo_' || md5(k."decisionId" || ':' || k.position),
  k."decisionId",
  k.position,
  k.label,
  NULLIF(left(regexp_replace(btrim(CASE WHEN jsonb_typeof(k.item -> 'note') = 'string' THEN k.item ->> 'note' ELSE '' END), '\s+', ' ', 'g'), 120), ''),
  CASE WHEN jsonb_typeof(k.item -> 'swatch') = 'string' AND (k.item ->> 'swatch') ~* '^#[0-9a-f]{6}$'
       THEN lower(k.item ->> 'swatch') END,
  CASE WHEN jsonb_typeof(k.item -> 'extraPaise') = 'number'
       THEN LEAST(GREATEST(round((k.item ->> 'extraPaise')::NUMERIC), 0), 10000000000)::BIGINT
       ELSE 0 END,
  CURRENT_TIMESTAMP
FROM kept k
WHERE k.usable >= 2;

UPDATE "home_decisions" d
SET "pickedOptionId" = o."id"
FROM "home_decision_options" o
WHERE o."decisionId" = d."id" AND d."chosenIndex" IS NOT NULL AND o."sortOrder" = d."chosenIndex";

UPDATE "decision_votes" v
SET "optionId" = o."id"
FROM "home_decision_options" o
WHERE o."decisionId" = v."decisionId" AND o."sortOrder" = v."optionIndex";

-- Each option picked so far is a recorded change on the quote, landing on
-- the last payment stage as signed (null when nothing was signed).
INSERT INTO "home_quote_changes"
  ("id", "projectId", "decisionId", "optionId", "label", "deltaPaise", "stageIndex", "byId", "at")
SELECT
  'hqc_' || md5(d."id" || ':' || o."id"),
  d."projectId",
  d."id",
  o."id",
  d."title" || ': ' || o."label",
  o."deltaPaise",
  CASE WHEN jsonb_typeof(p."paymentPhases") = 'array' AND jsonb_array_length(p."paymentPhases") > 0
       THEN jsonb_array_length(p."paymentPhases") - 1 END,
  d."chosenById",
  COALESCE(d."chosenAt", d."updatedAt")
FROM "home_decisions" d
JOIN "home_decision_options" o ON o."id" = d."pickedOptionId"
JOIN "home_projects" p ON p."id" = d."projectId";

-- ── Backfill: snag history ─────────────────────────────────────────
-- Who raised it: the studio when the snag says so; else the customer when
-- it was the brief's owner; else ops (raised on the customer's behalf).
INSERT INTO "home_snag_events" ("id", "snagId", "kind", "photoPaths", "actorType", "byId", "at")
SELECT
  'hse_' || md5(s."id" || ':raised'),
  s."id",
  'RAISED'::"SnagEventKind",
  s."photoPaths",
  CASE WHEN s."raisedByStudio" THEN 'STUDIO'::"ProjectActorType"
       WHEN s."raisedById" = b."userId" THEN 'CUSTOMER'::"ProjectActorType"
       ELSE 'OPS'::"ProjectActorType" END,
  s."raisedById",
  s."createdAt"
FROM "home_snags" s
JOIN "home_projects" p ON p."id" = s."projectId"
JOIN "introductions" i ON i."id" = p."introductionId"
JOIN "briefs" b ON b."id" = i."briefId";

-- A fix-by date was the studio taking the snag on. When is not recorded, so
-- it is placed a millisecond after it was raised, to keep the order.
INSERT INTO "home_snag_events" ("id", "snagId", "kind", "fixBy", "actorType", "at")
SELECT 'hse_' || md5(s."id" || ':accepted'), s."id", 'ACCEPTED'::"SnagEventKind", s."fixBy",
       'STUDIO'::"ProjectActorType", s."createdAt" + INTERVAL '1 millisecond'
FROM "home_snags" s
WHERE s."fixBy" IS NOT NULL;

INSERT INTO "home_snag_events" ("id", "snagId", "kind", "photoPaths", "customerText", "actorType", "at")
SELECT 'hse_' || md5(s."id" || ':fixed'), s."id", 'FIXED'::"SnagEventKind", s."fixedPhotoPaths", s."fixedNote",
       'STUDIO'::"ProjectActorType", GREATEST(COALESCE(s."fixedAt", s."updatedAt"), s."createdAt" + INTERVAL '2 milliseconds')
FROM "home_snags" s
WHERE s."status" = 'FIXED';

-- Fixed more than 7 days ago with no "not fixed" from the customer: closed
-- by the 7-day rule, as Phase 4's job would have done.
INSERT INTO "home_snag_events" ("id", "snagId", "kind", "actorType", "at")
SELECT 'hse_' || md5(s."id" || ':auto_closed'), s."id", 'AUTO_CLOSED'::"SnagEventKind", 'SYSTEM'::"ProjectActorType",
       GREATEST(COALESCE(s."fixedAt", s."updatedAt"), s."createdAt" + INTERVAL '2 milliseconds') + INTERVAL '7 days'
FROM "home_snags" s
WHERE s."status" = 'FIXED'
  AND GREATEST(COALESCE(s."fixedAt", s."updatedAt"), s."createdAt" + INTERVAL '2 milliseconds') + INTERVAL '7 days' < CURRENT_TIMESTAMP;

-- ── Backfill: payments from the paidPhases marks ───────────────────
-- One row per stage marked paid, for the amount signed for that stage.
-- Mode unknown (null); not confirmed by the customer, who was never asked.
-- `recordedById` names the source, not a person.
WITH marks AS (
  SELECT p."id" AS "projectId", p."paymentPhases" AS phases, m.mark
  FROM "home_projects" p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p."paidPhases") = 'array' THEN p."paidPhases" ELSE '[]'::jsonb END
  ) AS m(mark)
  WHERE jsonb_typeof(p."paymentPhases") = 'array'
),
usable AS (
  SELECT k."projectId", k.phases,
         CASE WHEN jsonb_typeof(k.mark) = 'object' AND (k.mark ->> 'index') ~ '^[0-9]{1,3}$'
              THEN (k.mark ->> 'index')::INTEGER END AS idx,
         CASE WHEN jsonb_typeof(k.mark) = 'object' AND (k.mark ->> 'paidOn') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              THEN k.mark ->> 'paidOn' END AS "paidOn"
  FROM marks k
),
priced AS (
  SELECT u.*,
         CASE WHEN u.idx IS NOT NULL AND jsonb_typeof(u.phases -> u.idx -> 'amountPaise') = 'number'
              THEN round((u.phases -> u.idx ->> 'amountPaise')::NUMERIC)::BIGINT END AS amount
  FROM usable u
)
INSERT INTO "home_project_payments"
  ("id", "projectId", "stageIndex", "amountPaise", "receivedOn", "recordedById", "recordedAt")
SELECT DISTINCT ON (x."projectId", x.idx)
  'hpp_' || md5(x."projectId" || ':' || x.idx),
  x."projectId",
  x.idx,
  x.amount,
  x."paidOn"::DATE,
  'backfill:paidPhases',
  CURRENT_TIMESTAMP
FROM priced x
WHERE x.idx IS NOT NULL AND x."paidOn" IS NOT NULL AND x.amount IS NOT NULL AND x.amount >= 0
ORDER BY x."projectId", x.idx;

-- ── Row-level security, as on every table: reached only through the server.
ALTER TABLE "studio_crew_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_crew_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_crew_members" FROM anon, authenticated;

ALTER TABLE "studio_holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_holidays" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_holidays" FROM anon, authenticated;

ALTER TABLE "home_decision_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_decision_options" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_decision_options" FROM anon, authenticated;

ALTER TABLE "home_snag_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_snag_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_snag_events" FROM anon, authenticated;

ALTER TABLE "home_site_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_site_logs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_site_logs" FROM anon, authenticated;

ALTER TABLE "home_site_log_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_site_log_photos" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_site_log_photos" FROM anon, authenticated;

ALTER TABLE "home_site_log_crew" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_site_log_crew" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_site_log_crew" FROM anon, authenticated;

ALTER TABLE "home_project_date_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_date_changes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_date_changes" FROM anon, authenticated;

ALTER TABLE "home_project_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_payments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_payments" FROM anon, authenticated;

ALTER TABLE "home_quote_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_quote_changes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_quote_changes" FROM anon, authenticated;

ALTER TABLE "home_project_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_events" FROM anon, authenticated;
