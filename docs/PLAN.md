# Health Tracker — Product & Build Plan

A low-friction app for logging **blood pressure** and **blood sugar** at home,
seeing how things are trending week to week, and handing a clear **1–2 page PDF
report** to a doctor.

It is built for the person taking the readings _and_ for the family member or
carer who helps them. One caregiver can look after several people; one person
can have several caregivers.

> Companion docs: [`DESIGN.md`](./DESIGN.md) (UX + visual design system),
> [`DECISIONS.md`](./DECISIONS.md) (architecture decisions and the open
> questions they resolve), [`../CLAUDE.md`](../CLAUDE.md) (how we build).

---

## 1. Goals, non-goals, and how we'll know it works

### Goals

1. **Log a reading in ~10 seconds** from opening the app. Low friction is the
   whole game: if logging is annoying, there is no data and nothing else matters.
2. **Trend comparisons** for week, month and 6 months, each against the previous
   period of the same length.
3. **A report a doctor can read in under a minute.**
4. **Caregivers** can log for, view, and export for everyone they're linked to.
5. **Works with no signal.** Readings are saved on the phone and synced later.

### Non-goals (v1)

- No diagnosis, no medical advice, no dosing suggestions. The app _logs and
  flags_. Flags always say "consider contacting your doctor".
- No Bluetooth/device integration, no CGM.
- No doctor login portal — doctors get the PDF (or a share link later).
- No social/gamification features.

### Success measures (check after 4 weeks of real use)

| Measure                                           | Target                        |
| ------------------------------------------------- | ----------------------------- |
| Median time from app open → reading saved         | ≤ 10 s                        |
| Days with at least one reading / days in period   | ≥ 80 %                        |
| Readings that needed a "did you mean?" correction | tracked, trending down        |
| Doctor feedback on report                         | "I could read it at a glance" |
| Readings lost while offline                       | 0                             |

---

## 2. Users and roles

The original spec tied "patient" to a login account. That breaks a common real
case: **the person being tracked may never use the app themselves** (no
smartphone, or the caregiver does all the logging). So we split _who is
tracked_ from _who logs in_:

- **Patient** — a health profile (name, DOB, targets, readings). Does **not**
  require a login.
- **User** — someone who signs in. A user can be linked to any number of
  patients with a role:
  - `owner` — full control, including delete and managing access. Usually the
    patient themselves, or the caregiver who created the profile.
  - `caregiver` — log, view, export, receive alerts.
  - `viewer` — view and export only (e.g. a sibling who wants to keep an eye on things).
- A patient who _does_ want to log themselves is simply a user linked to their
  own profile as `owner`.

This generalises the spec's `caregiver_links(caregiver_id, patient_id)` into
`patient_access(user_id, patient_id, role)` — the same "multi-patient from day
one" idea, without forcing every patient to have an account.

**Easy sign-in for less tech-confident patients:** the caregiver sets the
profile up, then opens an **invite link / QR code** on the patient's phone. That
signs the patient's device in with a long-lived session. No passwords to
remember, no OTP codes to read out over the phone.

---

## 3. Stack

| Layer          | Choice                                                                  | Why                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App            | **Next.js (App Router) + React + TypeScript**, Tailwind CSS             | One codebase for UI and API; server code (DB access, PDF, cron) lives next to the screens that use it                                                                                 |
| Client data    | TanStack Query                                                          | Caching and optimistic updates for logging; works alongside the offline outbox                                                                                                        |
| PWA            | Serwist (`@serwist/next`)                                               | Maintained successor to `next-pwa`; installable app + offline app shell                                                                                                               |
| Offline store  | IndexedDB via Dexie                                                     | Durable outbox for readings saved without signal                                                                                                                                      |
| Database       | **MongoDB Atlas** + Mongoose                                            | See [ADR-001](./DECISIONS.md#adr-001-database-mongodb). Encryption at rest on by default; free tier to start                                                                          |
| Validation     | Zod, shared by client and server                                        | Same rules on the form and in the API, so a bad reading can't sneak in through sync                                                                                                   |
| Auth           | Auth.js (NextAuth v5) with the MongoDB adapter                          | Magic-link sign-in + our own invite-link flow for patients' phones                                                                                                                    |
| Access control | One server-side data-access layer (`lib/db/access.ts`)                  | MongoDB has no row-level security, so **every** query goes through one module that checks membership. See [ADR-009](./DECISIONS.md#adr-009-access-control-without-row-level-security) |
| Stats          | MongoDB aggregation pipelines in one shared module (`lib/stats/`)       | One source of truth for dashboard + PDF                                                                                                                                               |
| PDF            | `@react-pdf/renderer` in a Next.js route handler (Node runtime)         | See [ADR-004](./DECISIONS.md#adr-004-pdf-generation). Identical output on every device                                                                                                |
| Charts (UI)    | Recharts                                                                | Simple, SVG, works with the target-band pattern                                                                                                                                       |
| Reminders      | Web Push first, behind a `ReminderChannel` interface; WhatsApp next     | See [ADR-003](./DECISIONS.md#adr-003-reminder-channels)                                                                                                                               |
| Scheduler      | Cron hitting a protected route handler (e.g. Vercel Cron)               | No extra server to run                                                                                                                                                                |
| Hosting        | Vercel (app) + MongoDB Atlas (data)                                     | Both have free tiers; move to paid when real people rely on it                                                                                                                        |
| Testing        | Vitest (unit + stats against `mongodb-memory-server`), Playwright (E2E) | Stats and access rules are where bugs hurt most                                                                                                                                       |
| CI             | GitHub Actions: typecheck, lint, test                                   |                                                                                                                                                                                       |

---

## 4. Data model (MongoDB collections)

Changes from the original spec are marked **[new]** or **[changed]** with the
reason. All dates are stored as BSON `Date` (always UTC).

**Embed vs reference rule:** small, bounded data that is always read with the
patient (targets, thresholds, medications, reminder settings) is **embedded** in
the patient document. Data that grows forever (readings, logs) gets **its own
collection**, indexed by `{ patientId, measuredAt }`.

```ts
// users — people who sign in (Auth.js also creates `accounts`, `sessions`,
// `verificationTokens` collections via its MongoDB adapter)
users {
  _id: ObjectId,
  name: string, email?: string, phone?: string,
  locale: string = 'en',
  createdAt: Date
}

// patients — people being tracked [changed: no login required]
patients {
  _id: ObjectId,
  displayName: string,
  dateOfBirth?: Date, sex?: string, heightCm?: number,
  conditions: string[],                 // e.g. 'hypertension', 'type2_diabetes'
  glucoseUnit: 'mgdl' | 'mmol',         // DISPLAY preference only
  timezone: string,                     // IANA, e.g. 'Africa/Lagos'
  doctor?: { name?: string, contact?: string },
  emergencyContact?: string,

  // Embedded: small, bounded, always needed with the patient
  targets: [{                           // [changed] history, newest last; reports
    sysMin, sysMax, diaMin, diaMax,     // use the target in force at each reading
    fastingGlucoseMinMgdl, fastingGlucoseMaxMgdl, postMealGlucoseMaxMgdl,
    source: 'doctor',
    effectiveFrom: Date, createdBy: ObjectId
  }],
  // Never hardcode our own "normal" values. Empty array → UI shows
  // "No target set — ask your doctor" and hides "% in range".

  alertThresholds: {                    // [new] safety flags, separate from targets
    sysHigh: 180, diaHigh: 120, sysLow: 90,
    glucoseLowMgdl: 70, glucoseHighMgdl: 300,
    isDefault: true                     // UI: "Defaults — confirm with your doctor"
  },
  medications: [{ _id, name, dose, timesOfDay: string[] /* 'HH:mm' */, active, startedOn, stoppedOn? }],
  reminders:   [{ _id, kind: 'bp_am'|'bp_pm'|'glucose'|'medication', timeOfDay: 'HH:mm',
                  channel: 'webpush'|'whatsapp'|'sms', recipientUserId, enabled }],

  createdAt, updatedAt, deletedAt?: Date
}

// memberships — who can see/do what [changed: generalises caregiver_links]
memberships {
  _id, userId: ObjectId, patientId: ObjectId,
  role: 'owner' | 'caregiver' | 'viewer',
  notifyOnFlags: boolean = true,
  createdAt
}   // unique index { userId, patientId }; index { patientId }

bpReadings {
  _id: string,                          // [new] UUID generated ON THE CLIENT so
                                        // offline retries are idempotent (upsert by _id)
  patientId: ObjectId,
  measuredAt: Date,
  measuredTz: string,                   // [new] tz at time of reading, so "which
                                        // day / AM or PM" never shifts if the
                                        // profile timezone changes later
  systolic: number, diastolic: number,  // [changed] 'dia' → 'diastolic'
  pulse?: number, arm?: 'left'|'right', posture?: 'sitting'|'standing'|'lying',
  notes?: string,
  loggedBy: ObjectId,
  createdAt, updatedAt, deletedAt?: Date  // [new] soft delete: corrections stay auditable
}   // index { patientId: 1, measuredAt: -1 }

glucoseReadings {
  _id: string, patientId, measuredAt, measuredTz,
  valueMgdl: number,                    // ONE canonical unit, rounded to 0.1.
                                        // Mixed units would corrupt every average.
  context: 'fasting'|'before_meal'|'after_meal_2h'|'bedtime'|'random',
  notes?, loggedBy, createdAt, updatedAt, deletedAt?
}   // index { patientId: 1, measuredAt: -1 }
// mmol/L = mg/dL ÷ 18.0 (spec). Conversion lives in ONE shared util
// (lib/units.ts) used by forms, dashboard and PDF.

medicationLogs {
  _id: string, patientId, medicationId,
  scheduledFor: Date,                   // [new] needed for adherence (taken ÷
                                        // scheduled); without it we only know what
                                        // was taken, not what was missed
  takenAt?: Date, status: 'taken'|'skipped'|'missed', loggedBy
}

symptomLogs { _id, patientId, loggedAt, symptoms: string[], notes?, loggedBy }
weightLogs  { _id, patientId, measuredAt, weightKg, loggedBy }
labResults  { _id, patientId, testName, value, unit, takenOn, loggedBy }   // e.g. HbA1c

flags {                                 // [new] persisted, so reports and the
  _id, patientId, readingType: 'bp'|'glucose', readingId,   // caregiver feed agree
  rule: string, thresholdSnapshot: object, createdAt, acknowledgedBy?: ObjectId
}

consents {                              // [new] NDPA / GDPR-style consent record
  _id, patientId, userId, purpose, version, grantedAt, withdrawnAt?
}

auditLog {                              // [new] who read/changed/exported what
  _id, actorUserId, patientId, action, entity, entityId, at
}

pushSubscriptions { _id, userId, endpoint, keys, createdAt }   // Web Push
invites { _id, patientId, role, tokenHash, expiresAt, usedAt? } // phone setup links
```

**Why not a time-series collection for readings?** MongoDB time-series
collections restrict updates and deletes, and readings get corrected. Our
volume (a few readings per person per day) is tiny, so a normal collection with
a compound index is simpler and plenty fast.

**Access control (replaces database row-level security):** MongoDB can't enforce per-row
access, so it lives in code — in exactly one place. `lib/db/access.ts` exposes
`requirePatientAccess(session, patientId, minRole)` and every repository
function (`lib/db/readings.ts`, …) calls it before touching the database and
always filters by `patientId`. Route handlers and server actions never import
the Mongo client directly; a lint rule enforces that. Access rules get their
own automated tests.

---

## 5. Features

### 5.1 Onboarding (short wizard, everything after step 1 skippable)

1. **Who is this for?** "Me" / "Someone I care for" → name, timezone (auto-detected).
2. **What do you track?** BP / blood sugar / both → glucose unit.
3. **Targets from your doctor** — optional; can be added later. Clear note:
   "Ask your doctor for these numbers. We don't set them for you."
4. **Medications** — name, dose, times.
5. **Reminders** — suggested times (BP 07:00 and 19:00), editable.
6. **Consent** — plain-language explanation + explicit checkbox; recorded in `consents`.
7. _(Caregiver flow)_ **Set up their phone** — show invite QR / link.

DOB, sex, height, weight, conditions, doctor details: on the profile page,
filled in whenever. Don't front-load them.

### 5.2 Daily logging

- Home screen = **"Today"**: big buttons _Blood pressure_ and _Blood sugar_,
  plus a checklist of today's expected readings (✓ Morning BP, ○ Evening BP).
- **BP form:** three large numeric fields (top / bottom / pulse) with plain
  labels ("Top number", "Bottom number", "Pulse"). AM/PM is **inferred from the
  time** (editable), not asked.
- **Glucose form:** one numeric field + context chips. Context defaults sensibly
  from time of day (e.g. before 09:00 → _Fasting_), one tap to change.
- **Validation — three tiers:**
  - _Impossible_ → block with an explanation (diastolic ≥ systolic, ≤ 0, non-numeric).
  - _Unusual_ → gentle "Did you mean…?" confirm: systolic outside 70–250,
    diastolic outside 40–150, pulse outside 35–200, glucose outside 30–600 mg/dL
    (1.7–33.3 mmol/L). E.g. `1200/80` → "Did you mean 120/80?"
  - _Unit slip_ → in mg/dL mode a value < 35 asks "Did you mean 5.6 mmol/L
    (= 101 mg/dL)?"; in mmol mode a value > 35 asks the reverse.
- **After save:** a full-width "Saved ✓" with the value repeated back and an
  **Undo** button for 10 s. Undo beats "Are you sure?" dialogs.
- Optional extras (collapsed by default): medication taken, symptom chips,
  notes. Weekly weight prompt on one chosen day.
- **Offline:** every save writes to the IndexedDB outbox first, then syncs. A
  small, calm status line shows "Saved on this phone — will sync when online".
  Client-generated UUIDs make retries safe; the outbox posts to one
  `POST /api/sync` route handler that upserts by `_id`.

### 5.3 Comparisons and charts

**Periods** (rolling, in the patient's local time):

| View     | Current period          | Compared with       | Chart points    |
| -------- | ----------------------- | ------------------- | --------------- |
| Week     | last 7 days incl. today | the 7 days before   | each reading    |
| Month    | last 30 days            | the 30 days before  | daily averages  |
| 6 months | last 182 days           | the 182 days before | weekly averages |

Rolling windows avoid the "it's Monday, so this week looks empty" problem of
calendar weeks.

**Per metric:** average, min, max, count; % in target range (only if a doctor
target exists); delta vs previous period; BP morning vs evening average;
glucose fasting vs post-meal average; logging consistency (days with ≥ 1
reading ÷ days in period).

**Definitions (so dashboard and PDF can't disagree):**

- _Morning_ = 04:00–11:59 local, _Evening_ = 17:00–23:59 local; other readings
  count toward totals but not the AM/PM split.
- **Minimum data rule:** if either period has fewer than 3 readings for a
  metric, show "Not enough readings to compare" instead of a delta. A delta
  from 2 readings is noise that looks like news.
- Deltas are shown as plain words + arrow + number: "↓ 6 lower than last week".

**One implementation:** `getPeriodStats(patientId, metric, start, end)` and
`getSeries(patientId, metric, start, end, bucket)` in `lib/stats/`, built as
MongoDB aggregation pipelines. Local-day and AM/PM bucketing use each reading's
own `measuredTz` (`$dateToString` / `$dateTrunc` with a `timezone`). The
dashboard and the PDF route both call these. React components only format.

**Charts:** one line chart per metric; doctor target shown as a shaded band;
flagged readings drawn with a distinct **shape** (not just colour). See
`DESIGN.md §6`.

### 5.4 Alerts (flag only)

- Evaluated **server-side** in the shared "save reading" function (used by
  both the form and offline sync), so a reading synced from offline still flags. Persisted to `flags`.
- Thresholds from `alert_thresholds`, defaults labelled
  _"Default safety values — please confirm with your doctor."_
- Wording (fixed, reviewed): _"This reading is outside the usual range.
  Consider contacting your doctor."_ Never names a condition or a treatment.
- If a reading is in the danger zone, the patient sees the message immediately
  on the save screen, plus "If you feel unwell, seek medical help now."
- Caregivers with `notify_on_flags` get notified through their reminder channel.
- **Lock-screen privacy:** notification text never contains the value by
  default ("New reading for Ade needs a look"). Opt-in to show values.

### 5.5 Doctor report (PDF)

**Page 1 — the one-minute read** (draft; confirm with a real doctor before polishing):

1. Header: patient name, age, sex, date range, "Home readings, self-measured",
   generated date.
2. Summary tiles: average BP, average fasting glucose, % in target, change vs
   previous period, readings count and logging consistency.
3. **Flagged readings** table (date/time, value, context).
4. Current medications.

**Page 2 — patterns:** 5. Trend chart per metric with target band. 6. Time-of-day patterns: AM vs PM BP; fasting vs post-meal glucose. 7. Medication adherence %, symptom notes.

**Appendix (page 3+):** full raw log table.

Footer on every page: _"Informational only, not medical advice. Readings
entered by the patient/caregiver."_

Range selector: last week / month / 6 months / custom. **Download** first;
WhatsApp/email share and expiring share link later.

### 5.6 Reminders

- Per patient: BP AM/PM, glucose, medication — times and on/off.
- Interface:
  ```ts
  interface ReminderChannel {
    id: "webpush" | "whatsapp" | "sms" | "email";
    send(to: Recipient, message: ReminderMessage): Promise<SendResult>;
  }
  sendReminder(patient, channel, message); // callers never know the channel
  ```
- Scheduler: a cron (e.g. Vercel Cron) calls a secret-protected route handler
  every 5–15 min (depends on hosting plan), which sends due
  reminders in the patient's timezone, skips ones already satisfied ("you
  already logged this morning").
- **Missed-reading nudge:** optional per caregiver, e.g. "No morning BP from Ade
  by 11:00".

### 5.7 Data rights (export / delete)

- **Export:** owner can download all data for a patient as CSV + JSON.
- **Delete:** owner can delete a patient profile; hard-deleted after a 30-day
  grace period (undo window), then gone from backups per retention policy.
- **Access review:** owner sees who has access and can revoke it.

---

## 6. Privacy, security, safety

- Encrypted in transit (HTTPS only) and at rest (MongoDB Atlas default
  encryption; restrict Atlas network access to the app). Minimal data: everything beyond name/timezone is optional.
- **Nigeria Data Protection Act 2023** (and GDPR-style principles generally):
  explicit consent, purpose limitation, access/export, deletion, consent
  withdrawal. Health data is _sensitive personal data_ — treat it that way.
- All DB access through the access-checked data layer; the MongoDB connection
  string only in server-side env vars, never in client bundles.
- No health values in logs, analytics, error reports, or push payloads by default.
- `audit_log` for exports, access changes, and edits to readings.
- Disclaimer in-app (settings + first run) and on every PDF page.
- Offline data on the phone: cleared on sign-out; outbox only holds unsynced items.

---

## 7. Accessibility

Designed for older users first — if it's easy for them it's easy for everyone.
Full spec in [`DESIGN.md`](./DESIGN.md). Headlines: 20 px base text, ≥ 56 px tap
targets, AAA contrast for body text, numeric keypad, never colour alone,
no swipe-only gestures, no timeouts, plain words, one task per screen.

**Test with real target users early** — after Milestone 1, not at the end.

---

## 8. Build plan (milestones)

Each milestone ends with something usable. Within a milestone, files are
delivered **one at a time**, following existing file boundaries, each with
comments explaining the _why_ (see `CLAUDE.md`).

| #   | Milestone           | Includes                                                                                                                                                                    | Done when                                             |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0   | **Skeleton**        | Next.js/TS/Tailwind app, MongoDB Atlas + local dev DB, CI, lint/format, design tokens                                                                                       | `npm run dev` shows a styled "Today" screen; CI green |
| 1   | **Log it**          | Mongoose models + indexes (§4), access layer + tests, auth + invite link, minimal onboarding (name, tz, unit), BP + glucose forms, validation, offline outbox, history list | A real user logs for a week, including offline        |
| 2   | **See it**          | Stats aggregation pipelines + tests, dashboard (week/month/6-month), charts with target bands, targets editing                                                              | Numbers match a hand-checked fixture                  |
| 3   | **Share it**        | PDF route + report v1, range picker, download                                                                                                                               | A doctor has seen one and given feedback              |
| 4   | **Watch it**        | Alert thresholds, server-side flagging, caregiver notifications                                                                                                             | Flag appears on save + caregiver notified             |
| 5   | **Remember it**     | Reminder scheduler, web push channel, missed-reading nudge                                                                                                                  | Reminders arrive on an installed PWA                  |
| 6   | **Polish + rights** | Full onboarding wizard, medications/symptoms/weight, export + delete, PWA install prompts, WhatsApp channel                                                                 | Data-rights flows tested end to end                   |

Why this order differs from the original: the original put PDF at step 9 and
onboarding at step 3. A logging app with no data has nothing to report, so
**logging ships first** with only the onboarding it needs; the full wizard
moves to polish. The PDF moves up because the doctor report is the main
payoff, and early doctor feedback shapes the layout.

---

## 9. Testing strategy

- **Stats:** run against `mongodb-memory-server`; fixture patients with known readings → assert exact averages,
  % in range, deltas, AM/PM split, the minimum-data rule, and local-day
  bucketing (including a reading at 23:30 and 00:30 local).
- **Access layer:** user A cannot read/write patient B; viewer cannot write; only owner deletes.
- **Validation:** table-driven tests for every tier and the unit-slip check.
- **Offline:** Playwright with network off → save → network on → exactly one row.
- **PDF:** snapshot the report's data model (not pixels); visual check by hand.

---

## 10. Risks

| Risk                                                   | Mitigation                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Users stop logging                                     | 10-second flow, reminders, "today" checklist, caregiver nudge                        |
| Dashboard and PDF disagree                             | Single stats module; shared unit util                                                |
| Wrong unit entered                                     | Unit-slip check, single canonical unit                                               |
| App seen as giving medical advice                      | Fixed reviewed wording, no hardcoded "normal", disclaimers                           |
| iOS web push only works for installed PWAs (iOS 16.4+) | Install prompt in onboarding; WhatsApp channel in M6                                 |
| WhatsApp Business template approval takes time         | Start the Meta/Twilio application during M3                                          |
| Data leak                                              | Single access-checked data layer + tests, no values in notifications/logs, audit log |
