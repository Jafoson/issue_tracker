ALTER TABLE "Workspace" ADD COLUMN "slug" TEXT;
UPDATE "Workspace" SET "slug" = "id";
ALTER TABLE "Workspace" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
