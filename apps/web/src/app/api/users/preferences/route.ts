import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const INTERNAL_CHATBOT_URL =
  process.env.INTERNAL_CHATBOT_URL ?? "http://localhost:8100";

export async function GET() {
  const session = await auth();
  if (!session?.user?.google_sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${INTERNAL_CHATBOT_URL}/api/users/me`, {
      headers: {
        "X-Service-Token": process.env.SERVICE_API_TOKEN ?? "",
        "X-User-Sub": session.user.google_sub,
        "X-User-Email": session.user.email ?? "",
        "X-User-Name": session.user.name ?? "",
        "X-User-Picture": session.user.image ?? "",
      },
    });
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.google_sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(`${INTERNAL_CHATBOT_URL}/api/users/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": process.env.SERVICE_API_TOKEN ?? "",
        "X-User-Sub": session.user.google_sub,
      },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
