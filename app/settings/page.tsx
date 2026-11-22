import type { Metadata } from "next";
import { BackHeader } from "@/components/nav/BackHeader";
import { SettingsPanel } from "@/components/account/SettingsPanel";
import { ClientOnly } from "@/components/providers/ClientOnly";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-4 pb-8">
      <BackHeader title="Settings" />
      <ClientOnly
        fallback={
          <div aria-hidden className="h-64 rounded-card bg-surface-muted" />
        }
      >
        <SettingsPanel />
      </ClientOnly>
    </main>
  );
}
