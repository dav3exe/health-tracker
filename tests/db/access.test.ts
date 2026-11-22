import { describe, expect, it } from "vitest";
import { withTestDatabase } from "./setup";
import { upsertGoogleUser } from "@/lib/db/users";
import {
  createPatient,
  listMyPatients,
  updatePatient,
} from "@/lib/db/patients";
import { createInvite, redeemInvite } from "@/lib/db/invites";
import { applySync, pullReadings } from "@/lib/db/readings";
import { Invite } from "@/lib/db/models/invite";
import type { Actor } from "@/lib/db/access";
import type { BpReadingInput } from "@/lib/validation/readings";

// ADR-009: with no database-level row security, these tests ARE the proof
// that one family can't see or change another's health data.

withTestDatabase();

async function googleUser(name: string): Promise<Actor> {
  return { userId: await upsertGoogleUser({ sub: `sub-${name}`, name }) };
}

async function setup() {
  const owner = await googleUser("owner");
  const stranger = await googleUser("stranger");
  const patient = await createPatient(owner, {
    id: crypto.randomUUID(),
    displayName: "Ade",
    glucoseUnit: "mgdl",
    timezone: "Africa/Lagos",
  });
  // Invite-based access, exactly as a real phone would get it.
  const asRole = async (role: "caregiver" | "viewer"): Promise<Actor> => {
    const { token } = await createInvite(owner, patient.id, role);
    const r = await redeemInvite(token);
    return { userId: r!.userId };
  };
  return {
    owner,
    stranger,
    patient,
    caregiver: await asRole("caregiver"),
    viewer: await asRole("viewer"),
  };
}

const bp = (patientId: string, over: Partial<BpReadingInput> = {}) => ({
  id: crypto.randomUUID(),
  type: "bp" as const,
  patientId,
  measuredAt: "2026-11-22T07:42:00+01:00",
  measuredTz: "Africa/Lagos",
  systolic: 128,
  diastolic: 82,
  ...over,
});

describe("writing readings (sync)", () => {
  it.each(["owner", "caregiver"] as const)("%s can log", async (who) => {
    const ctx = await setup();
    const r = bp(ctx.patient.id);
    const res = await applySync(ctx[who], { upserts: [r], deletes: [] });
    expect(res.accepted).toEqual([r.id]);
  });

  it.each(["viewer", "stranger"] as const)("%s cannot log", async (who) => {
    const ctx = await setup();
    const r = bp(ctx.patient.id);
    const res = await applySync(ctx[who], { upserts: [r], deletes: [] });
    expect(res.accepted).toEqual([]);
    expect(res.rejected[0].id).toBe(r.id);
  });

  it("is idempotent: re-sending the same id doesn't duplicate", async () => {
    const ctx = await setup();
    const r = bp(ctx.patient.id);
    await applySync(ctx.owner, { upserts: [r], deletes: [] });
    await applySync(ctx.owner, { upserts: [r], deletes: [] });
    const { readings } = await pullReadings(ctx.owner, ctx.patient.id);
    expect(readings).toHaveLength(1);
  });

  it("can't move a reading to another patient by reusing its id", async () => {
    const ctx = await setup();
    const other = await createPatient(ctx.owner, {
      id: crypto.randomUUID(),
      displayName: "Bisi",
      glucoseUnit: "mgdl",
      timezone: "Africa/Lagos",
    });
    const r = bp(ctx.patient.id);
    await applySync(ctx.owner, { upserts: [r], deletes: [] });
    const moved = await applySync(ctx.owner, {
      upserts: [{ ...r, patientId: other.id }],
      deletes: [],
    });
    expect(moved.rejected).toHaveLength(1);
    expect((await pullReadings(ctx.owner, other.id)).readings).toHaveLength(0);
  });

  it("rejects invalid readings individually without blocking good ones", async () => {
    const ctx = await setup();
    const good = bp(ctx.patient.id);
    const bad = bp(ctx.patient.id, { systolic: 80, diastolic: 120 });
    const res = await applySync(ctx.owner, {
      upserts: [good, bad],
      deletes: [],
    });
    expect(res.accepted).toEqual([good.id]);
    expect(res.rejected.map((x) => x.id)).toEqual([bad.id]);
  });
});

describe("deleting readings", () => {
  it("a stranger can't delete someone else's reading", async () => {
    const ctx = await setup();
    const r = bp(ctx.patient.id);
    await applySync(ctx.owner, { upserts: [r], deletes: [] });
    const res = await applySync(ctx.stranger, { upserts: [], deletes: [r.id] });
    expect(res.deleted).toEqual([]);
    const { readings } = await pullReadings(ctx.owner, ctx.patient.id);
    expect(readings[0].deleted).toBe(false);
  });

  it("a caregiver's delete is a soft delete that other phones receive", async () => {
    const ctx = await setup();
    const r = bp(ctx.patient.id);
    await applySync(ctx.owner, { upserts: [r], deletes: [] });
    await applySync(ctx.caregiver, { upserts: [], deletes: [r.id] });
    const { readings } = await pullReadings(ctx.owner, ctx.patient.id);
    expect(readings[0]).toMatchObject({ id: r.id, deleted: true });
  });
});

describe("reading readings (pull)", () => {
  it.each(["owner", "caregiver", "viewer"] as const)(
    "%s can view",
    async (who) => {
      const ctx = await setup();
      await applySync(ctx.owner, {
        upserts: [bp(ctx.patient.id)],
        deletes: [],
      });
      const { readings } = await pullReadings(ctx[who], ctx.patient.id);
      expect(readings).toHaveLength(1);
    },
  );

  it("a stranger cannot view", async () => {
    const ctx = await setup();
    await expect(pullReadings(ctx.stranger, ctx.patient.id)).rejects.toThrow(
      /don't have access/,
    );
  });

  it("only returns changes since the last pull", async () => {
    const ctx = await setup();
    await applySync(ctx.owner, { upserts: [bp(ctx.patient.id)], deletes: [] });
    const first = await pullReadings(ctx.owner, ctx.patient.id);
    await new Promise((r) => setTimeout(r, 5));
    await applySync(ctx.owner, { upserts: [bp(ctx.patient.id)], deletes: [] });
    const next = await pullReadings(
      ctx.owner,
      ctx.patient.id,
      new Date(first.serverTime),
    );
    expect(next.readings).toHaveLength(1);
  });
});

describe("patients", () => {
  it("lists only patients the user is linked to", async () => {
    const ctx = await setup();
    expect(await listMyPatients(ctx.stranger)).toEqual([]);
    expect((await listMyPatients(ctx.viewer))[0]).toMatchObject({
      id: ctx.patient.id,
      role: "viewer",
    });
  });

  it("re-creating with an existing id doesn't hand the patient to a stranger", async () => {
    const ctx = await setup();
    await expect(
      createPatient(ctx.stranger, {
        id: ctx.patient.id,
        displayName: "Hijack",
        glucoseUnit: "mgdl",
        timezone: "UTC",
      }),
    ).rejects.toThrow(/don't have access/);
    expect(await listMyPatients(ctx.stranger)).toEqual([]);
  });

  it("a viewer can't edit the profile", async () => {
    const ctx = await setup();
    await expect(
      updatePatient(ctx.viewer, ctx.patient.id, { glucoseUnit: "mmol" }),
    ).rejects.toThrow();
  });
});

describe("invites", () => {
  it("only the owner can create invites", async () => {
    const ctx = await setup();
    for (const who of ["caregiver", "viewer", "stranger"] as const) {
      await expect(createInvite(ctx[who], ctx.patient.id)).rejects.toThrow();
    }
  });

  it("an invite works exactly once", async () => {
    const ctx = await setup();
    const { token } = await createInvite(ctx.owner, ctx.patient.id);
    expect(await redeemInvite(token)).not.toBeNull();
    expect(await redeemInvite(token)).toBeNull();
  });

  it("two simultaneous redemptions: exactly one wins", async () => {
    const ctx = await setup();
    const { token } = await createInvite(ctx.owner, ctx.patient.id);
    const results = await Promise.all([
      redeemInvite(token),
      redeemInvite(token),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("an expired invite doesn't work", async () => {
    const ctx = await setup();
    const { token } = await createInvite(ctx.owner, ctx.patient.id);
    await Invite.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect(await redeemInvite(token)).toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const ctx = await setup();
    const { token } = await createInvite(ctx.owner, ctx.patient.id);
    const stored = await Invite.findOne().lean();
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("garbage tokens are rejected without errors", async () => {
    expect(await redeemInvite("nope")).toBeNull();
    expect(await redeemInvite("x".repeat(43))).toBeNull();
  });
});
