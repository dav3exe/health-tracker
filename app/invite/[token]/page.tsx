import type { Metadata } from "next";
import { RedeemInvite } from "@/components/account/RedeemInvite";
import { ClientOnly } from "@/components/providers/ClientOnly";

export const metadata: Metadata = {
  title: "Set up this phone",
  // Invite URLs are secrets: never let them be indexed or leak via Referer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The token is read in the browser (useParams), not here: the page shell is
// identical for every invite, so it can be prerendered and load instantly.
export default function InvitePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-10 pb-8">
      <ClientOnly>
        <RedeemInvite />
      </ClientOnly>
    </main>
  );
}
