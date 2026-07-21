"use client";

import { useEffect, useState } from "react";
import { fetchProfile, ProfileData } from "@/services/profile";
import {
  AdminAuthError,
  AdminProfileStat,
  AdminSocialLink,
  updateProfile,
} from "@/services/admin";
import { cardStyle, Field, inputStyle, labelStyle, Message, primaryButtonStyle } from "./shared";

type ProfileFormState = {
  name: string;
  headline: string;
  location: string;
  email: string;
  summary: string;
  resumeUrl: string;
  links: AdminSocialLink[];
  stats: AdminProfileStat[];
};

function toProfileForm(profile: ProfileData): ProfileFormState {
  return {
    name: profile.name,
    headline: profile.headline,
    location: profile.location,
    email: profile.email,
    summary: profile.summary ?? "",
    resumeUrl: profile.resumeUrl,
    links: profile.links.map((l, i) => ({
      platform: l.id,
      label: l.label,
      url: l.href,
      display_order: i,
    })),
    stats: profile.stats.map((s, i) => ({ label: s.label, value: s.value, display_order: i })),
  };
}

export default function ProfileSection({
  adminKey,
  onAuthError,
}: {
  adminKey: string;
  onAuthError: () => void;
}) {
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((profile) => setProfileForm(toProfileForm(profile)))
      .catch(() => setLoadError("Could not load current profile from the API."));
  }, []);

  const save = async () => {
    if (!profileForm) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(adminKey, {
        name: profileForm.name,
        headline: profileForm.headline,
        location: profileForm.location,
        email: profileForm.email,
        summary: profileForm.summary || null,
        resume_url: profileForm.resumeUrl,
        links: profileForm.links,
        stats: profileForm.stats,
      });
      setMessage({ type: "success", text: "Profile updated." });
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

  const updateLink = (index: number, patch: Partial<AdminSocialLink>) => {
    if (!profileForm) return;
    const links = profileForm.links.map((l, i) => (i === index ? { ...l, ...patch } : l));
    setProfileForm({ ...profileForm, links });
  };
  const removeLink = (index: number) => {
    if (!profileForm) return;
    setProfileForm({ ...profileForm, links: profileForm.links.filter((_, i) => i !== index) });
  };
  const addLink = () => {
    if (!profileForm) return;
    setProfileForm({
      ...profileForm,
      links: [...profileForm.links, { platform: "", label: "", url: "", display_order: profileForm.links.length }],
    });
  };

  const updateStat = (index: number, patch: Partial<AdminProfileStat>) => {
    if (!profileForm) return;
    const stats = profileForm.stats.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setProfileForm({ ...profileForm, stats });
  };
  const removeStat = (index: number) => {
    if (!profileForm) return;
    setProfileForm({ ...profileForm, stats: profileForm.stats.filter((_, i) => i !== index) });
  };
  const addStat = () => {
    if (!profileForm) return;
    setProfileForm({
      ...profileForm,
      stats: [...profileForm.stats, { label: "", value: "", display_order: profileForm.stats.length }],
    });
  };

  if (!profileForm) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{loadError ?? "Loading profile…"}</div>;
  }

  return (
    <div style={cardStyle}>
      <Field label="Name">
        <input style={inputStyle} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
      </Field>
      <Field label="Headline">
        <input style={inputStyle} value={profileForm.headline} onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })} />
      </Field>
      <div className="admin-grid-2">
        <Field label="Location">
          <input style={inputStyle} value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} />
        </Field>
        <Field label="Email">
          <input style={inputStyle} value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
        </Field>
      </div>
      <Field label="Summary">
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
          value={profileForm.summary}
          onChange={(e) => setProfileForm({ ...profileForm, summary: e.target.value })}
        />
      </Field>
      <Field label="Resume URL">
        <input style={inputStyle} value={profileForm.resumeUrl} onChange={(e) => setProfileForm({ ...profileForm, resumeUrl: e.target.value })} />
      </Field>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={labelStyle}>Links</label>
          <button type="button" onClick={addLink} style={{ fontSize: 12, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer" }}>
            + Add link
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {profileForm.links.map((link, i) => (
            <div key={i} className="admin-row-link">
              <input style={inputStyle} placeholder="platform" value={link.platform} onChange={(e) => updateLink(i, { platform: e.target.value })} />
              <input style={inputStyle} placeholder="label" value={link.label} onChange={(e) => updateLink(i, { label: e.target.value })} />
              <input style={inputStyle} placeholder="url" value={link.url} onChange={(e) => updateLink(i, { url: e.target.value })} />
              <button type="button" onClick={() => removeLink(i)} style={{ color: "#f87171", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "0 6px" }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={labelStyle}>Stats (hero landing page)</label>
          <button type="button" onClick={addStat} style={{ fontSize: 12, color: "var(--accent-2)", background: "transparent", border: "none", cursor: "pointer" }}>
            + Add stat
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {profileForm.stats.map((stat, i) => (
            <div key={i} className="admin-row-stat">
              <input style={inputStyle} placeholder="value (e.g. 6+)" value={stat.value} onChange={(e) => updateStat(i, { value: e.target.value })} />
              <input style={inputStyle} placeholder="label (e.g. Years AI/ML)" value={stat.label} onChange={(e) => updateStat(i, { label: e.target.value })} />
              <button type="button" onClick={() => removeStat(i)} style={{ color: "#f87171", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "0 6px" }}>
                ✕
              </button>
            </div>
          ))}
          {profileForm.stats.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No stats — the hero stats row will be empty.</p>
          )}
        </div>
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
