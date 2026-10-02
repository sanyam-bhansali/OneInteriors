-- Portfolio matching fields: carpet area, society, tags, a room per photo,
-- and style-picker consent. Columns on an existing table: no RLS change.

-- AlterTable
ALTER TABLE "portfolio_projects" ADD COLUMN     "carpetAreaSqft" INTEGER,
ADD COLUMN     "imageRooms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pickerConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "society" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
