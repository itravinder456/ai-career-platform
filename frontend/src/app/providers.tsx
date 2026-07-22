"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 5 minutes: this data (profile/projects/experience/skills/documents) is only
// ever admin-edited, never real-time — no reason to refetch on every page nav
// within that window. Admin saves invalidate the relevant query directly
// (see the admin sections), so edits still show up immediately.
const STALE_TIME_MS = 5 * 60 * 1000;

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
