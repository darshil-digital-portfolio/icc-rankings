"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSessionId,
  getHistory,
  sendMessage,
  type ChartSpec,
  type HistoryMessage,
} from "@/lib/chatbot-api";
import { ChatMessage } from "./chat-message";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  chart?: ChartSpec | null;
}

const WELCOME_MESSAGE: LocalMessage = {
  id: "welcome",
  role: "assistant",
  text:
    "Hey there! 🏏 I'm **Twelfth Man**, your ICC Cricket Rankings assistant.\n\n" +
    "I can help you explore team rankings, tournament history, points breakdowns, " +
    "and crunch numbers with statistical analysis.\n\n" +
    "What would you like to know?",
};

export function ChatView() {
  const [messages, setMessages] = useState<LocalMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [followups, setFollowups] = useState<string[]>([
    "Who has the most all-time ICC points?",
    "Show me all Men's World Cup champions",
    "Compare India and Australia's performance",
  ]);
  const [sessionId, setSessionId] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load session and history on mount.
  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);

    getHistory(sid)
      .then((h) => {
        if (h.messages.length > 0) {
          const loaded: LocalMessage[] = h.messages.map((m: HistoryMessage, i: number) => ({
            id: `history-${i}`,
            role: m.role,
            text: m.text,
            chart: m.chart,
          }));
          setMessages(loaded);
          setFollowups([]);
        }
      })
      .catch(() => {
        // No history — keep welcome message.
      })
      .finally(() => setHistoryLoaded(true));
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || isLoading) return;

      const userMsg: LocalMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: msg,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setFollowups([]);
      setIsLoading(true);

      try {
        const res = await sendMessage(msg, sessionId);
        const assistantMsg: LocalMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: res.text,
          chart: res.chart,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (res.followup_suggestions?.length) {
          setFollowups(res.followup_suggestions);
        }
      } catch (err) {
        const errorMsg: LocalMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: "Sorry, I couldn't reach the chatbot service. Make sure the Twelfth Man backend is running on port 8100.",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, isLoading, sessionId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    // Generate a new session — old one stays in MongoDB until TTL.
    localStorage.removeItem("twelfth_man_session_id");
    const newSid = getSessionId();
    setSessionId(newSid);
    setMessages([WELCOME_MESSAGE]);
    setFollowups([
      "Who has the most all-time ICC points?",
      "Show me all Men's World Cup champions",
      "Compare India and Australia's performance",
    ]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pitch-600 text-sm font-bold text-white">
            12
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Twelfth Man
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ICC Cricket Rankings Assistant
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Clear conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
          New chat
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              text={msg.text}
              chart={msg.chart}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <ChatMessage role="assistant" text="" isLoading />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Follow-up suggestions */}
      {followups.length > 0 && !isLoading && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/50 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            {followups.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="rounded-full border border-pitch-200 bg-white px-3 py-1.5 text-xs font-medium text-pitch-700 transition-colors hover:border-pitch-400 hover:bg-pitch-50 dark:border-pitch-800 dark:bg-slate-800 dark:text-pitch-300 dark:hover:border-pitch-600 dark:hover:bg-pitch-950"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about ICC rankings, teams, events..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm",
              "placeholder:text-slate-400",
              "focus:border-pitch-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400/20",
              "dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500",
              "dark:focus:border-pitch-500 dark:focus:bg-slate-700 dark:focus:ring-pitch-500/20",
            )}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              input.trim() && !isLoading
                ? "bg-pitch-600 text-white hover:bg-pitch-500"
                : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-slate-400 dark:text-slate-500">
          Twelfth Man can make mistakes. Verify important data from the Rankings page.
        </p>
      </div>
    </div>
  );
}
