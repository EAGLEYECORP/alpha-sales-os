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
  title: "Alpha Sales OS — les humains closent, Alpha fait tourner la machine",
  description:
    "Alpha trie qui appeler et quand, écrit le message, tient la relance et applique les règles françaises du démarchage. Gratuit en ligne ; complet chez vous, installé sur votre serveur. Cadrage obligatoire avant tout devis. Lyon.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/vitrine" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "EAGLEYE CORP",
    title: "Les humains closent. Alpha fait tourner la machine.",
    description:
      "Trier, écrire, relancer, rester dans les règles — vous gardez la conversation. Gratuit en ligne, complet chez vous.",
    images: [{ url: "/media/hero-poster.jpg", width: 1280, height: 720, alt: "Alpha Sales OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Les humains closent. Alpha fait tourner la machine.",
    description: "Trier, écrire, relancer, rester dans les règles — vous gardez la conversation.",
    images: ["/media/hero-poster.jpg"],
  },
};

export default function VitrineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
