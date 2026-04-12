"use client";

import { useEffect, useState } from "react";
import { History, ChevronLeft, ChevronRight, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserSessions, type SessionSummary } from "@/lib/chatbot-api";

interface ChatHistoryPanelProps {
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  /** Trigger refresh when a new message is sent */
  refreshTrigger?: number;
}

export function ChatHistoryPanel({
  activeSessionId,
  onSelectSession,
  onNewSession,
  refreshTrigger,
}: ChatHistoryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUserSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  return (
    <div
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-slate-50 transition-all duration-200",
        "dark:border-slate-700 dark:bg-slate-900/60",
        collapsed ? "w-10" : "w-60",
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
        title={collapsed ? "Expand history" : "Collapse history"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {collapsed ? (
        <div className="flex flex-1 flex-col items-center gap-3 pt-4">
          <History className="h-4 w-4 text-slate-400" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <History className="h-3.5 w-3.5" />
              History
            </span>
            <button
              onClick={onNewSession}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-pitch-600 hover:bg-pitch-50 dark:text-pitch-400 dark:hover:bg-pitch-950"
              title="Start new chat"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {loading && (
              <div className="space-y-2 px-1 pt-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"
                  />
                ))}
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <p className="px-1 pt-2 text-xs text-slate-400 dark:text-slate-500">
                No past conversations yet.
              </p>
            )}

            {!loading &&
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => onSelectSession(s.session_id)}
                  className={cn(
                    "mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                    s.session_id === activeSessionId
                      ? "bg-pitch-100 text-pitch-800 dark:bg-pitch-950 dark:text-pitch-200"
                      : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium leading-snug">
                      {s.preview}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(s.updated_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
