-- A studio's own past quotations, so their rate card can be derived rather
-- than typed from memory.
--
-- Tables are snake_case because every model in this schema carries an @@map;
-- columns are NOT mapped and stay camelCase. See tests/migration-names.test.ts,
-- which checks this mechanically.
--
-- Two tables, not one. A studio sends a batch and may send another later, and
-- each batch is reviewed as a unit -- so the archive holds the state and the
-- verdict, and the files hang off it. Merging them would make "this batch was
-- rejected" a fact repeated once per file, with nothing stopping the copies
-- disagreeing.
--
-- `quotationCount` is on the archive rather than derived from the file count
-- on purpose: one workbook can hold two hundred quotations and one PDF can
-- hold a single one. Only a person who has opened them knows.
CREATE TYPE "ArchiveState" AS ENUM ('RECEIVED', 'READING', 'FILED', 'REJECTED');

CREATE TABLE "quotation_archives" (
  "id"             TEXT NOT NULL,
  "studioId"       TEXT NOT NULL,
  "state"          "ArchiveState" NOT NULL DEFAULT 'RECEIVED',
  "quotationCount" INTEGER,
  "note"           TEXT,
  "report"         JSONB,
  "uploadedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"     TIMESTAMP(3),
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "quotation_archives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quotation_files" (
  "id"          TEXT NOT NULL,
  "archiveId"   TEXT NOT NULL,
  "path"        TEXT NOT NULL,
  "filename"    TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "bytes"       INTEGER NOT NULL,
  "uploadedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quotation_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quotation_archives_studioId_uploadedAt_idx"
  ON "quotation_archives" ("studioId", "uploadedAt");
CREATE INDEX "quotation_archives_state_idx" ON "quotation_archives" ("state");
CREATE INDEX "quotation_files_archiveId_idx" ON "quotation_files" ("archiveId");

-- Cascade on both. A deleted studio should not leave its commercial pricing
-- behind in the database, and an archive without its file list is unreadable.
-- Note this does NOT remove the objects from the storage bucket -- see the
-- note in modules/storage/quotation-archive.ts about why that is a separate
-- job rather than something a foreign key can do.
ALTER TABLE "quotation_archives"
  ADD CONSTRAINT "quotation_archives_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotation_files"
  ADD CONSTRAINT "quotation_files_archiveId_fkey"
  FOREIGN KEY ("archiveId") REFERENCES "quotation_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, matching the lockdown migration's posture: the tables are
-- reachable only through the server, which connects as the owner and bypasses
-- RLS. Enabling it with no permissive policy means a leaked anon or
-- authenticated key reads nothing from here -- and what is here is every
-- studio's confidential pricing, which is the most commercially sensitive data
-- we hold.
ALTER TABLE "quotation_archives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotation_archives" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quotation_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotation_files" FORCE ROW LEVEL SECURITY;

-- The REVOKE is not belt-and-braces on top of RLS, it is the other half.
--
-- Supabase sets ALTER DEFAULT PRIVILEGES on the public schema, so a table
-- created after the lockdown migration arrives with anon and authenticated
-- already granted -- and that lockdown was a one-time sweep of the tables that
-- existed in September, so it does nothing for these two. RLS with no
-- permissive policy stops the rows being read; this stops the grant existing
-- in the first place, which is what a future migration adding a policy would
-- otherwise quietly open.
--
-- tests/security-invariants.test.ts is what caught this missing, which is
-- precisely what that test was written for.
REVOKE ALL ON "quotation_archives" FROM anon, authenticated;
REVOKE ALL ON "quotation_files" FROM anon, authenticated;
