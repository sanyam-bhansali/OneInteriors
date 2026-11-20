-- After the handover (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md):
-- warranty claims decided against coverage rules kept as data, and paid
-- service visits with a fixed visiting charge per category.
-- Additive only: new columns with defaults, new tables, one new enum.

-- Studio settings: visiting charge per category (paise) and visits per slot.
ALTER TABLE "studios" ADD COLUMN "serviceCharges" JSONB;
ALTER TABLE "studios" ADD COLUMN "serviceSlotVisits" INTEGER NOT NULL DEFAULT 2;

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('HELD', 'BOOKED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "warranty_coverage_rules" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "examples" TEXT NOT NULL,
    "covered" BOOLEAN NOT NULL,
    "serviceCategory" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "clientNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_coverage_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientRuleKey" TEXT,
    "ruleKey" TEXT NOT NULL,
    "covered" BOOLEAN NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "readerModel" TEXT,
    "readerReason" TEXT,
    "readerFailure" TEXT,
    "snagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chargePaise" BIGINT NOT NULL,
    "slotDay" DATE NOT NULL,
    "slotStart" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'HELD',
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "payLinkId" TEXT,
    "payUrl" TEXT,
    "paymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "studioNote" TEXT,
    "doneAt" TIMESTAMP(3),
    "refundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warranty_coverage_rules_studioId_active_idx" ON "warranty_coverage_rules"("studioId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_snagId_key" ON "warranty_claims"("snagId");

-- CreateIndex
CREATE INDEX "warranty_claims_projectId_createdAt_idx" ON "warranty_claims"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_payLinkId_key" ON "service_requests"("payLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_paymentId_key" ON "service_requests"("paymentId");

-- CreateIndex
CREATE INDEX "service_requests_studioId_slotDay_slotStart_idx" ON "service_requests"("studioId", "slotDay", "slotStart");

-- CreateIndex
CREATE INDEX "service_requests_projectId_createdAt_idx" ON "service_requests"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "warranty_coverage_rules" ADD CONSTRAINT "warranty_coverage_rules_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles (the app reaches them through the server only).
ALTER TABLE "warranty_coverage_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warranty_coverage_rules" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "warranty_coverage_rules" FROM anon, authenticated;
ALTER TABLE "warranty_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warranty_claims" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "warranty_claims" FROM anon, authenticated;
ALTER TABLE "service_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_requests" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "service_requests" FROM anon, authenticated;

-- The default coverage list: Hauspire's agreement, clause 5 (aftercare/rules.ts
-- DEFAULT_COVERAGE_RULES; tests/aftercare.test.ts keeps the two equal).
-- Only manufacturing defects in modular woodwork are covered.
INSERT INTO "warranty_coverage_rules" ("id", "studioId", "key", "label", "examples", "covered", "serviceCategory", "sortOrder", "clientNote", "active", "updatedAt") VALUES
  ('wcr_default_modular_core', NULL, 'MODULAR_CORE', 'Modular woodwork: a defect in the board or the build', 'a factory panel or carcass cracked, splitting or delaminating, a shelf sagging, joints opening, a unit coming loose from the wall, a shutter warped beyond adjustment, with no sign of water or misuse', true, NULL, 10, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_modular_finish', NULL, 'MODULAR_FINISH', 'Laminate, edge banding or finish lifting on modular woodwork', 'laminate or edge band peeling or bubbling, acrylic or PU finish lifting, veneer coming off, from workmanship and not from water, heat or a knock', true, NULL, 20, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_modular_hardware', NULL, 'MODULAR_HARDWARE', 'Hinges, channels, drawer slides, lift-ups and handles', 'hinge broken, drawer channel or slide failed, soft-close not working, lift-up or gas strut failing, wardrobe sliding track, handle broken', false, 'CARPENTRY', 30, 'Hinges, channels and other hardware carry their manufacturer''s warranty; your studio helps you claim it on the visit.', true, CURRENT_TIMESTAMP),
  ('wcr_default_minor_adjustment', NULL, 'MINOR_ADJUSTMENT', 'Loose screws, doors or drawers slightly out of line', 'loose screw, door or drawer slightly out of line or rubbing, handle loose, shutter gap uneven, an easy adjustment', false, 'CARPENTRY', 40, 'Small adjustments are part of a service visit, not the warranty.', true, CURRENT_TIMESTAMP),
  ('wcr_default_moisture_pests', NULL, 'MOISTURE_PESTS', 'Swelling from water or damp, termites or pests', 'board swollen near a sink, from a spill, seepage or damp wall, water marks, termites, borer holes, fungus', false, 'CARPENTRY', 50, 'Damage from water, damp or pests is not covered by the warranty.', true, CURRENT_TIMESTAMP),
  ('wcr_default_damage_from_use', NULL, 'DAMAGE_FROM_USE', 'Damage from use, wear or fading', 'burn mark, scratches, dents, chipped edge from a knock, broken by force, normal wear, colour fading or yellowing over time', false, 'CARPENTRY', 60, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_painting', NULL, 'PAINTING', 'Wall paint and putty', 'crack in wall paint, peeling or flaking paint, patches, dampness marks, touch-up', false, 'PAINTING', 100, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_electrical', NULL, 'ELECTRICAL', 'Lights, LEDs, switches and wiring', 'LED strip or profile light not working, bulb, driver, switch, socket, fan, wiring', false, 'ELECTRICAL', 110, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_wallpaper', NULL, 'WALLPAPER', 'Wallpaper', 'wallpaper peeling, bubbles, seams opening, stains', false, 'WALLPAPER', 120, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_plumbing', NULL, 'PLUMBING', 'Taps, sinks and water', 'leaking tap, sink drain blocked, water leak, dampness from a pipe', false, 'PLUMBING', 130, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_ceiling_civil', NULL, 'CEILING_CIVIL', 'False ceiling, tiles and civil work', 'false ceiling crack, gypsum joint line, tile crack, grout, flooring, wall panelling', false, 'CIVIL', 140, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_glass_mirror', NULL, 'GLASS_MIRROR', 'Glass and mirrors', 'broken glass, cracked mirror, glass shutter broken', false, 'CARPENTRY', 150, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_curtains_decor', NULL, 'CURTAINS_DECOR', 'Curtains, blinds and decor', 'curtain rod, blinds, loose decor, artwork, accessories', false, 'OTHER', 160, NULL, true, CURRENT_TIMESTAMP),
  ('wcr_default_appliance', NULL, 'APPLIANCE', 'Appliances: chimney, hob, oven, geyser', 'chimney, hob, oven, dishwasher, geyser, any branded appliance', false, 'OTHER', 170, 'Appliances carry their brand''s warranty.', true, CURRENT_TIMESTAMP);
