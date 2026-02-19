import type { Metadata } from "next";
import Link from "next/link";
import { getTeams } from "@/lib/api";
import { formatPoints, getRankMedal } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Teams",
  description: "Browse all ICC member nations and their all-time ranking points.",
};

export default async function TeamsPage() {
  const response = await getTeams({ limit: 100 });
  const teams = response.data;

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="section-heading">ICC Member Nations</h1>
        <p className="mt-2 text-slate-500">
          {response.meta.total} nations ranked by total accumulated ICC points.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            className="card group flex flex-col gap-4 p-5 transition-all hover:shadow-md hover:border-pitch-300"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{team.flag_emoji}</span>
                <div>
                  <p className="font-bold text-slate-800 group-hover:text-pitch-700 transition-colors">
                    {team.name}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    {team.short_name}
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-slate-300">
                {getRankMedal(team.rank)}
              </span>
            </div>

            {/* Points */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold font-mono text-pitch-700">
                  {formatPoints(team.total_points)}
                </p>
                <p className="text-xs text-slate-500">total points</p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700">
                  {team.events_participated}
                </p>
                <p className="text-xs text-slate-500">events</p>
              </div>
            </div>

            {/* Titles */}
            {team.titles > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-gold-50 px-3 py-1.5">
                <span>🏆</span>
                <span className="text-xs font-bold text-gold-700">
                  {team.titles} title{team.titles !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
