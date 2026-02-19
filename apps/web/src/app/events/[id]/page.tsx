import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent } from "@/lib/api";
import { cn, STAGE_COLORS, formatPoints } from "@/lib/utils";
import { ArrowLeft, MapPinIcon, UsersIcon } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const event = await getEvent(id);
    return {
      title: event.name,
      description: `Results and points breakdown for ${event.name}.`,
    };
  } catch {
    return { title: "Event" };
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;

  let event;
  try {
    event = await getEvent(id);
  } catch {
    notFound();
  }

  const champion = event.participants.find((p) => p.stage === "champion");

  return (
    <div className="container-page py-10">
      {/* Back */}
      <Link
        href="/events"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-pitch-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Events
      </Link>

      {/* Hero */}
      <div className="card mb-8 overflow-hidden">
        <div className="bg-pitch-gradient px-8 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-pitch-300">
                {event.event_type_label}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                {event.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-pitch-200">
                <span className="flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4" />
                  {event.host}
                </span>
                <span className="flex items-center gap-1.5">
                  <UsersIcon className="h-4 w-4" />
                  {event.participants.length} teams
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <StatChip label="Year" value={String(event.year)} />
              <StatChip label="Multiplier" value={`${event.multiplier}×`} highlight />
              {champion && (
                <StatChip
                  label="Champion"
                  value={`${champion.flag_emoji} ${champion.team_name}`}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Participants table */}
      <h2 className="mb-4 text-lg font-bold text-slate-800">
        Participating Teams &amp; Points Earned
      </h2>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Base Points</th>
              <th className="px-4 py-3 text-right">Multiplier</th>
              <th className="px-4 py-3 text-right">Points Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {event.participants.map((p, idx) => (
              <tr
                key={p.team_id}
                className={cn(
                  "hover:bg-slate-50 transition-colors",
                  p.stage === "champion" && "bg-gold-50/40",
                )}
              >
                <td className="px-4 py-3 font-mono text-sm text-slate-400">
                  {idx + 1}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/teams/${p.team_slug}`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="text-xl leading-none">{p.flag_emoji}</span>
                    <span className="font-semibold text-slate-800 group-hover:text-pitch-700 transition-colors">
                      {p.team_name}
                    </span>
                    <span className="hidden text-xs text-slate-400 sm:block">
                      {p.team_short_name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "badge",
                      STAGE_COLORS[p.stage] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    {p.stage_label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">
                  {p.base_points}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">
                  {p.multiplier}×
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-pitch-700">
                  {p.total_points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatChip({
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
        "rounded-xl px-4 py-3 text-center min-w-[90px]",
        highlight ? "bg-gold-500" : "bg-white/10",
      )}
    >
      <p
        className={cn(
          "font-mono text-base font-bold",
          highlight ? "text-pitch-950" : "text-white",
        )}
      >
        {value}
      </p>
      <p className={cn("text-xs", highlight ? "text-pitch-800" : "text-pitch-200")}>
        {label}
      </p>
    </div>
  );
}
