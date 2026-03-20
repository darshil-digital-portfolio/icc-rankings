import type { Metadata } from "next";
import { ChatView } from "@/components/chat/chat-view";

export const metadata: Metadata = {
  title: "Twelfth Man – AI Chat",
  description:
    "Ask Twelfth Man anything about ICC cricket rankings, team history, and tournament statistics.",
};

export default function ChatPage() {
  return <ChatView />;
}
