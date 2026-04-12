"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { updateUserPreferences } from "@/lib/user-api";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { EventType } from "@/types";

const EVENT_TYPES: { value: EventType; label: string; mult: number }[] = [
  { value: "men_world_cup", label: "Men's WC", mult: 8 },
  { value: "test_championship", label: "Test Championship", mult: 7 },
  { value: "men_t20_world_cup", label: "Men's T20 WC", mult: 6 },
  { value: "men_knockout_champions", label: "Champions Trophy", mult: 5 },
  { value: "women_world_cup", label: "Women's WC", mult: 4 },
  { value: "women_t20_world_cup", label: "Women's T20 WC", mult: 3 },
  { value: "men_u19", label: "Men's U19", mult: 2 },
  { value: "women_u19", label: "Women's U19", mult: 1 },
];

interface EventTypeFilterProps {
  /** Comma-separated selected event types (empty / undefined = all) */
  current?: string;
}

export function EventTypeFilter({ current }: EventTypeFilterProps) {
  const router = useRouter();
  const { status } = useSession();
  const { data: preferences } = useUserPreferences();
  const hasRedirected = useRef(false);

  const selected = new Set(
    current ? current.split(",").filter(Boolean) : [],
  );
  const allSelected = selected.size === 0;

  // On initial page load: if authenticated, no URL filter is set, and the user
  // has saved filters, redirect to restore them.
  useEffect(() => {
    if (
      !hasRedirected.current &&
      status === "authenticated" &&
      preferences &&
      preferences.preferences.event_filters.length > 0 &&
      !current
    ) {
      hasRedirected.current = true;
      router.push(`/rankings?event_type=${preferences.preferences.event_filters.join(",")}`);
    }
  }, [status, preferences, current, router]);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    const joined = [...next].join(",");
    router.push(joined ? `/rankings?event_type=${joined}` : "/rankings");

    // Persist selection for authenticated users (fire-and-forget).
    if (status === "authenticated") {
      updateUserPreferences({ event_filters: [...next] }).catch(() => {});
    }
  }

  function clearAll() {
    router.push("/rankings");

    // Persist cleared selection for authenticated users (fire-and-forget).
    if (status === "authenticated") {
      updateUserPreferences({ event_filters: [] }).catch(() => {});
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* "All Formats" clears the selection */}
      <button
        onClick={clearAll}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold",
          "transition-all duration-150",
          allSelected
            ? [
                "border-transparent text-white shadow-md shadow-pitch-700/30",
                "bg-gradient-to-r from-pitch-700 to-pitch-500",
                "hover:from-pitch-600 hover:to-pitch-400",
              ]
            : [
                "border-slate-200 bg-white text-slate-600",
                "hover:border-pitch-300 hover:bg-pitch-50 hover:text-pitch-700 hover:shadow-sm",
              ],
        )}
      >
        All Formats
      </button>

      {EVENT_TYPES.map((et) => {
        const active = selected.has(et.value);
        return (
          <button
            key={et.value}
            onClick={() => toggle(et.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold",
              "transition-all duration-150",
              active
                ? [
                    "border-transparent text-white shadow-md shadow-pitch-700/30",
                    "bg-gradient-to-r from-pitch-700 to-pitch-500",
                    "hover:from-pitch-600 hover:to-pitch-400",
                  ]
                : [
                    "border-slate-200 bg-white text-slate-600",
                    "hover:border-pitch-300 hover:bg-pitch-50 hover:text-pitch-700 hover:shadow-sm",
                  ],
            )}
          >
            {et.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                active
                  ? "bg-white/20 text-white"
                  : "bg-pitch-50 text-pitch-600",
              )}
            >
              {et.mult}×
            </span>
          </button>
        );
      })}
    </div>
  );
}
