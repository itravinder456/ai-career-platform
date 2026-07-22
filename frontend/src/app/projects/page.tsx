"use client";

import { motion } from "framer-motion";
import PageShell from "@/components/ui/PageShell";
import PageLoader from "@/components/ui/PageLoader";
import ProjectCard from "@/components/widgets/ProjectCard";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { useProjects } from "@/hooks/useProjects";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const indexLabel = (i: number) => `PROJ_${String(i + 1).padStart(2, "0")}`;

export default function ProjectsPage() {
  const { data: projects, isError } = useProjects();
  const featuredIndex = projects?.findIndex((p) => p.featured) ?? -1;

  return (
    <PageShell
      eyebrow="PROJECTS.LOG"
      title="Projects"
      subtitle="A quick scan for anyone who'd rather browse than ask — the chat has more depth on all of these if you want to dig in."
    >
      {isError && (
        <p style={{ fontSize: 13, color: "#f87171", textAlign: "center" }}>
          Could not load projects — the API may be unreachable.
        </p>
      )}
      {!projects && !isError && <PageLoader />}

      <div
        style={{
          display: "grid",
          // min(420px, 100%), not a bare 420px: on a viewport narrower than
          // that, a bare minimum forces the grid wider than its container
          // instead of collapsing to one column — this caps it at 100% so it
          // degrades to a single column on phones instead of overflowing.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
          gap: 28,
        }}
      >
        {projects?.map((p, i) => (
          <motion.div
            key={p.slug}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
            style={{ gridColumn: i === featuredIndex ? "1 / -1" : undefined }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                fontFamily: "var(--font-tech), monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "var(--hero-muted)",
              }}
            >
              <span>{indexLabel(i)}</span>
              {i === featuredIndex && (
                <span
                  style={{
                    padding: "1px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--hero-line-bright)",
                    color: "var(--copper-bright)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                  }}
                >
                  FLAGSHIP
                </span>
              )}
              <span style={{ flex: 1, height: 1, background: "var(--hero-line)" }} />
            </div>
            <ProjectCard
              data={{
                name: p.name,
                description: p.summary,
                impact: p.impact,
                tech: p.tech_stack,
                github: p.repo_url ?? undefined,
                status: p.status,
              }}
            />
            <ProjectDetail description={p.description} demoUrl={p.demo_url} />
          </motion.div>
        ))}
      </div>
    </PageShell>
  );
}
