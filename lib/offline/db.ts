import Dexie, { type EntityTable } from "dexie";
import type { GlucoseUnit } from "@/lib/units";
import type { ReadingInput } from "@/lib/validation/readings";

// The phone's own database (IndexedDB via Dexie). Every reading is written
// HERE FIRST, then synced. That's what makes logging work with no signal and
// feel instant with a weak one: the "Saved" screen never waits on the network.

export type SyncState =
  | "pending" // saved on the phone, not yet confirmed by the server
  | "synced" // server has it
  | "rejected"; // server refused it (kept so it's never silently lost)

export type LocalReading = ReadingInput & {
  syncState: SyncState;
  /** Server's reason if rejected, shown in History so it can be fixed. */
  rejectReason?: string;
  /** Set by Undo/Delete. Kept as a tombstone until the server confirms. */
  deletedAt?: string;
  createdAt: string;
};

// Per-device settings. Until sign-in and profiles exist (later in M1) this is
// where the active patient and their preferred glucose unit live.
export type DeviceSettings = {
  key: "device";
  activePatientId: string | null;
  patientName?: string;
  glucoseUnit: GlucoseUnit;
};

class HealthDb extends Dexie {
  readings!: EntityTable<LocalReading, "id">;
  settings!: EntityTable<DeviceSettings, "key">;

  constructor() {
    super("health-tracker");
    // Indexes chosen for the screens that query them:
    //  [patientId+measuredAt] → History and Today, newest first, per patient
    //  syncState              → the sync loop finds pending work quickly
    this.version(1).stores({
      readings: "id, [patientId+measuredAt], syncState",
      settings: "key",
    });
  }
}

// A single instance per tab. Lazily created because IndexedDB doesn't exist
// during server rendering; touching it there would crash the render.
let instance: HealthDb | undefined;

export function localDb(): HealthDb {
  instance ??= new HealthDb();
  return instance;
}

export const DEFAULT_SETTINGS: DeviceSettings = {
  key: "device",
  activePatientId: null,
  glucoseUnit: "mgdl",
};

export async function getSettings(): Promise<DeviceSettings> {
  return (await localDb().settings.get("device")) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  patch: Partial<Omit<DeviceSettings, "key">>,
): Promise<void> {
  const current = await getSettings();
  await localDb().settings.put({ ...current, ...patch, key: "device" });
}
