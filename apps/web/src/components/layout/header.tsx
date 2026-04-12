"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { TrophyIcon, Menu, X, MessageCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/rankings", label: "Rankings" },
  { href: "/teams", label: "Teams" },
  { href: "/events", label: "Events" },
  { href: "/chat", label: "Twelfth Man", icon: true },
] as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();

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
                    "icon" in link && "flex items-center gap-1.5",
                  )}
                >
                  {"icon" in link && <MessageCircle className="h-3.5 w-3.5" />}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth + Theme toggle + Mobile burger */}
          <div className="flex items-center gap-1">
            {/* Auth section — desktop only */}
            <div className="hidden items-center gap-2 md:flex">
              {status === "loading" && (
                <div className="h-8 w-20 animate-pulse rounded-lg bg-white/10" />
              )}

              {status === "authenticated" && session && (
                <>
                  {session.user.is_admin && (
                    <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-pitch-950">
                      Admin
                    </span>
                  )}
                  <span className="max-w-[120px] truncate text-sm font-medium text-pitch-100">
                    {session.user.name}
                  </span>
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user.name ?? "User avatar"}
                      width={32}
                      height={32}
                      className="rounded-full ring-2 ring-white/20"
                    />
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-pitch-100 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Sign out
                  </button>
                </>
              )}

              {status === "unauthenticated" && (
                <button
                  onClick={() => signIn("google", { callbackUrl: "/?welcome=1" })}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-pitch-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Sign in
                </button>
              )}
            </div>

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
                    "icon" in link && "flex items-center gap-1.5",
                  )}
                >
                  {"icon" in link && <MessageCircle className="h-3.5 w-3.5" />}
                  {link.label}
                </Link>
              );
            })}

            {/* Mobile auth */}
            <div className="mt-1 border-t border-white/10 pt-2">
              {status === "authenticated" && session && (
                <button
                  onClick={() => { signOut({ callbackUrl: "/" }); setMobileOpen(false); }}
                  className="w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-pitch-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Sign out ({session.user.name})
                </button>
              )}
              {status === "unauthenticated" && (
                <button
                  onClick={() => { signIn("google", { callbackUrl: "/?welcome=1" }); setMobileOpen(false); }}
                  className="w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-pitch-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
