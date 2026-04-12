import type { DefaultSession } from "next-auth";

// Extend the built-in session / JWT types with our custom fields.
declare module "next-auth" {
  interface Session {
    user: {
      google_sub: string;
      is_admin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    google_sub?: string;
    is_admin?: boolean;
  }
}
