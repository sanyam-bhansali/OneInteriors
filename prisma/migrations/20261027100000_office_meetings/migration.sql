-- Office meetings (owner, 27 Oct 2026; docs/studio-os/OFFICE-MEETINGS.md):
-- anyone at a studio sets up a meeting with anyone else there through the
-- calendar; each person asked accepts or suggests another time.
--
-- Expand only: one enum, two new tables. Nothing existing is changed.
-- RLS on the new tables, no policies: reached only through Prisma on the
-- server, like every studio table.

-- CreateEnum
CREATE TYPE "MeetingAnswer" AS ENUM ('PENDING', 'ACCEPTED', 'PROPOSED');

-- CreateTable
CREATE TABLE "studio_meetings" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 30,
    "place" TEXT,
    "note" TEXT,
    "organiserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_meeting_guests" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "answer" "MeetingAnswer" NOT NULL DEFAULT 'PENDING',
    "proposedAt" TIMESTAMP(3),
    "note" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "studio_meeting_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_meetings_studioId_startsAt_idx" ON "studio_meetings"("studioId", "startsAt");
CREATE INDEX "studio_meetings_organiserId_startsAt_idx" ON "studio_meetings"("organiserId", "startsAt");
CREATE UNIQUE INDEX "studio_meeting_guests_meetingId_memberId_key" ON "studio_meeting_guests"("meetingId", "memberId");
CREATE INDEX "studio_meeting_guests_memberId_answer_idx" ON "studio_meeting_guests"("memberId", "answer");

-- AddForeignKey
ALTER TABLE "studio_meetings" ADD CONSTRAINT "studio_meetings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_meetings" ADD CONSTRAINT "studio_meetings_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "studio_meeting_guests" ADD CONSTRAINT "studio_meeting_guests_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "studio_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_meeting_guests" ADD CONSTRAINT "studio_meeting_guests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "studio_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_meetings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_meetings" FROM anon, authenticated;
ALTER TABLE "studio_meeting_guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_meeting_guests" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_meeting_guests" FROM anon, authenticated;
