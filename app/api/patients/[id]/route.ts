import { withActor, noStore } from "@/lib/api/route";
import { patientPatchSchema, updatePatient } from "@/lib/db/patients";

export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/patients/[id]">,
) {
  return withActor(async (actor) => {
    const { id } = await ctx.params;
    await updatePatient(actor, id, patientPatchSchema.parse(await req.json()));
    return new Response(null, { status: 204, headers: noStore });
  });
}
