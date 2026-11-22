import type { Metadata } from "next";
import { HistoryList } from "@/components/history/HistoryList";
import { ClientOnly } from "@/components/providers/ClientOnly";
import { BottomNav } from "@/components/nav/BottomNav";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-8">
        <h1 className="text-title font-bold">History</h1>
        <ClientOnly
          fallback={
            <div aria-hidden className="h-64 rounded-card bg-surface-muted" />
          }
        >
          <HistoryList />
        </ClientOnly>
      </main>
      <BottomNav />
    </>
  );
}
