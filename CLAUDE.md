# Working agreement for this repo

Read `docs/PLAN.md`, `docs/DESIGN.md`, and `docs/DECISIONS.md` before changing code.
Also read `AGENTS.md`: this is Next.js 16, which differs from older versions
(Cache Components, `io()`, typed `LayoutProps`). Check `node_modules/next/dist/docs/`.

## Commands

`npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` ·
`npm run format` · `npm run db:up` (local MongoDB in Docker; copy `.env.example`
to `.env.local` first)

## How we build

- **One file at a time.** Deliver a single file per step, matching existing file
  boundaries. Don't sprawl changes across the codebase.
- **Comment the why, not the what.** Every non-obvious decision gets a short
  comment explaining the reason (e.g. why a unit is canonical, why a check is
  soft, why stats run in the shared aggregation module). Restating the code is not a comment.
- Follow the milestone order in `docs/PLAN.md §8`. Each milestone ends usable.
- If a decision in `docs/DECISIONS.md` changes, update the ADR in the same change.

## Stack

Next.js (App Router) + React + TypeScript (strict), Tailwind CSS, TanStack Query,
PWA via Serwist, Dexie for the offline outbox, MongoDB Atlas + Mongoose, Zod
(shared client/server validation), Auth.js with the MongoDB adapter,
`@react-pdf/renderer` in a route handler for reports, Vitest
(+ `mongodb-memory-server`) and Playwright for tests.

## Hard rules

- **Stats live in `lib/stats/`** (`getPeriodStats`, `getSeries`, aggregation
  pipelines). React only formats.
  The dashboard and PDF must never compute numbers separately.
- **Glucose is stored only in mg/dL.** Convert at the edges via the one shared util.
- **Timestamps are UTC**, plus the IANA timezone each reading was taken in.
- **Never hardcode "normal" ranges.** Targets come from the doctor; safety
  thresholds are labelled defaults to confirm with a doctor.
- **No medical advice.** Use the fixed flag wording from `docs/PLAN.md §5.4`.
- **All DB access goes through `lib/db/`**, which calls `requirePatientAccess`
  first and always filters by `patientId` (MongoDB has no row-level security).
  Nothing else imports the Mongo client or models. `lib/db/*` starts with
  `import 'server-only'`. The connection string is never exposed to the client
  (no `NEXT_PUBLIC_` prefix).
- **No health values** in logs, analytics, error reports, or notification text by default.
- **Accessibility rules in `docs/DESIGN.md §2` are requirements**, not polish.
- Client-generated UUIDs for readings so offline sync is idempotent.
