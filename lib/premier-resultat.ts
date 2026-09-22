import { VERTICALS, offreDeLaVerticale, type VerticalPlaybook } from "./playbook";
import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA VALEUR EN 30 SECONDES — ce qu'Alpha montre AVANT de demander à brancher.
 *
 * Le défaut d'onboarding qu'on répare (inspiré d'excelio) : Alpha faisait
 * « branche SMTP/DNS d'abord », et l'inscrit reposait le téléphone avant
 * d'avoir rien VU. Ici, il choisit son marché et voit à l'instant, sans
 * config, sans envoi : l'angle qui mord chez lui, le message qu'Alpha écrit,
 * l'offre qui s'y rattache. « Montrer la valeur avant de la faire configurer. »
 *
 * ⚠ ON N'INVENTE RIEN. Tout est ASSEMBLÉ depuis les verticales réelles
 * (`lib/playbook.ts`), qui portent déjà leur niveau de preuve et passent les
 * gardes d'interdits. Ce module ne fabrique pas de contenu : il en RÉVÈLE.
 * Fabriquer un pitch ici recréerait exactement la preuve inventée que le reste
 * du dépôt refuse.
 *
 * ⚠ Le message montré est la partie VALEUR de l'approche (la bascule + le
 * rendez-vous), jamais la ligne de barrage/permission d'un appel à froid :
 * celle-là ne veut rien dire hors d'un vrai appel, et l'afficher en vitrine
 * d'onboarding sonnerait faux.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ApercuValeur {
  /** L'id de la verticale d'où tout est tiré. */
  verticaleId: string;
  /** Le marché, lisible (ex. « Maîtrise d'ouvrage — promotion & aménagement »). */
  label: string;
  /** QUI on appelle — le déclencheur de ciblage. */
  criterion: string;
  /** L'angle honnête : pourquoi ça mord chez lui (la douleur structurelle). */
  angle: string;
  /** Le message qu'Alpha écrit : la bascule de valeur + la demande de RDV. */
  message: string;
  /** L'offre que cette verticale sert. */
  offre: EagleyeOffer;
}

/** La liste des marchés proposables au choix, dans l'ordre du playbook. */
export function secteursDisponibles(): { id: string; label: string }[] {
  return VERTICALS.map((v) => ({ id: v.id, label: v.label }));
}

/**
 * Les lignes de VALEUR de l'approche. On garde la bascule (ce qu'on installe et
 * ce qu'il récupère) et le CTA (le rendez-vous) ; on écarte barrage et
 * permission, qui n'existent que dans un appel vivant. Repli : les deux
 * dernières lignes, pour ne jamais rendre un message vide.
 */
function messageDeValeur(v: VerticalPlaybook): string {
  const valeur = v.opener.filter((s) => /bascule|cta/i.test(s.label)).map((s) => s.line);
  const lignes = valeur.length > 0 ? valeur : v.opener.slice(-2).map((s) => s.line);
  return lignes.join("\n\n");
}

/** L'aperçu instantané pour un marché choisi. `null` si l'id est inconnu. */
export function apercuPour(verticaleId: string): ApercuValeur | null {
  const v = VERTICALS.find((x) => x.id === verticaleId);
  if (!v) return null;
  return {
    verticaleId: v.id,
    label: v.label,
    criterion: v.criterion,
    angle: v.structuralPain,
    message: messageDeValeur(v),
    offre: offreDeLaVerticale(v) ?? "alpha-voice",
  };
}
