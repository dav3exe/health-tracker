import "server-only";
import { connectToDatabase } from "@/lib/db/client";
import { User } from "@/lib/db/models/user";

// User accounts. Called from auth.ts during sign-in, i.e. BEFORE there is a
// session, so these functions take no Actor; they only ever create or find
// the account of the person who just proved who they are to Google.

export async function upsertGoogleUser(profile: {
  sub: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<string> {
  await connectToDatabase();
  const user = await User.findOneAndUpdate(
    { googleSub: profile.sub },
    {
      // Refresh name/photo/email each sign-in so they track the Google
      // account, but never change kind or googleSub after creation.
      $set: {
        email: profile.email ?? undefined,
        name: profile.name || profile.email || "Caregiver",
        image: profile.image ?? undefined,
      },
      $setOnInsert: { kind: "google", googleSub: profile.sub },
    },
    { upsert: true, new: true, projection: { _id: 1 } },
  ).lean();
  return String(user!._id);
}

export async function getUser(userId: string) {
  await connectToDatabase();
  return User.findById(userId, { name: 1, email: 1, image: 1, kind: 1 }).lean();
}
