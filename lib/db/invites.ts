import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/db/client";
import { requirePatientAccess, type Actor } from "@/lib/db/access";
import { Invite } from "@/lib/db/models/invite";
import { Membership, type Role } from "@/lib/db/models/membership";
import { Patient } from "@/lib/db/models/patient";
import { User } from "@/lib/db/models/user";

// Invite links: how a patient's phone gets signed in without an email,
// password or code to read out (PLAN.md §2).

// A week is long enough to visit and set the phone up in person, short
// enough that a link forgotten in a chat app soon stops working.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Owner-only. Returns the RAW token; only its hash is stored. */
export async function createInvite(
  actor: Actor,
  patientId: string,
  role: Exclude<Role, "owner"> = "caregiver",
): Promise<{ token: string; expiresAt: Date }> {
  // Only owners hand out access, so a viewer can't quietly grant themselves
  // (or anyone else) more.
  await requirePatientAccess(actor, patientId, "owner");
  // 32 random bytes = 256 bits: unguessable, and URL-safe as base64url.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await Invite.create({
    tokenHash: hash(token),
    patientId,
    role,
    createdBy: actor.userId,
    expiresAt,
  });
  return { token, expiresAt };
}

export type RedeemedInvite = {
  userId: string;
  name: string;
  patientId: string;
};

/**
 * Turns a valid, unused, unexpired invite into a new device user with access
 * to the patient. Returns null for anything else, without saying which case
 * it was, so a guessed token reveals nothing.
 */
export async function redeemInvite(
  token: string,
): Promise<RedeemedInvite | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) {
    return null;
  }
  await connectToDatabase();

  // Claim it atomically: if the link is opened twice at once (double tap,
  // or forwarded and opened elsewhere), exactly one request wins.
  const invite = await Invite.findOneAndUpdate(
    {
      tokenHash: hash(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  ).lean();
  if (!invite) return null;

  const patient = await Patient.findById(invite.patientId, {
    displayName: 1,
  }).lean();
  if (!patient) return null;

  const user = await User.create({ kind: "device", name: patient.displayName });
  await Membership.create({
    userId: user._id,
    patientId: invite.patientId,
    role: invite.role,
  });
  await Invite.updateOne({ _id: invite._id }, { $set: { usedBy: user._id } });

  return {
    userId: String(user._id),
    name: patient.displayName,
    patientId: invite.patientId,
  };
}
