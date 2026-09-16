-- Introductions, appointments, and two numbers that disagreed with themselves.
--
-- ## The introduction
--
-- The single event the business charges for, recorded nowhere until now. It
-- gates contact release, starts the commission clock, and is the honest
-- denominator for whether matching works. There is deliberately no automatic
-- writer: an introduction is a judgement a person makes on a call, and if a
-- customer action could trigger one, the expert call would stop being the gate.
--
-- ## The appointments
--
-- The product promises "we set up the meeting or site visit with that studio
-- directly" in four places in customer-facing copy and modelled it in none.
-- Note what this is not: consultations.scheduledFor is the EXPERT's call with
-- the customer, and a verification_checks site visit is US visiting the STUDIO.
-- Three things that all involve a date and a visit, kept apart on purpose.
--
-- ## The two renames
--
-- `subscriptions.guaranteedProjects` promised the thing the pricing module's
-- own comment says we must never promise — whether a brief becomes a project is
-- the customer's decision. Renamed to `guaranteedBriefs`.
--
-- `projects.commissionBps` defaulted to 400 while COMMISSION_BPS in code is 500
-- and every business document says 5%. A studio dashboard was about to render a
-- take rate computed one way against an invoice computed the other.
--
-- Normally a rename is expand → backfill → contract, never one step. Both of
-- these are done in one step deliberately and safely: NO CODE WRITES EITHER
-- TABLE today. `prisma.subscription` appears in no write path and no Project
-- row has ever been created, so both tables are empty in every environment and
-- there is no running deploy reading the old column. If that is no longer true
-- when you read this, do not copy this migration's approach.

-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('FIRST_MEETING', 'SITE_VISIT', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoShowParty" AS ENUM ('CUSTOMER', 'STUDIO');

-- AlterTable
ALTER TABLE "subscriptions" RENAME COLUMN "guaranteedProjects" TO "guaranteedBriefs";

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "commissionBps" SET DEFAULT 500;

-- CreateTable
CREATE TABLE "introductions" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "consultationId" TEXT,
    "introducedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "introducedById" TEXT NOT NULL,
    "contactReleasedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "introductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "introductionId" TEXT NOT NULL,
    "kind" "AppointmentKind" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "proposedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "noShowBy" "NoShowParty",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One introduction per studio per brief. A second one is the same
-- introduction, not a new one.
CREATE UNIQUE INDEX "introductions_briefId_studioId_key" ON "introductions"("briefId", "studioId");

-- CreateIndex
-- The studio dashboard's main read: my introductions, newest first.
CREATE INDEX "introductions_studioId_introducedAt_idx" ON "introductions"("studioId", "introducedAt");

-- CreateIndex
CREATE INDEX "appointments_introductionId_idx" ON "appointments"("introductionId");

-- CreateIndex
-- The calendar's read: what is coming up, and the ops sweep for appointments
-- that have passed without an outcome.
CREATE INDEX "appointments_startsAt_status_idx" ON "appointments"("startsAt", "status");

-- AddForeignKey
ALTER TABLE "introductions" ADD CONSTRAINT "introductions_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "introductions" ADD CONSTRAINT "introductions_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_introductionId_fkey" FOREIGN KEY ("introductionId") REFERENCES "introductions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
--
-- Both of these carry the link between a real person and a business
-- they are about to spend lakhs with. `introductions` is the join
-- that makes a customer's phone number reachable at all.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "introductions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "introductions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "introductions" FROM anon, authenticated;

ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "appointments" FROM anon, authenticated;
