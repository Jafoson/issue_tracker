-- CreateTable
CREATE TABLE "WorkspaceDashboardPreference" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hidden" TEXT[],
    "order" TEXT[],
    "range" TEXT NOT NULL DEFAULT '30d',

    CONSTRAINT "WorkspaceDashboardPreference_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateIndex
CREATE INDEX "WorkspaceDashboardPreference_workspaceId_idx" ON "WorkspaceDashboardPreference"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceDashboardPreference" ADD CONSTRAINT "WorkspaceDashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDashboardPreference" ADD CONSTRAINT "WorkspaceDashboardPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
