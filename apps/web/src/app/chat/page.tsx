import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";

export const metadata: Metadata = {
  title: "Twelfth Man – AI Chat",
  description:
    "Ask Twelfth Man anything about ICC cricket rankings, team history, and tournament statistics.",
};

export default async function ChatPage() {
  const session = await auth();
  // Middleware already redirects unauthenticated users, but guard here too.
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/chat");
  }

  return (
    <ChatView
      userName={session.user.name ?? ""}
      googleSub={session.user.google_sub}
      isNewUser={session.user.is_new_user}
    />
  );
}
