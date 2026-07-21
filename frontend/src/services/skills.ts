const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Skill {
  id: number;
  name: string;
  category: string;
  proficiency: number | null;
  display_order: number;
}

export async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch(`${API_BASE}/api/v1/skills`);
  if (!res.ok) throw new Error(`Failed to load skills: ${res.status}`);
  return res.json();
}
