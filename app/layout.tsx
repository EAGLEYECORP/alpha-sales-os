import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "ALPHA SALES OS® — EAGLEYE CORP",
    template: "%s · ALPHA SALES OS®",
  },
  description:
    "Système d'exploitation commercial Hormozi-natif. Pipeline, Red Zone, Taxe d'Ignorance, 3 Croyances — Lyon.",
  applicationName: "ALPHA SALES OS",
  manifest: "/manifest.webmanifest",
  keywords: ["sales", "CRM", "Hormozi", "Lyon", "EAGLEYE"],
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Installée sur le téléphone (PWA) : plein écran, sans chrome navigateur.
  appleWebApp: {
    capable: true,
    title: "ALPHA OS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
    { media: "(prefers-color-scheme: light)", color: "#ede7da" },
  ],
  width: "device-width",
  initialScale: 1,
  // Laisse l'app peindre sous les encoches/barres système (safe-areas gérées).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
