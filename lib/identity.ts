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

/**
 * Budget par défaut de la doctrine dans un prompt. Assez large pour contenir
 * la doctrine livrée (~1 900 caractères) sans la mutiler.
 */
export const DOCTRINE_MAX_CHARS = 2600;

/**
 * Tronque la doctrine SUR UNE FRONTIÈRE DE RÈGLE, jamais au milieu d'une
 * phrase.
 *
 * Pourquoi ça compte : une doctrine coupée à l'aveugle produit une demi-règle
 * (« ... chantier > 40 k → Nuwac ») que le modèle complète au hasard. Sur des
 * règles qui portent des PRIX et un routage de commission, une demi-phrase est
 * pire que rien : elle a l'air d'une consigne. On préfère perdre les dernières
 * règles en entier — c'est pour ça qu'elles sont classées par gravité.
 */
export function clipDoctrine(rules: string, max: number = DOCTRINE_MAX_CHARS): string {
  const text = rules.trim();
  if (text.length <= max) return text;

  const lines = text.split("\n");
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    const cost = used === 0 ? line.length : line.length + 1;
    if (used + cost > max) break;
    kept.push(line);
    used += cost;
  }
  // Aucune règle entière ne tient : mieux vaut ne rien injecter qu'un fragment.
  return kept.join("\n");
}
