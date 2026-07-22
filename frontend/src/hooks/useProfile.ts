"use client";

import { useQuery } from "@tanstack/react-query";
import { FALLBACK_SOCIAL_LINKS, SocialLink } from "@/lib/links";
import { fetchProfile, ProfileData } from "@/services/profile";
import { queryKeys } from "./queryKeys";

interface UseProfileResult {
  profile: ProfileData | null;
  links: SocialLink[];
}

export function useProfile(): UseProfileResult {
  const { data } = useQuery({
    queryKey: queryKeys.profile,
    queryFn: fetchProfile,
    // Falls back to FALLBACK_SOCIAL_LINKS below on error — the api service may
    // be down — rather than surfacing a loading/error state in the navbar.
    retry: false,
  });

  const links: SocialLink[] = data
    ? data.links.map((l) => ({ ...l, download: l.id === "resume" }))
    : FALLBACK_SOCIAL_LINKS;

  return { profile: data ?? null, links };
}
