-- Where the studio actually is, and what they sent us to prove it.
--
-- Two things the registration step asked for and had nowhere to put: a street
-- address, and the certificate a studio uploads to back its registration
-- claim.

-- ── Address ────────────────────────────────────────────────────────
--
-- `city` already exists with a default of 'pune' and is deliberately left
-- alone. These two are the parts that vary.
--
-- Nullable, because every studio on the roster predates this and none of them
-- has an address. A NOT NULL with a made-up default would put a fiction in the
-- column that verification reads, and ops cannot tell an invented default from
-- a real answer.
ALTER TABLE "studios" ADD COLUMN "addressLine" TEXT;

-- Six digits, stored as text. Never a number: an integer drops the leading
-- zero that half of India's pincodes start with, and nothing is ever computed
-- from one.
ALTER TABLE "studios" ADD COLUMN "pincode" TEXT;

-- ── Business proof ─────────────────────────────────────────────────
--
-- One row per file a studio sends to support its registration. A separate
-- table rather than a column on studios, because there is legitimately more
-- than one: a GST certificate AND a Udyam registration AND a shop licence is
-- a normal answer, and a single `proofUrl` would silently mean the last
-- upload erased the previous one.
CREATE TABLE "studio_documents" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,

    -- What the studio says it is. A claim, not a finding -- nobody has opened
    -- it yet at the moment this row is written.
    "kind" TEXT NOT NULL,

    -- Where the bytes are, and what the studio called the file. The original
    -- name is kept because it is often the only thing distinguishing two
    -- scans, and ops reads it before opening anything.
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,

    -- RECEIVED until a person looks. Deliberately not 'PENDING', which reads
    -- as a queue position; this says what happened, which is that we have it.
    "state" TEXT NOT NULL DEFAULT 'RECEIVED',

    -- What ops wants the studio to know -- why it was refused, what to send
    -- instead. Shown verbatim, so it is written for them and not for us.
    "note" TEXT,

    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "studio_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_documents_studioId_idx" ON "studio_documents" ("studioId");

-- The live set per studio, which is what every screen asks for. Partial on
-- the soft delete, following the house rule: a withdrawn upload stays for the
-- audit trail and must not count toward anything.
CREATE INDEX "studio_documents_studioId_state_idx"
  ON "studio_documents" ("studioId", "state")
  WHERE "deletedAt" IS NULL;

ALTER TABLE "studio_documents"
  ADD CONSTRAINT "studio_documents_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE. Removing an ops account must not delete the record
-- of what that person reviewed -- the review is a fact about the document,
-- not about the reviewer, and losing it would quietly reopen decisions that
-- were already made.
ALTER TABLE "studio_documents"
  ADD CONSTRAINT "studio_documents_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Lockdown ───────────────────────────────────────────────────────
--
-- Both halves are required and the second is the one that gets forgotten.
-- Supabase grants every new table to anon and authenticated automatically
-- through ALTER DEFAULT PRIVILEGES, so enabling row-level security on its own
-- leaves a table that is protected by policies nobody has written yet.
--
-- These rows are uploaded identity documents. There is no policy here at all,
-- deliberately: nothing reaches this table except through the server, which
-- connects as the owner and bypasses RLS.
ALTER TABLE "studio_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_documents" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON "studio_documents" FROM anon, authenticated;
