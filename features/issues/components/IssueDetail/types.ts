/**
 * Wie die Attribute stehen.
 *
 * `column` heißt: alles untereinander in einer Spalte, die Attribute als
 * flache Leiste unter dem Titel. Das schmale Seitenpanel kann nichts anderes —
 * eine zweite Spalte bliebe dort ein Stapel mit Trennlinie.
 *
 * `aside` ist die zweispaltige Aufteilung des großen Dialogs und der
 * Vollseite: Inhalt links, Attribute rechts daneben. Dort ist die Breite da,
 * und beides gleichzeitig im Blick zu haben ist mehr wert als der Lesefluss
 * von oben nach unten.
 */
export type IssueDetailLayout = "column" | "aside";
