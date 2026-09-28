/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE LE WEBHOOK STRIPE ÉCRIT — extrait pour être testable.
 *
 * La route ne fait plus que vérifier la signature et écrire ; toute la
 * décision vit ici, en fonctions pures. Ce n'est pas de la cosmétique : les
 * trois défauts corrigés ci-dessous étaient invisibles à 1 025 tests, parce
 * qu'ils vivaient dans un `if` d'une route qu'aucun test ne pouvait appeler
 * sans Supabase et sans une signature valide.
 *
 * Les trois, tous dans le chemin de l'argent :
 *
 *  1. LA CLÉ NE CORRESPONDAIT PAS. Le checkout posait `metadata[offre]`, le
 *     webhook lisait `metadata.plan`. L'essai à 290 € était encaissé et la
 *     ligne s'écrivait avec `plan: null` — payé, aucun droit ouvert, aucune
 *     erreur nulle part.
 *
 *  2. UN ÉVÉNEMENT PARTIEL EFFAÇAIT LE RESTE. `upsert` met à jour les
 *     colonnes fournies, `null` compris. Stripe ne garantit pas l'ordre des
 *     webhooks : reçu après l'abonnement, l'événement de session remettait
 *     `plan` et `current_period_end` à `null`.
 *
 *  3. « SESSION TERMINÉE » ÉTAIT LU COMME « ARGENT REÇU ». Sur un paiement
 *     différé (SEPA, virement), la session se termine sans encaissement, et
 *     le compte passait `active` avant l'argent.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ObjetStripe {
  id?: string;
  customer?: string;
  subscription?: string;
  status?: string;
  /** Session uniquement : « paid » | « unpaid » | « no_payment_required ». */
  payment_status?: string;
  client_reference_id?: string;
  customer_email?: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  customer_details?: { email?: string };
  items?: { data?: { price?: { id?: string } }[] };
}

export type LigneAbonnement = Record<string, unknown> & { user_id: string };

/**
 * Le compte visé par l'événement. `client_reference_id` d'abord : c'est le
 * champ que Stripe recopie tel quel depuis le checkout, donc le plus sûr.
 */
export function compteDe(obj: ObjetStripe): string | null {
  const id = obj.client_reference_id || obj.metadata?.user_id;
  return id ? String(id) : null;
}

/**
 * L'offre achetée. `plan` est le nom canonique ; `offre` est relu pour les
 * sessions créées AVANT l'uniformisation de la clé — elles existent en base
 * chez Stripe et rejoueront peut-être.
 */
export const planDe = (obj: ObjetStripe): string | null =>
  obj.metadata?.plan ?? obj.metadata?.offre ?? null;

/**
 * Le paiement est-il RÉELLEMENT encaissé ?
 *
 * `no_payment_required` couvre les essais à 0 € et les codes promo à 100 % :
 * il n'y a rien à encaisser, l'accès est dû. Tout le reste — `unpaid`,
 * absent, inconnu — reste en attente. Dans le doute, on n'ouvre pas l'accès :
 * refuser un accès dû se répare en une minute, encaisser un impayé non.
 */
export const paiementEncaisse = (obj: ObjetStripe): boolean =>
  obj.payment_status === "paid" || obj.payment_status === "no_payment_required";

/**
 * Ne garder que ce qu'on SAIT. Un champ absent doit rester tel quel en base,
 * jamais être remis à zéro par un événement qui ne le portait pas.
 * `user_id` est conservé quoi qu'il arrive : c'est la clé du conflit.
 */
export function sansInconnus(ligne: LigneAbonnement): Record<string, unknown> {
  const garde = Object.fromEntries(
    Object.entries(ligne).filter(([, v]) => v !== null && v !== undefined)
  );
  return { ...garde, user_id: ligne.user_id };
}

/** La ligne à écrire pour `checkout.session.completed`. */
export function ligneDepuisSession(obj: ObjetStripe): LigneAbonnement | null {
  const user_id = compteDe(obj);
  if (!user_id) return null;
  return {
    user_id,
    email: obj.customer_email ?? obj.customer_details?.email ?? null,
    stripe_customer_id: obj.customer ?? null,
    stripe_subscription_id: obj.subscription ?? null,
    plan: planDe(obj),
    status: paiementEncaisse(obj) ? "active" : "pending",
  };
}

/** La ligne à écrire pour `customer.subscription.*`. */
export function ligneDepuisAbonnement(
  type: string,
  obj: ObjetStripe,
  planPourPrix: (priceId: string | undefined) => string | null
): LigneAbonnement | null {
  const user_id = compteDe(obj);
  if (!user_id) return null;
  return {
    user_id,
    stripe_customer_id: obj.customer ?? null,
    stripe_subscription_id: obj.id ?? null,
    plan: planDe(obj) ?? planPourPrix(obj.items?.data?.[0]?.price?.id),
    status: type.endsWith("deleted") ? "canceled" : (obj.status ?? "inactive"),
    current_period_end: obj.current_period_end
      ? new Date(obj.current_period_end * 1000).toISOString()
      : null,
  };
}
