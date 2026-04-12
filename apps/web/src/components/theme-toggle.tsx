"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { updateUserPreferences } from "@/lib/user-api";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const { status } = useSession();
  const { data: preferences } = useUserPreferences();

  // Initialise from localStorage on mount.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  // When server preferences load for an authenticated user, apply the saved theme.
  useEffect(() => {
    if (status === "authenticated" && preferences?.preferences.theme) {
      const next = preferences.preferences.theme === "dark";
      setIsDark(next);
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", preferences.preferences.theme);
    }
  }, [preferences?.preferences.theme, status]);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");

    // Fire-and-forget preference update for authenticated users.
    if (status === "authenticated") {
      updateUserPreferences({ theme: next ? "dark" : "light" }).catch(() => {});
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      aria-label="Toggle dark mode"
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
