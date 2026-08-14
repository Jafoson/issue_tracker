-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "desc" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "WorkspaceLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WorkspaceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceLink_workspaceId_idx" ON "WorkspaceLink"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceLink" ADD CONSTRAINT "WorkspaceLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
