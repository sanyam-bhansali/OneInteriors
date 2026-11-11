-- Item pages (owner, 10 Nov 2026): every quotation line carries a photo, and
-- every item has its own public page at /items/<slug>.
--
-- Expand only: one new table and one nullable column, no data changed.
-- item_pages: our shared list of items (no studio names or rates), with photos.
-- studio_products.itemId: which item a studio's product is.

CREATE TABLE "item_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whatItDoes" TEXT NOT NULL,
    "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "finishes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "typicalSize" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "catalogueCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "translations" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_pages_slug_key" ON "item_pages"("slug");
CREATE INDEX "item_pages_published_sortOrder_idx" ON "item_pages"("published", "sortOrder");

ALTER TABLE "studio_products" ADD COLUMN "itemId" TEXT;
CREATE INDEX "studio_products_itemId_idx" ON "studio_products"("itemId");
ALTER TABLE "studio_products" ADD CONSTRAINT "studio_products_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles. The app
-- reads through Prisma on the server only.
ALTER TABLE "item_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_pages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "item_pages" FROM anon, authenticated;
