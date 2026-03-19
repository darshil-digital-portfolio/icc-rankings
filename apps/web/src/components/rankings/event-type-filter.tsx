"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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

  const selected = new Set(
    current ? current.split(",").filter(Boolean) : [],
  );
  const allSelected = selected.size === 0;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    const joined = [...next].join(",");
    router.push(joined ? `/rankings?event_type=${joined}` : "/rankings");
  }

  function clearAll() {
    router.push("/rankings");
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
