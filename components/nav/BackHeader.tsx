import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Header for single-task screens (logging, settings). A big, labelled
// "Back" target instead of a bare arrow: an icon-only back button is easy to
// miss, and the word removes any doubt about what it does.
export function BackHeader({
  title,
  backHref = "/",
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <Link
        href={backHref}
        className="-ml-2 inline-flex min-h-14 w-fit items-center gap-2 rounded-button px-2 text-label font-bold text-primary hover:bg-primary-soft"
      >
        <ArrowLeft aria-hidden className="size-6" />
        Back
      </Link>
      <h1 className="text-title font-bold">{title}</h1>
    </header>
  );
}
