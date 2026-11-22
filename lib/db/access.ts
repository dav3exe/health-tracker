import "server-only";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/client";
import { Membership, type Role } from "@/lib/db/models/membership";

// THE access check (ADR-009). MongoDB has no row-level security, so every
// repository function in lib/db/ calls requirePatientAccess() before reading or
// writing anything patient-scoped. Routes never query directly: ESLint blocks
// importing mongoose outside lib/db/.

/** Who is making the request. Always built from the verified session. */
export type Actor = { userId: string };

// Higher number = more power. A caregiver can do everything a viewer can.
const RANK: Record<Role, number> = { viewer: 1, caregiver: 2, owner: 3 };

export class AccessDeniedError extends Error {
  constructor() {
    // Deliberately vague: never confirm whether a patient id exists to
    // someone who can't see it.
    super("You don't have access to this person's readings.");
    this.name = "AccessDeniedError";
  }
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * Throws AccessDeniedError unless `actor` has at least `minRole` for the
 * patient. Returns the actor's actual role.
 *
 * Role guide: viewer = read + export; caregiver = also log readings;
 * owner = also manage access (invites) and delete the profile.
 */
export async function requirePatientAccess(
  actor: Actor,
  patientId: string,
  minRole: Role,
): Promise<Role> {
  if (!isValidObjectId(actor.userId) || typeof patientId !== "string") {
    throw new AccessDeniedError();
  }
  await connectToDatabase();
  const membership = await Membership.findOne(
    { userId: actor.userId, patientId },
    { role: 1 },
  ).lean();
  if (!membership || !roleAtLeast(membership.role as Role, minRole)) {
    throw new AccessDeniedError();
  }
  return membership.role as Role;
}

/** Map of patientId → role for everything the actor can see. */
export async function accessiblePatients(
  actor: Actor,
): Promise<Map<string, Role>> {
  if (!isValidObjectId(actor.userId)) return new Map();
  await connectToDatabase();
  const rows = await Membership.find(
    { userId: actor.userId },
    { patientId: 1, role: 1 },
  ).lean();
  return new Map(rows.map((m) => [m.patientId, m.role as Role]));
}
