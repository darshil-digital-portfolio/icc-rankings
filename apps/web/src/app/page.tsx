import Link from "next/link";
import { getRankings, getEvents } from "@/lib/api";
import { formatPoints, EVENT_TYPE_LABELS } from "@/lib/utils";
import { TrophyIcon, BarChart3Icon, CalendarIcon, UsersIcon, ArrowRightIcon } from "lucide-react";
import type { EventType } from "@/types";

// Revalidate the home page every 5 minutes
export const revalidate = 300;

export default async function HomePage() {
  const [rankings, events] = await Promise.all([
    getRankings({ limit: 5 }),
    getEvents({ limit: 5 }),
  ]);

  const top5 = rankings.data;
  const recentEvents = events.data;

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-pitch-gradient">
        <div className="container-page py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" />
              <span className="text-xs font-semibold text-gold-300 uppercase tracking-wider">
                Phase 1 · Historical Data 1973–2025
              </span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              ICC Team Rankings
            </h1>
            <p className="mt-5 text-lg text-pitch-200">
              The definitive leaderboard of every nation's accumulated ICC points
              across all formats — World Cup, T20, Test Championship, Champions Trophy,
              and age-group tournaments.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/rankings"
                className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-6 py-3 text-sm font-bold text-pitch-950 shadow-lg transition-all hover:bg-gold-400 hover:shadow-gold-400/30"
              >
                <BarChart3Icon className="h-4 w-4" />
                View Full Rankings
              </Link>
              <Link
                href="/teams"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                <UsersIcon className="h-4 w-4" />
                Browse Teams
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="container-page">
          <div className="grid grid-cols-2 divide-x divide-slate-200 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-6 text-center">
                <p className="font-mono text-3xl font-extrabold text-pitch-700">{s.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main content grid ──────────────────────────────────────────────── */}
      <div className="container-page py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Top 5 rankings */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Top 5 Rankings</h2>
              <Link
                href="/rankings"
                className="flex items-center gap-1 text-sm font-semibold text-pitch-600 hover:text-pitch-800 transition-colors"
              >
                See all <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-2">
              {top5.map((entry) => (
                <Link
                  key={entry.team_id}
                  href={`/teams/${entry.team_slug}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md hover:border-pitch-300 group"
                >
                  <span className="w-6 text-center text-lg font-bold text-slate-400">
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                  </span>
                  <span className="text-2xl leading-none">{entry.flag_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-pitch-700 transition-colors">
                      {entry.team_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {entry.events_participated} events · {entry.titles} title{entry.titles !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="font-mono text-lg font-bold text-pitch-700 shrink-0">
                    {formatPoints(entry.total_points)}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent tournaments */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Recent Tournaments</h2>
              <Link
                href="/events"
                className="flex items-center gap-1 text-sm font-semibold text-pitch-600 hover:text-pitch-800 transition-colors"
              >
                See all <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-2">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md hover:border-pitch-300 group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pitch-50 font-mono text-sm font-bold text-pitch-700">
                    {event.year}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-pitch-700 transition-colors truncate">
                      {event.short_name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {EVENT_TYPE_LABELS[event.event_type as EventType]} · {event.multiplier}× · {event.teams_count} teams
                    </p>
                  </div>
                  {event.champion_flag && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-gold-50 px-2.5 py-1.5 shrink-0">
                      <span className="text-sm">{event.champion_flag}</span>
                      <span className="text-xs font-bold text-gold-700 hidden sm:block">
                        {event.champion_name}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-800">
            How Points Are Calculated
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.title} className="card p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pitch-50 text-2xl">
                  {item.icon}
                </div>
                <h3 className="font-bold text-slate-800">{item.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-pitch-200 bg-pitch-50 p-5 text-center">
            <p className="font-mono text-lg font-bold text-pitch-800">
              Points = Stage Base × Event Multiplier
            </p>
            <p className="mt-1 text-sm text-pitch-600">
              Example: Champion (5) at Men's World Cup (8×) = <strong>40 points</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const STATS = [
  { value: "50+", label: "Nations" },
  { value: "80+", label: "Tournaments" },
  { value: "8", label: "Formats" },
  { value: "1973", label: "Since" },
];

const HOW_IT_WORKS = [
  {
    icon: "🏏",
    title: "Stage Reached",
    body: "Group exit = 1pt, QF = 2pts, Semi-final = 3pts, Runner-up = 4pts, Champion = 5pts.",
  },
  {
    icon: "✖️",
    title: "Event Multiplier",
    body: "Higher-stakes events carry greater multipliers — Men's WC tops at 8×.",
  },
  {
    icon: "➕",
    title: "Cumulative Total",
    body: "Every ICC event a nation plays in adds to their all-time points tally.",
  },
  {
    icon: "📊",
    title: "Live Leaderboard",
    body: "Teams are ranked by grand total points across all formats and eras.",
  },
];
