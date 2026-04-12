import type { UserPreferences, UserProfile } from "@/types";

export async function getUserPreferences(): Promise<UserProfile> {
  const res = await fetch("/api/users/preferences");
  if (!res.ok) {
    throw new Error(`Failed to fetch user preferences (${res.status})`);
  }
  return res.json() as Promise<UserProfile>;
}

export async function updateUserPreferences(
  update: Partial<UserPreferences>,
): Promise<UserProfile> {
  const res = await fetch("/api/users/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    throw new Error(`Failed to update user preferences (${res.status})`);
  }
  return res.json() as Promise<UserProfile>;
}
