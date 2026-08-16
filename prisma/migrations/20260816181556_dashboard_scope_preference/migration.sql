-- AlterTable
ALTER TABLE "DashboardPreference" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE "WorkspaceDashboardPreference" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'all';
