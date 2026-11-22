"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { CloudOff } from "lucide-react";
import { useMe } from "@/lib/account/client";

// A calm nudge, not a wall: logging always works without an account (readings
// stay on the phone), so the app never blocks someone who just wants to save a
// number. It only explains what signing in adds.
export function AccountBanner() {
  const { status } = useSession();
  const { data: me } = useMe();

  const needsSetup =
    status === "authenticated" &&
    me?.user.kind === "google" &&
    me.patients.length === 0;
  if (status !== "unauthenticated" && !needsSetup) return null;

  return (
    <Link
      href={needsSetup ? "/setup" : "/signin"}
      className="flex items-center gap-4 rounded-card border-2 border-primary-soft-border bg-primary-soft p-4"
    >
      <CloudOff aria-hidden className="size-7 shrink-0 text-primary" />
      <span className="flex flex-col">
        <span className="text-body font-bold">
          {needsSetup ? "Finish setting up" : "Back up your readings"}
        </span>
        <span className="text-label text-text-muted">
          {needsSetup
            ? "One more step to save readings to your account."
            : "Readings are only on this phone. Tap to sign in."}
        </span>
      </span>
    </Link>
  );
}
