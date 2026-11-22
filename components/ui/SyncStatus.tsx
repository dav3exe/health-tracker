import { CloudCheck, CloudUpload } from "lucide-react";

// One calm line that tells the user their readings are safe. Older users
// often worry that a reading "didn't go through"; saying it plainly beats a
// spinner or a red error. Offline is NOT an error here: the reading is saved
// on the phone and will sync, so the tone stays neutral (DESIGN.md §7).
//
// Milestone 0: the state is passed in. Milestone 1 wires this to the Dexie
// outbox (pending count) and the browser's online status.

export function SyncStatus({ pending = 0 }: { pending?: number }) {
  const allSaved = pending === 0;
  const Icon = allSaved ? CloudCheck : CloudUpload;

  return (
    // role="status" makes screen readers announce changes politely,
    // without interrupting whatever the user is doing.
    <p
      role="status"
      className="flex items-center gap-2 text-label text-text-muted"
    >
      <Icon aria-hidden className={allSaved ? "size-6 text-ok" : "size-6"} />
      {allSaved
        ? "All readings saved"
        : `Saved on this phone. Will sync when online (${pending})`}
    </p>
  );
}
