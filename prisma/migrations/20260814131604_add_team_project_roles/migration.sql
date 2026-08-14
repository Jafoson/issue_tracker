-- CreateEnum
CREATE TYPE "ProjectMemberOrigin" AS ENUM ('manual', 'team');

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "origin" "ProjectMemberOrigin" NOT NULL DEFAULT 'manual',
ADD COLUMN     "originTeamId" TEXT;

-- AlterTable
ALTER TABLE "TeamProject" ADD COLUMN     "roleId" TEXT;

-- CreateIndex
CREATE INDEX "ProjectMember_originTeamId_idx" ON "ProjectMember"("originTeamId");

-- CreateIndex
CREATE INDEX "TeamProject_roleId_idx" ON "TeamProject"("roleId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_originTeamId_fkey" FOREIGN KEY ("originTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProject" ADD CONSTRAINT "TeamProject_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
