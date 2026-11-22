# Architecture Decisions

Short records of the decisions behind the plan. Each one resolves an open
question from the original spec. They are **recommendations** — change any of
them by editing the record and noting why.

Status values: `Proposed` (recommended, not yet confirmed) · `Accepted` · `Superseded`.

---

## ADR-001: Backend — Supabase
**Status:** Proposed
**Question:** Custom Node API or Supabase?

**Decision:** Supabase (Postgres + Auth + RLS + Edge Functions + `pg_cron`),
plus one small Node service for PDF generation.

**Why:**
- The spec's core security rule ("a user can only read patients they own or are
  linked to") is exactly what Postgres **Row Level Security** does. With
  Supabase it lives in the database, so no API endpoint can forget to check it.
- Auth (magic link, phone OTP, sessions) is done; we don't build password reset.
- The spec already requires stats in SQL; Supabase RPC calls those functions
  directly from the app.
- `pg_cron` + edge functions cover the reminder scheduler without extra infra.
- It's still plain Postgres: if we outgrow it, migrations move to any host.

**Trade-offs:** some vendor lock-in for auth/edge functions; RLS policies need
careful tests (planned). Free tier pauses inactive projects — fine for
development, use a paid tier once real people rely on it.

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
  reminder *timing and wording* early.
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

**Decision:** a small Node service using `@react-pdf/renderer`, which calls the
same SQL stats functions as the dashboard.

**Why:** server-side means identical output on every device (spec requirement).
`@react-pdf/renderer` is pure JS (no headless Chrome to host), lets us write
the report as React components, and draws charts as SVG. Supabase Edge
Functions run Deno, where react-pdf support is less proven, so we keep PDF in
Node (deployable to any Node host, e.g. a serverless function).

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
