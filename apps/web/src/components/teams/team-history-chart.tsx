"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EventHistoryEntry, EventType } from "@/types";
import { EVENT_TYPE_CHART_COLORS } from "@/lib/utils";

interface TeamHistoryChartProps {
  history: EventHistoryEntry[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartEntry = EventHistoryEntry & { idx: number };

interface TooltipPayload {
  payload: ChartEntry;
}

// ─── Custom dot — each dot coloured by event type ─────────────────────────────

function CustomDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartEntry;
}) {
  if (cx === undefined || cy === undefined || !payload) return <g />;
  const fill = EVENT_TYPE_CHART_COLORS[payload.event_type as EventType] ?? "#7e22ce";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="white"
      strokeWidth={2}
    />
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const h = payload[0]!.payload;
  const dotColor = EVENT_TYPE_CHART_COLORS[h.event_type as EventType] ?? "#7e22ce";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl max-w-[240px]">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <p className="font-semibold text-slate-800 text-sm">{h.event_short_name}</p>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{h.year} · {h.event_type_label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold text-pitch-700">
          {h.total_points} pts
        </span>
        <span className="text-xs text-slate-400">
          ({h.base_points} × {h.multiplier})
        </span>
      </div>
      <p className="mt-0.5 text-xs font-semibold text-slate-600">{h.stage_label}</p>
    </div>
  );
}

// ─── Main chart ───────────────────────────────────────────────────────────────

export function TeamHistoryChart({ history }: TeamHistoryChartProps) {
  // Sort chronologically; stable sort by event name within same year
  const chartData: ChartEntry[] = [...history]
    .sort((a, b) =>
      a.year !== b.year
        ? a.year - b.year
        : a.event_short_name.localeCompare(b.event_short_name),
    )
    .map((h, i) => ({ ...h, idx: i }));

  // Unique years for readable x-axis ticks
  const seenYears = new Set<number>();
  const yearTicks = chartData
    .filter((d) => {
      if (seenYears.has(d.year)) return false;
      seenYears.add(d.year);
      return true;
    })
    .map((d) => d.idx);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-slate-500">
        Points per Tournament
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Dot colour indicates the tournament format
      </p>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="idx"
            ticks={yearTicks}
            tickFormatter={(i: number) => String(chartData[i]?.year ?? "")}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total_points"
            stroke="#7e22ce"
            strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => (
              <CustomDot
                key={`dot-${props.index}`}
                cx={props.cx}
                cy={props.cy}
                payload={props.payload}
              />
            )}
            activeDot={{ r: 7, fill: "#7e22ce", stroke: "white", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(EVENT_TYPE_CHART_COLORS).map(([et, color]) => {
          const hasData = history.some((h) => h.event_type === et);
          if (!hasData) return null;
          return (
            <span
              key={et}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {et.replace(/_/g, " ")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
