"use client";

import { useSyncExternalStore } from "react";

// Renders children only in the browser; `fallback` on the server and during
// hydration.
//
// Why: the logging screens depend on things that only exist on the phone:
// its clock and timezone (the reading time) and IndexedDB (the offline store).
// Rendered on the server, the time would come from the SERVER's timezone
// (often UTC), so a reading at 07:42 in Lagos would briefly show 06:42.
// useSyncExternalStore is React's tear-free way to tell server from client.
const subscribe = () => () => {};

export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return isClient ? children : fallback;
}
