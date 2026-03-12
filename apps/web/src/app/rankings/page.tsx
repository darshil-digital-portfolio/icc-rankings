import type { Metadata } from "next";
import { getRankings, getTeams, getTeam } from "@/lib/api";
import { RankingsTable } from "@/components/rankings/rankings-table";
import { RankingsLineChart } from "@/components/rankings/rankings-line-chart";
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

  // Rankings table data (filtered by event_type if set)
  const response = await getRankings({ event_type: eventType, limit: 50 });

  // All teams for the chart — fetch every team that has played at least once
  const allTeamsRes = await getTeams({ limit: 200 });
  const slugsForChart = allTeamsRes.data
    .filter((t) => t.events_participated > 0)
    .map((t) => t.slug);

  // Fetch full history for every active team in parallel
  const teamDetails = await Promise.all(slugsForChart.map((slug) => getTeam(slug)));

  return (
    <div className="container-page py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="section-heading">ICC Team Rankings</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Cumulative points earned across all ICC events.
          Points = Stage base × Event multiplier.
        </p>
      </div>

      {/* Scoring legend */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Scoring System
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SCORING_LEGEND.map((item) => (
            <div
              key={item.stage}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
            >
              <span className="text-base">{item.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.stage}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.points} pts</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Event Multipliers
          </p>
          <div className="flex flex-wrap gap-2">
            {MULTIPLIER_LEGEND.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <span className="font-bold text-pitch-700 dark:text-pitch-400">{item.mult}×</span>
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
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {response.meta.total} team{response.meta.total !== 1 ? "s" : ""}
        {eventType ? " for this event type" : " across all events"}
      </p>

      <div className="space-y-6">
        {/* Line chart — all nations, cumulative points over time */}
        {teamDetails.length > 0 && (
          <RankingsLineChart teams={teamDetails} eventType={eventType} />
        )}

        {/* Rankings table */}
        <RankingsTable data={response.data} />
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
