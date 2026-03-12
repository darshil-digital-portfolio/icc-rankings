"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankingEntry } from "@/types";
import { formatPoints, getTeamColor } from "@/lib/utils";

interface RankingsChartProps {
  data: RankingEntry[];
  /** Max entries to render in the chart (default 15) */
  limit?: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: RankingEntry;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]!.payload;
  const teamColor = getTeamColor(entry.team_slug);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="flex items-center gap-2 font-semibold text-slate-800">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: teamColor }}
        />
        <span>{entry.flag_emoji}</span>
        <span>{entry.team_name}</span>
      </p>
      <p className="mt-1 font-mono text-lg font-bold text-pitch-700">
        {formatPoints(entry.total_points)} pts
      </p>
      <p className="text-xs text-slate-500">
        {entry.events_participated} events · {entry.titles} title{entry.titles !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function RankingsChart({ data, limit = 15 }: RankingsChartProps) {
  const chartData = data.slice(0, limit).map((d) => ({
    ...d,
    label: d.team_short_name,
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-widest text-slate-500">
        Top {Math.min(limit, chartData.length)} Teams · Total Points
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Bar colours reflect each team&apos;s national jersey
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            angle={-45}
            textAnchor="end"
            interval={0}
            height={56}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#faf5ff" }} />
          <Bar dataKey="total_points" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {chartData.map((entry) => (
              <Cell
                key={entry.team_id}
                fill={getTeamColor(entry.team_slug)}
                opacity={0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
