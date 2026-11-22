-- The electrical bill (owner, 22 Nov 2026): a change order of its own kind, priced from an electrical rate list.
ALTER TABLE "home_change_orders" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'EXTRA';
ALTER TABLE "home_change_order_lines" ADD COLUMN "note" TEXT;
ALTER TABLE "home_change_order_lines" ADD COLUMN "unitLabel" TEXT;

CREATE TABLE "studio_electrical_items" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "details" TEXT,
    "ratePaise" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "studio_electrical_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "studio_electrical_items_studioId_name_key" ON "studio_electrical_items"("studioId", "name");
CREATE INDEX "studio_electrical_items_studioId_isActive_idx" ON "studio_electrical_items"("studioId", "isActive");

-- Row level security: closed to the anon and authenticated roles (the app reaches them through the server only).
ALTER TABLE "studio_electrical_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_electrical_items" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_electrical_items" FROM anon, authenticated;
