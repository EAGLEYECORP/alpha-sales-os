import type { SupabaseClient } from "@supabase/supabase-js";
import { PROPRIETAIRE_OPERATEUR } from "./sync-prospects";
import type { Meeting, Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LIRE LE PIPE CÔTÉ SERVEUR — une seule fois, bornée, et cloisonnée.
 *
 * ══ LE DÉFAUT QUE CE MODULE FERME, ET IL ÉTAIT À MOITIÉ CORRIGÉ ══
 *
 * `/api/v1/etat` portait déjà le raisonnement, écrit noir sur blanc :
 *
 *   « La requête balayait la table entière. Tant qu'il n'y a qu'un locataire
 *     ça ne se voit pas ; le jour où il y en a deux, l'agent de l'un lit le
 *     pipe de l'autre. »
 *
 * Le filtre a été posé là. Et NULLE PART AILLEURS. Un balayage des routes
 * montre que trois autres lisaient `prospects` sans lui :
 *
 *   · `/api/campaign/tick`  — bornée à 2 000, mais SANS filtre de propriétaire
 *   · `/api/push/tick`      — ni borne, ni filtre
 *   · `/api/calendar`       — ni borne, ni filtre
 *
 * ⚠ CELLE QUI COMPTE EST LA PREMIÈRE : elle COMPOSE DES NUMÉROS. Le jour où
 * un second locataire existe, notre cron appelle ses prospects à lui, avec
 * notre ligne, sur notre facture, et en engageant sa relation client. Aucune
 * erreur ne serait levée : la requête est valide, elle rend juste plus de
 * lignes qu'elle ne devrait.
 *
 * C'est la forme la plus coûteuse du défaut récurrent du dépôt : une règle
 * juste, appliquée à UN endroit sur quatre. Elle ne vit donc plus dans une
 * route — elle vit ici, et un test interdit toute lecture directe.
 *
 * ══ POURQUOI BORNER AUSSI, ET POURQUOI LA TRONCATURE SE DIT ══
 *
 * Une fonction serverless qui charge une table entière meurt en mémoire au
 * moment précis où le produit commence à marcher. Mais une borne SILENCIEUSE
 * est pire que pas de borne : les fiches au-delà ne sont jamais rappelées, et
 * rien ne le dit. On lit donc UNE ligne de plus que la limite pour SAVOIR
 * qu'on tronque, et on le remonte.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Plafond de lecture par requête.
 *
 * ⚠ Il valait 2 000 dans `campaign/tick` et 2 000 dans `moniteur`, écrits
 * séparément. Deux constantes pour la même limite finissent par diverger, et
 * on se retrouve avec un autopilote qui voit 2 000 fiches et un moniteur qui
 * en voit 5 000 — l'écran contredit alors la machine qu'il surveille.
 */
export const LIMITE_LECTURE = 2000;

export interface LecturePipe {
  prospects: Prospect[];
  /** Vrai quand la base en contient PLUS que la limite. */
  tronque: boolean;
  /** La phrase à remonter dans la réponse. Vide quand rien n'est tronqué. */
  avertissement: string;
  /** Message d'erreur de la base, ou `null`. */
  erreur: string | null;
}

/**
 * Les fiches de L'OPÉRATEUR, bornées.
 *
 * ⚠ `proprietaire` et pas `user_id` : les lignes écrites par le serveur
 * n'appartiennent à aucune session Supabase — c'est ce qui permet au service
 * role d'écrire sans utilisateur connecté. La convention est posée dans
 * `lib/sync-prospects.ts`, et elle n'est pas recopiée ici.
 */
export async function lireProspectsOperateur(db: SupabaseClient): Promise<LecturePipe> {
  const { data, error } = await db
    .from("prospects")
    .select("data")
    .eq("proprietaire", PROPRIETAIRE_OPERATEUR)
    .limit(LIMITE_LECTURE + 1);

  if (error) {
    return { prospects: [], tronque: false, avertissement: "", erreur: error.message };
  }

  const brut = (data ?? []).map((r) => (r as { data: Prospect }).data).filter(Boolean);
  const tronque = brut.length > LIMITE_LECTURE;

  return {
    prospects: tronque ? brut.slice(0, LIMITE_LECTURE) : brut,
    tronque,
    avertissement: tronque
      ? `⚠ Plus de ${LIMITE_LECTURE} fiches côté serveur : seules les ${LIMITE_LECTURE} premières sont lues. ` +
        `Les suivantes ne sont JAMAIS traitées — il faut paginer ou filtrer côté base.`
      : "",
    erreur: null,
  };
}

export interface LectureRdv {
  meetings: Meeting[];
  tronque: boolean;
  avertissement: string;
  erreur: string | null;
}

/**
 * Les rendez-vous, bornés — et le trou qui reste, dit en clair.
 *
 * ⚠⚠ `meetings` N'A PAS DE COLONNE `proprietaire`. Elle porte `user_id` et
 * s'appuie sur la RLS… que le **service role contourne par conception**. Une
 * lecture serveur de cette table voit donc les rendez-vous de TOUS les
 * utilisateurs, et aucun filtre écrit ici ne peut y remédier : il n'existe
 * aucune colonne qui distingue « les nôtres ».
 *
 * On BORNE donc, et on ne prétend pas cloisonner. Fermer vraiment ce trou
 * demande une migration (ajouter `proprietaire` à `meetings`) ET de changer le
 * chemin d'écriture qui la remplit — ça ne se fait pas à l'aveugle depuis un
 * environnement qui n'atteint aucune base réelle.
 *
 * Tant que c'est ouvert, c'est écrit : dans ce commentaire, dans le relevé de
 * pannes d'Alpha CEO, et dans la réponse des routes concernées. Un trou nommé
 * se referme un jour ; un trou tacite se découvre en production.
 */
export const RDV_SANS_CLOISON =
  "Les rendez-vous n'ont pas de colonne propriétaire : une lecture par le service role voit ceux de tous les " +
  "utilisateurs. Tant qu'il n'y a qu'un opérateur c'est sans conséquence. Fermer le trou demande une migration " +
  "sur `meetings` et le chemin d'écriture qui la remplit.";

export async function lireMeetingsBornes(db: SupabaseClient): Promise<LectureRdv> {
  const { data, error } = await db.from("meetings").select("data").limit(LIMITE_LECTURE + 1);

  if (error) {
    return { meetings: [], tronque: false, avertissement: "", erreur: error.message };
  }

  const brut = (data ?? []).map((r) => (r as { data: Meeting }).data).filter(Boolean);
  const tronque = brut.length > LIMITE_LECTURE;

  return {
    meetings: tronque ? brut.slice(0, LIMITE_LECTURE) : brut,
    tronque,
    avertissement: tronque ? `⚠ Plus de ${LIMITE_LECTURE} rendez-vous côté serveur : seuls les premiers sont lus.` : "",
    erreur: null,
  };
}
