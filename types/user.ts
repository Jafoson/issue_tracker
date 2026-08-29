export interface User {
  id: string;
  firstName: string;
  lastName: string;
  // Passkey accounts get by without an address (`prisma/schema.prisma`'s
  // `User.email`) — anywhere it's displayed, the empty case must be handled
  // visibly instead of interpolated unchecked.
  email: string | null;
  // Not populated everywhere: `getMembers` supplies it, the project view
  // doesn't. `lib/filter-slugs.ts` builds the readable filter slugs from it.
  handle?: string;
  // Role key within the workspace (owner | admin | manager | project_lead |
  // member | viewer | guest, or a custom role).
  role?: string;
  // Rank of this role. Comes from the database so custom roles are also
  // sorted correctly in the hierarchy.
  roleRank?: number;
  color: string;
  image?: string;
  pending?: boolean;
}

export interface Role {
  /** The stable role key within its level — that's the value used in the UI. */
  id: string;
  name: string;
  desc: string;
  rank: number;
}
