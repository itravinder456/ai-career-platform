"use client";

import PageShell from "@/components/ui/PageShell";
import PageLoader from "@/components/ui/PageLoader";
import SkillGraph from "@/components/widgets/SkillGraph";
import SkillModuleGrid, { SkillModule } from "@/components/skills/SkillModuleGrid";
import { useSkills } from "@/hooks/useSkills";
import type { Skill } from "@/services/skills";

function groupByCategory(skills: Skill[]): SkillModule[] {
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
  const { data: skills, isError } = useSkills();

  const rated = skills?.filter((s) => s.proficiency != null) ?? [];

  return (
    <PageShell
      eyebrow="SKILLS.LOG"
      title="Skills"
      subtitle="Grouped the way I'd actually describe my own stack, not a keyword dump."
    >
      {isError && (
        <p style={{ fontSize: 13, color: "#f87171", textAlign: "center" }}>
          Could not load skills — the API may be unreachable.
        </p>
      )}
      {!skills && !isError && <PageLoader />}

      {rated.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SkillGraph skills={rated.map((s) => ({ name: s.name, level: s.proficiency! }))} />
        </div>
      )}

      {skills && <SkillModuleGrid modules={groupByCategory(skills)} />}
    </PageShell>
  );
}
