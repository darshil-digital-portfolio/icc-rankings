"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { EventType } from "@/types";

const EVENT_TYPES: { value: EventType | ""; label: string; mult?: number }[] = [
  { value: "", label: "All Formats" },
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
  current?: string;
}

export function EventTypeFilter({ current }: EventTypeFilterProps) {
  const router = useRouter();

  function handleChange(value: string) {
    const url = value ? `/rankings?event_type=${value}` : "/rankings";
    router.push(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {EVENT_TYPES.map((et) => {
        const active = (current ?? "") === et.value;
        return (
          <button
            key={et.value}
            onClick={() => handleChange(et.value)}
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
            {et.mult && (
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
            )}
          </button>
        );
      })}
    </div>
  );
}
