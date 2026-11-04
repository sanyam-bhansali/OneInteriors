-- Design DNA room mock-ups and the customer's yes / no on each (owner, 4 Nov 2026).
CREATE TABLE "design_mockups" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "variant" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "blend" TEXT,
    "light" TEXT NOT NULL,
    "density" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "verdict" TEXT,
    "reason" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_mockups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "design_mockups_briefId_createdAt_idx" ON "design_mockups"("briefId", "createdAt");

ALTER TABLE "design_mockups" ADD CONSTRAINT "design_mockups_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "design_mockups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "design_mockups" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "design_mockups" FROM anon, authenticated;
