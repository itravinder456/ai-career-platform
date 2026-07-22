// Centralized so admin sections invalidate the exact same key the public
// pages/hooks read from — a typo'd key here would silently break cache
// invalidation after a save.
export const queryKeys = {
  profile: ["profile"] as const,
  projects: ["projects"] as const,
  experiences: ["experiences"] as const,
  skills: ["skills"] as const,
  documents: (docType: string) => ["documents", docType] as const,
};
