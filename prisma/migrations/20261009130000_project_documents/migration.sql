-- CreateTable
CREATE TABLE "home_documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "byStudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "home_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_documents_projectId_createdAt_idx" ON "home_documents"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "home_documents" ADD CONSTRAINT "home_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, as on every table: reached only through the server.
ALTER TABLE "home_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_documents" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_documents" FROM anon, authenticated;
