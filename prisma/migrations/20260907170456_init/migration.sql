-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STUDIO', 'OPS', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('MARKETING_EMAIL', 'MARKETING_WHATSAPP', 'MARKETING_SMS', 'DATA_PROCESSING', 'IMPORTED_LEAD');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('BHK_1', 'BHK_2', 'BHK_3', 'BHK_4_PLUS', 'VILLA', 'OTHER');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('FULL_HOME', 'KITCHEN_WARDROBE', 'SINGLE_ROOM', 'RENOVATION');

-- CreateEnum
CREATE TYPE "Involvement" AS ENUM ('DECIDE_FOR_ME', 'COLLABORATE', 'APPROVE_EVERYTHING');

-- CreateEnum
CREATE TYPE "PriorityFactor" AS ENUM ('BUDGET', 'SPEED', 'DESIGN_AMBITION', 'MATERIAL_QUALITY');

-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('UNVERIFIED', 'LISTED', 'VERIFIED', 'PROVEN');

-- CreateEnum
CREATE TYPE "StudioStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('PAN_NAME_MATCH', 'AADHAAR_KYC', 'ADDRESS_VISIT', 'CONTACT_REACHABLE', 'CODE_OF_CONDUCT', 'GSTIN_ACTIVE', 'GST_FILING_HISTORY', 'MCA_STATUS', 'UDYAM', 'CLIENT_REFERENCE', 'SITE_INSPECTION', 'LITIGATION_SEARCH');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NOT_APPLICABLE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuotationKind" AS ENUM ('INDICATIVE', 'FIRM');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('CONTRACTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EscrowDirection" AS ENUM ('DEPOSIT', 'RELEASE', 'REFUND', 'FEE');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('INITIATED', 'PENDING', 'SETTLED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'UPHELD', 'DISMISSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('LISTED', 'VERIFIED', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerified" TIMESTAMP(3),
    "email" TEXT,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyType" "PropertyType",
    "carpetAreaSqft" INTEGER,
    "locality" TEXT,
    "possessionOn" TIMESTAMP(3),
    "scope" "ScopeType",
    "budgetMinPaise" BIGINT,
    "budgetMaxPaise" BIGINT,
    "styleLikes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleDislikes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adults" INTEGER,
    "children" INTEGER,
    "elderly" INTEGER,
    "pets" BOOLEAN NOT NULL DEFAULT false,
    "worksFromHome" BOOLEAN NOT NULL DEFAULT false,
    "priorityRanking" "PriorityFactor"[] DEFAULT ARRAY[]::"PriorityFactor"[],
    "involvement" "Involvement",
    "moveInBy" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastStep" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studios" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "about" TEXT,
    "city" TEXT NOT NULL DEFAULT 'pune',
    "localities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "StudioStatus" NOT NULL DEFAULT 'ONBOARDING',
    "tier" "VerificationTier" NOT NULL DEFAULT 'UNVERIFIED',
    "gstin" TEXT,
    "cin" TEXT,
    "udyamNumber" TEXT,
    "panLast4" TEXT,
    "yearsActive" INTEGER,
    "teamSize" INTEGER,
    "minProjectPaise" BIGINT,
    "maxProjectPaise" BIGINT,
    "designFeePaise" BIGINT,
    "completedProjects" INTEGER NOT NULL DEFAULT 0,
    "avgVarianceDays" DOUBLE PRECISION,
    "upheldDisputes" INTEGER NOT NULL DEFAULT 0,
    "specComplianceRate" DOUBLE PRECISION,
    "communicationRating" DOUBLE PRECISION,
    "autonomyProfile" DOUBLE PRECISION,
    "performanceComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_members" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_checks" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "type" "CheckType" NOT NULL,
    "result" "CheckResult" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "evidenceUrl" TEXT,
    "notes" TEXT,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locality" TEXT,
    "propertyType" "PropertyType",
    "scope" "ScopeType",
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "valuePaise" BIGINT,
    "durationDays" INTEGER,
    "completedOn" TIMESTAMP(3),
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRender" BOOLEAN NOT NULL DEFAULT false,
    "clientConsented" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_items" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "ratePaise" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_card_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "factorsScored" INTEGER NOT NULL,
    "factorsTotal" INTEGER NOT NULL DEFAULT 6,
    "breakdown" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortlists" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "kind" "QuotationKind" NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalPaise" BIGINT NOT NULL,
    "gstPaise" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "variancePct" DOUBLE PRECISION DEFAULT 15,
    "assumptions" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "ratePaise" BIGINT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "quotationId" TEXT,
    "reference" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'CONTRACTED',
    "contractValuePaise" BIGINT NOT NULL,
    "commissionBps" INTEGER NOT NULL DEFAULT 400,
    "commissionPaise" BIGINT NOT NULL DEFAULT 0,
    "escrowFeeBps" INTEGER NOT NULL DEFAULT 175,
    "committedStartOn" TIMESTAMP(3) NOT NULL,
    "committedEndOn" TIMESTAMP(3) NOT NULL,
    "actualEndOn" TIMESTAMP(3),
    "contractUrl" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "dueOn" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_evidence" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "capturedAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "direction" "EscrowDirection" NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'INITIATED',
    "amountPaise" BIGINT NOT NULL,
    "providerRef" TEXT,
    "providerPayload" JSONB,
    "failureReason" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'LISTED',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "monthlyPaise" BIGINT NOT NULL DEFAULT 0,
    "guaranteedProjects" INTEGER NOT NULL DEFAULT 0,
    "startedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_periods" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "guaranteed" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "shortfall" INTEGER NOT NULL DEFAULT 0,
    "creditCarriedInPaise" BIGINT NOT NULL DEFAULT 0,
    "creditCarriedOutPaise" BIGINT NOT NULL DEFAULT 0,
    "invoicedPaise" BIGINT NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "allocation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "expertUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "outcomeNotes" TEXT,
    "recommendedStudioId" TEXT,
    "matchWasCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_createdAt_idx" ON "otp_challenges"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "consents_userId_purpose_idx" ON "consents"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "briefs_userId_key" ON "briefs"("userId");

-- CreateIndex
CREATE INDEX "briefs_locality_completedAt_idx" ON "briefs"("locality", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "studios_slug_key" ON "studios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "studios_gstin_key" ON "studios"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "studios_cin_key" ON "studios"("cin");

-- CreateIndex
CREATE INDEX "studios_city_status_tier_idx" ON "studios"("city", "status", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "studio_members_userId_key" ON "studio_members"("userId");

-- CreateIndex
CREATE INDEX "studio_members_studioId_idx" ON "studio_members"("studioId");

-- CreateIndex
CREATE INDEX "verification_checks_studioId_result_idx" ON "verification_checks"("studioId", "result");

-- CreateIndex
CREATE UNIQUE INDEX "verification_checks_studioId_type_key" ON "verification_checks"("studioId", "type");

-- CreateIndex
CREATE INDEX "portfolio_projects_studioId_idx" ON "portfolio_projects"("studioId");

-- CreateIndex
CREATE INDEX "rate_card_items_studioId_category_idx" ON "rate_card_items"("studioId", "category");

-- CreateIndex
CREATE INDEX "matches_briefId_score_idx" ON "matches"("briefId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "matches_briefId_studioId_key" ON "matches"("briefId", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "shortlists_briefId_studioId_key" ON "shortlists"("briefId", "studioId");

-- CreateIndex
CREATE INDEX "quotations_briefId_studioId_idx" ON "quotations"("briefId", "studioId");

-- CreateIndex
CREATE INDEX "quotation_line_items_quotationId_idx" ON "quotation_line_items"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_quotationId_key" ON "projects"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_reference_key" ON "projects"("reference");

-- CreateIndex
CREATE INDEX "projects_studioId_status_idx" ON "projects"("studioId", "status");

-- CreateIndex
CREATE INDEX "projects_status_committedEndOn_idx" ON "projects"("status", "committedEndOn");

-- CreateIndex
CREATE INDEX "milestones_projectId_status_idx" ON "milestones"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_projectId_position_key" ON "milestones"("projectId", "position");

-- CreateIndex
CREATE INDEX "milestone_evidence_milestoneId_idx" ON "milestone_evidence"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_providerRef_key" ON "escrow_transactions"("providerRef");

-- CreateIndex
CREATE INDEX "escrow_transactions_projectId_direction_idx" ON "escrow_transactions"("projectId", "direction");

-- CreateIndex
CREATE INDEX "escrow_transactions_status_idx" ON "escrow_transactions"("status");

-- CreateIndex
CREATE INDEX "disputes_projectId_idx" ON "disputes"("projectId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_studioId_key" ON "subscriptions"("studioId");

-- CreateIndex
CREATE INDEX "allocation_periods_periodStart_idx" ON "allocation_periods"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_periods_studioId_periodStart_key" ON "allocation_periods"("studioId", "periodStart");

-- CreateIndex
CREATE INDEX "consultations_briefId_idx" ON "consultations"("briefId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_members" ADD CONSTRAINT "studio_members_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_members" ADD CONSTRAINT "studio_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_checks" ADD CONSTRAINT "verification_checks_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_items" ADD CONSTRAINT "rate_card_items_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_periods" ADD CONSTRAINT "allocation_periods_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
