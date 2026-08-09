/**
 * Identité du compte pour les prompts IA — white-label.
 *
 * L'IA doit parler AU NOM du compte (EAGLEYE par défaut, un revendeur ensuite)
 * et vendre SON offre, pas celle d'EAGLEYE codée en dur. Le client construit ce
 * bloc depuis ses réglages et l'envoie aux routes IA (comme businessRules).
 * Pur, sans dépendance → client + serveur.
 */

export interface OfferIdentity {
  agencyName?: string;
  offer?: { city?: string; whatYouSell?: string; valueProp?: string };
}

/** Nom de l'agence, avec repli neutre (jamais « EAGLEYE » en dur). */
export function agencyLabel(s: OfferIdentity): string {
  return s.agencyName?.trim() || "l'agence";
}

/** Bloc d'identité injecté en tête des prompts IA. */
export function buildIdentity(s: OfferIdentity): string {
  const name = s.agencyName?.trim() || "l'agence";
  const city = s.offer?.city?.trim();
  const sells = s.offer?.whatYouSell?.trim();
  const vp = s.offer?.valueProp?.trim();
  const parts = [`Tu agis pour le compte de ${name}${city ? ` (${city})` : ""}.`];
  if (sells) parts.push(`Ce que ${name} vend : ${sells}.`);
  if (vp) parts.push(`Proposition de valeur : ${vp}.`);
  parts.push("Parle toujours au nom de cette agence et de cette offre — jamais d'une autre.");
  return parts.join(" ");
}
