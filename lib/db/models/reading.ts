import "server-only";
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { GLUCOSE_CONTEXTS } from "@/lib/validation/readings";

// Readings get their own collections because they grow forever, unlike the
// small, bounded data embedded in a patient (PLAN.md §4). Two collections,
// not one, so each has a strict schema and stats pipelines stay simple.
//
// Not MongoDB time-series collections: those restrict updates and deletes,
// and readings get corrected and undone.

const common = {
  // UUID generated on the phone, so retried syncs upsert, never duplicate.
  _id: { type: String, required: true },
  patientId: { type: String, ref: "Patient", required: true },
  measuredAt: { type: Date, required: true }, // stored as UTC
  // The timezone the reading was TAKEN in, so "which day" and "morning vs
  // evening" never shift if the patient's profile timezone changes later.
  measuredTz: { type: String, required: true },
  notes: { type: String, maxlength: 500 },
  loggedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // Soft delete: an undone reading stays auditable and syncs as a delete.
  deletedAt: { type: Date },
};

const bpSchema = new Schema(
  {
    ...common,
    systolic: { type: Number, required: true, min: 40, max: 300 },
    diastolic: { type: Number, required: true, min: 20, max: 200 },
    pulse: { type: Number, min: 20, max: 250 },
  },
  { timestamps: true },
);

const glucoseSchema = new Schema(
  {
    ...common,
    // ONE canonical unit. Mixed units would corrupt every average (ADR-008).
    valueMgdl: { type: Number, required: true, min: 10, max: 1000 },
    context: { type: String, enum: GLUCOSE_CONTEXTS, required: true },
  },
  { timestamps: true },
);

// History, Today and stats all read "this patient's readings, by time".
// updatedAt powers incremental sync ("what changed since I last pulled?").
for (const s of [bpSchema, glucoseSchema]) {
  s.index({ patientId: 1, measuredAt: -1 });
  s.index({ patientId: 1, updatedAt: 1 });
}

export type BpReadingDoc = InferSchemaType<typeof bpSchema>;
export type GlucoseReadingDoc = InferSchemaType<typeof glucoseSchema>;

export const BpReading: Model<BpReadingDoc> =
  (models.BpReading as Model<BpReadingDoc>) ??
  model<BpReadingDoc>("BpReading", bpSchema, "bpReadings");

export const GlucoseReading: Model<GlucoseReadingDoc> =
  (models.GlucoseReading as Model<GlucoseReadingDoc>) ??
  model<GlucoseReadingDoc>("GlucoseReading", glucoseSchema, "glucoseReadings");
