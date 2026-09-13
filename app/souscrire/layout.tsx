import type { Metadata } from "next";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA DEUXIÈME PAGE PUBLIQUE — celle où on peut effectivement acheter.
 *
 * Elle existe parce que le tunnel était ARCHITECTURALEMENT FERMÉ, et que
 * personne ne pouvait le voir en local : le mur `SITE_PASSWORD` ne s'active
 * que si la variable est posée. Vérifié en démarrant le serveur avec, un
 * inconnu obtenait :
 *
 *   /vitrine ................. 200
 *   /compte?offre=solo ....... 307 → /gate      ← la cible de CHAQUE bouton
 *   /login ................... 307 → /gate
 *   /api/billing/checkout .... 401
 *
 * Autrement dit : les offres payables n'étaient affichées nulle part, et les
 * boutons qui menaient à elles tombaient sur une demande de mot de passe.
 * Zéro vente en libre-service n'était possible — la grille, la route Stripe
 * et l'écran de retour existaient tous, sans porte d'entrée.
 *
 * Le mur reste debout : cette page vit HORS de `(app)`, elle ne monte pas la
 * coquille de l'opérateur, ne touche pas au store, et n'affiche aucune donnée
 * client. Ce n'est pas un trou dans la porte, c'est une porte différente —
 * le même raisonnement que `/api/v1` et `/api/mcp`.
 * ─────────────────────────────────────────────────────────────────────
 */
export const metadata: Metadata = {
  title: "Souscrire — Alpha Sales OS",
  description:
    "Commencer avec Alpha Sales OS : essai terrain, abonnement mensuel, ou installation complète avec cadrage. Prix affichés, sans engagement.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/souscrire" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "EAGLEYE CORP",
    title: "Commencer avec Alpha Sales OS",
    description: "Essai terrain, abonnement mensuel, ou installation complète. Sans engagement.",
    // ⚠ TROUVÉ AU RENDU, pas à la relecture : cette page déclarait des balises
    // Open Graph SANS image. Partagée sur LinkedIn, la page où l'on ACHÈTE
    // sortait en carte nue — un titre sur fond gris, à côté des liens
    // concurrents qui ont tous une vignette. La vitrine avait la sienne ; la
    // page de conversion, non. Même fichier image : c'est le même produit, et
    // deux visuels différents pour un même lien partagé deux fois de suite
    // ressemblent à deux produits.
    images: [{ url: "/media/hero-poster.jpg", width: 1280, height: 720, alt: "Alpha Sales OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Commencer avec Alpha Sales OS",
    description: "Essai terrain, abonnement mensuel, ou installation complète. Sans engagement.",
    images: ["/media/hero-poster.jpg"],
  },
};

export default function SouscrireLayout({ children }: { children: React.ReactNode }) {
  return children;
}
