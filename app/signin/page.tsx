import type { Metadata } from "next";
import { BackHeader } from "@/components/nav/BackHeader";
import { GoogleSignInButton } from "@/components/account/GoogleSignInButton";

export const metadata: Metadata = { title: "Sign in" };

// Google is the only way to create an account (owner's decision). Patients'
// phones don't come here at all: they're set up from an invite link, so this
// page speaks to the person setting things up.
export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pt-4 pb-8">
      <BackHeader title="Sign in" />

      <div className="flex flex-col gap-3">
        <p className="text-body">
          Sign in to back up readings and share them with family or a doctor.
        </p>
        <p className="text-body text-text-muted">
          Readings you already saved on this phone are kept and will be backed
          up after you sign in.
        </p>
      </div>

      <GoogleSignInButton />

      <div className="rounded-card border border-border-subtle bg-surface-muted p-5">
        <p className="text-label font-bold">Setting up a phone for someone?</p>
        <p className="mt-1 text-label text-text-muted">
          They don&rsquo;t need an account. Sign in here on your phone, then go
          to Settings and choose &ldquo;Set up their phone&rdquo;.
        </p>
      </div>
    </main>
  );
}
