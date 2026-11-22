# Health Tracker

A simple, accessible app for logging **blood pressure** and **blood sugar** at
home, seeing week / month / 6-month trends, and exporting a clear PDF report
for a doctor.

Built for people who aren't keen on apps, and for the family members and
carers who help them. One caregiver can look after several people, and a
person can have several caregivers.

## Highlights (planned)

- **10-second logging** with big buttons and a numeric keypad
- **Works offline**: readings save on the phone and sync later (installable PWA)
- **Trends** against the previous period, with the doctor's target range shown
- **Doctor report**: 1–2 page PDF, summary and flagged readings on page 1
- **Flags, not diagnoses**: out-of-range readings prompt "consider contacting
  your doctor" and notify caregivers
- **Reminders**: web push first, WhatsApp/SMS later
- **Your data, your rights**: consent, export, and delete built in

## Status

**Milestone 0 (skeleton) done:** Next.js app, white-and-red design tokens with
automated contrast checks, the Today screen, MongoDB connection, CI.
Next: Milestone 1 (logging). See the docs:

| Doc                                      | What's in it                                                      |
| ---------------------------------------- | ----------------------------------------------------------------- |
| [`docs/PLAN.md`](docs/PLAN.md)           | Product scope, data model, features, milestones, testing, risks   |
| [`docs/DESIGN.md`](docs/DESIGN.md)       | Accessibility rules, design tokens, components, screen wireframes |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decisions (backend, reminders, PDF, ...)             |
| [`CLAUDE.md`](CLAUDE.md)                 | Working agreement and hard rules for contributors                 |

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run db:up        # local MongoDB in Docker
npm run dev          # http://localhost:3000
```

## Stack

Next.js · React · TypeScript · Tailwind CSS · TanStack Query · PWA ·
MongoDB (Atlas + Mongoose) · Auth.js · react-pdf

## Disclaimer

This app is for recording and sharing information only. It does not give
medical advice, diagnose, or recommend treatment. Always talk to a qualified
health professional about your readings.
