import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

/**
 * NextAuth v5 configuration.
 *
 * Auth strategy: JWT sessions (no DB session table — the existing
 * `Session` model in our Prisma schema is for ONBOARDING sessions, not
 * auth sessions, so we keep them separate by NOT routing auth through
 * the DB session model).
 *
 * Providers:
 *   - Google OAuth (preferred — 1-click, no email round-trip)
 *   - Resend email magic link (fallback for users without Google)
 *
 * Pages:
 *   - /login is our custom UI; NextAuth's default is replaced.
 *   - We don't define /verify-request — Resend's flow uses NextAuth's
 *     default page which says "check your email" (good enough for now).
 *
 * The PrismaAdapter persists Account rows on first OAuth link and
 * VerificationToken rows for magic-link flows. User rows get
 * auto-created on first sign-in.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL ?? "hi@step.careers",
    }),
  ],
  session: {
    // JWT — the auth session lives in a signed cookie, not in our DB.
    // Avoids a name collision with our domain `Session` model and
    // saves a DB round-trip on every request.
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Forward the userId into the JWT and onto the session object so
    // server-side route handlers can read `session.user.id` directly.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
