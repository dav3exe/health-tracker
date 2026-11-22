"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { GlucoseUnit } from "@/lib/units";

// Thin, typed wrappers over the account API routes. The server is the source
// of truth for WHO can see WHAT; the phone only caches it.

export type Role = "owner" | "caregiver" | "viewer";

export type PatientSummary = {
  id: string;
  displayName: string;
  glucoseUnit: GlucoseUnit;
  timezone: string;
  role: Role;
};

export type Me = {
  user: {
    name: string;
    email?: string;
    image?: string;
    kind: "google" | "device";
  };
  patients: PatientSummary[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Something went wrong. Please try again.");
  }
  return (await res.json()) as T;
}

export const meQueryKey = ["me"] as const;

/** The signed-in user and their patients. Disabled when signed out. */
export function useMe() {
  const { status } = useSession();
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => json<Me>(await fetch("/api/me")),
    enabled: status === "authenticated",
    // Offline-first: keep showing what we last knew instead of an error.
    staleTime: 60_000,
    retry: 1,
  });
}

export async function createPatientRequest(input: {
  id: string;
  displayName: string;
  glucoseUnit: GlucoseUnit;
  timezone: string;
}): Promise<PatientSummary> {
  return json(
    await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updatePatientRequest(
  id: string,
  patch: Partial<{ displayName: string; glucoseUnit: GlucoseUnit }>,
): Promise<void> {
  const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await json(res);
}

export async function createInviteRequest(
  patientId: string,
  role: "caregiver" | "viewer" = "caregiver",
): Promise<{ url: string; expiresAt: string }> {
  return json(
    await fetch(`/api/patients/${encodeURIComponent(patientId)}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }),
  );
}
