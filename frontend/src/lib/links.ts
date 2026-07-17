// Social / external links — shared by Navbar and the chat sidebar so they never drift.

export type SocialId = "github" | "linkedin" | "resume";

export interface SocialLink {
  id: SocialId;
  href: string;
  label: string;
  download?: boolean;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { id: "github", href: "https://github.com/ravinder-varikuppala", label: "GitHub" },
  { id: "linkedin", href: "https://linkedin.com/in/ravinder-varikuppala", label: "LinkedIn" },
  { id: "resume", href: "/resume.pdf", label: "Resume", download: true },
];
