export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  // Nicht überall gefüllt: `getMembers` liefert ihn, die Projektansicht nicht.
  // `lib/filter-slugs.ts` baut daraus die lesbaren Filter-Slugs.
  handle?: string;
  // Role-Key innerhalb des Workspace (owner | admin | manager | project_lead |
  // member | viewer | guest oder eine benutzerdefinierte Rolle).
  role?: string;
  // Rang dieser Rolle. Kommt aus der Datenbank, damit auch selbst angelegte
  // Rollen in der Hierarchie richtig einsortiert werden.
  roleRank?: number;
  color: string;
  image?: string;
  pending?: boolean;
}

export interface Role {
  /** Der stabile Role-Key innerhalb seiner Ebene — das ist der Wert in der UI. */
  id: string;
  name: string;
  desc: string;
  rank: number;
}
