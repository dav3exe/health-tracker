# Working agreement for this repo

Read `docs/PLAN.md`, `docs/DESIGN.md`, and `docs/DECISIONS.md` before changing code.

## How we build
- **One file at a time.** Deliver a single file per step, matching existing file
  boundaries. Don't sprawl changes across the codebase.
- **Comment the why, not the what.** Every non-obvious decision gets a short
  comment explaining the reason (e.g. why a unit is canonical, why a check is
  soft, why a query runs in SQL). Restating the code is not a comment.
- Follow the milestone order in `docs/PLAN.md §8`. Each milestone ends usable.
- If a decision in `docs/DECISIONS.md` changes, update the ADR in the same change.

## Stack
Vite + React + TypeScript (strict), TanStack Query, Tailwind CSS, PWA via
`vite-plugin-pwa`, Dexie for the offline outbox, Supabase (Postgres + Auth + RLS),
Node + `@react-pdf/renderer` for reports, Vitest + Playwright for tests.

## Hard rules
- **Stats live in SQL** (`get_period_stats`, `get_series`). React only formats.
  The dashboard and PDF must never compute numbers separately.
- **Glucose is stored only in mg/dL.** Convert at the edges via the one shared util.
- **Timestamps are UTC**, plus the IANA timezone each reading was taken in.
- **Never hardcode "normal" ranges.** Targets come from the doctor; safety
  thresholds are labelled defaults to confirm with a doctor.
- **No medical advice.** Use the fixed flag wording from `docs/PLAN.md §5.4`.
- **RLS on every patient-scoped table**, with tests. Service-role key never in client code.
- **No health values** in logs, analytics, error reports, or notification text by default.
- **Accessibility rules in `docs/DESIGN.md §2` are requirements**, not polish.
- Client-generated UUIDs for readings so offline sync is idempotent.
