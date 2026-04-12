"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a dismissible welcome banner when `?welcome=1` is in the URL.
 * Reads `is_new_user` from the session to personalise the greeting.
 * Auto-dismisses after 6 seconds and removes the query param from the URL.
 */
export function WelcomeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);

  const shouldShow = searchParams.get("welcome") === "1";

  // Show the banner and schedule auto-dismiss.
  useEffect(() => {
    if (!shouldShow) return;
    setVisible(true);
    const timer = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  function dismiss() {
    setVisible(false);
    // Strip the ?welcome=1 param without adding a history entry.
    router.replace("/", { scroll: false });
  }

  if (!shouldShow && !visible) return null;

  const isNewUser = session?.user?.is_new_user ?? false;
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div
      className={cn(
        "pointer-events-auto transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none",
      )}
    >
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div
          className={cn(
            "relative flex items-start gap-3 rounded-xl border px-5 py-4 shadow-lg",
            isNewUser
              ? "border-gold-400/60 bg-gold-50 dark:border-gold-500/30 dark:bg-gold-950/40"
              : "border-pitch-300/60 bg-pitch-50 dark:border-pitch-700/40 dark:bg-pitch-950/50",
          )}
        >
          {/* Cricket ball icon */}
          <span className="mt-0.5 text-2xl leading-none select-none">🏏</span>

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-bold text-base",
                isNewUser
                  ? "text-gold-800 dark:text-gold-300"
                  : "text-pitch-800 dark:text-pitch-300",
              )}
            >
              {isNewUser ? `Welcome to ICC Rankings, ${name}!` : `Welcome back, ${name}!`}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm",
                isNewUser
                  ? "text-gold-700 dark:text-gold-400"
                  : "text-pitch-600 dark:text-pitch-400",
              )}
            >
              {isNewUser
                ? "Explore team rankings, tournament history, and chat with Twelfth Man — our AI cricket assistant."
                : "Good to see you again. Your chat history is waiting in Twelfth Man."}
            </p>
          </div>

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className={cn(
              "shrink-0 rounded-md p-1 transition-colors",
              isNewUser
                ? "text-gold-600 hover:bg-gold-100 dark:text-gold-400 dark:hover:bg-gold-900/40"
                : "text-pitch-500 hover:bg-pitch-100 dark:text-pitch-400 dark:hover:bg-pitch-900/40",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
