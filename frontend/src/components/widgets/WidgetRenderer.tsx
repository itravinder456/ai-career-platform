import type { ComponentProps } from "react";
import { Widget } from "@/types/chat";
import TechStack from "./TechStack";
import ProjectCard from "./ProjectCard";
import ArchitectureCard from "./ArchitectureCard";
import SkillGraph from "./SkillGraph";
import ResumePreview from "./ResumePreview";

// widget.data is Record<string, unknown> (built from LLM JSON at runtime); assert it
// to each child's own inferred prop type at the dispatch boundary — no `any`.
function as<T>(value: unknown): T {
  return value as T;
}

export default function WidgetRenderer({ widgets }: { widgets: Widget[] }) {
  return (
    <div className="space-y-2">
      {widgets.map((widget, i) => {
        switch (widget.type) {
          case "tech_stack":
            return (
              <TechStack
                key={i}
                categories={as<ComponentProps<typeof TechStack>["categories"]>(widget.data.categories)}
              />
            );
          case "project_card":
            return <ProjectCard key={i} data={as<ComponentProps<typeof ProjectCard>["data"]>(widget.data)} />;
          case "architecture":
            return (
              <ArchitectureCard
                key={i}
                layers={as<ComponentProps<typeof ArchitectureCard>["layers"]>(widget.data.layers)}
              />
            );
          case "skill_graph":
            return (
              <SkillGraph
                key={i}
                skills={as<ComponentProps<typeof SkillGraph>["skills"]>(widget.data.skills)}
              />
            );
          case "resume_preview":
            return <ResumePreview key={i} data={as<ComponentProps<typeof ResumePreview>["data"]>(widget.data)} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
