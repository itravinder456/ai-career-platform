"use client";

import PageShell from "@/components/ui/PageShell";
import PageLoader from "@/components/ui/PageLoader";
import ExperienceTimeline from "@/components/experience/ExperienceTimeline";
import { useExperiences } from "@/hooks/useExperiences";

export default function ExperiencePage() {
  const { data: experiences, isError } = useExperiences();

  return (
    <PageShell eyebrow="CAREER.LOG" title="Experience" subtitle="Work history, most recent first.">
      {isError && (
        <p style={{ fontSize: 13, color: "#f87171", textAlign: "center" }}>
          Could not load experience — the API may be unreachable.
        </p>
      )}
      {!experiences && !isError && <PageLoader />}

      {experiences && <ExperienceTimeline experiences={experiences} />}
    </PageShell>
  );
}
