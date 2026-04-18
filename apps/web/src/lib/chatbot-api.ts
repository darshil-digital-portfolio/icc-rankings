/**
 * API client for the Twelfth Man chatbot service.
 */

const CHATBOT_BASE_URL =
  process.env.NEXT_PUBLIC_CHATBOT_URL?.replace(/\/$/, "") ??
  "http://localhost:8100";

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
  quota_exceeded: boolean;
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

export interface SessionSummary {
  session_id: string;
  preview: string;
  updated_at: string;
}

// ─── Session management ───────────────────────────────────────────────────────

const ACTIVE_SESSION_KEY = "twelfth_man_active_session";

/**
 * Returns the active session ID for an authenticated user.
 *
 * - Reads from localStorage key `twelfth_man_active_session`.
 * - If none exists (first visit), creates a new UUID session.
 *
 * NOTE: The session_id is now always a UUID — NOT the google_sub.
 * The google_sub is sent separately as user_id to tag ownership server-side.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Start a brand-new session, returning its ID.
 */
export function createNewSession(): string {
  if (typeof window === "undefined") return "";
  const sessionId = crypto.randomUUID();
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  return sessionId;
}

/**
 * Switch to a specific past session (load it as active).
 */
export function setActiveSession(sessionId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  sessionId: string,
  userId?: string,
): Promise<ChatResponse> {
  const res = await fetch(`${CHATBOT_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId, user_id: userId }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "Unknown error");
    throw new Error(`Chat request failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<ChatResponse>;
}

export async function getHistory(sessionId: string): Promise<HistoryResponse> {
  const res = await fetch(`${CHATBOT_BASE_URL}/history/${sessionId}`);

  if (!res.ok) {
    if (res.status === 404) {
      return { session_id: sessionId, messages: [] };
    }
    throw new Error(`History request failed (${res.status})`);
  }

  return res.json() as Promise<HistoryResponse>;
}

/**
 * Fetch the authenticated user's past sessions via the Next.js proxy route.
 * Must be called from a client component — uses session cookies automatically.
 */
export async function getUserSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/chat/sessions");
  if (!res.ok) return [];
  return res.json() as Promise<SessionSummary[]>;
}
