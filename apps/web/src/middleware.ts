import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Protect /admin/* — redirect non-admins to home.
  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (!req.auth?.user?.is_admin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
