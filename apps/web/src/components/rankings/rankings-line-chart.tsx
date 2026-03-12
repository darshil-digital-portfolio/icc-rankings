"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TeamDetailResponse } from "@/types";
import { getTeamColor } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingsLineChartProps {
  teams: TeamDetailResponse[];
  eventType?: string;
}

type ChartRow = Record<string, number>; // { year: number; [slug]: cumulativePoints }

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

// ─── Build cumulative points per year ─────────────────────────────────────────
//
// For each team: sort their history chronologically, compute a running total.
// If a team didn't play in a given year the line stays flat (fill-forward).
// Result: one row per year that appears across *any* team's history.

function buildCumulativeData(teams: TeamDetailResponse[], eventType?: string): ChartRow[] {
  // Per-team: sorted list of { year, cumulative } checkpoints
  const teamCheckpoints: Record<string, { year: number; cumulative: number }[]> = {};

  for (const team of teams) {
    const history = eventType
      ? team.history.filter((h) => h.event_type === eventType)
      : team.history;

    const sorted = [...history].sort((a, b) => a.year - b.year);
    let running = 0;
    const checkpoints: { year: number; cumulative: number }[] = [];

    for (const h of sorted) {
      running += h.total_points;
      const existing = checkpoints.find((c) => c.year === h.year);
      if (existing) {
        existing.cumulative = running; // same year, multiple events
      } else {
        checkpoints.push({ year: h.year, cumulative: running });
      }
    }
    teamCheckpoints[team.slug] = checkpoints;
  }

  // All years across all teams, sorted ascending
  const allYears = [
    ...new Set(
      Object.values(teamCheckpoints).flatMap((pts) => pts.map((p) => p.year)),
    ),
  ].sort((a, b) => a - b);

  // For each year, fill-forward each team's last known cumulative total
  return allYears.map((year) => {
    const row: ChartRow = { year };
    for (const team of teams) {
      const pts = teamCheckpoints[team.slug] ?? [];
      const last = [...pts].reverse().find((p) => p.year <= year);
      row[team.slug] = last?.cumulative ?? 0;
    }
    return row;
  });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload].sort(
    (a: TooltipEntry, b: TooltipEntry) => (b.value ?? 0) - (a.value ?? 0),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl min-w-[180px]">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      {sorted.map((entry: TooltipEntry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-mono text-xs font-bold text-slate-800">
            {(entry.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Custom legend (flag + short name) ───────────────────────────────────────

function CustomLegend({ teams }: { teams: TeamDetailResponse[] }) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
      {teams.map((team) => (
        <span key={team.slug} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: getTeamColor(team.slug) }}
          />
          <span>{team.flag_emoji}</span>
          <span>{team.short_name}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main chart ───────────────────────────────────────────────────────────────

export function RankingsLineChart({ teams, eventType }: RankingsLineChartProps) {
  const chartData = buildCumulativeData(teams, eventType);

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-center text-sm text-slate-400">No chart data for this filter.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-widest text-slate-500">
        Cumulative Points Over Time
      </h3>
      <p className="mb-6 text-xs text-slate-400">
        Running total per team across all tournaments · line colour = national jersey
      </p>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="year"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickCount={8}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={() => null} /> {/* hide default, use CustomLegend below */}
          {teams.map((team) => (
            <Line
              key={team.slug}
              type="stepAfter"
              dataKey={team.slug}
              name={team.name}
              stroke={getTeamColor(team.slug)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <CustomLegend teams={teams} />
    </div>
  );
}
