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
