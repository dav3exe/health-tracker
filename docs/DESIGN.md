# Design System & UX Spec

**Design target:** a 70-year-old with reading glasses, a budget Android phone,
patchy data, and no patience for apps. If it works for them, it works for everyone.

---

## 1. Principles

1. **One screen, one job.** Each screen asks for one thing. No dashboards on
   the logging path.
2. **Big, obvious, forgiving.** Large targets, large text, Undo instead of
   "Are you sure?".
3. **Say it in plain words.** "Top number", not "Systolic". "Blood sugar", not
   "Glucose" (technical terms appear small, underneath, for caregivers/doctors).
4. **Never colour alone.** Every status has an icon + a word + a colour.
5. **Calm, not alarming.** White and neutral tones carry the page; the brand
   red is an accent for actions and highlights. Because red is the brand, a
   flagged reading is never shown by red alone: it gets a darker red filled
   banner + ⚠ icon + the words "Check with doctor".
6. **Show, don't diagnose.** We show numbers vs the doctor's target. We never
   say "you have high blood pressure".

---

## 2. Accessibility rules (non-negotiable)

| Rule                  | Value                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| Base body text        | **20 px** (1.25 rem), line-height 1.5                                           |
| Minimum text anywhere | 16 px                                                                           |
| Tap targets           | **≥ 56 × 56 px**, ≥ 12 px apart (WCAG min is 44 — we go bigger)                 |
| Contrast              | Body text ≥ **7:1** (AAA); large text and icons ≥ 4.5:1                         |
| Number inputs         | `inputmode="numeric"` (BP) / `"decimal"` (mmol/L), `pattern` set                |
| Gestures              | Every action reachable by a single tap; no swipe-only, long-press-only, or drag |
| Time limits           | None, except the 10 s Undo (and Undo is also in History)                        |
| Focus                 | Visible 3 px focus ring; logical tab order; labels on every input               |
| Motion                | Respect `prefers-reduced-motion`; no animation needed to understand state       |
| Zoom                  | Layout survives 200 % text zoom with no horizontal scroll                       |
| Language              | Short sentences, ~6th-grade reading level; i18n-ready strings from day one      |

---

## 3. Design tokens

Defined once as CSS variables in `app/globals.css` and exposed to Tailwind v4
via `@theme`. **Brand: white with red accents.** Light theme only for now
(white is the brand, and light backgrounds read best for older eyes outdoors);
a dark theme can reuse the same token names later.

`tests/design-tokens.test.ts` reads these values from `globals.css` and fails CI
if any pair drops below its contrast requirement.

### Colour

| Token                      | Value                 | Use                                                     |
| -------------------------- | --------------------- | ------------------------------------------------------- |
| `--bg` / `--surface`       | `#FFFFFF`             | Page and cards                                          |
| `--surface-muted`          | `#FAF7F7`             | Faint warm tint to separate sections                    |
| `--text`                   | `#1A1A1A`             | Body text (~17:1)                                       |
| `--text-muted`             | `#4A4A4A`             | Secondary text (≥ 7:1, AAA)                             |
| `--border-strong`          | `#8A8A8A`             | Input borders (≥ 3:1, visible)                          |
| `--border-subtle`          | `#ECE6E6`             | Decorative card edges and dividers only                 |
| `--primary`                | `#A8101A`             | Brand red: main buttons, links, active tab (7.6:1, AAA) |
| `--primary-hover`          | `#8E0E16`             | Pressed / hover                                         |
| `--on-primary`             | `#FFFFFF`             | Text on red                                             |
| `--primary-soft`           | `#FDF2F2`             | Red-tint highlights: selected chips, progress track     |
| `--primary-soft-border`    | `#F3C4C7`             | Border for red-tint highlights                          |
| `--ok` / `--ok-soft`       | `#1E6B3A` / `#EDF7F0` | "In target" (always with ✓ + word)                      |
| `--watch` / `--watch-soft` | `#8A5A00` / `#FDF6E7` | "Above/below target" (with ▲/▼ + word)                  |
| `--flag` / `--on-flag`     | `#7A1015` / `#FFFFFF` | Flag banner: darker than brand, with ⚠ + word           |
| `--focus-ring`             | `#1A1A1A`             | 3 px ring, visible on white and on red                  |
| chart target band          | `--primary` @ 10 %    | Doctor's target range behind chart lines                |

### Type scale

| Token          | Size                         | Use                                     |
| -------------- | ---------------------------- | --------------------------------------- |
| `text-body`    | 20 px                        | Default                                 |
| `text-label`   | 18 px                        | Field labels                            |
| `text-title`   | 28 px / 700                  | Screen titles                           |
| `text-reading` | 48 px / 700, tabular numbers | The number being typed or repeated back |
| `text-hero`    | 64 px / 700                  | "Saved ✓" confirmation value            |

Font: **Atkinson Hyperlegible Next** (Braille Institute, designed for low
vision; makes 1/l/I, 0/O and 6/8 distinct, which matters for numbers),
self-hosted via fontsource so it works offline. Numbers use
`font-variant-numeric: tabular-nums` so values line up in tables.

### Spacing & shape

4 px base grid; screen padding 16 px; card padding 20 px; radius 16 px
(buttons, cards); inputs 64 px tall.

---

## 4. Components

| Component      | Notes                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| `BigButton`    | Full width, 72 px tall, icon + label, primary or secondary                                    |
| `NumberField`  | 64 px tall, 48 px digits, label above, unit inside right ("mmHg"), error text below with icon |
| `ChipGroup`    | Single-select chips ≥ 56 px tall, wraps to 2 rows; selected = filled + ✓                      |
| `StatusBadge`  | Icon + word + colour: ✓ In target · ▲ Above target · ▼ Below target · ⚠ Check with doctor     |
| `StatTile`     | Big number, label, delta line in words ("↓ 6 lower than last week")                           |
| `SyncStatus`   | One calm line: "All saved" / "Saved on this phone — will sync when online"                    |
| `ConfirmSheet` | For "Did you mean…?": two big buttons, the suggested value first                              |
| `UndoBar`      | Bottom bar, 10 s, "Saved. Undo"                                                               |
| `TrendChart`   | See §6                                                                                        |

---

## 5. Screens

### 5.1 Today (home)

```
┌──────────────────────────────┐
│ Good morning, Ade      ⚙     │  ← name of patient; switcher for caregivers
│ Sunday 22 November           │
│                              │
│ ┌──────────────────────────┐ │
│ │ ♥  Blood pressure        │ │  ← BigButton
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 💧 Blood sugar            │ │
│ └──────────────────────────┘ │
│                              │
│ Today                        │
│  ✓ Morning blood pressure    │
│  ○ Evening blood pressure    │
│  ○ Blood sugar (fasting)     │
│                              │
│ All saved                    │  ← SyncStatus
├──────────────────────────────┤
│  Today   History   Trends    │  ← 3 tabs max in simple mode
└──────────────────────────────┘
```

### 5.2 Log blood pressure

```
┌──────────────────────────────┐
│ ← Blood pressure             │
│ Morning · 07:42  (change)    │  ← inferred, tap to edit
│                              │
│ Top number                   │
│ ┌──────────────────────────┐ │
│ │ 128                 mmHg │ │  ← autofocus, numeric keypad
│ └──────────────────────────┘ │
│ Bottom number                │
│ ┌──────────────────────────┐ │
│ │ 82                  mmHg │ │  ← auto-advance after 2–3 digits
│ └──────────────────────────┘ │
│ Pulse (optional)             │
│ ┌──────────────────────────┐ │
│ │ 71                   bpm │ │
│ └──────────────────────────┘ │
│ + Add note or symptoms       │  ← collapsed
│                              │
│ ┌──────────────────────────┐ │
│ │         Save             │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Auto-advance between fields when the value is complete (3 digits, or 2 digits
followed by a short pause) cuts taps and gets us to the 10-second goal.

### 5.3 Log blood sugar

Single `NumberField` (unit from profile) + `ChipGroup`: _Fasting · Before meal ·
2 h after meal · Bedtime · Other_. Default chip chosen from time of day.

### 5.4 Saved

Full screen: `128 / 82` in `text-hero`, `StatusBadge` vs target (if set),
"Saved ✓", Undo bar, **Done** button. If flagged: the fixed safety message in a
`--flag` bordered card with ⚠, and "If you feel unwell, seek medical help now."

### 5.5 History

Reverse-chronological list grouped by day ("Today", "Yesterday", "Fri 20 Nov").
Each row: time, value, badge. Tap to edit or delete (with Undo).

### 5.6 Trends

Segmented control **Week · Month · 6 months**. Per metric: `StatTile` row
(average, % in target, change), then `TrendChart`, then AM-vs-PM / fasting-vs-
after-meal pair. "Not enough readings to compare" state is designed, not an error.

### 5.7 Report

Range picker (Week · Month · 6 months · Custom) → preview summary → big
**Download PDF** button. Share options later.

### 5.8 Caregiver home

Patient cards: name, last reading + time, today's checklist progress, any
unacknowledged flags at the top. Tap → that patient's Today.

---

## 6. Charts

- One metric per chart. BP: two lines (top/bottom number), labelled at the line
  end — no legend to decode.
- **Target band** shaded with `--band` behind the line; band label "Doctor's
  target". No band if no target is set (and a note says so).
- Points: in-range = filled circle; out of target = hollow circle; flagged =
  ⚠ triangle in `--flag`. Shape carries meaning without colour.
- Y axis starts at a sensible floor (BP 40, glucose 40 mg/dL), not 0, so changes
  are visible — but never auto-zooms so tightly that noise looks dramatic.
- 6-month view: weekly averages with a light min–max whisker.
- Tap a point → tooltip with exact value, time, context.
- Same chart component logic feeds the PDF (rendered as SVG there).

---

## 7. Writing style

| Instead of                   | Write                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| Systolic / Diastolic         | Top number / Bottom number (technical term small, below)                  |
| Glucose                      | Blood sugar                                                               |
| Submit                       | Save                                                                      |
| Error: invalid input         | That number looks unusual. Did you mean 120?                              |
| Hypertensive crisis detected | This reading is outside the usual range. Consider contacting your doctor. |
| Sync failed                  | Saved on this phone — will sync when online                               |

Always: say what happened, then what to do. Never blame the user.

---

## 8. Early user testing (after Milestone 1)

Sit with 2–3 target users. Give them a real cuff/meter and the phone, no
instructions. Watch and time:

1. First reading from a cold start (goal: no help needed).
2. A reading with the network off.
3. Correcting a typo.
4. Finding yesterday's reading.

Note every hesitation. Fix those before building anything new.
