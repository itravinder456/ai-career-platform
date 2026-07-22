"use client";

import RuntimeGraph from "@/components/landing/RuntimeGraph";
import { TOPOLOGIES } from "@/lib/graphTopologies";

/** Slug -> the real system-shape topology from Home's carousel that actually
 * describes it (see lib/graphTopologies.tsx) — reused here rather than
 * inventing a second diagram, since these already accurately model the
 * project in question. Projects with no accurate pre-built shape are
 * intentionally left out rather than given a fabricated architecture. */
// fullstack_arch's own caption already names all four client projects it
// covers (Fleet Manager, Ayurway, iDestination, Notifii), so it's only
// attached to one of those cards (Fleet Manager) rather than repeated 4x.
export const PROJECT_TOPOLOGY: Record<string, string> = {
  "elsa-ai-assistant": "planner_executor",
  "ai-career-platform": "career_graph",
  "fleet-manager": "fullstack_arch",
};

export default function ProjectGraphPanel({ topologyId }: { topologyId: string }) {
  const topo = TOPOLOGIES.find((t) => t.id === topologyId);
  if (!topo) return null;

  return (
    <div className="graph-panel" style={{ marginTop: 14, marginBottom: 14 }}>
      <div className="graph-panel-head">
        <div className="graph-title">{topo.title}</div>
      </div>
      <div className="graph-canvas-wrap" style={{ height: 190 }}>
        <RuntimeGraph nodes={topo.nodes} edges={topo.edges} paths={topo.paths} />
      </div>
      <div className="graph-caption">{topo.caption}</div>
    </div>
  );
}
