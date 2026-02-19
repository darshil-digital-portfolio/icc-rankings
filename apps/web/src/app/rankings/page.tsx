import type { Metadata } from "next";
import { getRankings } from "@/lib/api";
import { RankingsTable } from "@/components/rankings/rankings-table";
import { RankingsChart } from "@/components/rankings/rankings-chart";
import { EventTypeFilter } from "@/components/rankings/event-type-filter";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Overall ICC team rankings by cumulative points across all formats and tournaments.",
};

interface PageProps {
  searchParams: Promise<{ event_type?: string }>;
}

export default async function RankingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const eventType = params.event_type;

  const response = await getRankings({
    event_type: eventType,
    limit: 50,
  });

  return (
    <div className="container-page py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="section-heading">ICC Team Rankings</h1>
        <p className="mt-2 text-slate-500">
          Cumulative points earned across all ICC events.
          Points = Stage base × Event multiplier.
        </p>
      </div>

      {/* Scoring legend */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Scoring System
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SCORING_LEGEND.map((item) => (
            <div
              key={item.stage}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
            >
              <span className="text-base">{item.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-slate-700">{item.stage}</p>
                <p className="text-xs text-slate-500">{item.points} pts</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Event Multipliers
          </p>
          <div className="flex flex-wrap gap-2">
            {MULTIPLIER_LEGEND.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
              >
                <span className="font-bold text-pitch-700">{item.mult}×</span>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <EventTypeFilter current={eventType} />
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-slate-500">
        {response.meta.total} team{response.meta.total !== 1 ? "s" : ""}
        {eventType ? " for this event type" : " across all events"}
      </p>

      <div className="space-y-6">
        {/* Table */}
        <RankingsTable data={response.data} />

        {/* Chart */}
        {response.data.length > 0 && (
          <RankingsChart data={response.data} limit={15} />
        )}
      </div>
    </div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const SCORING_LEGEND = [
  { stage: "Group Stage", points: 1, emoji: "1️⃣" },
  { stage: "QF / Super Stage", points: 2, emoji: "2️⃣" },
  { stage: "Semi-Final", points: 3, emoji: "3️⃣" },
  { stage: "Runner-Up", points: 4, emoji: "4️⃣" },
  { stage: "Champion", points: 5, emoji: "🏆" },
];

const MULTIPLIER_LEGEND = [
  { label: "Women's U19", mult: 1 },
  { label: "Men's U19", mult: 2 },
  { label: "Women's T20 WC", mult: 3 },
  { label: "Women's WC", mult: 4 },
  { label: "Men's CT / KO", mult: 5 },
  { label: "Men's T20 WC", mult: 6 },
  { label: "Test Championship", mult: 7 },
  { label: "Men's WC", mult: 8 },
];
