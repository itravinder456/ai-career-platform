"use client";

import { useEffect, useState } from "react";
import { fetchSkills } from "@/services/skills";
import { AdminAuthError, AdminSkill, updateSkills } from "@/services/admin";
import {
  addButtonStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  Message,
  primaryButtonStyle,
  removeButtonStyle,
} from "./shared";

type SkillForm = {
  name: string;
  category: string;
  proficiency: string; // "" = unrated, else "0"-"100"
};

const emptySkill: SkillForm = { name: "", category: "", proficiency: "" };

function toForm(s: Awaited<ReturnType<typeof fetchSkills>>[number]): SkillForm {
  return { name: s.name, category: s.category, proficiency: s.proficiency == null ? "" : String(s.proficiency) };
}

function toApi(s: SkillForm, display_order: number): AdminSkill {
  return {
    name: s.name,
    category: s.category,
    proficiency: s.proficiency === "" ? null : Math.max(0, Math.min(100, Number(s.proficiency))),
    display_order,
  };
}

export default function SkillsSection({
  adminKey,
  onAuthError,
}: {
  adminKey: string;
  onAuthError: () => void;
}) {
  const [items, setItems] = useState<SkillForm[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchSkills()
      .then((skills) => setItems(skills.map(toForm)))
      .catch(() => setLoadError("Could not load skills from the API."));
  }, []);

  const update = (index: number, patch: Partial<SkillForm>) => {
    if (!items) return;
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const remove = (index: number) => {
    if (!items) return;
    setItems(items.filter((_, i) => i !== index));
  };
  const add = () => {
    if (!items) return;
    setItems([...items, { ...emptySkill }]);
  };

  const save = async () => {
    if (!items) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = items.map((it, i) => toApi(it, i));
      await updateSkills(adminKey, payload);
      setMessage({ type: "success", text: "Skills updated." });
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
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{loadError ?? "Loading skills…"}</div>;
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={labelStyle}>Skills ({items.length})</label>
        <button type="button" onClick={add} style={addButtonStyle}>
          + Add skill
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8 }}>
        Proficiency is optional (0-100) — only skills with a value show up in the /skills page&apos;s graph view;
        the rest still show up grouped by category.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((s, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr 0.7fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input style={inputStyle} placeholder="name (e.g. RAG)" value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
            <input style={inputStyle} placeholder="category (e.g. AI / LLM)" value={s.category} onChange={(e) => update(i, { category: e.target.value })} />
            <input
              style={inputStyle}
              placeholder="0-100"
              type="number"
              min={0}
              max={100}
              value={s.proficiency}
              onChange={(e) => update(i, { proficiency: e.target.value })}
            />
            <button type="button" onClick={() => remove(i)} style={removeButtonStyle}>
              ✕
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
