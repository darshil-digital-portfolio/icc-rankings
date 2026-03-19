"use client";

import { useMemo } from "react";
import type { TeamDetailResponse, RankingEntry } from "@/types";
import { RankingsLineChart } from "./rankings-line-chart";
import { RankingsTable } from "./rankings-table";

interface RankingsClientViewProps {
  teams: TeamDetailResponse[];
  eventTypes: string[];
}

function computeRankings(
  teams: TeamDetailResponse[],
  eventTypes: string[],
): RankingEntry[] {
  return teams
    .map((team) => {
      const history =
        eventTypes.length > 0
          ? team.history.filter((h) => eventTypes.includes(h.event_type))
          : team.history;

      const total_points = history.reduce((sum, h) => sum + h.total_points, 0);
      const events_participated = history.length;
      const titles = history.filter((h) => h.stage === "champion").length;

      return {
        rank: 0, // assigned below after sort
        team_id: team.slug,
        team_slug: team.slug,
        team_name: team.name,
        team_short_name: team.short_name,
        flag_emoji: team.flag_emoji,
        total_points,
        events_participated,
        titles,
      };
    })
    .filter((e) => e.events_participated > 0)
    .sort((a, b) => b.total_points - a.total_points)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function RankingsClientView({ teams, eventTypes }: RankingsClientViewProps) {
  const rankings = useMemo(
    () => computeRankings(teams, eventTypes),
    [teams, eventTypes],
  );

  return (
    <>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {rankings.length} team{rankings.length !== 1 ? "s" : ""}
        {eventTypes.length === 0
          ? " across all events"
          : eventTypes.length === 1
            ? " for this event type"
            : ` across ${eventTypes.length} selected event types`}
      </p>

      <div className="space-y-6">
        <RankingsLineChart
          teams={teams}
          eventTypes={eventTypes.length > 0 ? eventTypes : undefined}
        />
        <RankingsTable data={rankings} />
      </div>
    </>
  );
}
