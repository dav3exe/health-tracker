import { afterAll, beforeAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// A real, throwaway MongoDB per test file. Mocks would hide exactly the bugs
// these tests exist for: wrong filters, missing indexes, upsert edge cases.
let server: MongoMemoryServer;

export function withTestDatabase() {
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri("health-tracker-test");
    const { connectToDatabase } = await import("@/lib/db/client");
    await connectToDatabase();
    // Build unique indexes now; tests rely on them (e.g. one membership per
    // user+patient, no duplicate reading ids).
    await Promise.all(
      Object.values(mongoose.models).map((m) => m.syncIndexes()),
    );
  });

  beforeEach(async () => {
    const db = mongoose.connection.db!;
    for (const c of await db.collections()) await c.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}
