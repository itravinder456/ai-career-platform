"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchProfile, ProfileData } from "@/services/profile";
import {
  AdminAuthError,
  AdminProfileStat,
  AdminSocialLink,
  updateProfile,
  verifyAdminKey,
} from "@/services/admin";

const STORAGE_KEY = "admin_key";

type Message = { type: "success" | "error"; text: string };

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
  display: "block",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--bg-2)",
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "12px 0",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  opacity: disabled ? 0.6 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<Message | null>(null);

  const loadProfile = async () => {
    try {
      const profile = await fetchProfile();
      setProfileForm(toProfileForm(profile));
    } catch {
      setLoadError("Could not load current profile from the API.");
    }
  };

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (!stored) return;

    verifyAdminKey(stored)
      .then(() => {
        setAdminKey(stored);
        return loadProfile();
      })
      .catch(() => {
        sessionStorage.removeItem(STORAGE_KEY);
      });
  }, []);

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      await verifyAdminKey(keyInput);
      sessionStorage.setItem(STORAGE_KEY, keyInput);
      setAdminKey(keyInput);
      await loadProfile();
    } catch (err) {
      setUnlockError(err instanceof AdminAuthError ? "Invalid admin key." : "Could not reach the API.");
    } finally {
      setUnlocking(false);
    }
  };

  const lock = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey(null);
    setProfileForm(null);
    setKeyInput("");
  };

  const saveProfile = async () => {
    if (!adminKey || !profileForm) return;
    setProfileSaving(true);
    setProfileMessage(null);
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
      setProfileMessage({ type: "success", text: "Profile updated." });
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setProfileMessage({ type: "error", text: "Admin key was rejected — locking." });
        lock();
      } else {
        setProfileMessage({ type: "error", text: "Save failed — check the API is running." });
      }
    } finally {
      setProfileSaving(false);
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

  // ── Lock screen ────────────────────────────────────────────────────────────
  if (!adminKey) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <form
          onSubmit={unlock}
          style={{ width: 340, padding: 28, borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-2)" }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Admin</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Enter the admin key to continue.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin key"
            autoFocus
            style={inputStyle}
          />
          {unlockError && <p style={{ fontSize: 12, color: "#f87171", marginTop: 10 }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking || !keyInput} style={{ ...primaryButtonStyle(unlocking || !keyInput), width: "100%", marginTop: 16 }}>
            {unlocking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Profile admin</h1>
          <button
            onClick={lock}
            style={{ fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
          >
            Lock
          </button>
        </div>

        {!profileForm ? (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{loadError ?? "Loading profile…"}</div>
        ) : (
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

            {profileMessage && (
              <p style={{ fontSize: 13, color: profileMessage.type === "success" ? "var(--green)" : "#f87171" }}>{profileMessage.text}</p>
            )}

            <button onClick={saveProfile} disabled={profileSaving} style={primaryButtonStyle(profileSaving)}>
              {profileSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
