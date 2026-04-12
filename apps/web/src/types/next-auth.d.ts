import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      google_sub: string;
      is_admin: boolean;
      is_new_user: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    google_sub?: string;
    is_admin?: boolean;
    is_new_user?: boolean;
  }
}
