import {
  getSettings,
  localDb,
  updateSettings,
  type LocalReading,
} from "@/lib/offline/db";
import { readingSchema, type ReadingInput } from "@/lib/validation/readings";

// The outbox: save locally, then push to the server whenever possible.
//
// Design choices:
// - IDs are UUIDs made on the phone, and the server UPSERTS by id. So if a
//   sync request succeeds but the response is lost (common on mobile), the
//   retry can't create a duplicate reading.
// - Nothing is ever dropped. A reading the server rejects stays on the phone,
//   marked "rejected", until someone fixes or deletes it.
// - Undo of a reading that hasn't synced yet simply removes it. Undo of a
//   synced one leaves a tombstone that syncs as a delete.

export const SYNC_ENDPOINT = "/api/sync";

export type SyncResponse = {
  accepted: string[];
  deleted: string[];
  rejected: { id: string; reason: string }[];
};

/** Validate and store a new reading. Resolves as soon as it's on the phone. */
export async function saveReading(input: ReadingInput): Promise<LocalReading> {
  // Same schema the server uses, so a reading the server would reject is
  // caught now, while the user is still on the form.
  const parsed = readingSchema.parse(input);
  const record: LocalReading = {
    ...parsed,
    syncState: "pending",
    createdAt: new Date().toISOString(),
  };
  await localDb().readings.put(record);
  void syncNow(); // fire and forget: the UI never waits for the network
  return record;
}

export async function undoReading(id: string): Promise<void> {
  const db = localDb();
  const existing = await db.readings.get(id);
  if (!existing) return;
  if (existing.syncState === "synced") {
    await db.readings.update(id, {
      deletedAt: new Date().toISOString(),
      syncState: "pending",
    });
    void syncNow();
  } else {
    await db.readings.delete(id);
  }
}

/** Readings for History/Today, newest first, excluding deleted ones. */
export async function listReadings(
  patientId: string,
  sinceIso?: string,
): Promise<LocalReading[]> {
  const rows = await localDb()
    .readings.where("[patientId+measuredAt]")
    .between(
      [patientId, sinceIso ?? ""],
      [patientId, "￿"], // highest string: "up to the newest"
    )
    .reverse()
    .toArray();
  return rows.filter((r) => !r.deletedAt);
}

export async function pendingCount(): Promise<number> {
  return localDb().readings.where("syncState").equals("pending").count();
}

// ---------------------------------------------------------------------------
// Sync loop
// ---------------------------------------------------------------------------

let inFlight: Promise<void> | null = null;
let queued: Promise<void> | null = null;

/**
 * Push pending readings. At most one request runs at a time, so tapping Save
 * twice quickly can't double-send. A call made DURING a sync queues exactly
 * one follow-up run: otherwise a reading saved mid-sync would sit unsent
 * until the next trigger (up to a minute).
 */
export function syncNow(
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<void> {
  if (!inFlight) {
    inFlight = pushPending(fetchImpl)
      .then(() => pullChanges(fetchImpl))
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }
  queued ??= inFlight
    .catch(() => {})
    .then(() => {
      queued = null;
      return syncNow(fetchImpl);
    });
  return queued;
}

/** Strip local-only bookkeeping so we send exactly the wire format. */
function toWire(r: LocalReading): ReadingInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { syncState, rejectReason, deletedAt, createdAt, ...wire } = r;
  return wire;
}

async function pushPending(fetchImpl: typeof fetch): Promise<void> {
  const db = localDb();
  const pending = await db.readings
    .where("syncState")
    .equals("pending")
    .toArray();
  if (pending.length === 0) return;

  const upserts = pending.filter((r) => !r.deletedAt).map(toWire);
  const deletes = pending.filter((r) => r.deletedAt).map((r) => r.id);

  let res: Response;
  try {
    res = await fetchImpl(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upserts, deletes }),
    });
  } catch {
    return; // offline or flaky network: stay pending, retry later
  }
  // Server error or signed out: also retry later. Never mark as rejected on
  // a 5xx/401, because those say nothing about the reading itself.
  if (!res.ok) return;

  const body = (await res.json()) as SyncResponse;
  await db.transaction("rw", db.readings, async () => {
    for (const id of body.accepted) {
      await db.readings.update(id, {
        syncState: "synced",
        rejectReason: undefined,
      });
    }
    for (const id of body.deleted) {
      await db.readings.delete(id);
    }
    for (const { id, reason } of body.rejected) {
      await db.readings.update(id, {
        syncState: "rejected",
        rejectReason: reason,
      });
    }
  });
}

/**
 * Start background syncing for this tab: on reconnect, when the app comes back
 * to the foreground, and every minute as a safety net. Returns a cleanup fn.
 */
export function startAutoSync(): () => void {
  const run = () => void syncNow();
  const onVisible = () => document.visibilityState === "visible" && run();
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(run, 60_000);
  run();
  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}

/** Readings that failed for a fixable reason (e.g. before setup) go again. */
export async function retryRejected(): Promise<void> {
  await localDb()
    .readings.where("syncState")
    .equals("rejected")
    .modify({ syncState: "pending", rejectReason: undefined });
  void syncNow();
}

/**
 * Move readings logged on this phone before it was linked to a patient onto
 * that patient. Only unsynced rows move: synced ones already belong to a
 * patient on the server and must never be reassigned.
 */
export async function reassignLocalReadings(
  fromPatientId: string,
  toPatientId: string,
): Promise<void> {
  if (fromPatientId === toPatientId) return;
  await localDb()
    .readings.where("[patientId+measuredAt]")
    .between([fromPatientId, ""], [fromPatientId, "\uffff"])
    .filter((r) => r.syncState !== "synced")
    .modify({
      patientId: toPatientId,
      syncState: "pending",
      rejectReason: undefined,
    });
}

type PullResponse = {
  serverTime: string;
  readings: (ReadingInput & { deleted: boolean })[];
};

// Bring in readings logged on OTHER phones for the active patient, so a
// caregiver and the patient see the same History.
async function pullChanges(fetchImpl: typeof fetch): Promise<void> {
  const settings = await getSettings();
  const patientId = settings.activePatientId;
  if (!patientId) return;
  const since = settings.lastPulledAt?.[patientId];
  const qs = new URLSearchParams({ patientId, ...(since && { since }) });

  let res: Response;
  try {
    res = await fetchImpl(`${SYNC_ENDPOINT}?${qs}`);
  } catch {
    return;
  }
  // 401 (signed out) / 403 (not linked yet) / 5xx: nothing to merge.
  if (!res.ok) return;
  const body = (await res.json()) as PullResponse;

  const db = localDb();
  await db.transaction("rw", db.readings, async () => {
    for (const { deleted, ...r } of body.readings) {
      const local = await db.readings.get(r.id);
      // Never overwrite an edit or undo made on this phone that hasn't been
      // sent yet: the local change is newer and will sync next.
      if (local && local.syncState !== "synced") continue;
      if (deleted) {
        await db.readings.delete(r.id);
      } else {
        await db.readings.put({
          ...readingSchema.parse(r),
          syncState: "synced",
          createdAt: local?.createdAt ?? new Date().toISOString(),
        });
      }
    }
  });
  await updateSettings({
    lastPulledAt: { ...settings.lastPulledAt, [patientId]: body.serverTime },
  });
}
