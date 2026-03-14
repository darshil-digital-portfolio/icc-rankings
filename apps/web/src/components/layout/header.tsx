"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrophyIcon, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/rankings", label: "Rankings" },
  { href: "/teams", label: "Teams" },
  { href: "/events", label: "Events" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-pitch-900/20 bg-pitch-gradient shadow-md">
      <div className="container-page">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white transition-opacity hover:opacity-90"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500">
              <TrophyIcon className="h-5 w-5 text-pitch-950" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              ICC Rankings
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-pitch-100 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Theme toggle + Mobile burger */}
          <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            className="flex items-center justify-center rounded-lg p-2 text-white hover:bg-white/10 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-pitch-800 md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-pitch-100 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
