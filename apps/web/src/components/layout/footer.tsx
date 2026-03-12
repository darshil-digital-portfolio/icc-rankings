import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="container-page py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏏</span>
            <span className="font-semibold text-slate-700">ICC Rankings</span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-pitch-700 transition-colors">Home</Link>
            <Link href="/rankings" className="hover:text-pitch-700 transition-colors">Rankings</Link>
            <Link href="/teams" className="hover:text-pitch-700 transition-colors">Teams</Link>
            <Link href="/events" className="hover:text-pitch-700 transition-colors">Events</Link>
          </nav>

          <p className="text-xs text-slate-400">
            Phase 1 · Data through 2025 · Non-commercial
          </p>
        </div>
      </div>
    </footer>
  );
}
