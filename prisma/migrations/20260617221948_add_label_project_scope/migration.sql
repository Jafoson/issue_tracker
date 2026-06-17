-- AlterTable
ALTER TABLE "Label" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Label_projectId_idx" ON "Label"("projectId");

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
