import { withActor, noStore } from "@/lib/api/route";
import { getUser } from "@/lib/db/users";
import { listMyPatients } from "@/lib/db/patients";

// Who am I, and whose readings can I see? Drives the patient picker,
// onboarding redirect and which patient this phone logs for.
export async function GET() {
  return withActor(async (actor) => {
    const [user, patients] = await Promise.all([
      getUser(actor.userId),
      listMyPatients(actor),
    ]);
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    return Response.json(
      {
        user: {
          name: user.name,
          email: user.email,
          image: user.image,
          kind: user.kind,
        },
        patients,
      },
      { headers: noStore },
    );
  });
}
