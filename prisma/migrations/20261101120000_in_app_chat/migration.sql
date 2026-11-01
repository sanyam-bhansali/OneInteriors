-- In-app chat, instead of WhatsApp (owner, 1 Nov 2026; modules/chat).
-- One thread of each kind per project, its messages, and how far each
-- person has read.
--
-- Expand only: three new tables and three enums. RLS on, no policies:
-- reached only through Prisma on the server, like every studio table.

-- CreateEnum
CREATE TYPE "ChatKind" AS ENUM ('DESIGNER', 'TEAM', 'ONE_INTERIORS');

-- CreateEnum
CREATE TYPE "ChatSide" AS ENUM ('CLIENT', 'FAMILY', 'STUDIO', 'ONE_INTERIORS');

-- CreateEnum
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'PHOTO', 'VOICE', 'FILE');

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ChatKind" NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "side" "ChatSide" NOT NULL,
    "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "bytes" INTEGER,
    "durationMs" INTEGER,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_reads" (
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "chat_reads_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateIndex
CREATE INDEX "chat_threads_studioId_lastMessageAt_idx" ON "chat_threads"("studioId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_projectId_kind_key" ON "chat_threads"("projectId", "kind");

-- CreateIndex
CREATE INDEX "chat_messages_threadId_createdAt_idx" ON "chat_messages"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_studioId_idx" ON "chat_messages"("studioId");

-- CreateIndex
CREATE INDEX "chat_reads_userId_idx" ON "chat_reads"("userId");

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "chat_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_threads" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "chat_threads" FROM anon, authenticated;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "chat_messages" FROM anon, authenticated;
ALTER TABLE "chat_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_reads" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "chat_reads" FROM anon, authenticated;
