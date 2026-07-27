import { AdminAuthError } from "@/services/admin";
import { Widget } from "@/types/chat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ConversationRow {
  session_id: string;
  message_count: number;
  user_agent: string | null;
  first_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: string;
  content: string;
  widgets: Widget[];
}

export interface ConversationDetail extends ConversationRow {
  messages: ConversationMessage[];
}

async function getJson<T>(key: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Admin-Key": key },
  });
  if (res.status === 401) throw new AdminAuthError("Invalid admin key");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function fetchConversations(key: string): Promise<ConversationRow[]> {
  return getJson(key, "/api/v1/admin/conversations");
}

export function fetchConversationDetail(key: string, sessionId: string): Promise<ConversationDetail> {
  return getJson(key, `/api/v1/admin/conversations/${encodeURIComponent(sessionId)}`);
}
