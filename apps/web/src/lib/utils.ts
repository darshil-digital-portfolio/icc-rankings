import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EventType, Stage } from "@/types";

// ─── Tailwind class merging ───────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatPoints(points: number): string {
  return points.toLocaleString();
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// ─── Stage helpers ───────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<Stage, string> = {
  first_stage: "Group Stage",
  other_stage: "Quarter-Final / Super Stage",
  semi_final: "Semi-Final",
  final: "Runner-Up",
  champion: "Champion",
};

export const STAGE_COLORS: Record<Stage, string> = {
  first_stage: "bg-slate-200 text-slate-700",
  other_stage: "bg-blue-100 text-blue-700",
  semi_final: "bg-amber-100 text-amber-700",
  final: "bg-orange-100 text-orange-700",
  champion: "bg-pitch-100 text-pitch-800",
};

export const STAGE_RANK: Record<Stage, number> = {
  first_stage: 1,
  other_stage: 2,
  semi_final: 3,
  final: 4,
  champion: 5,
};

// ─── EventType helpers ────────────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  women_u19: "Women's U19 World Cup",
  men_u19: "Men's U19 World Cup",
  women_t20_world_cup: "Women's T20 World Cup",
  women_world_cup: "Women's World Cup",
  men_knockout_champions: "Men's Knockout / Champions Trophy",
  men_t20_world_cup: "Men's T20 World Cup",
  test_championship: "World Test Championship",
  men_world_cup: "Men's Cricket World Cup",
};

export const EVENT_TYPE_MULTIPLIERS: Record<EventType, number> = {
  women_u19: 1,
  men_u19: 2,
  women_t20_world_cup: 3,
  women_world_cup: 4,
  men_knockout_champions: 5,
  men_t20_world_cup: 6,
  test_championship: 7,
  men_world_cup: 8,
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  women_u19: "#e9d5ff",
  men_u19: "#dbeafe",
  women_t20_world_cup: "#fce7f3",
  women_world_cup: "#fef3c7",
  men_knockout_champions: "#d1fae5",
  men_t20_world_cup: "#e0f2fe",
  test_championship: "#fee2e2",
  men_world_cup: "#d4af37",
};

export const EVENT_TYPE_CHART_COLORS: Record<EventType, string> = {
  women_u19: "#a855f7",
  men_u19: "#3b82f6",
  women_t20_world_cup: "#ec4899",
  women_world_cup: "#f59e0b",
  men_knockout_champions: "#10b981",
  men_t20_world_cup: "#0ea5e9",
  test_championship: "#ef4444",
  men_world_cup: "#d4af37",
};

// ─── Rank medal helpers ───────────────────────────────────────────────────────

export function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

// ─── Point calculation verification (client-side) ────────────────────────────

export function computePoints(stage: Stage, eventType: EventType): number {
  return STAGE_RANK[stage] * EVENT_TYPE_MULTIPLIERS[eventType];
}
