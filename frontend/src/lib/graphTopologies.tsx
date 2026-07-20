import type { ReactNode } from "react";
import type { GraphNode, GraphEdge, GraphPath } from "@/components/landing/RuntimeGraph";

// Three real system shapes, not decorative diagrams — each mirrors an
// architecture actually described in data/{ (this repo's own RAG source) or
// services/runtime. Kept as one hub -> four branches -> one sink so all three
// share the same visual rhythm in the carousel and RuntimeGraph needs no
// per-shape special-casing.
export interface Topology {
  id: string;
  title: ReactNode;
  caption: ReactNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: GraphPath[];
}

export const TOPOLOGIES: Topology[] = [
  {
    id: "career_graph",
    title: (
      <>
        <b>career_graph</b> · runtime.state
      </>
    ),
    caption: (
      <>
        This is the actual LangGraph topology behind the chat — a planner breaks compound
        questions into focused sub-tasks that run <b>concurrently</b>, grounded in the real
        resume, before <b>respond</b> synthesizes them into one answer.
      </>
    ),
    nodes: [
      { id: "start", label: "start", x: 0.08, y: 0.5, r: 5 },
      { id: "plan", label: "plan_tasks", x: 0.34, y: 0.5, r: 7 },
      { id: "project", label: "execute_task", x: 0.64, y: 0.12, r: 6 },
      { id: "skills", label: "execute_task", x: 0.64, y: 0.37, r: 6 },
      { id: "resume", label: "execute_task", x: 0.64, y: 0.62, r: 6 },
      { id: "jd_match", label: "execute_task", x: 0.64, y: 0.87, r: 6 },
      { id: "respond", label: "respond", x: 0.92, y: 0.5, r: 7 },
    ],
    edges: [
      ["start", "plan"],
      ["plan", "project"],
      ["plan", "skills"],
      ["plan", "resume"],
      ["plan", "jd_match"],
      ["project", "respond"],
      ["skills", "respond"],
      ["resume", "respond"],
      ["jd_match", "respond"],
    ],
    paths: [
      ["start", "plan", "project", "respond"],
      ["start", "plan", "skills", "respond"],
      ["start", "plan", "resume", "respond"],
      ["start", "plan", "jd_match", "respond"],
    ],
  },

  {
    id: "planner_executor",
    title: (
      <>
        <b>planner_executor</b> · elsa.state
      </>
    ),
    caption: (
      <>
        The multi-agent core behind Elsa, the enterprise AI platform I built at EPAM — a supervisor
        plans, then delegates to narrow sub-agents (RAG, Jira automation, analytics, summarization)
        before <b>compose</b> merges their output into one response.
      </>
    ),
    nodes: [
      { id: "request", label: "request", x: 0.06, y: 0.5, r: 5 },
      { id: "supervisor", label: "supervisor", x: 0.32, y: 0.5, r: 7 },
      { id: "rag", label: "rag_retrieval", x: 0.6, y: 0.12, r: 6 },
      { id: "jira", label: "jira_automation", x: 0.6, y: 0.37, r: 6 },
      { id: "analytics", label: "analytics", x: 0.6, y: 0.62, r: 6 },
      { id: "summarize", label: "summarization", x: 0.6, y: 0.87, r: 6 },
      { id: "compose", label: "compose", x: 0.92, y: 0.5, r: 7 },
    ],
    edges: [
      ["request", "supervisor"],
      ["supervisor", "rag"],
      ["supervisor", "jira"],
      ["supervisor", "analytics"],
      ["supervisor", "summarize"],
      ["rag", "compose"],
      ["jira", "compose"],
      ["analytics", "compose"],
      ["summarize", "compose"],
    ],
    paths: [
      ["request", "supervisor", "rag", "compose"],
      ["request", "supervisor", "jira", "compose"],
      ["request", "supervisor", "analytics", "compose"],
      ["request", "supervisor", "summarize", "compose"],
    ],
  },

  {
    id: "fullstack_arch",
    title: (
      <>
        <b>fullstack_arch</b> · platform.state
      </>
    ),
    caption: (
      <>
        The shape behind the full-stack platforms I&apos;ve shipped (Fleet Manager, Ayurway,
        iDestination, Notifii) — one gateway, RBAC-gated business logic, async data pipelines, and
        third-party integrations, all backed by <b>Postgres</b>.
      </>
    ),
    nodes: [
      { id: "client", label: "client", x: 0.06, y: 0.5, r: 5 },
      { id: "gateway", label: "api_gateway", x: 0.3, y: 0.5, r: 7 },
      { id: "auth", label: "auth_rbac", x: 0.6, y: 0.12, r: 6 },
      { id: "logic", label: "business_logic", x: 0.6, y: 0.37, r: 6 },
      { id: "pipeline", label: "data_pipeline", x: 0.6, y: 0.62, r: 6 },
      { id: "integration", label: "3rd_party_api", x: 0.6, y: 0.87, r: 6 },
      { id: "response", label: "postgres", x: 0.92, y: 0.5, r: 7 },
    ],
    edges: [
      ["client", "gateway"],
      ["gateway", "auth"],
      ["gateway", "logic"],
      ["gateway", "pipeline"],
      ["gateway", "integration"],
      ["auth", "response"],
      ["logic", "response"],
      ["pipeline", "response"],
      ["integration", "response"],
    ],
    paths: [
      ["client", "gateway", "auth", "response"],
      ["client", "gateway", "logic", "response"],
      ["client", "gateway", "pipeline", "response"],
      ["client", "gateway", "integration", "response"],
    ],
  },
];
