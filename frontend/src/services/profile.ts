import { SocialId } from "@/lib/links";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ProfileData {
  name: string;
  headline: string;
  location: string;
  email: string;
  summary: string | null;
  resumeUrl: string;
  links: { id: SocialId; href: string; label: string }[];
}

export async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch(`${API_BASE}/api/v1/profile`);
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  const data = await res.json();

  return {
    name: data.name,
    headline: data.headline,
    location: data.location,
    email: data.email,
    summary: data.summary,
    resumeUrl: data.resume_url,
    links: (data.links as { platform: SocialId; label: string; url: string }[]).map((l) => ({
      id: l.platform,
      href: l.url,
      label: l.label,
    })),
  };
}
