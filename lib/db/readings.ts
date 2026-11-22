import "server-only";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/client";
import {
  AccessDeniedError,
  accessiblePatients,
  requirePatientAccess,
  roleAtLeast,
  type Actor,
} from "@/lib/db/access";
import { BpReading, GlucoseReading } from "@/lib/db/models/reading";
import { readingSchema, type ReadingInput } from "@/lib/validation/readings";

// Server side of the offline outbox (lib/offline/outbox.ts).
//
// Each reading is handled independently: one bad reading in a batch must not
// block the good ones, and the phone needs a per-reading answer so it can
// mark each one synced or rejected.

export const syncRequestSchema = z.object({
  // Capped so one request can't tie up the server; the outbox sends what's
  // pending, which in practice is a handful of readings.
  upserts: z.array(z.unknown()).max(500),
  deletes: z.array(z.string()).max(500),
});

export type SyncResult = {
  accepted: string[];
  deleted: string[];
  rejected: { id: string; reason: string }[];
};

export async function applySync(
  actor: Actor,
  body: z.infer<typeof syncRequestSchema>,
): Promise<SyncResult> {
  await connectToDatabase();
  const result: SyncResult = { accepted: [], deleted: [], rejected: [] };
  // One membership lookup for the whole batch instead of one per reading.
  const roles = await accessiblePatients(actor);

  for (const raw of body.upserts) {
    const parsed = readingSchema.safeParse(raw);
    const id =
      typeof raw === "object" && raw && "id" in raw ? String(raw.id) : "";
    if (!parsed.success) {
      if (id)
        result.rejected.push({ id, reason: "This reading looks invalid." });
      continue;
    }
    const r = parsed.data;
    const role = roles.get(r.patientId);
    if (!role || !roleAtLeast(role, "caregiver")) {
      result.rejected.push({
        id: r.id,
        reason: new AccessDeniedError().message,
      });
      continue;
    }
    try {
      await upsertReading(actor, r);
      result.accepted.push(r.id);
    } catch (err) {
      result.rejected.push({ id: r.id, reason: rejectionReason(err) });
    }
  }

  for (const id of body.deletes) {
    const existing =
      (await BpReading.findById(id, { patientId: 1 }).lean()) ??
      (await GlucoseReading.findById(id, { patientId: 1 }).lean());
    // Already gone (or never synced): deleting is idempotent, report success
    // so the phone can drop its tombstone.
    if (!existing) {
      result.deleted.push(id);
      continue;
    }
    const role = roles.get(existing.patientId);
    if (!role || !roleAtLeast(role, "caregiver")) {
      result.rejected.push({ id, reason: new AccessDeniedError().message });
      continue;
    }
    const update = { $set: { deletedAt: new Date() } };
    await BpReading.updateOne({ _id: id }, update);
    await GlucoseReading.updateOne({ _id: id }, update);
    result.deleted.push(id);
  }

  return result;
}

async function upsertReading(actor: Actor, r: ReadingInput): Promise<void> {
  const common = {
    patientId: r.patientId,
    measuredAt: new Date(r.measuredAt),
    measuredTz: r.measuredTz,
    notes: r.notes,
  };
  // The filter includes patientId: if this id already exists under ANOTHER
  // patient, the filter misses, the upsert tries to insert, and the unique
  // _id makes it fail. So a reading can never be moved between patients by
  // re-sending its id.
  const filter = { _id: r.id, patientId: r.patientId };
  const opts = { upsert: true };
  if (r.type === "bp") {
    await BpReading.updateOne(
      filter,
      {
        $set: {
          ...common,
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse,
        },
        $setOnInsert: { loggedBy: actor.userId },
      },
      opts,
    );
  } else {
    await GlucoseReading.updateOne(
      filter,
      {
        $set: { ...common, valueMgdl: r.valueMgdl, context: r.context },
        $setOnInsert: { loggedBy: actor.userId },
      },
      opts,
    );
  }
}

function rejectionReason(err: unknown): string {
  if (
    typeof err === "object" &&
    err &&
    "code" in err &&
    (err as { code: number }).code === 11000
  ) {
    return "This reading belongs to someone else.";
  }
  // Generic on purpose: internal error text can leak details (and values).
  return "The server couldn't save this reading. It will be kept on this phone.";
}

export type PulledReading = ReadingInput & {
  deleted: boolean;
  updatedAt: string;
};

/**
 * Readings for a patient changed since `since`, including deletions, so every
 * phone linked to the patient converges on the same list (e.g. a caregiver
 * sees readings logged on the patient's own phone).
 */
export async function pullReadings(
  actor: Actor,
  patientId: string,
  since?: Date,
): Promise<{ readings: PulledReading[]; serverTime: string }> {
  await requirePatientAccess(actor, patientId, "viewer");
  // Taken BEFORE querying: anything written during the query is picked up
  // next time rather than missed.
  const serverTime = new Date().toISOString();
  const filter = {
    patientId,
    ...(since && { updatedAt: { $gt: since } }),
  };
  const [bp, glucose] = await Promise.all([
    BpReading.find(filter).sort({ updatedAt: 1 }).limit(2000).lean(),
    GlucoseReading.find(filter).sort({ updatedAt: 1 }).limit(2000).lean(),
  ]);

  const base = (d: {
    _id: string;
    patientId: string;
    measuredAt: Date;
    measuredTz: string;
    notes?: string | null;
    deletedAt?: Date | null;
    updatedAt: Date;
  }) => ({
    id: d._id,
    patientId: d.patientId,
    measuredAt: d.measuredAt.toISOString(),
    measuredTz: d.measuredTz,
    ...(d.notes && { notes: d.notes }),
    deleted: !!d.deletedAt,
    updatedAt: d.updatedAt.toISOString(),
  });

  return {
    serverTime,
    readings: [
      ...bp.map((d) => ({
        ...base(d),
        type: "bp" as const,
        systolic: d.systolic,
        diastolic: d.diastolic,
        ...(d.pulse != null && { pulse: d.pulse }),
      })),
      ...glucose.map((d) => ({
        ...base(d),
        type: "glucose" as const,
        valueMgdl: d.valueMgdl,
        context: d.context,
      })),
    ],
  };
}
