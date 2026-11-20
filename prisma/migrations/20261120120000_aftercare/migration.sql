-- After the handover (owner, 20 Nov 2026; docs/studio-os/AFTERCARE.md):
-- warranty claims decided against coverage rules kept as data, and paid
-- service visits with a fixed visiting charge per category.
-- Additive only: new columns with defaults, new tables, one new enum.

-- Studio settings: visiting charge per category (paise) and visits per slot.
ALTER TABLE "studios" ADD COLUMN "serviceCharges" JSONB;
ALTER TABLE "studios" ADD COLUMN "serviceSlotVisits" INTEGER NOT NULL DEFAULT 2;

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('HELD', 'BOOKED', 'CANCELLED');

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

-- One Interiors' default coverage list (aftercare/rules.ts DEFAULT_COVERAGE_RULES;
-- tests/aftercare.test.ts keeps the two equal). Generally only modular is covered.
INSERT INTO "warranty_coverage_rules" ("id", "studioId", "key", "label", "examples", "covered", "serviceCategory", "sortOrder", "active", "updatedAt") VALUES
  ('wcr_default_modular_structure', NULL, 'MODULAR_STRUCTURE', 'Modular furniture body: wardrobe, kitchen, vanity, TV unit, bed', 'carcass or panel swelling from inside, sagging shelf, joints opening, a unit coming loose from the wall, a factory panel cracked', true, NULL, 10, true, CURRENT_TIMESTAMP),
  ('wcr_default_modular_hardware', NULL, 'MODULAR_HARDWARE', 'Hinges, channels, drawers, lift-ups and handles', 'hinge broken or loose, drawer channel stuck or dropped, soft-close not working, lift-up or gas strut failing, handle loose, wardrobe sliding track', true, NULL, 20, true, CURRENT_TIMESTAMP),
  ('wcr_default_modular_shutter_finish', NULL, 'MODULAR_SHUTTER_FINISH', 'Shutters, laminate and edge banding on modular furniture', 'shutter warped or out of line, laminate or edge band peeling, acrylic or PU finish lifting, veneer coming off', true, NULL, 30, true, CURRENT_TIMESTAMP),
  ('wcr_default_painting', NULL, 'PAINTING', 'Wall paint and putty', 'crack in wall paint, peeling or flaking paint, patches, dampness marks, touch-up', false, 'PAINTING', 100, true, CURRENT_TIMESTAMP),
  ('wcr_default_electrical', NULL, 'ELECTRICAL', 'Lights, LEDs, switches and wiring', 'LED strip or profile light not working, bulb, driver, switch, socket, fan, wiring', false, 'ELECTRICAL', 110, true, CURRENT_TIMESTAMP),
  ('wcr_default_wallpaper', NULL, 'WALLPAPER', 'Wallpaper', 'wallpaper peeling, bubbles, seams opening, stains', false, 'WALLPAPER', 120, true, CURRENT_TIMESTAMP),
  ('wcr_default_plumbing', NULL, 'PLUMBING', 'Taps, sinks and water', 'leaking tap, sink drain blocked, water leak, dampness from a pipe', false, 'PLUMBING', 130, true, CURRENT_TIMESTAMP),
  ('wcr_default_ceiling_civil', NULL, 'CEILING_CIVIL', 'False ceiling, tiles and civil work', 'false ceiling crack, gypsum joint line, tile crack, grout, flooring', false, 'CIVIL', 140, true, CURRENT_TIMESTAMP),
  ('wcr_default_glass_mirror', NULL, 'GLASS_MIRROR', 'Glass and mirrors', 'broken glass, cracked mirror, glass shutter broken', false, 'CARPENTRY', 150, true, CURRENT_TIMESTAMP),
  ('wcr_default_damage_from_use', NULL, 'DAMAGE_FROM_USE', 'Damage from use', 'burn mark, scratches, dents, swelling from water spilled on the outside, broken by force, termites or pests', false, 'CARPENTRY', 160, true, CURRENT_TIMESTAMP),
  ('wcr_default_appliance', NULL, 'APPLIANCE', 'Appliances: chimney, hob, oven, geyser', 'chimney, hob, oven, dishwasher, geyser, any branded appliance', false, 'OTHER', 170, true, CURRENT_TIMESTAMP);
