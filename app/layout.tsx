import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { CaptureParrainage } from "@/components/capture-parrainage";

export const metadata: Metadata = {
  title: {
    default: "ALPHA SALES OS® — EAGLEYE CORP",
    template: "%s · ALPHA SALES OS®",
  },
  // Volontairement neutre : cette description part avec CHAQUE page, y
  // compris là où elle serait lue par un tiers. Le vocabulaire interne de la
  // méthode (« Taxe d'Ignorance », « 3 Croyances »…) décrit le procédé à
  // quiconque sait lire, et ne dit rien à un prospect. La vitrine porte sa
  // propre description, tournée vers le résultat.
  description: "Système d'exploitation commercial — EAGLEYE CORP, Lyon.",
  applicationName: "ALPHA SALES OS",
  manifest: "/manifest.webmanifest",
  // L'app est un CRM privé : rien n'y est indexable. La vitrine SURCHARGE
  // cette valeur dans son propre layout — sans quoi la seule page publique
  // resterait invisible pour Google.
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
      {/* suppressHydrationWarning : le script de thème mute <html> avant
          l'hydratation, et des extensions navigateur ajoutent souvent des
          attributs sur <body>. Ni l'un ni l'autre ne doit faire échouer
          l'hydratation. */}
      <body suppressHydrationWarning>
        {/*
          ⚠ La capture du code d'apport vit ICI, dans la racine — un prospect
          amené par un apporteur arrive sur `/vitrine`, qui est hors de la
          coquille applicative. La monter dans `app/(app)/layout` l'aurait
          rendue inerte pour le seul public qu'elle concerne.
        */}
        <CaptureParrainage />
        {children}
      </body>
    </html>
  );
}
