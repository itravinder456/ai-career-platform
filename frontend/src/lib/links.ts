// Social / external links — fallback used only if GET /api/v1/profile fails
// (see @/hooks/useProfile). Postgres (services/api) is the source of truth.

export type SocialId = "github" | "linkedin" | "resume";

export interface SocialLink {
  id: SocialId;
  href: string;
  label: string;
  download?: boolean;
}

export const FALLBACK_SOCIAL_LINKS: SocialLink[] = [
  { id: "github", href: "https://github.com/itravinder456", label: "GitHub" },
  { id: "linkedin", href: "https://www.linkedin.com/in/varikuppala-ravinder/", label: "LinkedIn" },
  { id: "resume", href: "/resume", label: "Resume", download: true },
];
