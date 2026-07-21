const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Project {
  id: number;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  tech_stack: string[];
  impact: string[];
  repo_url: string | null;
  demo_url: string | null;
  image_url: string | null;
  status: string;
  featured: boolean;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/api/v1/projects`);
  if (!res.ok) throw new Error(`Failed to load projects: ${res.status}`);
  return res.json();
}
