import "server-only";
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { ROLES } from "@/lib/db/models/membership";

// One-time links a caregiver opens on a patient's phone to sign it in
// (PLAN.md §2). Only a SHA-256 hash of the token is stored: if the database
// leaked, the hashes couldn't be turned back into working links.
const inviteSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    patientId: { type: String, ref: "Patient", required: true },
    role: { type: String, enum: ROLES, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    usedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// MongoDB deletes expired invites by itself (TTL index), a day after expiry
// so a "this link has expired" message can still be shown briefly.
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export type InviteDoc = InferSchemaType<typeof inviteSchema>;

export const Invite: Model<InviteDoc> =
  (models.Invite as Model<InviteDoc>) ??
  model<InviteDoc>("Invite", inviteSchema);
