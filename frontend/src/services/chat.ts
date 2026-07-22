import { Step, Widget } from "@/types/chat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface StreamCallbacks {
  onStep: (step: Step) => void;
  onToken: (token: string) => void;
  onWidget: (widget: Widget) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function streamChat(
  sessionId: string,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  let completed = false;

  const finish = () => {
    if (!completed) {
      completed = true;
      callbacks.onDone();
    }
  };

  try {
    const response = await fetch(`${API_BASE}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
      signal,
    });

    if (!response.ok || !response.body) {
      callbacks.onError(`Request failed: ${response.status}`);
      finish();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;

        try {
          const event = JSON.parse(raw) as Record<string, unknown>;
          switch (event.type) {
            case "step":
              callbacks.onStep({
                id: event.id as string,
                label: event.label as string,
                status: (event.status as Step["status"]) ?? "running",
              });
              break;
            case "token":
              callbacks.onToken(event.content as string);
              break;
            case "widget":
              callbacks.onWidget({
                type: event.widget_type as Widget["type"],
                data: event.data as Record<string, unknown>,
              });
              break;
            case "done":
              finish();
              break;
            case "error":
              completed = true;
              callbacks.onError(event.message as string);
              break;
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } catch (err) {
    // A user-initiated stop() aborts the fetch deliberately — that's a normal
    // end of the turn, not a failure worth an error bubble.
    if (err instanceof DOMException && err.name === "AbortError") {
      // fall through to finish() in the `finally` block below
    } else {
      callbacks.onError(err instanceof Error ? err.message : "Network error");
    }
  } finally {
    finish(); // always resolve — prevents isStreaming from locking up
  }
}

export async function clearSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/chat/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}
