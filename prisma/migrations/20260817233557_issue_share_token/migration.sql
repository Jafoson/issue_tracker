/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `Issue` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Issue_shareToken_key" ON "Issue"("shareToken");
