import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect /admin/* — redirect non-admins to home.
  if (pathname.startsWith("/admin")) {
    if (!req.auth?.user?.is_admin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Protect /chat — redirect unauthenticated users to sign-in.
  if (pathname.startsWith("/chat")) {
    if (!req.auth) {
      const signInUrl = new URL("/api/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: ["/admin/:path*", "/chat/:path*"],
};
