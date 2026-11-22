import type { Metadata } from "next";
import { BackHeader } from "@/components/nav/BackHeader";
import { SetupWizard } from "@/components/account/SetupWizard";
import { ClientOnly } from "@/components/providers/ClientOnly";

export const metadata: Metadata = { title: "Add a person" };

export default function AddPersonPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-4 pb-8">
      <BackHeader title="Add a person" backHref="/settings" />
      <ClientOnly>
        <SetupWizard another />
      </ClientOnly>
    </main>
  );
}
