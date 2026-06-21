-- Add slug column to Project (nullable first for backfill)
ALTER TABLE "Project" ADD COLUMN "slug" TEXT;

-- Backfill: derive slug from name, make duplicates unique per workspace
WITH base AS (
  SELECT
    id,
    "workspaceId",
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g')) AS base_slug
  FROM "Project"
),
ranked AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY "workspaceId", base_slug ORDER BY id) - 1 AS rn
  FROM base
)
UPDATE "Project" p
SET slug = CASE WHEN r.rn = 0 THEN r.base_slug ELSE r.base_slug || '-' || r.rn::text END
FROM ranked r
WHERE p.id = r.id;

-- Now set NOT NULL and unique constraint
ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");
