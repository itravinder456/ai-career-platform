"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";
import TechStack from "@/components/widgets/TechStack";
import SkillGraph from "@/components/widgets/SkillGraph";
import { fetchSkills, Skill } from "@/services/skills";

function groupByCategory(skills: Skill[]): { label: string; items: string[] }[] {
  const order: string[] = [];
  const byCategory = new Map<string, string[]>();
  for (const s of skills) {
    if (!byCategory.has(s.category)) {
      byCategory.set(s.category, []);
      order.push(s.category);
    }
    byCategory.get(s.category)!.push(s.name);
  }
  return order.map((label) => ({ label, items: byCategory.get(label)! }));
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => setError("Could not load skills — the API may be unreachable."));
  }, []);

  const rated = skills?.filter((s) => s.proficiency != null) ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar state="chat" />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "96px 24px 64px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Skills
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>
          Grouped the way I&apos;d actually describe my own stack, not a keyword dump.
        </p>

        {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}
        {!skills && !error && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}

        {rated.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SkillGraph skills={rated.map((s) => ({ name: s.name, level: s.proficiency! }))} />
          </div>
        )}

        {skills && <TechStack categories={groupByCategory(skills)} />}
      </div>
    </div>
  );
}
