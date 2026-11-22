import { connection } from "next/server";
import { pingDatabase } from "@/lib/db/client";

// Liveness + database check for deploys and uptime monitors.
// It reports only "up/down", never versions, hostnames or counts, because
// anything here is public and could help an attacker.
export async function GET() {
  // Must run per request, never be prerendered at build time: a cached
  // "database: up" from the last deploy would hide a real outage.
  await connection();
  const database = (await pingDatabase()) ? "up" : "down";
  return Response.json(
    { status: database === "up" ? "ok" : "degraded", database },
    {
      status: database === "up" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
