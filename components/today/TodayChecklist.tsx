import { Check } from "lucide-react";

// "What's left today" in one glance. A checklist rather than a streak counter
// or score: it answers the only question that matters each day ("have I done
// my readings?") without guilt-tripping anyone over a missed day.

export type ChecklistItem = {
  id: string;
  label: string;
  /** Local time the reading was logged, e.g. "7:42". Absent = not done yet. */
  doneAt?: string;
};

export function TodayChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.doneAt).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <section
      aria-labelledby="today-heading"
      className="rounded-card border border-border-subtle bg-surface p-5 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-heading" className="text-body font-bold">
          Today&rsquo;s readings
        </h2>
        <p className="text-label font-bold text-primary">
          {done} of {items.length} done
        </p>
      </div>

      {/* The bar is decorative: the "x of y done" text above carries the
          same information for screen readers and colour-blind users. */}
      <div
        aria-hidden
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary-soft"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-4 divide-y divide-border-subtle">
        {items.map((item) => (
          <li key={item.id} className="flex min-h-16 items-center gap-4 py-2">
            {item.doneAt ? (
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
              >
                <Check className="size-5" strokeWidth={3} />
              </span>
            ) : (
              <span
                aria-hidden
                className="size-9 shrink-0 rounded-full border-2 border-border-strong"
              />
            )}

            <span className="flex-1 text-body">{item.label}</span>

            {/* Status as WORDS, not just the icon: "Done 7:42" / "Not yet". */}
            <span
              className={
                item.doneAt
                  ? "tabular text-label text-text-muted"
                  : "text-label text-text-muted"
              }
            >
              {item.doneAt ? `Done ${item.doneAt}` : "Not yet"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
