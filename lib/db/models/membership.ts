import "server-only";
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

// Who can see/do what for which patient (ADR-002, ADR-009). This collection IS
// the security model: lib/db/access.ts checks it before every query.
export const ROLES = ["viewer", "caregiver", "owner"] as const;
export type Role = (typeof ROLES)[number];

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    patientId: { type: String, ref: "Patient", required: true },
    role: { type: String, enum: ROLES, required: true },
    notifyOnFlags: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// One membership per user per patient. Also the index for "what can I see?".
membershipSchema.index({ userId: 1, patientId: 1 }, { unique: true });
// "Who has access to this patient?" (access review, alerts).
membershipSchema.index({ patientId: 1 });

export type MembershipDoc = InferSchemaType<typeof membershipSchema>;

export const Membership: Model<MembershipDoc> =
  (models.Membership as Model<MembershipDoc>) ??
  model<MembershipDoc>("Membership", membershipSchema);
