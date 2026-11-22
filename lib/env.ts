import "server-only";
import { z } from "zod";

// Validate server env vars once, at first use, with a clear message.
// A missing MONGODB_URI otherwise surfaces as a confusing driver error deep
// inside a request, long after the real cause (a missing .env.local) is gone.
//
// "server-only" makes importing this file from a Client Component a build
// error, so secrets in here can never be bundled for the browser.
const serverEnvSchema = z.object({
  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb(\+srv)?:\/\//,
      "MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string",
    ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and rule messages are reported, never values,
    // because the value itself may be a credential.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment. Copy .env.example to .env.local.\n${issues}`,
    );
  }
  cached = parsed.data;
  return cached;
}
