import type { Metadata } from "next";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Métadonnées de la SEULE page publique.
 *
 * Deux corrections par rapport à ce dont elle héritait :
 *
 *  1. INDEXABLE. La racine porte `robots: { index: false }` — c'est juste
 *     pour un CRM privé, et c'était appliqué à TOUT, y compris à la page
 *     dont le seul travail est d'être trouvée. Une page de vente en
 *     noindex ne convertit personne : elle n'existe pas pour Google.
 *
 *  2. SANS VOCABULAIRE MAISON. La description héritée annonçait
 *     « Hormozi-natif, Taxe d'Ignorance, 3 Croyances ». Ce sont les noms
 *     internes de la méthode : ils ne veulent rien dire pour un prospect,
 *     et ils décrivent le procédé à quiconque sait lire. La description
 *     publique parle du RÉSULTAT.
 *
 * Les balises Open Graph comptent autant que le référencement : le premier
 * canal, c'est LinkedIn, et un lien partagé sans image ni titre correct
 * perd la moitié de ses clics avant même d'être ouvert.
 * ─────────────────────────────────────────────────────────────────────
 */
export const metadata: Metadata = {
  title: "Alpha Sales OS — votre machine de vente tourne, vous vivez",
  description:
    "On trouve vos clients, on les appelle, on les relance et on remplit votre agenda — pendant que vous êtes sur le terrain. Installation sur mesure, cadrage obligatoire avant tout devis. Lyon.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/vitrine" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "EAGLEYE CORP",
    title: "Votre machine de vente tourne. Vous, vous vivez.",
    description:
      "Trouver, appeler, relancer, remplir l'agenda — sans vous. Cadrage obligatoire avant tout devis : on regarde votre cas avant d'annoncer un prix.",
    images: [{ url: "/media/hero-poster.jpg", width: 1280, height: 720, alt: "Alpha Sales OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Votre machine de vente tourne. Vous, vous vivez.",
    description: "Trouver, appeler, relancer, remplir l'agenda — sans vous.",
    images: ["/media/hero-poster.jpg"],
  },
};

export default function VitrineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
