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
import type { EventHistoryEntry, EventType } from "@/types";
import { EVENT_TYPE_CHART_COLORS } from "@/lib/utils";

interface TeamHistoryChartProps {
  history: EventHistoryEntry[];
}

interface TooltipPayload {
  payload: EventHistoryEntry;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const h = payload[0]!.payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg max-w-[220px]">
      <p className="font-semibold text-slate-800 text-sm">{h.event_short_name}</p>
      <p className="text-xs text-slate-500">{h.year} · {h.event_type_label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-base font-bold text-pitch-700">
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

export function TeamHistoryChart({ history }: TeamHistoryChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
        Points per Tournament
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={history} margin={{ top: 4, right: 8, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="event_short_name"
            tick={{ fontSize: 10, fill: "#64748b" }}
            angle={-45}
            textAnchor="end"
            interval={0}
            height={64}
          />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="total_points" radius={[3, 3, 0, 0]}>
            {history.map((h, idx) => (
              <Cell
                key={idx}
                fill={EVENT_TYPE_CHART_COLORS[h.event_type as EventType] ?? "#15803d"}
              />
            ))}
          </Bar>
        </BarChart>
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
