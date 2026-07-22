"use client";

export type Message = { type: "success" | "error"; text: string };

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--hero-line)",
  background: "var(--hero-surface)",
  color: "var(--text-primary)",
  fontSize: 14,
};

// Labels stay neutral (hero-muted), same as Skills' category headers and the
// site's own eyebrow tag — color is reserved for genuine live/current signals
// (see PageShell eyebrow dot, ProjectCard's "Production" status), not for
// every small caption, which is what made the app read as wire/teal-heavy.
export const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech), monospace",
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--hero-muted)",
  marginBottom: 6,
  display: "block",
};

export const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
  borderRadius: 13,
  border: "1px solid var(--hero-line)",
  background: "linear-gradient(160deg, rgba(107,138,148,0.06) 0%, rgba(16,15,12,0.9) 60%)",
};

export const itemCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 16,
  borderRadius: 10,
  border: "1px solid var(--hero-line)",
  background: "var(--hero-surface)",
};

export const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "12px 0",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, var(--copper) 0%, var(--copper-bright) 100%)",
  color: "var(--ink)",
  fontWeight: 700,
  fontSize: 13,
  fontFamily: "var(--font-tech), monospace",
  letterSpacing: "0.02em",
  opacity: disabled ? 0.6 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

export const addButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech), monospace",
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: "0.03em",
  color: "var(--copper-bright)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
};

export const removeButtonStyle: React.CSSProperties = {
  color: "#f87171",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 8px",
  alignSelf: "flex-start",
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

/** Comma-separated <-> string[] helper for tech_stack-style fields in plain <input>s. */
export function toCsv(items: string[]): string {
  return items.join(", ");
}
export function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One-per-line <-> string[] helper for achievements/impact-style fields in <textarea>s. */
export function toLines(items: string[]): string {
  return items.join("\n");
}
export function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
