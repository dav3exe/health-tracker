import type { Metadata } from "next";
import { SetupWizard } from "@/components/account/SetupWizard";
import { ClientOnly } from "@/components/providers/ClientOnly";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-8 pb-8">
      <h1 className="text-title font-bold">Let&rsquo;s get started</h1>
      <ClientOnly>
        <SetupWizard />
      </ClientOnly>
    </main>
  );
}
