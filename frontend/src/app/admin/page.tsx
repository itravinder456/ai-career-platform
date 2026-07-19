"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchProfile, ProfileData } from "@/services/profile";
import { AdminAuthError, AdminSocialLink, updateProfile, verifyAdminKey } from "@/services/admin";

const STORAGE_KEY = "admin_key";

type FormState = {
  name: string;
  headline: string;
  location: string;
  email: string;
  summary: string;
  resumeUrl: string;
  links: AdminSocialLink[];
};

function toFormState(profile: ProfileData): FormState {
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const loadProfile = async () => {
    try {
      const profile = await fetchProfile();
      setForm(toFormState(profile));
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
    setForm(null);
    setKeyInput("");
  };

  const save = async () => {
    if (!adminKey || !form) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(adminKey, {
        name: form.name,
        headline: form.headline,
        location: form.location,
        email: form.email,
        summary: form.summary || null,
        resume_url: form.resumeUrl,
        links: form.links,
      });
      setMessage({ type: "success", text: "Profile updated." });
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setMessage({ type: "error", text: "Admin key was rejected — locking." });
        lock();
      } else {
        setMessage({ type: "error", text: "Save failed — check the API is running." });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateLink = (index: number, patch: Partial<AdminSocialLink>) => {
    if (!form) return;
    const links = form.links.map((l, i) => (i === index ? { ...l, ...patch } : l));
    setForm({ ...form, links });
  };

  const removeLink = (index: number) => {
    if (!form) return;
    setForm({ ...form, links: form.links.filter((_, i) => i !== index) });
  };

  const addLink = () => {
    if (!form) return;
    setForm({
      ...form,
      links: [...form.links, { platform: "", label: "", url: "", display_order: form.links.length }],
    });
  };

  // ── Lock screen ────────────────────────────────────────────────────────────
  if (!adminKey) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <form
          onSubmit={unlock}
          style={{
            width: 340,
            padding: 28,
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--bg-2)",
          }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Admin
          </h1>
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
          {unlockError && (
            <p style={{ fontSize: 12, color: "#f87171", marginTop: 10 }}>{unlockError}</p>
          )}
          <button
            type="submit"
            disabled={unlocking || !keyInput}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              opacity: unlocking || !keyInput ? 0.6 : 1,
              cursor: unlocking || !keyInput ? "not-allowed" : "pointer",
            }}
          >
            {unlocking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  // ── Unlocked but profile still loading/failed ──────────────────────────────
  if (!form) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {loadError ?? "Loading profile…"}
      </div>
    );
  }

  // ── Editor ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            Profile admin
          </h1>
          <button
            onClick={lock}
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Lock
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 24,
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--bg-2)",
          }}
        >
          <Field label="Name">
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Headline">
            <input
              style={inputStyle}
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Location">
              <input
                style={inputStyle}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                style={inputStyle}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Summary">
            <textarea
              style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </Field>
          <Field label="Resume URL">
            <input
              style={inputStyle}
              value={form.resumeUrl}
              onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
            />
          </Field>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <label style={labelStyle}>Links</label>
              <button
                type="button"
                onClick={addLink}
                style={{
                  fontSize: 12,
                  color: "var(--accent-2)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + Add link
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.links.map((link, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 2fr auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    style={inputStyle}
                    placeholder="platform"
                    value={link.platform}
                    onChange={(e) => updateLink(i, { platform: e.target.value })}
                  />
                  <input
                    style={inputStyle}
                    placeholder="label"
                    value={link.label}
                    onChange={(e) => updateLink(i, { label: e.target.value })}
                  />
                  <input
                    style={inputStyle}
                    placeholder="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, { url: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    style={{
                      color: "#f87171",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "0 6px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {message && (
            <p
              style={{
                fontSize: 13,
                color: message.type === "success" ? "var(--green)" : "#f87171",
              }}
            >
              {message.text}
            </p>
          )}

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "12px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
