export interface Status {
  id: string;
  name: string;
  short: string;
  color: string;
  isColumn: boolean;
}

export interface Priority {
  id: number;
  key: string;
  name: string;
  color: string;
}

export interface Label {
  id: string;
  name: string;
  slug: string;
  color: string;
  projectId?: string | null;
}

export interface IssueType {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  author: string;
  time: number;
  body: string;
}

export interface Issue {
  id: string;
  key: number;
  title: string;
  status: string;
  priority: number;
  assignee: string | null;
  reporter: string;
  labels: string[];
  rank: number;
  created: number;
  updated: number;
  description: string;
  comments: Comment[];
  project: string;
  type: string;
}
