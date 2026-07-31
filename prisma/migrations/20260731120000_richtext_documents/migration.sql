-- Beschreibungen und Kommentare werden ProseMirror-Dokumente.
--
-- Die Spalten sind schon TEXT, und JSON ist Text — deshalb braucht es keine
-- Zwischenspalten und kein DROP: `scripts/migrate-richtext.ts` schreibt das
-- umgewandelte Dokument an Ort und Stelle in dieselbe Spalte, danach ändert
-- diese Migration nur noch den Typ.
--
--   1. bun run scripts/migrate-richtext.ts   (Markdown -> JSON, in place)
--   2. bun prisma migrate deploy             (diese Datei)
--
-- Wer Schritt 1 überspringt, verliert nichts: der CASE unten fängt alles ab,
-- was noch kein JSON-Objekt ist, und macht daraus einen einzelnen Absatz. Die
-- Auszeichnungen (Überschriften, Listen, fett) fehlen dann allerdings — deshalb
-- ist das nur das Sicherheitsnetz, nicht der Weg.
--
-- Auf einer frischen Datenbank sind die Tabellen leer, `db:reset` läuft also
-- ohne Schritt 1 durch.

-- ─── Issue.description ───────────────────────────────────────────────────────

ALTER TABLE "Issue" ADD COLUMN "descriptionText" TEXT NOT NULL DEFAULT '';

-- Der alte Default ('') ist kein gültiges JSON und blockiert sonst den Cast.
ALTER TABLE "Issue" ALTER COLUMN "description" DROP DEFAULT;

ALTER TABLE "Issue"
  ALTER COLUMN "description" TYPE JSONB
  USING (
    CASE
      WHEN btrim(COALESCE("description", '')) = ''
        THEN '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
      WHEN btrim("description") LIKE '{%'
        THEN "description"::jsonb
      ELSE jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', "description")
            )
          )
        )
      )
    END
  );

ALTER TABLE "Issue"
  ALTER COLUMN "description"
  SET DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb;

-- Fließtext für die Suche nachziehen. Das ist die grobe Variante direkt aus dem
-- JSON; `scripts/migrate-richtext.ts` setzt denselben Wert sauberer über
-- `toPlainText`. Beide Wege enden beim selben Ergebnis, solange das Skript läuft.
UPDATE "Issue"
SET "descriptionText" = COALESCE(
  (
    SELECT string_agg(value, ' ')
    FROM jsonb_path_query("description", 'strict $.**.text') AS t(node),
         LATERAL (SELECT node #>> '{}') AS s(value)
    WHERE jsonb_typeof(node) = 'string'
  ),
  ''
);

-- ─── Comment.body ────────────────────────────────────────────────────────────

ALTER TABLE "Comment" ADD COLUMN "bodyText" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Comment"
  ALTER COLUMN "body" TYPE JSONB
  USING (
    CASE
      WHEN btrim(COALESCE("body", '')) = ''
        THEN '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
      WHEN btrim("body") LIKE '{%'
        THEN "body"::jsonb
      ELSE jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', "body")
            )
          )
        )
      )
    END
  );

UPDATE "Comment"
SET "bodyText" = COALESCE(
  (
    SELECT string_agg(value, ' ')
    FROM jsonb_path_query("body", 'strict $.**.text') AS t(node),
         LATERAL (SELECT node #>> '{}') AS s(value)
    WHERE jsonb_typeof(node) = 'string'
  ),
  ''
);
