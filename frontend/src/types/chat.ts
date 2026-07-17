export type Role = "user" | "assistant";

export type WidgetType =
  | "project_card"
  | "tech_stack"
  | "architecture"
  | "timeline"
  | "github_activity"
  | "resume_preview"
  | "skill_graph"
  | "jd_match";

export interface Widget {
  type: WidgetType;
  data: Record<string, unknown>;
}

export type StepStatus = "running" | "done";

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  widgets?: Widget[];
  steps?: Step[];
  isStreaming?: boolean;
  timestamp: Date;
}

export type AppState = "landing" | "chat";
