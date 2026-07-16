import { Widget } from "@/types/chat";
import TechStack from "./TechStack";
import ProjectCard from "./ProjectCard";
import ArchitectureCard from "./ArchitectureCard";
import SkillGraph from "./SkillGraph";
import ResumePreview from "./ResumePreview";

export default function WidgetRenderer({ widgets }: { widgets: Widget[] }) {
  return (
    <div className="space-y-2">
      {widgets.map((widget, i) => {
        switch (widget.type) {
          case "tech_stack":
            return <TechStack key={i} categories={(widget.data as any).categories} />;
          case "project_card":
            return <ProjectCard key={i} data={widget.data as any} />;
          case "architecture":
            return <ArchitectureCard key={i} layers={(widget.data as any).layers} />;
          case "skill_graph":
            return <SkillGraph key={i} skills={(widget.data as any).skills} />;
          case "resume_preview":
            return <ResumePreview key={i} data={widget.data as any} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
