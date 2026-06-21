export interface Project {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  key: string;
  color: string;
  lead: string;
  members: string[];
  projects: string[];
  desc: string;
}
