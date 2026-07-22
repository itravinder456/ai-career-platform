"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queryKeys";
import { fetchExperiences } from "@/services/experiences";
import { AdminAuthError, AdminExperience, updateExperiences } from "@/services/admin";
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

type ExperienceForm = {
  company: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  summary: string;
  achievements: string; // one-per-line in the UI
  tech_stack: string; // comma-separated in the UI
};

const emptyExperience: ExperienceForm = {
  company: "",
  title: "",
  location: "",
  start_date: "",
  end_date: "",
  summary: "",
  achievements: "",
  tech_stack: "",
};

function toForm(e: Awaited<ReturnType<typeof fetchExperiences>>[number]): ExperienceForm {
  return {
    company: e.company,
    title: e.title,
    location: e.location ?? "",
    start_date: e.start_date,
    end_date: e.end_date ?? "",
    summary: e.summary ?? "",
    achievements: toLines(e.achievements),
    tech_stack: toCsv(e.tech_stack),
  };
}

function toApi(e: ExperienceForm, display_order: number): AdminExperience {
  return {
    company: e.company,
    title: e.title,
    location: e.location || null,
    start_date: e.start_date,
    end_date: e.end_date || null,
    summary: e.summary || null,
    achievements: fromLines(e.achievements),
    tech_stack: fromCsv(e.tech_stack),
    display_order,
  };
}

export default function ExperienceSection({
  adminKey,
  onAuthError,
}: {
  adminKey: string;
  onAuthError: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isError } = useQuery({ queryKey: queryKeys.experiences, queryFn: fetchExperiences });

  const [items, setItems] = useState<ExperienceForm[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // Seed local edit state once, adjusted during render (not in an effect) —
  // see ProfileSection.tsx for why this pattern is used here.
  if (data && items === null) {
    setItems(data.map(toForm));
  }

  const update = (index: number, patch: Partial<ExperienceForm>) => {
    if (!items) return;
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const remove = (index: number) => {
    if (!items) return;
    setItems(items.filter((_, i) => i !== index));
  };
  const add = () => {
    if (!items) return;
    setItems([...items, { ...emptyExperience }]);
  };

  const save = async () => {
    if (!items) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = items.map((it, i) => toApi(it, i));
      await updateExperiences(adminKey, payload);
      await queryClient.invalidateQueries({ queryKey: queryKeys.experiences });
      setMessage({ type: "success", text: "Experience updated." });
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
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
        {isError ? "Could not load experience from the API." : "Loading experience…"}
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={labelStyle}>Experience ({items.length})</label>
        <button type="button" onClick={add} style={addButtonStyle}>
          + Add role
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((e, i) => (
          <div key={i} style={itemCardStyle}>
            <div className="admin-grid-2">
              <Field label="Company">
                <input style={inputStyle} value={e.company} onChange={(ev) => update(i, { company: ev.target.value })} />
              </Field>
              <Field label="Title">
                <input style={inputStyle} value={e.title} onChange={(ev) => update(i, { title: ev.target.value })} />
              </Field>
            </div>
            <Field label="Location (optional)">
              <input style={inputStyle} value={e.location} onChange={(ev) => update(i, { location: ev.target.value })} />
            </Field>
            <div className="admin-grid-2">
              <Field label="Start date">
                <input type="date" style={inputStyle} value={e.start_date} onChange={(ev) => update(i, { start_date: ev.target.value })} />
              </Field>
              <Field label="End date (blank = current role)">
                <input type="date" style={inputStyle} value={e.end_date} onChange={(ev) => update(i, { end_date: ev.target.value })} />
              </Field>
            </div>
            <Field label="Summary (optional)">
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
                value={e.summary}
                onChange={(ev) => update(i, { summary: ev.target.value })}
              />
            </Field>
            <Field label="Achievements (one per line)">
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
                value={e.achievements}
                onChange={(ev) => update(i, { achievements: ev.target.value })}
              />
            </Field>
            <Field label="Tech stack (comma-separated)">
              <input style={inputStyle} value={e.tech_stack} onChange={(ev) => update(i, { tech_stack: ev.target.value })} />
            </Field>
            <button type="button" onClick={() => remove(i)} style={removeButtonStyle}>
              Remove role
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
