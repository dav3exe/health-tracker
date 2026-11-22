import { withActor, noStore } from "@/lib/api/route";
import { createPatient, newPatientSchema } from "@/lib/db/patients";

// Onboarding: create a patient profile owned by the signed-in user.
export async function POST(req: Request) {
  return withActor(async (actor) => {
    const input = newPatientSchema.parse(await req.json());
    const patient = await createPatient(actor, input);
    return Response.json(patient, { status: 201, headers: noStore });
  });
}
