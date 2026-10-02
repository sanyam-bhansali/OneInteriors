-- Studios whose own portfolio photo the customer picked in the style picker
-- (brief/picker-photos.ts). A column on an existing table: RLS unchanged.
ALTER TABLE "briefs" ADD COLUMN     "styleStudioPicks" TEXT[] DEFAULT ARRAY[]::TEXT[];
