const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Experience {
  id: number;
  company: string;
  title: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  summary: string | null;
  achievements: string[];
  tech_stack: string[];
  display_order: number;
}

export async function fetchExperiences(): Promise<Experience[]> {
  const res = await fetch(`${API_BASE}/api/v1/experiences`);
  if (!res.ok) throw new Error(`Failed to load experiences: ${res.status}`);
  return res.json();
}
