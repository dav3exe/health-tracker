import type { Metadata } from "next";
import { BackHeader } from "@/components/nav/BackHeader";
import { GlucoseForm } from "@/components/logging/GlucoseForm";
import { ClientOnly } from "@/components/providers/ClientOnly";

export const metadata: Metadata = { title: "Blood sugar" };

export default function LogGlucosePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-4 pb-8">
      <BackHeader title="Blood sugar" />
      <ClientOnly>
        <GlucoseForm />
      </ClientOnly>
    </main>
  );
}
