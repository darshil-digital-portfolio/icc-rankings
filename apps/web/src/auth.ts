import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const INTERNAL_CHATBOT_URL =
  process.env.INTERNAL_CHATBOT_URL ?? "http://localhost:8100";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      if (trigger === "signIn" && account?.provider === "google" && profile) {
        token.google_sub = profile.sub as string | undefined;
        try {
          const res = await fetch(`${INTERNAL_CHATBOT_URL}/api/users/me`, {
            headers: {
              "X-Service-Token": process.env.SERVICE_API_TOKEN ?? "",
              "X-User-Sub": (profile.sub ?? "") as string,
              "X-User-Email": (profile.email ?? "") as string,
              "X-User-Name": (profile.name ?? "") as string,
              "X-User-Picture": (
                (profile as Record<string, unknown>).picture ?? ""
              ) as string,
            },
          });
          if (res.ok) {
            const user = (await res.json()) as {
              is_admin?: boolean;
              is_new_user?: boolean;
            };
            token.is_admin = user.is_admin ?? false;
            token.is_new_user = user.is_new_user ?? false;
          } else {
            token.is_admin = false;
            token.is_new_user = false;
          }
        } catch {
          token.is_admin = false;
          token.is_new_user = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.google_sub = (token.google_sub ?? "") as string;
      session.user.is_admin = (token.is_admin ?? false) as boolean;
      session.user.is_new_user = (token.is_new_user ?? false) as boolean;
      return session;
    },
  },
});
