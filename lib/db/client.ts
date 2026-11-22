import "server-only";
import mongoose from "mongoose";
import { serverEnv } from "@/lib/env";

// This is the ONE place that opens a MongoDB connection (ADR-009). Other files
// in lib/db/ use it; everything outside lib/db/ is blocked from importing
// mongoose by ESLint, so every query is forced through the access-checked
// repository functions.

// Serverless functions and Next.js hot reload both re-evaluate modules. A new
// connection per evaluation would exhaust Atlas's connection limit (low on the
// free tier) within minutes. Caching the promise on globalThis survives
// re-evaluation and also stops concurrent first requests from racing to open
// several connections.
type MongooseCache = { promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as typeof globalThis & {
  __mongoose?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose.__mongoose ??= {
  promise: null,
});

export function connectToDatabase(): Promise<typeof mongoose> {
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(serverEnv().MONGODB_URI, {
        // Fail fast instead of letting a request hang for 30 s when the DB is
        // unreachable. The offline outbox on the client will simply retry.
        serverSelectionTimeoutMS: 5_000,
        // Mongoose's default queues queries until the connection opens, which
        // hides connection problems. We want them to surface as errors.
        bufferCommands: false,
      })
      .catch((err: unknown) => {
        // Clear the cache so the next request retries instead of reusing a
        // permanently rejected promise.
        cache.promise = null;
        throw err;
      });
  }
  return cache.promise;
}

// Strict query filters: Mongoose drops unknown filter keys by default, so a
// typo like { patientID: id } would silently match EVERY document. For a
// multi-patient health app that is a data leak, so make it an error instead.
mongoose.set("strictQuery", "throw");

// Used by the /api/health route so deploys and uptime checks can confirm the
// database is reachable, without exposing the driver outside lib/db/.
export async function pingDatabase(): Promise<boolean> {
  try {
    const conn = await connectToDatabase();
    await conn.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}
