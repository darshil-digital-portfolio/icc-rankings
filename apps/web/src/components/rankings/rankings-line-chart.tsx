"use client";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TeamDetailResponse } from "@/types";
import { getTeamColor } from "@/lib/utils";
import { TeamFlag } from "@/components/ui/team-flag";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingsLineChartProps {
  teams: TeamDetailResponse[];
  eventType?: string;
}

type ChartRow = Record<string, number>; // { year: number; [slug]: cumulativePoints }

// ─── Build cumulative points per year ─────────────────────────────────────────

function buildCumulativeData(teams: TeamDetailResponse[], eventType?: string): {
  rows: ChartRow[];
  activeSlugs: string[];
} {
  const teamCheckpoints: Record<string, { year: number; cumulative: number }[]> = {};

  for (const team of teams) {
    const history = eventType
      ? team.history.filter((h) => h.event_type === eventType)
      : team.history;

    if (history.length === 0) continue; // skip teams with no matching history

    const sorted = [...history].sort((a, b) => a.year - b.year);
    let running = 0;
    const checkpoints: { year: number; cumulative: number }[] = [];

    for (const h of sorted) {
      running += h.total_points;
      const existing = checkpoints.find((c) => c.year === h.year);
      if (existing) {
        existing.cumulative = running;
      } else {
        checkpoints.push({ year: h.year, cumulative: running });
      }
    }
    teamCheckpoints[team.slug] = checkpoints;
  }

  const activeSlugs = Object.keys(teamCheckpoints);

  const allYears = [
    ...new Set(
      Object.values(teamCheckpoints).flatMap((pts) => pts.map((p) => p.year)),
    ),
  ].sort((a, b) => a - b);

  const rows = allYears.map((year) => {
    const row: ChartRow = { year };
    for (const slug of activeSlugs) {
      const pts = teamCheckpoints[slug] ?? [];
      const last = [...pts].reverse().find((p) => p.year <= year);
      row[slug] = last?.cumulative ?? 0;
    }
    return row;
  });

  return { rows, activeSlugs };
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  teamMap,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
  teamMap: Record<string, TeamDetailResponse>;
}) {
  if (!active || !payload?.length) return null;

  // Show top 8 by current value, plus a count of the rest
  const sorted = [...payload]
    .filter((e) => (e.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const visible = sorted.slice(0, 8);
  const hidden = sorted.length - visible.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl min-w-[200px] dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </p>
      {visible.map((entry) => {
        const team = teamMap[entry.dataKey];
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              {team && <TeamFlag slug={team.slug} name={team.name} size="sm" />}
              <span>{team?.short_name ?? entry.dataKey}</span>
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
              {(entry.value ?? 0).toLocaleString()}
            </span>
          </div>
        );
      })}
      {hidden > 0 && (
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          +{hidden} more teams with lower totals
        </p>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function ChartLegend({ teams }: { teams: TeamDetailResponse[] }) {
  return (
    <div className="mt-4 flex max-h-24 flex-wrap gap-x-3 gap-y-1.5 overflow-y-auto">
      {teams.map((team) => (
        <span key={team.slug} className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-600">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getTeamColor(team.slug) }} />
          <TeamFlag slug={team.slug} name={team.name} size="sm" />
          <span>{team.short_name}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RankingsLineChart({ teams, eventType }: RankingsLineChartProps) {
  const { rows, activeSlugs } = buildCumulativeData(teams, eventType);

  // Map slug → team for tooltip lookup
  const teamMap = Object.fromEntries(teams.map((t) => [t.slug, t]));
  const activeTeams = activeSlugs.map((s) => teamMap[s]).filter(Boolean) as TeamDetailResponse[];

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-[#FDF9D4] p-6 shadow-sm dark:border-slate-700 dark:bg-[#E7D5AD]">
        <p className="text-center text-sm text-slate-400">No chart data for this filter.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-[#FDF9D4] p-6 shadow-sm dark:border-slate-700 dark:bg-[#E7D5AD]">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-700">
        Cumulative Points Over Time · All {activeTeams.length} Nations
      </h3>
      <p className="mb-6 text-xs text-slate-400 dark:text-slate-600">
        Drag the handles below the chart to zoom into a time window
      </p>

      <ResponsiveContainer width="100%" height={460}>
        <LineChart data={rows} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} vertical={false} />
          <XAxis
            dataKey="year"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickCount={8}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            content={(props) => (
              <CustomTooltip {...props} teamMap={teamMap} />
            )}
          />
          {activeSlugs.map((slug) => (
            <Line
              key={slug}
              type="monotone"
              dataKey={slug}
              name={teamMap[slug]?.name ?? slug}
              stroke={getTeamColor(slug)}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
          <Brush
            dataKey="year"
            height={28}
            stroke="#7e22ce"
            fill="transparent"
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>

      <ChartLegend teams={activeTeams} />
    </div>
  );
}
