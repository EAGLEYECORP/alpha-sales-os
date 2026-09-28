/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ARMEMENT DE L'AUTOPILOTE — UNE seule définition de « est-ce armé ? ».
 *
 * Décidé le 28/09/2026. « Alpha se gère tout seul » se pilotait par la variable
 * d'env `CAMPAIGN_AUTOPILOT=on` — un geste d'OPS (éditer Netlify, redéployer),
 * pas un BOUTON. Et la question « est-ce armé ? » était recopiée dans CINQ
 * fichiers (les trois ticks, le moniteur, Telegram) : le défaut n°1 du dépôt,
 * appliqué à la gâchette la plus chère qui existe ici.
 *
 * Ce module unifie les deux niveaux :
 *  · `CAMPAIGN_AUTOPILOT=on` — le DISJONCTEUR d'ops. Il force l'armement quel
 *    que soit le reste (héritage, et un cran d'arrêt pour couper depuis l'infra).
 *  · le DRAPEAU EN BASE — l'INTERRUPTEUR de l'opérateur, basculé par un bouton
 *    dans l'app (`/api/autopilote`). C'est LUI que le bouton mobile actionne.
 *
 * ⚠ CE QUE LE BOUTON NE FAIT PAS, ET IL FAUT LE DIRE. Il ARME ; il ne contourne
 * AUCUNE garde. Un tick armé refuse toujours hors palier, sans DKIM aligné, sans
 * fiche synchronisée, sans agent vivant (voix). Il ne SOURCE pas non plus — la
 * recherche de leads vit hors de l'app. « Se gère tout seul » = envoie/drippe ce
 * qui est déjà chargé, dans les règles ; pas « trouve et dépense sans limite ».
 *
 * ⚠ Et il n'INSTALLE pas l'ordonnanceur : `pg_cron` (migrations 004/014) doit
 * être posé une fois. Le bouton décide si le cron AGIT ; il ne le crée pas.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** L'id de la ligne unique du réglage (compte maître, mono-locataire pour l'instant). */
export const REGLAGE_ID = "global";

/** Le disjoncteur d'ops : la variable d'environnement force l'armement. */
export function autopiloteArmeEnv(): boolean {
  return (process.env.CAMPAIGN_AUTOPILOT ?? "").trim().toLowerCase() === "on";
}

/**
 * La règle d'armement, PURE et testable. `dbActif` vaut `null` quand on n'a pas
 * pu lire le drapeau (base injoignable, ligne absente) — et dans ce cas on NE
 * s'arme PAS sur la base : seul l'env peut alors armer. Toute panne penche vers
 * « simulation », jamais vers « ça part ».
 */
export function estArme(opts: { env: boolean; dbActif: boolean | null }): boolean {
  return opts.env || opts.dbActif === true;
}

/**
 * Lit le drapeau en base. `null` si indisponible (jamais `false` par défaut sur
 * une panne : `null` dit « on ne sait pas », et `estArme` ne s'arme pas dessus).
 * Prend le client en argument : le module reste testable sans réseau.
 */
export async function lireDrapeauAutopilote(db: SupabaseClient): Promise<boolean | null> {
  try {
    const { data, error } = await db
      .from("autopilote_reglage")
      .select("actif")
      .eq("id", REGLAGE_ID)
      .maybeSingle();
    if (error) return null;
    if (!data) return false; // pas de ligne = jamais armé (état de départ), pas une panne
    return Boolean((data as { actif?: unknown }).actif);
  } catch {
    return null;
  }
}

/** Écrit le drapeau (bouton ON/OFF). Renvoie true si l'écriture a réussi. */
export async function ecrireDrapeauAutopilote(
  db: SupabaseClient,
  actif: boolean,
  parQui: string | null,
): Promise<boolean> {
  try {
    const { error } = await db
      .from("autopilote_reglage")
      .upsert({ id: REGLAGE_ID, actif, updated_at: new Date().toISOString(), updated_by: parQui });
    return !error;
  } catch {
    return false;
  }
}

export interface EtatAutopilote {
  /** Le drapeau opérateur (bouton) — ou null si base injoignable. */
  drapeau: boolean | null;
  /** Le disjoncteur d'ops (env). */
  env: boolean;
  /** Ce qui compte réellement : armé ou non. */
  arme: boolean;
}

/** L'état complet, pour la sonde et le bouton. */
export async function etatAutopilote(db: SupabaseClient): Promise<EtatAutopilote> {
  const drapeau = await lireDrapeauAutopilote(db);
  const env = autopiloteArmeEnv();
  return { drapeau, env, arme: estArme({ env, dbActif: drapeau }) };
}
