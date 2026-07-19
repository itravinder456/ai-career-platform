"use client";

import { useEffect, useState } from "react";
import { FALLBACK_SOCIAL_LINKS, SocialLink } from "@/lib/links";
import { fetchProfile, ProfileData } from "@/services/profile";

interface UseProfileResult {
  profile: ProfileData | null;
  links: SocialLink[];
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        // Falls back to FALLBACK_SOCIAL_LINKS below — api service may be down.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const links: SocialLink[] = profile
    ? profile.links.map((l) => ({ ...l, download: l.id === "resume" }))
    : FALLBACK_SOCIAL_LINKS;

  return { profile, links };
}
