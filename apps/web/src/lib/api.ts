/**
 * Typed API client for the ICC Ranking Rust backend.
 *
 * All functions throw on non-2xx responses with a structured ApiError shape.
 */

import type {
  EventDetailResponse,
  EventsResponse,
  RankingsResponse,
  TeamBreakdownResponse,
  TeamDetailResponse,
  TeamsResponse,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:7429";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}/api/v1${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    // Next.js cache config – revalidate every 60 s for static-like data.
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: { code: "UNKNOWN", message: response.statusText },
    }));
    throw body;
  }

  return response.json() as Promise<T>;
}

// ─── Query param builder ──────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

export interface GetRankingsParams extends Record<string, string | number | undefined> {
  event_type?: string;
  limit?: number;
  offset?: number;
}

export async function getRankings(
  params: GetRankingsParams = {},
): Promise<RankingsResponse> {
  return apiFetch<RankingsResponse>(
    `/rankings${buildQuery(params)}`,
  );
}

export async function getTeamBreakdown(
  slug: string,
): Promise<TeamBreakdownResponse> {
  return apiFetch<TeamBreakdownResponse>(`/rankings/team/${slug}/breakdown`);
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export interface GetTeamsParams extends Record<string, string | number | undefined> {
  q?: string;
  limit?: number;
  offset?: number;
}

export async function getTeams(
  params: GetTeamsParams = {},
): Promise<TeamsResponse> {
  return apiFetch<TeamsResponse>(`/teams${buildQuery(params)}`);
}

export async function getTeam(slug: string): Promise<TeamDetailResponse> {
  return apiFetch<TeamDetailResponse>(`/teams/${slug}`);
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface GetEventsParams extends Record<string, string | number | undefined> {
  event_type?: string;
  year?: number;
  limit?: number;
  offset?: number;
}

export async function getEvents(
  params: GetEventsParams = {},
): Promise<EventsResponse> {
  return apiFetch<EventsResponse>(`/events${buildQuery(params)}`);
}

export async function getEvent(id: string): Promise<EventDetailResponse> {
  return apiFetch<EventDetailResponse>(`/events/${id}`);
}
