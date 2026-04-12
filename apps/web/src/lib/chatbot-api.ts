/**
 * API client for the Twelfth Man chatbot service.
 */

const CHATBOT_BASE_URL =
  process.env.NEXT_PUBLIC_CHATBOT_URL?.replace(/\/$/, "") ?? "http://localhost:8100";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartSpec {
  chart_type: "bar" | "line" | "pie";
  data: Record<string, unknown>[];
  x_key: string;
  y_key: string;
  title: string;
  x_label: string;
  y_label: string;
}

export interface ChatResponse {
  text: string;
  chart: ChartSpec | null;
  followup_suggestions: string[];
  session_id: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  text: string;
  chart: ChartSpec | null;
  timestamp: string;
}

export interface HistoryResponse {
  session_id: string;
  messages: HistoryMessage[];
}

// ─── Session management ───────────────────────────────────────────────────────

const SESSION_KEY = "twelfth_man_session_id";

/**
 * Returns the session ID to use for the chat.
 *
 * - When `googleSub` is provided (authenticated user), the Google sub is used
 *   as the session key so chat history is tied to the user's identity across
 *   devices.
 * - Otherwise falls back to an anonymous UUID stored in localStorage.
 */
export function getSessionId(googleSub?: string): string {
  if (typeof window === "undefined") return "";
  if (googleSub) return googleSub;
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  sessionId: string,
): Promise<ChatResponse> {
  const res = await fetch(`${CHATBOT_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "Unknown error");
    throw new Error(`Chat request failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<ChatResponse>;
}

export async function getHistory(
  sessionId: string,
): Promise<HistoryResponse> {
  const res = await fetch(`${CHATBOT_BASE_URL}/history/${sessionId}`);

  if (!res.ok) {
    if (res.status === 404) {
      return { session_id: sessionId, messages: [] };
    }
    throw new Error(`History request failed (${res.status})`);
  }

  return res.json() as Promise<HistoryResponse>;
}
