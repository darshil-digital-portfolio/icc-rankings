import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeam, getTeamBreakdown } from "@/lib/api";
import { formatPoints, STAGE_COLORS, EVENT_TYPE_CHART_COLORS } from "@/lib/utils";
import { TeamFlag } from "@/components/ui/team-flag";
import { TeamHistoryChart } from "@/components/teams/team-history-chart";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { EventType } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const team = await getTeam(slug);
    return {
      title: team.name,
      description: `${team.name}'s complete ICC tournament history and all-time ranking points.`,
    };
  } catch {
    return { title: "Team" };
  }
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let team;
  let breakdown;
  try {
    [team, breakdown] = await Promise.all([
      getTeam(slug),
      getTeamBreakdown(slug),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="container-page py-10">
      {/* Back */}
      <Link
        href="/teams"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-pitch-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Teams
      </Link>

      {/* Hero */}
      <div className="card mb-8 overflow-hidden">
        <div className="bg-pitch-gradient px-8 py-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <TeamFlag slug={team.slug} name={team.name} size="lg" />
              <div>
                <h1 className="text-3xl font-bold text-white">{team.name}</h1>
                <p className="text-pitch-200 font-mono text-lg">{team.short_name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <StatPill label="Total Points" value={formatPoints(team.total_points)} highlight />
              <StatPill label="Events" value={String(team.events_participated)} />
              <StatPill label="Titles" value={`🏆 ${team.titles}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by event type */}
      {breakdown.breakdown.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-slate-700 dark:text-slate-800">Points by Format</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {breakdown.breakdown.map((b) => (
              <div
                key={b.event_type}
                className="card p-4"
                style={{
                  borderLeftColor: EVENT_TYPE_CHART_COLORS[b.event_type as EventType],
                  borderLeftWidth: 4,
                }}
              >
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-600">{b.event_type_label}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-pitch-700 dark:text-pitch-700">
                  {formatPoints(b.total_points)}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-600">
                  <span>{b.events_participated} events</span>
                  {b.titles > 0 && (
                    <span className="font-semibold text-gold-600 dark:text-gold-400">🏆 {b.titles} title{b.titles !== 1 ? "s" : ""}</span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-600">
                  {b.multiplier}× multiplier
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History chart */}
      {team.history.length > 0 && (
        <div className="mb-8">
          <TeamHistoryChart history={team.history} />
        </div>
      )}

      {/* Full history table */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-slate-700 dark:text-slate-800">
          Tournament History
          <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-600">
            ({team.history.length} events)
          </span>
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[#FDF9D4] shadow-sm dark:border-[#C5A882] dark:bg-[#E7D5AD]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E0D89A] bg-[#EDE8BB] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-[#C5A882] dark:bg-[#D4BF96] dark:text-slate-700">
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Base</th>
                <th className="px-4 py-3 text-right">Mult</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0D89A] dark:divide-[#C5A882]">
              {team.history.map((h) => (
                <tr key={h.event_id} className="hover:bg-[#EDE8BB] transition-colors dark:hover:bg-[#D4BF96]/50">
                  <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-600">{h.year}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-800">
                    <Link
                      href={`/events/${h.event_id}`}
                      className="hover:text-pitch-700 transition-colors dark:hover:text-pitch-600"
                    >
                      {h.event_short_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-600">{h.event_type_label}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "badge",
                        STAGE_COLORS[h.stage] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      {h.stage_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-600">
                    {h.base_points}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-600">
                    {h.multiplier}×
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-pitch-700 dark:text-pitch-700">
                    {h.total_points}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 dark:border-[#C5A882] dark:bg-[#D4BF96]">
                <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-700">
                  Grand Total
                </td>
                <td className="px-4 py-3 text-right font-mono text-base font-bold text-pitch-700 dark:text-pitch-700">
                  {formatPoints(team.total_points)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-center min-w-[100px]",
        highlight ? "bg-gold-500" : "bg-white/10",
      )}
    >
      <p
        className={cn(
          "font-mono text-xl font-bold",
          highlight ? "text-pitch-950" : "text-white",
        )}
      >
        {value}
      </p>
      <p className={cn("text-xs", highlight ? "text-pitch-800" : "text-pitch-200")}>{label}</p>
    </div>
  );
}
