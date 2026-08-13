-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- Bestehende Aufgaben nachtragen: für alles, was schon abgeschlossen ist, ist
-- `updated` die beste Näherung, die es gibt — von da an führt die Spalte sich
-- selbst (`features/issues/actions.ts`). Ohne diesen Schritt hätte jedes
-- gewachsene Projekt am ersten Tag einen leeren Durchsatz und keine
-- Durchlaufzeit, obwohl beides in den Daten steckt.
UPDATE "Issue" SET "closedAt" = "updated" WHERE "status" IN ('done', 'canceled');

-- CreateTable
CREATE TABLE "DashboardPreference" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hidden" TEXT[],
    "order" TEXT[],
    "range" TEXT NOT NULL DEFAULT '30d',

    CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateIndex
CREATE INDEX "DashboardPreference_projectId_idx" ON "DashboardPreference"("projectId");

-- CreateIndex
CREATE INDEX "Issue_projectId_closedAt_idx" ON "Issue"("projectId", "closedAt");

-- AddForeignKey
ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
