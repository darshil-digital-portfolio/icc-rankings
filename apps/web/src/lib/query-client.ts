"use client";

import { QueryClient } from "@tanstack/react-query";

let client: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          retry: 2,
        },
      },
    });
  }
  return client;
}
