"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ChartSpec } from "@/lib/chatbot-api";
import { ChatChart } from "./chat-chart";

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  chart?: ChartSpec | null;
  isLoading?: boolean;
}

export function ChatMessage({ role, text, chart, isLoading }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-600 text-sm font-bold text-white">
          12
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-pitch-600 text-white"
            : "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Twelfth Man is thinking
            </span>
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pitch-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pitch-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pitch-400" />
            </span>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "prose prose-sm max-w-none",
                isUser
                  ? "prose-invert"
                  : "prose-slate dark:prose-invert",
                // Table styling
                "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
                "[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
                "[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-1.5",
                "dark:[&_th]:border-slate-600 dark:[&_th]:bg-slate-700",
                "dark:[&_td]:border-slate-600",
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
            {chart && <ChatChart spec={chart} />}
          </>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-sm font-bold text-pitch-950">
          U
        </div>
      )}
    </div>
  );
}
