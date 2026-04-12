"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { getUserPreferences } from "@/lib/user-api";
import type { UserProfile } from "@/types";

export function useUserPreferences() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return useQuery<UserProfile>({
    queryKey: ["userPreferences"],
    queryFn: getUserPreferences,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min — preference data changes rarely
    retry: 1,
  });
}
