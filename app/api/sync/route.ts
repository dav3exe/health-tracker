import { withActor, noStore } from "@/lib/api/route";
import { applySync, pullReadings, syncRequestSchema } from "@/lib/db/readings";

// POST: the phone pushes its outbox (new readings + deletions).
export async function POST(req: Request) {
  return withActor(async (actor) => {
    const body = syncRequestSchema.parse(await req.json());
    return Response.json(await applySync(actor, body), { headers: noStore });
  });
}

// GET ?patientId=…&since=…: the phone pulls what changed elsewhere, e.g.
// readings a caregiver logged on their own phone.
export async function GET(req: Request) {
  return withActor(async (actor) => {
    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId") ?? "";
    const sinceRaw = url.searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : undefined;
    const valid = since && !Number.isNaN(since.getTime()) ? since : undefined;
    return Response.json(await pullReadings(actor, patientId, valid), {
      headers: noStore,
    });
  });
}
