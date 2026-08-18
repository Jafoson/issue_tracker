-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "shareTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "shareTokenCreatedById" TEXT,
ADD COLUMN     "shareTokenExpiresAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_shareTokenCreatedById_fkey" FOREIGN KEY ("shareTokenCreatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
