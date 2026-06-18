-- AlterTable: add slug, backfill from name, then enforce NOT NULL + uniqueness
ALTER TABLE "Label" ADD COLUMN "slug" TEXT;

-- Backfill slug from the label name (lowercase, non-alphanumerics -> "-", trimmed)
UPDATE "Label"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'));

-- Disambiguate any collisions within a workspace by appending the row id
UPDATE "Label" l
SET "slug" = l."slug" || '-' || l."id"
FROM (
  SELECT "id"
  FROM (
    SELECT "id",
           row_number() OVER (PARTITION BY "workspaceId", "slug" ORDER BY "id") AS rn
    FROM "Label"
  ) ranked
  WHERE rn > 1
) dup
WHERE l."id" = dup."id";

ALTER TABLE "Label" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Label_workspaceId_slug_key" ON "Label"("workspaceId", "slug");
