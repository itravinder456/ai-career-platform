"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";
import ProjectCard from "@/components/widgets/ProjectCard";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { fetchProjects, Project } from "@/services/projects";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setError("Could not load projects — the API may be unreachable."));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar state="chat" />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "96px 24px 64px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
          Projects
        </h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}>
          A quick scan for anyone who&apos;d rather browse than ask — the chat has more depth on all of these
          if you want to dig in.
        </p>

        {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}
        {!projects && !error && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {projects?.map((p) => (
            <div key={p.slug}>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
