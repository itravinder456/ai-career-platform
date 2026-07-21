"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";
import ExperienceTimeline from "@/components/experience/ExperienceTimeline";
import { fetchExperiences, Experience } from "@/services/experiences";

export default function ExperiencePage() {
  const [experiences, setExperiences] = useState<Experience[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiences()
      .then(setExperiences)
      .catch(() => setError("Could not load experience — the API may be unreachable."));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar state="chat" />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "96px 24px 64px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Experience
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>
          Work history, most recent first.
        </p>

        {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}
        {!experiences && !error && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}

        {experiences && <ExperienceTimeline experiences={experiences} />}
      </div>
    </div>
  );
}
