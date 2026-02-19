// ─── Shared domain types mirroring the Rust API response shapes ──────────────

export type Stage =
  | "first_stage"
  | "other_stage"
  | "semi_final"
  | "final"
  | "champion";

export type EventType =
  | "women_u19"
  | "men_u19"
  | "women_t20_world_cup"
  | "women_world_cup"
  | "men_knockout_champions"
  | "men_t20_world_cup"
  | "test_championship"
  | "men_world_cup";

// ─── Rankings ─────────────────────────────────────────────────────────────────

export interface RankingEntry {
  rank: number;
  team_id: string;
  team_slug: string;
  team_name: string;
  team_short_name: string;
  flag_emoji: string;
  total_points: number;
  events_participated: number;
  titles: number;
}

export interface RankingsMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface RankingsResponse {
  data: RankingEntry[];
  meta: RankingsMeta;
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export interface TeamSummary {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  flag_emoji: string;
  country_code: string;
  total_points: number;
  events_participated: number;
  titles: number;
  rank: number;
}

export interface TeamsResponse {
  data: TeamSummary[];
  meta: { total: number; limit: number; offset: number };
}

export interface EventHistoryEntry {
  event_id: string;
  event_name: string;
  event_short_name: string;
  event_type: EventType;
  event_type_label: string;
  year: number;
  host: string;
  stage: Stage;
  stage_label: string;
  base_points: number;
  multiplier: number;
  total_points: number;
}

export interface TeamDetailResponse {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  flag_emoji: string;
  country_code: string;
  total_points: number;
  events_participated: number;
  titles: number;
  history: EventHistoryEntry[];
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventSummary {
  id: string;
  name: string;
  short_name: string;
  event_type: EventType;
  event_type_label: string;
  multiplier: number;
  year: number;
  host: string;
  teams_count: number;
  champion_slug: string | null;
  champion_name: string | null;
  champion_flag: string | null;
}

export interface EventsResponse {
  data: EventSummary[];
  meta: { total: number; limit: number; offset: number };
}

export interface ParticipantEntry {
  team_id: string;
  team_slug: string;
  team_name: string;
  team_short_name: string;
  flag_emoji: string;
  stage: Stage;
  stage_label: string;
  base_points: number;
  multiplier: number;
  total_points: number;
}

export interface EventDetailResponse {
  id: string;
  name: string;
  short_name: string;
  event_type: EventType;
  event_type_label: string;
  multiplier: number;
  year: number;
  host: string;
  participants: ParticipantEntry[];
}

// ─── Breakdown ────────────────────────────────────────────────────────────────

export interface BreakdownEntry {
  event_type: EventType;
  event_type_label: string;
  multiplier: number;
  total_points: number;
  events_participated: number;
  titles: number;
}

export interface TeamBreakdownResponse {
  team_slug: string;
  team_name: string;
  flag_emoji: string;
  grand_total: number;
  breakdown: BreakdownEntry[];
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
