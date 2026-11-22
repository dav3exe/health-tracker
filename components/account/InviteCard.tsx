"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Copy, MessageCircle, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInviteRequest } from "@/lib/account/client";

// "Set up their phone" (PLAN.md §2). The owner makes a one-time link and gets
// it onto the patient's phone in whichever way suits them:
//  - in person: the patient's phone camera scans the QR code
//  - remotely: share via WhatsApp (how most families talk), or copy it
// The link signs that phone in; the patient never creates an account.
export function InviteCard({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const [invite, setInvite] = useState<{ url: string; qr: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await createInviteRequest(patientId);
      // Generated in the browser: the link never goes to a QR service.
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 640 });
      setInvite({ url, qr });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the link.");
    } finally {
      setBusy(false);
    }
  }

  const message = `Open this link on your phone to start logging your readings: `;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-5 shadow-card">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
        >
          <Smartphone className="size-6" />
        </span>
        <div>
          <h2 className="text-body font-bold">
            Set up {patientName}&rsquo;s phone
          </h2>
          <p className="text-label text-text-muted">
            They can log their own readings without making an account.
          </p>
        </div>
      </div>

      {!invite ? (
        <Button size="lg" disabled={busy} onClick={() => void create()}>
          {busy ? "Creating link…" : "Create a setup link"}
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-label">
            Scan this with {patientName}&rsquo;s phone camera, or send the link.
            It works once and expires in 7 days.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img
            src={invite.qr}
            alt={`QR code to set up ${patientName}'s phone`}
            className="mx-auto w-full max-w-64 rounded-button border border-border-subtle"
          />
          <Button asChild size="lg">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message + invite.url)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle aria-hidden />
              Send on WhatsApp
            </a>
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                void navigator
                  .share({ text: message, url: invite.url })
                  .catch(() => {})
              }
            >
              <Share2 aria-hidden />
              Share another way
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(invite.url);
              setCopied(true);
            }}
          >
            <Copy aria-hidden />
            {copied ? "Link copied" : "Copy link"}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-body font-bold text-flag">
          {error}
        </p>
      )}
    </section>
  );
}
