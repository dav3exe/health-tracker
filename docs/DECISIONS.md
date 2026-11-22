# Architecture Decisions

Short records of the decisions behind the plan. Each one resolves an open
question from the original spec. They are **recommendations** — change any of
them by editing the record and noting why.

Status values: `Proposed` (recommended, not yet confirmed) · `Accepted` · `Superseded`.

---

## ADR-001: Database — MongoDB

**Status:** Accepted (owner's choice; supersedes the earlier Supabase proposal)
**Question:** Which backend and database?

**Decision:** MongoDB Atlas with Mongoose, accessed only from Next.js server
code (route handlers, server actions, server components).

**Why:**

- Owner's preferred, familiar stack — speed of building matters more than
  theoretical fit.
- The data is document-shaped: a patient with embedded targets, thresholds,
  medications and reminders reads in one query.
- Atlas gives encryption at rest, backups and a free tier out of the box.
- Aggregation pipelines with `$dateTrunc` / `$dateToString` + `timezone` handle
  per-timezone daily, weekly and AM/PM bucketing.

**Consequences we accept and design around:**

- **No row-level security** → [ADR-009](#adr-009-access-control-without-row-level-security).
- **No foreign keys or DB-level referential integrity** → repositories own
  writes; Mongoose schemas + Zod validate; deletes of a patient cascade in code.
- **Schema is enforced by the app, not the DB** → Mongoose schemas are the
  source of truth; add collection `$jsonSchema` validators for the reading
  collections as a second safety net.
- Stats are aggregation pipelines instead of SQL functions — same rule applies:
  **one module, used by dashboard and PDF**.

---

## ADR-002: Patients are not users

**Status:** Proposed

**Decision:** `patients` is a profile; `users` are people who sign in;
`patient_access(user_id, patient_id, role)` links them.

**Why:** many tracked people will never sign in (the caregiver logs for them).
Forcing a login per patient would mean fake accounts or shared passwords.
This also gives us multi-caregiver and viewer access for free.

---

## ADR-003: Reminder channels

**Status:** Proposed
**Question:** Web push only, or WhatsApp/SMS from the start?

**Decision:** v1 ships **Web Push** behind a `ReminderChannel` interface.
**WhatsApp** is the second channel (Milestone 6). SMS only as a fallback.

**Why:**

- Web push costs nothing and needs no third-party approval, so we can test
  reminder _timing and wording_ early.
- WhatsApp is what many users actually read (especially in Nigeria and
  similar markets), but the WhatsApp Business API needs a verified business
  and **pre-approved message templates**, which takes time. Start that
  application during Milestone 3 so it's ready by Milestone 6.
- Web push limits: on iOS it only works for an **installed** PWA (iOS 16.4+);
  cheap Android phones may kill background delivery. That's why WhatsApp is
  planned, not optional.

---

## ADR-004: PDF generation

**Status:** Proposed

**Decision:** `@react-pdf/renderer` inside a Next.js route handler
(`app/api/patients/[id]/report/route.ts`, Node runtime), calling the same
`lib/stats/` functions as the dashboard.

**Why:** server-side means identical output on every device (spec requirement).
`@react-pdf/renderer` is pure JS (no headless Chrome to host, fits serverless
size limits), lets us write the report as React components, and draws charts as
SVG. Living inside the Next.js app means no separate service to deploy.

**Alternative:** HTML template rendered by headless Chromium — pixel-perfect
reuse of web styles, but heavier to host. Revisit if react-pdf layout limits bite.

---

## ADR-005: Report page 1

**Status:** Proposed — **needs a real doctor's input**
**Question:** Does the doctor want specific fields on page 1?

**Decision (draft):** page 1 = header, summary tiles, flagged readings,
current medications. See `PLAN.md §5.5`.

**Next step:** after Milestone 3, show a generated report to at least one doctor
and ask: "What do you look at first? What's missing? What's noise?"

---

## ADR-006: Who logs — patient or caregiver?

**Status:** Proposed
**Question:** Should patients log themselves, or mostly the caregiver?

**Decision:** design for **both**, and prioritise the **patient's logging
screen** for simplicity, because:

- If the patient logs, the 10-second screen is all they ever see — it must be perfect.
- A remote caregiver can't take a reading; they can only enter one that was
  read to them. So the patient's phone (or someone with them) is where most
  readings start.
- The caregiver experience leans on viewing: dashboard across patients, flags,
  missed-reading nudges, and the PDF.

The patient's device runs a **simple mode** (Today, log, history — no settings
clutter). Caregivers see everything.

---

## ADR-007: Rolling comparison windows

**Status:** Proposed

**Decision:** week = last 7 days vs prior 7; month = last 30 vs prior 30;
6 months = last 182 vs prior 182, all in the patient's local time.

**Why:** calendar periods make the current period look artificially empty early
in the week/month. Rolling windows are always comparable.

---

## ADR-008: Canonical units and time

**Status:** Accepted (from the original spec)

- Glucose stored only as mg/dL (`numeric(5,1)`), converted for display with
  mmol/L = mg/dL ÷ 18.0 in one shared util.
- Timestamps stored UTC; each reading also stores the IANA timezone it was taken
  in, so "which day" and "morning vs evening" never shift later.

---

## ADR-009: Access control without row-level security

**Status:** Accepted

**Decision:** all database access goes through a single server-side data layer
(`lib/db/`). Every function takes the session, calls
`requirePatientAccess(session, patientId, minRole)` from `lib/db/access.ts`,
and always filters by `patientId`.

**Why:** MongoDB can't enforce "a user only sees patients they're linked to" in
the database the way Postgres RLS can. The risk is a route that forgets to check.
Funnelling everything through one module makes the check impossible to skip by
accident and easy to test.

**Guardrails:**

- Route handlers / server actions / components never import the Mongo client
  or models directly — an ESLint `no-restricted-imports` rule enforces it.
- `import 'server-only'` in `lib/db/*` so DB code can never ship to the browser.
- Test matrix: every repository function × {owner, caregiver, viewer, stranger}.
- Role rules: read = any role; write readings = owner/caregiver; manage access,
  export-all, delete patient = owner.
