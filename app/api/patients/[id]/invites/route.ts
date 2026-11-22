import { z } from "zod";
import { withActor, noStore } from "@/lib/api/route";
import { createInvite } from "@/lib/db/invites";

const bodySchema = z.object({
  role: z.enum(["caregiver", "viewer"]).default("caregiver"),
});

// Owner creates a one-time link to set up another phone for this patient.
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/patients/[id]/invites">,
) {
  return withActor(async (actor) => {
    const { id } = await ctx.params;
    const { role } = bodySchema.parse(await req.json().catch(() => ({})));
    const { token, expiresAt } = await createInvite(actor, id, role);
    // Built from the request's own origin, so preview and production
    // deployments each produce links to themselves.
    const url = `${new URL(req.url).origin}/invite/${token}`;
    return Response.json({ url, expiresAt }, { status: 201, headers: noStore });
  });
}
