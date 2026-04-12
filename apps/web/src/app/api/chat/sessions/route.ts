import { auth } from "@/auth";
import { NextResponse } from "next/server";

const INTERNAL_CHATBOT_URL =
  process.env.INTERNAL_CHATBOT_URL ?? "http://localhost:8100";

export async function GET() {
  const session = await auth();
  if (!session?.user?.google_sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${INTERNAL_CHATBOT_URL}/api/users/sessions`, {
      headers: {
        "X-Service-Token": process.env.SERVICE_API_TOKEN ?? "",
        "X-User-Sub": session.user.google_sub,
      },
    });
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
