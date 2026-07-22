"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminAuthError, verifyAdminKey } from "@/services/admin";
import PageShell from "@/components/ui/PageShell";
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
      <div className="relative min-h-screen overflow-x-hidden dot-grid" style={{ background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, transparent 40%, var(--bg) 100%)" }}
        />
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: "20%",
            right: "18%",
            width: 460,
            height: 460,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(107,138,148,0.12) 0%, transparent 68%)",
            filter: "blur(70px)",
          }}
        />

        <form
          onSubmit={unlock}
          className="relative z-10"
          style={{
            width: 340,
            padding: 28,
            borderRadius: 13,
            border: "1px solid var(--hero-line)",
            background: "linear-gradient(160deg, rgba(107,138,148,0.06) 0%, rgba(16,15,12,0.95) 60%)",
          }}
        >
          <div className="hero2-eyebrow" style={{ marginBottom: 10 }}>
            <span className="dot" />
            ADMIN.LOG
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Admin</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
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
    <PageShell eyebrow="ADMIN.LOG" title="Admin" subtitle="Edit profile, projects, experience, skills, and documents." compact>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 32,
          borderBottom: "1px solid var(--hero-line)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px",
                fontFamily: "var(--font-tech), monospace",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "transparent",
                border: "none",
                borderBottom: t === tab ? "2px solid var(--copper-bright)" : "2px solid transparent",
                color: t === tab ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={lock}
          style={{
            fontFamily: "var(--font-tech), monospace",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--text-secondary)",
            background: "transparent",
            border: "1px solid var(--hero-line)",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
            marginBottom: 8,
          }}
        >
          LOCK
        </button>
      </div>

      {tab === "Profile" && <ProfileSection adminKey={adminKey} onAuthError={lock} />}
      {tab === "Projects" && <ProjectsSection adminKey={adminKey} onAuthError={lock} />}
      {tab === "Experience" && <ExperienceSection adminKey={adminKey} onAuthError={lock} />}
      {tab === "Skills" && <SkillsSection adminKey={adminKey} onAuthError={lock} />}
      {tab === "Documents" && <DocumentsSection adminKey={adminKey} onAuthError={lock} />}
      </div>
    </PageShell>
  );
}
