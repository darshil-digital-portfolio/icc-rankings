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
      // On initial sign-in, upsert user in Python service and embed is_admin.
      if (trigger === "signIn" && account?.provider === "google" && profile) {
        token.google_sub = profile.sub as string | undefined;
        try {
          const res = await fetch(`${INTERNAL_CHATBOT_URL}/api/users/me`, {
            headers: {
              "X-Service-Token": process.env.SERVICE_API_TOKEN ?? "",
              "X-User-Sub": (profile.sub ?? "") as string,
              "X-User-Email": (profile.email ?? "") as string,
              "X-User-Name": (profile.name ?? "") as string,
              // `picture` is on the Google profile but not on the base Profile type
              "X-User-Picture": (
                (profile as Record<string, unknown>).picture ?? ""
              ) as string,
            },
          });
          if (res.ok) {
            const user = (await res.json()) as { is_admin?: boolean };
            token.is_admin = user.is_admin ?? false;
          } else {
            token.is_admin = false;
          }
        } catch {
          token.is_admin = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.google_sub = (token.google_sub ?? "") as string;
      session.user.is_admin = (token.is_admin ?? false) as boolean;
      return session;
    },
  },
});
