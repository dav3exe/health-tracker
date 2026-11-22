"use client";

import { use } from "react";
import { io } from "next/cache";

// Greeting and date are computed IN THE BROWSER, from the phone's clock and
// timezone. If they were rendered on the server they'd use the server's
// timezone (usually UTC), and someone in Lagos opening the app at 00:30 would
// see yesterday's date. That's exactly the kind of confusion that makes older
// users distrust an app.
//
// `use(io())` tells Next.js not to bake a server-side time into the static
// shell. The fallback below ships instead and is replaced on the client.

function partOfDay(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name?: string }) {
  use(io());
  const now = new Date();
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <h1 className="text-title font-bold">
        {partOfDay(now.getHours())}
        {name ? `, ${name}` : ""}
      </h1>
      <p className="text-body text-text-muted">{date}</p>
    </div>
  );
}

// Same height as the real greeting so nothing jumps when it swaps in.
// Layout shift makes people mis-tap, and our buttons sit right below this.
export function GreetingFallback() {
  return (
    <div aria-hidden>
      <p className="text-title font-bold">Hello</p>
      <p className="text-body text-text-muted">&nbsp;</p>
    </div>
  );
}
