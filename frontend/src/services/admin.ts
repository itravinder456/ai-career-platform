const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AdminSocialLink {
  platform: string;
  label: string;
  url: string;
  display_order: number;
}

export interface AdminProfileStat {
  label: string;
  value: string;
  display_order: number;
}

export interface AdminProfileUpdate {
  name?: string;
  headline?: string;
  location?: string;
  email?: string;
  summary?: string | null;
  resume_url?: string;
  links?: AdminSocialLink[];
  stats?: AdminProfileStat[];
}

export class AdminAuthError extends Error {}

export async function verifyAdminKey(key: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/ping`, {
    headers: { "X-Admin-Key": key },
  });
  if (res.status === 401) throw new AdminAuthError("Invalid admin key");
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`);
}

export async function updateProfile(key: string, body: AdminProfileUpdate) {
  const res = await fetch(`${API_BASE}/api/v1/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AdminAuthError("Invalid admin key");
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

async function putJson(key: string, path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AdminAuthError("Invalid admin key");
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

export interface AdminProject {
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

export function updateProjects(key: string, projects: AdminProject[]) {
  return putJson(key, "/api/v1/projects", { projects });
}

export interface AdminExperience {
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

export function updateExperiences(key: string, experiences: AdminExperience[]) {
  return putJson(key, "/api/v1/experiences", { experiences });
}

export interface AdminSkill {
  name: string;
  category: string;
  proficiency: number | null;
  display_order: number;
}

export function updateSkills(key: string, skills: AdminSkill[]) {
  return putJson(key, "/api/v1/skills", { skills });
}

export interface AdminDocument {
  title: string;
  body: string;
  asset_url: string | null;
  display_order: number;
}

export function updateDocuments(key: string, docType: string, documents: AdminDocument[]) {
  return putJson(key, `/api/v1/documents/${docType}`, { documents });
}

/** Stopgap resume-replace flow — see the comment on RESUME_DIR in
 * services/api/app/api/v1/documents.py for the production caveat. */
export async function uploadResume(key: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/documents/resume/upload`, {
    method: "POST",
    headers: { "X-Admin-Key": key },
    body: formData,
  });
  if (res.status === 401) throw new AdminAuthError("Invalid admin key");
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
