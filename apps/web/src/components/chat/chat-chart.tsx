"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/chatbot-api";

const CHART_COLORS = [
  "#9333ea", "#d4af37", "#3b82f6", "#ef4444", "#10b981",
  "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#14b8a6",
];

interface ChatChartProps {
  spec: ChartSpec;
}

export function ChatChart({ spec }: ChatChartProps) {
  const { chart_type, data, x_key, y_key, title, x_label, y_label } = spec;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
      {title && (
        <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </h4>
      )}
      <ResponsiveContainer width="100%" height={280}>
        {chart_type === "bar" ? (
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey={x_key}
              tick={{ fontSize: 11 }}
              label={x_label ? { value: x_label, position: "insideBottom", offset: -5 } : undefined}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={y_label ? { value: y_label, angle: -90, position: "insideLeft" } : undefined}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />
            <Bar dataKey={y_key} radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        ) : chart_type === "line" ? (
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey={x_key}
              tick={{ fontSize: 11 }}
              label={x_label ? { value: x_label, position: "insideBottom", offset: -5 } : undefined}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              label={y_label ? { value: y_label, angle: -90, position: "insideLeft" } : undefined}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />
            <Line
              type="monotone"
              dataKey={y_key}
              stroke="#9333ea"
              strokeWidth={2}
              dot={{ fill: "#9333ea", r: 4 }}
              activeDot={{ r: 6, fill: "#d4af37" }}
            />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey={y_key}
              nameKey={x_key}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
