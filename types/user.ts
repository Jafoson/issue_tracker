export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  // Role-Key innerhalb des Workspace (owner | admin | manager | project_lead |
  // member | viewer | guest oder eine benutzerdefinierte Rolle).
  role: string;
  color: string;
  image?: string;
  pending?: boolean;
}

export interface Role {
  id: string;
  name: string;
  desc: string;
}
