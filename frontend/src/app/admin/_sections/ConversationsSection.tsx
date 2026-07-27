"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageCircle, MonitorSmartphone, Search } from "lucide-react";
import { queryKeys } from "@/hooks/queryKeys";
import { AdminAuthError } from "@/services/admin";
import { ConversationRow, fetchConversationDetail, fetchConversations } from "@/services/conversations";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";
import { Widget } from "@/types/chat";
import { cardStyle, inputStyle, labelStyle } from "./shared";

// ── Small formatting helpers — kept local, no new dependency for a couple of
// one-off strings the admin view needs. ──────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Best-effort "Browser on OS" label from a raw User-Agent string — good enough
 * for an admin glance, not a real UA-parsing library's worth of edge cases. */
function summarizeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/") && !ua.includes("Chrome/")
          ? "Safari"
          : "Browser";
  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS X")
      ? "macOS"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone") || ua.includes("iPad")
          ? "iOS"
          : ua.includes("Linux")
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Groups already-sorted (newest-first) rows into "Today"/"Yesterday"/etc.
 * sections — the main scannability win once there are dozens of rows to
 * scroll past instead of just a handful. */
function dateBucket(iso: string): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return "This week";
  if (daysAgo < 30) return "This month";
  return "Earlier";
}

function groupByRecency(rows: ConversationRow[]): { label: string; rows: ConversationRow[] }[] {
  const groups: { label: string; rows: ConversationRow[] }[] = [];
  for (const row of rows) {
    const label = dateBucket(row.updated_at);
    const current = groups.at(-1);
    if (current && current.label === label) {
      current.rows.push(row);
    } else {
      groups.push({ label, rows: [row] });
    }
  }
  return groups;
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "This month", "Earlier"];

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        border: active ? "1px solid rgba(201,122,61,0.5)" : "1px solid var(--hero-line)",
        background: active ? "rgba(201,122,61,0.14)" : "transparent",
        color: active ? "var(--copper-bright)" : "var(--text-secondary)",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ── Transcript pane ───────────────────────────────────────────────────────────

function TranscriptBubble({ role, content, widgets }: { role: string; content: string; widgets: Widget[] }) {
  const isHuman = role === "human";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "flex", justifyContent: isHuman ? "flex-end" : "flex-start" }}
    >
      <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            borderRadius: isHuman ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
            padding: "11px 15px",
            fontSize: 13.5,
            lineHeight: 1.6,
            wordBreak: "break-word",
            background: isHuman
              ? "linear-gradient(135deg, var(--copper) 0%, var(--copper-bright) 100%)"
              : "linear-gradient(135deg, rgba(107,138,148,0.07) 0%, rgba(255,255,255,0.025) 100%)",
            color: isHuman ? "#fff" : "var(--text-primary)",
            border: isHuman ? "none" : "1px solid rgba(107,138,148,0.14)",
            borderLeft: isHuman ? "none" : "2px solid rgba(107,138,148,0.4)",
          }}
        >
          {isHuman ? content : <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>}
        </div>
        {!isHuman && widgets.length > 0 && <WidgetRenderer widgets={widgets} />}
      </div>
    </motion.div>
  );
}

function TranscriptView({ sessionId, adminKey, onAuthError }: { sessionId: string; adminKey: string; onAuthError: () => void }) {
  const { data, isError, error } = useQuery({
    queryKey: queryKeys.conversation(sessionId),
    queryFn: () => fetchConversationDetail(adminKey, sessionId),
  });

  useEffect(() => {
    if (error instanceof AdminAuthError) onAuthError();
  }, [error, onAuthError]);

  if (!data) {
    return (
      <div style={{ ...cardStyle, minHeight: 300, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {isError ? "Could not load this conversation." : "Loading transcript…"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, minHeight: 300 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 12, borderBottom: "1px solid var(--hero-line)" }}>
        <span style={{ fontFamily: "var(--font-tech), monospace", fontSize: 12, color: "var(--text-primary)" }}>{data.session_id}</span>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-muted)" }}>
          <span>First seen {new Date(data.created_at).toLocaleString()}</span>
          <span>Last active {new Date(data.updated_at).toLocaleString()}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MonitorSmartphone size={12} /> {summarizeUserAgent(data.user_agent)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
        {data.messages.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No messages in this session.</div>
        )}
        {data.messages.map((m, i) => (
          <TranscriptBubble key={i} role={m.role} content={m.content} widgets={m.widgets} />
        ))}
      </div>
    </div>
  );
}

// ── List pane ─────────────────────────────────────────────────────────────────

function ConversationListItem({
  row,
  selected,
  onSelect,
}: {
  row: ConversationRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 14px",
        borderRadius: 10,
        border: selected ? "1px solid rgba(201,122,61,0.45)" : "1px solid var(--hero-line)",
        background: selected ? "rgba(201,122,61,0.08)" : "var(--hero-surface)",
        boxShadow: selected ? "0 0 0 1px rgba(201,122,61,0.15) inset" : "none",
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.first_message_preview ?? row.session_id}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {formatRelativeTime(row.updated_at)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MessageCircle size={11} /> {row.message_count}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {summarizeUserAgent(row.user_agent)}
        </span>
      </div>
    </div>
  );
}

export default function ConversationsSection({
  adminKey,
  onAuthError,
}: {
  adminKey: string;
  onAuthError: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const { data: rows, isError, error } = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => fetchConversations(adminKey),
  });

  useEffect(() => {
    if (error instanceof AdminAuthError) onAuthError();
  }, [error, onAuthError]);

  // Default to the most recently active conversation once the list loads —
  // saves a click for the common case of "what did the last visitor ask".
  useEffect(() => {
    if (rows && rows.length > 0 && selected === null) {
      setSelected(rows[0].session_id);
    }
  }, [rows, selected]);

  if (!rows) {
    return (
      <div style={cardStyle}>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {isError ? "Could not load conversations from the API." : "Loading…"}
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const textFiltered = q
    ? rows.filter(
        (r) =>
          r.session_id.toLowerCase().includes(q) ||
          (r.first_message_preview ?? "").toLowerCase().includes(q)
      )
    : rows;
  const availableBuckets = BUCKET_ORDER.filter((b) => textFiltered.some((r) => dateBucket(r.updated_at) === b));
  const filtered = dateFilter ? textFiltered.filter((r) => dateBucket(r.updated_at) === dateFilter) : textFiltered;
  const groups = groupByRecency(filtered);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label style={labelStyle}>Conversations ({rows.length})</label>

      {rows.length === 0 ? (
        <div style={cardStyle}>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>No conversations recorded yet.</div>
        </div>
      ) : (
        <div className="admin-conversations-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                style={{ ...inputStyle, paddingLeft: 34, fontSize: 13 }}
              />
            </div>

            {availableBuckets.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <FilterChip label="All" active={dateFilter === null} onClick={() => setDateFilter(null)} />
                {availableBuckets.map((b) => (
                  <FilterChip key={b} label={b} active={dateFilter === b} onClick={() => setDateFilter(b)} />
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
              {groups.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No conversations match {query ? `"${query}"` : "this filter"}.
                </div>
              )}
              {groups.map((group) => (
                <div key={group.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ ...labelStyle, marginBottom: 0 }}>{group.label}</span>
                  {group.rows.map((row) => (
                    <ConversationListItem
                      key={row.session_id}
                      row={row}
                      selected={row.session_id === selected}
                      onSelect={() => setSelected(row.session_id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {selected ? (
            <TranscriptView sessionId={selected} adminKey={adminKey} onAuthError={onAuthError} />
          ) : (
            <div style={{ ...cardStyle, minHeight: 300, alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Select a conversation to view its transcript.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
