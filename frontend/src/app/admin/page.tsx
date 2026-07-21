"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminAuthError, verifyAdminKey } from "@/services/admin";
import { inputStyle, primaryButtonStyle } from "./_sections/shared";
import ProfileSection from "./_sections/ProfileSection";
import ProjectsSection from "./_sections/ProjectsSection";
import ExperienceSection from "./_sections/ExperienceSection";
import SkillsSection from "./_sections/SkillsSection";
import DocumentsSection from "./_sections/DocumentsSection";

const STORAGE_KEY = "admin_key";

const TABS = ["Profile", "Projects", "Experience", "Skills", "Documents"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Profile");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (!stored) return;

    verifyAdminKey(stored)
      .then(() => setAdminKey(stored))
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
    } catch (err) {
      setUnlockError(err instanceof AdminAuthError ? "Invalid admin key." : "Could not reach the API.");
    } finally {
      setUnlocking(false);
    }
  };

  const lock = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKey(null);
    setKeyInput("");
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Admin</h1>
          <button
            onClick={lock}
            style={{ fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
          >
            Lock
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                background: "transparent",
                border: "none",
                borderBottom: t === tab ? "2px solid var(--accent-2)" : "2px solid transparent",
                color: t === tab ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Profile" && <ProfileSection adminKey={adminKey} onAuthError={lock} />}
        {tab === "Projects" && <ProjectsSection adminKey={adminKey} onAuthError={lock} />}
        {tab === "Experience" && <ExperienceSection adminKey={adminKey} onAuthError={lock} />}
        {tab === "Skills" && <SkillsSection adminKey={adminKey} onAuthError={lock} />}
        {tab === "Documents" && <DocumentsSection adminKey={adminKey} onAuthError={lock} />}
      </div>
    </div>
  );
}
