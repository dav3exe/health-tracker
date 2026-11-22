import "server-only";
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

// A person whose readings are tracked (PLAN.md §4). Who may see or change it
// lives in `memberships`, never on this document.
const patientSchema = new Schema(
  {
    // A UUID generated ON THE PHONE, not an ObjectId. Someone can start
    // logging before they sign up; their readings already carry this id, so
    // creating the profile later adopts them with no remapping step.
    _id: { type: String, required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    // Display preference only. Storage is always mg/dL (ADR-008).
    glucoseUnit: { type: String, enum: ["mgdl", "mmol"], default: "mgdl" },
    timezone: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Soft delete with a grace period (PLAN.md §5.7), then hard-deleted.
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

export type PatientDoc = InferSchemaType<typeof patientSchema>;

export const Patient: Model<PatientDoc> =
  (models.Patient as Model<PatientDoc>) ??
  model<PatientDoc>("Patient", patientSchema);
