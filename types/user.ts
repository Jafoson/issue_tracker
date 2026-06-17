export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: "admin" | "member" | "viewer";
  color: string;
  image?: string;
  pending?: boolean;
}

export interface Role {
  id: string;
  name: string;
  desc: string;
}
