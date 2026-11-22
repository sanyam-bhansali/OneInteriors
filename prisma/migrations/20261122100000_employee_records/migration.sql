-- Employee records (owner, 21 Nov 2026): documents, salary, incentives and their payouts, devices.
CREATE TABLE "studio_staff_records" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "designation" TEXT,
    "joinedOn" DATE,
    "address" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "studio_staff_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "studio_staff_records_memberId_key" ON "studio_staff_records"("memberId");
CREATE INDEX "studio_staff_records_studioId_idx" ON "studio_staff_records"("studioId");

CREATE TABLE "studio_staff_docs" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "studio_staff_docs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_staff_docs_studioId_memberId_idx" ON "studio_staff_docs"("studioId", "memberId");

CREATE TABLE "studio_staff_salaries" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "monthlyPaise" BIGINT NOT NULL,
    "fromDay" DATE NOT NULL,
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_staff_salaries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_staff_salaries_studioId_memberId_idx" ON "studio_staff_salaries"("studioId", "memberId");

CREATE TABLE "studio_staff_incentives" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidOn" DATE,
    "paidById" TEXT,
    CONSTRAINT "studio_staff_incentives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_staff_incentives_studioId_memberId_idx" ON "studio_staff_incentives"("studioId", "memberId");

CREATE TABLE "studio_staff_devices" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial" TEXT,
    "givenOn" DATE NOT NULL,
    "returnedOn" DATE,
    "note" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_staff_devices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_staff_devices_studioId_memberId_idx" ON "studio_staff_devices"("studioId", "memberId");

-- Row level security: closed to the anon and authenticated roles (the app reaches them through the server only).
ALTER TABLE "studio_staff_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_staff_records" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_staff_records" FROM anon, authenticated;
ALTER TABLE "studio_staff_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_staff_docs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_staff_docs" FROM anon, authenticated;
ALTER TABLE "studio_staff_salaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_staff_salaries" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_staff_salaries" FROM anon, authenticated;
ALTER TABLE "studio_staff_incentives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_staff_incentives" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_staff_incentives" FROM anon, authenticated;
ALTER TABLE "studio_staff_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_staff_devices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_staff_devices" FROM anon, authenticated;
