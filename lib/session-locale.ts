/**
 * ─────────────────────────────────────────────────────────────────────
 * À QUI APPARTIENT CE QUI EST DANS CE NAVIGATEUR ?
 *
 * ── LE DÉFAUT ──
 *
 * Le pipe vit dans le `localStorage`, sous une clé UNIQUE et non nominative
 * (`alpha-sales-os-v2`). `signOut()` ne fait qu'une chose : fermer la session
 * Supabase. Il ne touche pas au stockage.
 *
 * Conséquence, sur n'importe quel navigateur partagé — et le premier concerné
 * est l'ordinateur de démonstration :
 *
 *   1. Zakaria travaille, son pipe s'écrit dans le localStorage.
 *   2. Il se déconnecte.
 *   3. Un client crée son compte et se connecte sur la même machine.
 *   4. Il ouvre `/pipeline` — et il voit les fiches de Zakaria.
 *
 * Ce n'est pas une faille serveur : la RLS fait son travail, la base ne lui
 * rend rien. C'est le NAVIGATEUR qui garde l'état du précédent. Le client
 * hérite littéralement de la session de quelqu'un d'autre, avec des noms, des
 * téléphones et des montants de deals.
 *
 * ── LA RÈGLE ──
 *
 * On mémorise à côté du pipe l'identifiant du compte à qui il appartient. À
 * chaque changement d'état d'authentification, on compare.
 *
 * ⚠ ON NE PURGE PAS À LA DÉCONNEXION, et c'est délibéré. L'app est
 * LOCAL-FIRST : tant que `pipeServeur` n'est pas activé, le localStorage est
 * la SEULE copie qui existe. Effacer à la déconnexion détruirait le travail de
 * quelqu'un qui se déconnecte pour se reconnecter. Et ce n'est pas nécessaire :
 * une fois déconnecté, l'écran de connexion est fermé — personne ne voit rien
 * sans ouvrir une session, et c'est à ce moment-là que la purge tombe.
 *
 * ⚠ UN STOCKAGE SANS PROPRIÉTAIRE EST ADOPTÉ, PAS DÉTRUIT. C'est le cas de
 * tout ce qui a été créé avant que les comptes existent. Détruire par principe
 * effacerait le pipe réel de l'opérateur au premier login. Le corollaire à
 * connaître : sur une machine où des données existent déjà sans propriétaire,
 * c'est le PREMIER qui se connecte qui les réclame.
 * ─────────────────────────────────────────────────────────────────────
 */

/** La clé du store zustand. Doit rester identique à `persist({ name })`. */
export const CLE_STORE = "alpha-sales-os-v2";

/** Où on note à qui appartient ce stockage. Volontairement à part du store. */
export const CLE_PROPRIETAIRE = "alpha-sales-os-proprietaire";

export type DecisionSession =
  /** Personne n'est connecté : on ne touche à rien. */
  | "rien"
  /** Stockage sans propriétaire connu : le compte qui arrive le réclame. */
  | "adopter"
  /** Le stockage appartient à quelqu'un d'autre : il doit disparaître. */
  | "purger";

/**
 * La décision, pure et testable.
 *
 * Séparée de l'exécution parce que c'est la RÈGLE qui doit être vérifiable :
 * une purge est irréversible, et se tromper de sens efface le travail d'un
 * utilisateur au lieu de le protéger.
 */
export function decider(proprietaire: string | null, utilisateur: string | null): DecisionSession {
  if (!utilisateur) return "rien";
  if (!proprietaire) return "adopter";
  return proprietaire === utilisateur ? "rien" : "purger";
}

/** Lit le propriétaire noté, ou `null`. Ne lève jamais. */
export function lireProprietaire(): string | null {
  try {
    return localStorage.getItem(CLE_PROPRIETAIRE);
  } catch {
    // Navigation privée, stockage bloqué : on ne sait pas, donc on ne purge
    // pas. Un doute ne doit jamais déclencher une suppression.
    return null;
  }
}

export interface EffetSession {
  decision: DecisionSession;
  /** Le stockage a-t-il réellement été effacé ? */
  purge: boolean;
}

/**
 * Applique la décision au stockage réel.
 *
 * ⚠ Après une purge, l'appelant DOIT recharger la page. L'état zustand vit en
 * mémoire : vider le localStorage ne le vide pas, et l'écran continuerait
 * d'afficher les fiches du précédent jusqu'au prochain rafraîchissement —
 * c'est-à-dire exactement le défaut qu'on corrige, en pire (l'utilisateur
 * croirait que ce sont les siennes). Le rechargement est laissé à l'appelant
 * parce que ce module doit rester testable sans navigateur.
 */
export function appliquer(utilisateur: string | null): EffetSession {
  const decision = decider(lireProprietaire(), utilisateur);
  if (decision === "rien") return { decision, purge: false };

  try {
    if (decision === "purger") localStorage.removeItem(CLE_STORE);
    if (utilisateur) localStorage.setItem(CLE_PROPRIETAIRE, utilisateur);
  } catch {
    // Stockage indisponible : rien n'a été écrit, donc rien à protéger.
    return { decision, purge: false };
  }
  return { decision, purge: decision === "purger" };
}
