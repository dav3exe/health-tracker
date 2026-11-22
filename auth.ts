import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { upsertGoogleUser } from "@/lib/db/users";
import { redeemInvite } from "@/lib/db/invites";

// Sign-in (owner's decision): two ways in, and only two.
//
//  1. Google: the ONLY way to create an account. No passwords for us to store
//     or for anyone to forget, and Google handles 2-step verification.
//  2. Invite link: a caregiver opens a one-time link on a patient's phone,
//     which signs that phone in. No email, password or code needed, which is
//     what makes setup possible for less tech-confident people (PLAN.md §2).

declare module "next-auth" {
  interface Session {
    user: { id: string; kind: "google" | "device" } & DefaultSession["user"];
  }
}

// ~6 months. Long, on purpose: being signed out is the biggest barrier for
// our users, and an expired session on a parent's phone means a support visit.
// The phone's own screen lock is the real protection here.
const SESSION_MAX_AGE = 180 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT (cookie) sessions, no database adapter: the Auth.js MongoDB adapter
  // requires MongoDB driver v6 while Mongoose uses v7, and two drivers in one
  // app is a recipe for subtle bugs. Users are stored by our own lib/db code.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/signin" },
  providers: [
    Google,
    Credentials({
      id: "invite",
      name: "Invite link",
      credentials: { token: {} },
      async authorize(credentials) {
        const redeemed = await redeemInvite(String(credentials?.token ?? ""));
        if (!redeemed) return null;
        return { id: redeemed.userId, name: redeemed.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Runs at sign-in (account present) and on every session read after.
      if (account?.provider === "google" && profile?.sub) {
        token.uid = await upsertGoogleUser({
          sub: profile.sub,
          email: profile.email,
          name: profile.name,
          image: typeof profile.picture === "string" ? profile.picture : null,
        });
        token.kind = "google";
      } else if (account?.provider === "invite" && user?.id) {
        token.uid = user.id;
        token.kind = "device";
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.user.kind = token.kind === "device" ? "device" : "google";
      return session;
    },
  },
});
