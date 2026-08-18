-- CreateTable
CREATE TABLE "WorkspaceDomain" (
    "domain" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceDomain_pkey" PRIMARY KEY ("domain")
);

-- CreateIndex
CREATE INDEX "WorkspaceDomain_workspaceId_idx" ON "WorkspaceDomain"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceDomain" ADD CONSTRAINT "WorkspaceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
