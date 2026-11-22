import { CircleCheck } from "lucide-react";

// "How was my last reading?" answered in one glance, so nobody has to open
// History or Trends for the most common question.
//
// Layout borrows from the sleep-tracking dashboard on inspora.design
// (DESIGN.md §9): one hero number with a small unit beside it, then a row of
// secondary stats with small change notes. We enlarge every size from that
// reference, because its 11-12px labels fail our 16px floor (DESIGN.md §2).

export type LatestBp = {
  systolic: number;
  diastolic: number;
  pulse?: number;
  /** Already formatted in the patient's timezone, e.g. "This morning, 7:42". */
  when: string;
  /** 7-day average, if there are enough readings (PLAN.md §5.3 min-data rule). */
  weekAverage?: { systolic: number; diastolic: number };
  /** Systolic change vs the previous 7 days. Absent = not enough data. */
  weekChange?: number;
  /** Only present when a doctor target exists. Never computed from our own "normal". */
  target?: "in" | "above" | "below";
};

export function LatestReadingCard({ reading }: { reading: LatestBp }) {
  return (
    <section
      aria-labelledby="latest-heading"
      className="rounded-card border border-border-subtle bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="latest-heading"
          className="flex items-center gap-2 text-label font-bold"
        >
          {/* The red dot is the brand accent marking "this is live data",
              borrowed from the reference's period label. Decorative only. */}
          <span aria-hidden className="size-2.5 rounded-full bg-primary" />
          Latest blood pressure
        </h2>
        <p className="text-label text-text-muted">{reading.when}</p>
      </div>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-reading font-bold">
          {reading.systolic}/{reading.diastolic}
        </span>
        <span className="text-label text-text-muted">mmHg</span>
      </p>

      {reading.target && <TargetBadge status={reading.target} />}

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border-subtle pt-4">
        {reading.pulse !== undefined && (
          <div>
            <dt className="text-small text-text-muted">Pulse</dt>
            <dd className="tabular text-title font-bold">
              {reading.pulse}{" "}
              <span className="text-small font-normal text-text-muted">
                bpm
              </span>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-small text-text-muted">7-day average</dt>
          <dd className="tabular text-title font-bold">
            {reading.weekAverage
              ? `${reading.weekAverage.systolic}/${reading.weekAverage.diastolic}`
              : "–"}
          </dd>
          <dd className="text-small text-text-muted">
            <WeekChange change={reading.weekChange} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Change is shown in neutral grey, in words, with an arrow. NOT green/red:
// "lower" isn't automatically good (too-low BP is a problem too), and colouring
// it would be the app making a medical judgement (PLAN.md non-goals).
function WeekChange({ change }: { change?: number }) {
  if (change === undefined) return <>Not enough readings yet</>;
  if (change === 0) return <>Same as last week</>;
  const arrow = change < 0 ? "↓" : "↑";
  const word = change < 0 ? "lower" : "higher";
  return (
    <>
      <span aria-hidden>{arrow} </span>
      {Math.abs(change)} {word} than last week
    </>
  );
}

// Pill style borrowed from the reference's "biggest drop-off" chip: tinted
// background, strong text, icon. Status is icon + words + colour, never colour
// alone (DESIGN.md §1).
function TargetBadge({ status }: { status: "in" | "above" | "below" }) {
  if (status === "in") {
    return (
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1.5 text-label font-bold text-ok">
        <CircleCheck aria-hidden className="size-5" />
        Within your doctor&rsquo;s target
      </p>
    );
  }
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-watch-soft px-3 py-1.5 text-label font-bold text-watch">
      <span aria-hidden>{status === "above" ? "▲" : "▼"}</span>
      {status === "above" ? "Above" : "Below"} your doctor&rsquo;s target
    </p>
  );
}
