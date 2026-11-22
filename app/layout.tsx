import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OfflineProvider } from "@/components/providers/OfflineProvider";

export const metadata: Metadata = {
  title: {
    default: "Health Tracker",
    template: "%s · Health Tracker",
  },
  description:
    "Log blood pressure and blood sugar in seconds, see trends, and share a clear report with your doctor.",
  // Health data: keep every page out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deliberately NO maximumScale / userScalable=no: pinch-zoom is an
  // accessibility requirement (WCAG 1.4.4), especially for older users.
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <OfflineProvider>{children}</OfflineProvider>
      </body>
    </html>
  );
}
