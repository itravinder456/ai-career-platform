"use client";

export type Message = { type: "success" | "error"; text: string };

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
  fontSize: 14,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
  display: "block",
};

export const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--bg-2)",
};

export const itemCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 16,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.02)",
};

export const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
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

export const addButtonStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--accent-2)",
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
