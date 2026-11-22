import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDb } from "@/lib/offline/db";
import {
  listReadings,
  pendingCount,
  saveReading,
  syncNow,
  undoReading,
} from "@/lib/offline/outbox";
import type { BpReadingInput } from "@/lib/validation/readings";

// The outbox is where "never lose a reading" is either true or false, so the
// failure paths (offline, server error, lost response) are tested explicitly.

const reading = (over: Partial<BpReadingInput> = {}): BpReadingInput => ({
  id: crypto.randomUUID(),
  type: "bp",
  patientId: "p1",
  measuredAt: "2026-11-22T07:42:00+01:00",
  measuredTz: "Africa/Lagos",
  systolic: 128,
  diastolic: 82,
  ...over,
});

const offline = () =>
  vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

function serverAccepting() {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        accepted: body.upserts.map((r: { id: string }) => r.id),
        deleted: body.deletes,
        rejected: [],
      }),
    );
  });
}

beforeEach(async () => {
  // saveReading kicks off a real background sync; make it fail harmlessly.
  vi.stubGlobal("fetch", offline());
  await localDb().readings.clear();
});

describe("outbox", () => {
  it("saves locally as pending even with no network", async () => {
    await saveReading(reading());
    await syncNow(offline());
    expect(await pendingCount()).toBe(1);
  });

  it("rejects an invalid reading before it's stored", async () => {
    await expect(
      saveReading(reading({ systolic: 80, diastolic: 120 })),
    ).rejects.toThrow();
    expect(await localDb().readings.count()).toBe(0);
  });

  it("marks readings synced once the server accepts them", async () => {
    const r = await saveReading(reading());
    await syncNow(serverAccepting());
    expect((await localDb().readings.get(r.id))?.syncState).toBe("synced");
    expect(await pendingCount()).toBe(0);
  });

  it("keeps readings pending on a server error (never drops them)", async () => {
    await saveReading(reading());
    await syncNow(vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    expect(await pendingCount()).toBe(1);
  });

  it("sends the same id on retry, so the server can't duplicate it", async () => {
    const r = await saveReading(reading());
    // First attempt: the request reached the server but the response was lost.
    const lost = vi.fn().mockRejectedValue(new TypeError("network lost"));
    await syncNow(lost);
    const server = serverAccepting();
    await syncNow(server);
    const sent = JSON.parse(String(server.mock.calls[0][1]?.body));
    expect(sent.upserts.map((u: { id: string }) => u.id)).toEqual([r.id]);
  });

  it("does not send local-only fields to the server", async () => {
    await saveReading(reading());
    const server = serverAccepting();
    await syncNow(server);
    const sent = JSON.parse(String(server.mock.calls[0][1]?.body)).upserts[0];
    expect(sent).not.toHaveProperty("syncState");
    expect(sent).not.toHaveProperty("createdAt");
  });

  it("keeps rejected readings with the reason", async () => {
    const r = await saveReading(reading());
    await syncNow(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accepted: [],
            deleted: [],
            rejected: [{ id: r.id, reason: "No access to this patient" }],
          }),
        ),
      ),
    );
    const stored = await localDb().readings.get(r.id);
    expect(stored?.syncState).toBe("rejected");
    expect(stored?.rejectReason).toBe("No access to this patient");
  });

  it("undo of an unsynced reading removes it locally", async () => {
    const r = await saveReading(reading());
    await undoReading(r.id);
    expect(await localDb().readings.count()).toBe(0);
  });

  it("undo of a synced reading syncs a delete, then removes it", async () => {
    const r = await saveReading(reading());
    await syncNow(serverAccepting());
    await undoReading(r.id);
    expect(await listReadings("p1")).toHaveLength(0); // hidden immediately
    const server = serverAccepting();
    await syncNow(server);
    expect(JSON.parse(String(server.mock.calls[0][1]?.body)).deletes).toEqual([
      r.id,
    ]);
    expect(await localDb().readings.count()).toBe(0);
  });

  it("lists a patient's readings newest first", async () => {
    await saveReading(reading({ measuredAt: "2026-11-21T07:00:00+01:00" }));
    await saveReading(reading({ measuredAt: "2026-11-22T19:00:00+01:00" }));
    await saveReading(reading({ patientId: "someone-else" }));
    const rows = await listReadings("p1");
    expect(rows.map((r) => r.measuredAt)).toEqual([
      "2026-11-22T19:00:00+01:00",
      "2026-11-21T07:00:00+01:00",
    ]);
  });
});
