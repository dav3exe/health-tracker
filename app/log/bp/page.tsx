import type { Metadata } from "next";
import { BackHeader } from "@/components/nav/BackHeader";
import { BpForm } from "@/components/logging/BpForm";
import { ClientOnly } from "@/components/providers/ClientOnly";

export const metadata: Metadata = { title: "Blood pressure" };

// No bottom nav on logging screens: one screen, one job (DESIGN.md §1).
// Fewer things to tap by mistake while entering numbers.
export default function LogBpPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-4 pb-8">
      <BackHeader title="Blood pressure" />
      <ClientOnly>
        <BpForm />
      </ClientOnly>
    </main>
  );
}
