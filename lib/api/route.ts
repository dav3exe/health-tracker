import { ZodError } from "zod";
import { auth } from "@/auth";
import { AccessDeniedError, type Actor } from "@/lib/db/access";

// Shared wrapper for every authenticated API route. It turns the session into
// an Actor (the only thing lib/db/ accepts) and maps errors to status codes in
// ONE place, so no route can forget a check or leak an internal error message.

export async function withActor(
  handler: (actor: Actor) => Promise<Response>,
): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  try {
    return await handler({ userId });
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return Response.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ZodError) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    // Log the error type only: messages and stacks can contain health values
    // (CLAUDE.md: no health values in logs).
    console.error("API error:", err instanceof Error ? err.name : typeof err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export const noStore = { "Cache-Control": "no-store" };
