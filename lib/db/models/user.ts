import "server-only";
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

// People who sign in (ADR-002: patients are NOT users).
//
// Two kinds:
//  - "google": signed up with Google. The only way to create a full account.
//  - "device": a patient's phone, set up from a caregiver's invite link. It has
//    no email or password, so an older person never has to remember one; its
//    access comes entirely from the membership the invite created.
const userSchema = new Schema(
  {
    kind: { type: String, enum: ["google", "device"], required: true },
    // Google's stable account id ("sub"). Emails can change; sub never does.
    googleSub: { type: String },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    image: { type: String },
  },
  { timestamps: true },
);

// Partial index: device users have no googleSub, and a plain unique index
// would treat all their missing values as duplicates of each other.
userSchema.index(
  { googleSub: 1 },
  { unique: true, partialFilterExpression: { googleSub: { $type: "string" } } },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);
