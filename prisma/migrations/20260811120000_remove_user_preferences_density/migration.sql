-- Die Dichte ("airy" | "compact") gibt es nicht mehr: es gab genau eine Stelle,
-- an der sie sich einstellen ließ, und die ist entfernt. Was bleibt, ist das
-- luftige Aussehen — jede CSS-Regel dazu hing an `[data-density="compact"]`,
-- keine einzige an "airy", also ist der Wegfall genau der bisherige Normalfall.
--
-- Gespeicherte "compact"-Wahlen gehen dabei verloren. Das ist beabsichtigt und
-- ohne Folge: ohne Bedienelement wäre eine solche Zeile eine Einstellung, die
-- niemand mehr zurücknehmen kann.

-- AlterTable
ALTER TABLE "UserPreferences" DROP COLUMN "density";
