import "server-only";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/client";
import {
  accessiblePatients,
  requirePatientAccess,
  type Actor,
} from "@/lib/db/access";
import { Membership, type Role } from "@/lib/db/models/membership";
import { Patient } from "@/lib/db/models/patient";

export const newPatientSchema = z.object({
  // The phone's local patient id (see Patient model), so readings logged
  // before sign-up attach to this profile automatically.
  id: z.uuid(),
  displayName: z.string().trim().min(1).max(80),
  glucoseUnit: z.enum(["mgdl", "mmol"]),
  timezone: z.string().min(1),
});

export type PatientSummary = {
  id: string;
  displayName: string;
  glucoseUnit: "mgdl" | "mmol";
  timezone: string;
  role: Role;
};

/** Creates a patient with the actor as its owner. */
export async function createPatient(
  actor: Actor,
  input: z.infer<typeof newPatientSchema>,
): Promise<PatientSummary> {
  const data = newPatientSchema.parse(input);
  await connectToDatabase();

  // No multi-document transaction: free-tier and local single-node MongoDB
  // don't support them. Instead, create the membership FIRST: a stray
  // membership pointing at nothing is harmless, but a patient with no owner
  // would be unreachable data nobody can delete.
  const existing = await Patient.exists({ _id: data.id });
  if (existing) {
    // Re-running onboarding (double tap, retry after a lost response) must not
    // hand someone else's patient to this user. Only an existing member gets
    // the profile back.
    const role = await requirePatientAccess(actor, data.id, "viewer");
    const p = await Patient.findById(data.id).lean();
    return toSummary(p!, role);
  }

  await Membership.create({
    userId: actor.userId,
    patientId: data.id,
    role: "owner",
  });
  try {
    const patient = await Patient.create({
      _id: data.id,
      displayName: data.displayName,
      glucoseUnit: data.glucoseUnit,
      timezone: data.timezone,
      createdBy: actor.userId,
    });
    return toSummary(patient.toObject(), "owner");
  } catch (err) {
    // Lost a race for the same id: remove the membership we just made, or it
    // would grant ownership of whoever won.
    await Membership.deleteOne({ userId: actor.userId, patientId: data.id });
    throw err;
  }
}

export async function listMyPatients(actor: Actor): Promise<PatientSummary[]> {
  const roles = await accessiblePatients(actor);
  if (roles.size === 0) return [];
  const patients = await Patient.find({
    _id: { $in: [...roles.keys()] },
    deletedAt: { $exists: false },
  })
    .sort({ createdAt: 1 })
    .lean();
  return patients.map((p) => toSummary(p, roles.get(p._id)!));
}

export const patientPatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    glucoseUnit: z.enum(["mgdl", "mmol"]),
  })
  .partial();

export async function updatePatient(
  actor: Actor,
  patientId: string,
  patch: z.infer<typeof patientPatchSchema>,
): Promise<void> {
  const data = patientPatchSchema.parse(patch);
  await requirePatientAccess(actor, patientId, "caregiver");
  await Patient.updateOne({ _id: patientId }, { $set: data });
}

function toSummary(
  p: {
    _id: string;
    displayName: string;
    glucoseUnit?: string | null;
    timezone: string;
  },
  role: Role,
): PatientSummary {
  return {
    id: p._id,
    displayName: p.displayName,
    glucoseUnit: p.glucoseUnit === "mmol" ? "mmol" : "mgdl",
    timezone: p.timezone,
    role,
  };
}
