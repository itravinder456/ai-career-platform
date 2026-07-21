"use client";

import { useEffect, useState } from "react";
import { fetchProjects } from "@/services/projects";
import { AdminAuthError, AdminProject, updateProjects } from "@/services/admin";
import {
  addButtonStyle,
  cardStyle,
  Field,
  fromCsv,
  fromLines,
  inputStyle,
  itemCardStyle,
  labelStyle,
  Message,
  primaryButtonStyle,
  removeButtonStyle,
  toCsv,
  toLines,
} from "./shared";

type ProjectForm = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  tech_stack: string; // comma-separated in the UI
  impact: string; // one-per-line in the UI
  repo_url: string;
  demo_url: string;
  image_url: string;
  status: string;
  featured: boolean;
  start_date: string;
  end_date: string;
};

const emptyProject: ProjectForm = {
  slug: "",
  name: "",
  summary: "",
  description: "",
  tech_stack: "",
  impact: "",
  repo_url: "",
  demo_url: "",
  image_url: "",
  status: "completed",
  featured: false,
  start_date: "",
  end_date: "",
};

function toForm(p: Awaited<ReturnType<typeof fetchProjects>>[number]): ProjectForm {
  return {
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    description: p.description ?? "",
    tech_stack: toCsv(p.tech_stack),
    impact: toLines(p.impact),
    repo_url: p.repo_url ?? "",
    demo_url: p.demo_url ?? "",
    image_url: p.image_url ?? "",
    status: p.status,
    featured: p.featured,
    start_date: p.start_date ?? "",
    end_date: p.end_date ?? "",
  };
}

function toApi(p: ProjectForm, display_order: number): AdminProject {
  return {
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    description: p.description || null,
    tech_stack: fromCsv(p.tech_stack),
    impact: fromLines(p.impact),
    repo_url: p.repo_url || null,
    demo_url: p.demo_url || null,
    image_url: p.image_url || null,
    status: p.status,
    featured: p.featured,
    start_date: p.start_date || null,
    end_date: p.end_date || null,
    display_order,
  };
}

export default function ProjectsSection({
  adminKey,
  onAuthError,
}: {
  adminKey: string;
  onAuthError: () => void;
}) {
  const [items, setItems] = useState<ProjectForm[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((projects) => setItems(projects.map(toForm)))
      .catch(() => setLoadError("Could not load projects from the API."));
  }, []);

  const update = (index: number, patch: Partial<ProjectForm>) => {
    if (!items) return;
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const remove = (index: number) => {
    if (!items) return;
    setItems(items.filter((_, i) => i !== index));
  };
  const add = () => {
    if (!items) return;
    setItems([...items, { ...emptyProject }]);
  };

  const save = async () => {
    if (!items) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = items.map((it, i) => toApi(it, i));
      await updateProjects(adminKey, payload);
      setMessage({ type: "success", text: "Projects updated." });
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setMessage({ type: "error", text: "Admin key was rejected — locking." });
        onAuthError();
      } else {
        setMessage({ type: "error", text: "Save failed — check the API is running." });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!items) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{loadError ?? "Loading projects…"}</div>;
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={labelStyle}>Projects ({items.length})</label>
        <button type="button" onClick={add} style={addButtonStyle}>
          + Add project
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((p, i) => (
          <div key={i} style={itemCardStyle}>
            <div className="admin-grid-2">
              <Field label="Slug">
                <input style={inputStyle} value={p.slug} onChange={(e) => update(i, { slug: e.target.value })} />
              </Field>
              <Field label="Name">
                <input style={inputStyle} value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
              </Field>
            </div>
            <Field label="Summary (short, shown on the project card)">
              <input style={inputStyle} value={p.summary} onChange={(e) => update(i, { summary: e.target.value })} />
            </Field>
            <Field label="Description (full write-up, used for RAG + expanded view)">
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                value={p.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </Field>
            <Field label="Tech stack (comma-separated)">
              <input style={inputStyle} value={p.tech_stack} onChange={(e) => update(i, { tech_stack: e.target.value })} />
            </Field>
            <Field label="Impact / outcomes (one per line)">
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
                value={p.impact}
                onChange={(e) => update(i, { impact: e.target.value })}
              />
            </Field>
            <div className="admin-grid-2">
              <Field label="Repo URL">
                <input style={inputStyle} value={p.repo_url} onChange={(e) => update(i, { repo_url: e.target.value })} />
              </Field>
              <Field label="Demo URL">
                <input style={inputStyle} value={p.demo_url} onChange={(e) => update(i, { demo_url: e.target.value })} />
              </Field>
            </div>
            <div className="admin-grid-2">
              <Field label="Status">
                <input style={inputStyle} value={p.status} onChange={(e) => update(i, { status: e.target.value })} />
              </Field>
              <Field label="Image URL">
                <input style={inputStyle} value={p.image_url} onChange={(e) => update(i, { image_url: e.target.value })} />
              </Field>
            </div>
            <div className="admin-grid-2">
              <Field label="Start date">
                <input type="date" style={inputStyle} value={p.start_date} onChange={(e) => update(i, { start_date: e.target.value })} />
              </Field>
              <Field label="End date">
                <input type="date" style={inputStyle} value={p.end_date} onChange={(e) => update(i, { end_date: e.target.value })} />
              </Field>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={p.featured} onChange={(e) => update(i, { featured: e.target.checked })} />
              Featured
            </label>
            <button type="button" onClick={() => remove(i)} style={removeButtonStyle}>
              Remove project
            </button>
          </div>
        ))}
      </div>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "#f87171" }}>{message.text}</p>
      )}

      <button onClick={save} disabled={saving} style={primaryButtonStyle(saving)}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
