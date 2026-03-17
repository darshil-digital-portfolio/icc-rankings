"use client";

import Link from "next/link";
import type { RankingEntry } from "@/types";
import { cn, formatPoints, getRankMedal } from "@/lib/utils";
import { TeamFlag } from "@/components/ui/team-flag";

interface RankingsTableProps {
  data: RankingEntry[];
  isLoading?: boolean;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-slate-200 dark:bg-slate-700" />
        </td>
      ))}
    </tr>
  );
}

export function RankingsTable({ data, isLoading }: RankingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[#FDF9D4] shadow-sm dark:border-slate-700 dark:bg-[#E7D5AD]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E0D89A] bg-[#EDE8BB] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-[#C5A882] dark:bg-[#D4BF96] dark:text-slate-700">
            <th className="px-4 py-3 w-16">Rank</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3 text-right">Points</th>
            <th className="px-4 py-3 text-right">Events</th>
            <th className="px-4 py-3 text-right">Titles</th>
            <th className="px-4 py-3 text-right">Avg/Event</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E0D89A] dark:divide-[#C5A882]">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            : data.map((entry, idx) => (
                <RankingsRow key={entry.team_id} entry={entry} isTopThree={idx < 3} />
              ))}
        </tbody>
      </table>

      {!isLoading && data.length === 0 && (
        <div className="py-16 text-center text-slate-400 dark:bg-slate-900">
          <p className="text-base font-medium">No teams found</p>
        </div>
      )}
    </div>
  );
}

function RankingsRow({
  entry,
  isTopThree,
}: {
  entry: RankingEntry;
  isTopThree: boolean;
}) {
  const avg =
    entry.events_participated > 0
      ? (entry.total_points / entry.events_participated).toFixed(1)
      : "0.0";

  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[#EDE8BB] dark:hover:bg-[#D4BF96]/50",
        isTopThree && "bg-gradient-to-r from-gold-50/40 to-transparent dark:from-gold-900/10",
      )}
    >
      <td className="px-4 py-3 font-mono font-semibold text-slate-600 dark:text-slate-600">
        <span className="text-base">{getRankMedal(entry.rank)}</span>
      </td>

      <td className="px-4 py-3">
        <Link href={`/teams/${entry.team_slug}`} className="flex items-center gap-3 group">
          <TeamFlag slug={entry.team_slug} name={entry.team_name} size="sm" />
          <span className="font-semibold text-slate-800 group-hover:text-pitch-600 transition-colors dark:text-pitch-800 dark:group-hover:text-pitch-600">
            {entry.team_name}
          </span>
          <span className="hidden text-xs font-medium text-slate-400 sm:block dark:text-slate-600">
            {entry.team_short_name}
          </span>
        </Link>
      </td>

      <td className="px-4 py-3 text-right">
        <span className="font-mono text-base font-bold text-pitch-700 dark:text-pitch-700">
          {formatPoints(entry.total_points)}
        </span>
      </td>

      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-600">
        {entry.events_participated}
      </td>

      <td className="px-4 py-3 text-right">
        {entry.titles > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-gold-700 dark:bg-gold-200 dark:text-gold-700">
            🏆 {entry.titles}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 dark:text-slate-600">
        {avg}
      </td>
    </tr>
  );
}
