-- CreateTable
CREATE TABLE "ProjectHiddenLabel" (
    "projectId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "ProjectHiddenLabel_pkey" PRIMARY KEY ("projectId","labelId")
);

-- CreateIndex
CREATE INDEX "ProjectHiddenLabel_labelId_idx" ON "ProjectHiddenLabel"("labelId");

-- AddForeignKey
ALTER TABLE "ProjectHiddenLabel" ADD CONSTRAINT "ProjectHiddenLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectHiddenLabel" ADD CONSTRAINT "ProjectHiddenLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
