import type { Metadata } from "next";
import Link from "next/link";
import { getEvents } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CalendarIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { TeamFlag } from "@/components/ui/team-flag";
import type { EventType } from "@/types";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse all ICC tournaments from 1975 to 2025.",
};

const EVENT_TYPE_BADGE_COLORS: Record<string, string> = {
  men_world_cup: "bg-gold-100 text-gold-800",
  test_championship: "bg-red-100 text-red-800",
  men_t20_world_cup: "bg-sky-100 text-sky-800",
  men_knockout_champions: "bg-emerald-100 text-emerald-800",
  women_world_cup: "bg-amber-100 text-amber-800",
  women_t20_world_cup: "bg-pink-100 text-pink-800",
  men_u19: "bg-blue-100 text-blue-800",
  women_u19: "bg-purple-100 text-purple-800",
};

export default async function EventsPage() {
  let events: Awaited<ReturnType<typeof getEvents>>["data"] = [];
  let total = 0;

  try {
    const response = await getEvents({ limit: 200 });
    events = response.data;
    total = response.meta.total;
  } catch {
    // API unavailable at build time
  }

  // Group by event type for better UX
  const groups = groupByEventType(events);

  return (
    <div className="container-page py-10">
      <div className="mb-8">
        <h1 className="section-heading">ICC Tournaments</h1>
        <p className="mt-2 text-slate-500">
          {total > 0 ? `${total} tournaments across all formats, 1973–2025.` : "Tournaments across all formats, 1973–2025."}
        </p>
      </div>

      <div className="space-y-10">
        {GROUP_ORDER.map((et) => {
          const group = groups[et];
          if (!group?.length) return null;
          return (
            <section key={et}>
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={cn(
                    "badge text-xs",
                    EVENT_TYPE_BADGE_COLORS[et] ?? "bg-slate-100 text-slate-600",
                  )}
                >
                  {group[0]!.event_type_label}
                </span>
                <span className="text-sm font-semibold text-pitch-700">
                  {group[0]!.multiplier}× multiplier
                </span>
                <span className="text-xs text-slate-400">
                  ({group.length} editions)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="card group p-4 transition-all hover:shadow-md hover:border-pitch-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-800 group-hover:text-pitch-700 transition-colors leading-tight dark:text-neon-cyan/90 dark:group-hover:text-pitch-400">
                        {event.short_name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-pitch-50 px-2 py-0.5 text-[10px] font-bold text-pitch-700">
                        {event.year}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPinIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.host}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <UsersIcon className="h-3 w-3 shrink-0" />
                        <span>{event.teams_count} teams</span>
                      </div>
                    </div>

                    {event.champion_name && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-gold-50 px-2.5 py-2">
                        {event.champion_slug && (
                          <TeamFlag slug={event.champion_slug} name={event.champion_name ?? ""} size="sm" />
                        )}
                        <span className="text-xs font-bold text-gold-700">
                          {event.champion_name}
                        </span>
                        <span className="ml-auto text-xs">🏆</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROUP_ORDER: EventType[] = [
  "men_world_cup",
  "test_championship",
  "men_t20_world_cup",
  "men_knockout_champions",
  "women_world_cup",
  "women_t20_world_cup",
  "men_u19",
  "women_u19",
];

function groupByEventType(events: Awaited<ReturnType<typeof getEvents>>["data"]) {
  const result: Partial<Record<EventType, typeof events>> = {};
  for (const event of events) {
    const et = event.event_type as EventType;
    if (!result[et]) result[et] = [];
    result[et]!.push(event);
  }
  // Sort each group newest-first
  for (const key of Object.keys(result)) {
    result[key as EventType]!.sort((a, b) => b.year - a.year);
  }
  return result;
}
