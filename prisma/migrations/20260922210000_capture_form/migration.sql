-- A studio's public enquiry form.
--
-- No field schema, deliberately. A form builder is a second product, and
-- AxLeads' own known-gaps list shows where that road ends: its forms are
-- operator-managed because letting a client define fields meant an import
-- could reference a field that had been hidden, and "nothing about this is
-- recoverable without deleting the leads and starting again".
--
-- The questions are fixed in capture-fields.ts. What a studio controls is the
-- wording around them and whether the form is on at all.

CREATE TABLE "studio_forms" (
  "id"        TEXT NOT NULL,
  "studioId"  TEXT NOT NULL,
  -- Separate from the studio's own slug so the link can be rotated. The
  -- reason to rotate is that the old one is being abused, and rotating the
  -- studio slug would break its public profile too.
  "slug"      TEXT NOT NULL,
  "headline"  TEXT NOT NULL,
  "blurb"     TEXT NOT NULL,
  -- Off means the page explains itself rather than 404ing. A dead link
  -- somebody printed on a card is worse than a page that says why.
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "studio_forms_pkey" PRIMARY KEY ("id")
);

-- One per studio.
CREATE UNIQUE INDEX "studio_forms_studioId_key" ON "studio_forms" ("studioId");
-- The public lookup.
CREATE UNIQUE INDEX "studio_forms_slug_key" ON "studio_forms" ("slug");

ALTER TABLE "studio_forms"
  ADD CONSTRAINT "studio_forms_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, matching the lockdown migration's posture.
--
-- Note the shape here, because it is unusual for this table: the PAGE is
-- public, but the row is still only ever read through the server, which
-- connects as the owner and bypasses RLS. Nothing about "the form is public"
-- means the table should be readable by anon -- that would hand out every
-- studio's form slug and let somebody enumerate the roster.
ALTER TABLE "studio_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_forms" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON "studio_forms" FROM anon, authenticated;
