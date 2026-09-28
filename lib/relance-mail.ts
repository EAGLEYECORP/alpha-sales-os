import type { Prospect } from "@/lib/types";
import { DIVULGATION_ECRITE } from "@/lib/signature-ia";
import { RAPPELS_MAX } from "@/lib/call-cadence";
import { raisonNeuve, AUCUNE_RAISON, type RaisonNeuve, type ContexteRaison } from "@/lib/raison-neuve";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTO-RELANCE EMAIL — B2 de la boucle : rappeler sans harceler.
 *
 * Décidé le 28/09/2026. Le 1er contact part par `mail-tick`. Sans réponse, la
 * doctrine impose des rappels ESPACÉS, dans les fenêtres, PLAFONNÉS — et surtout
 * chacun avec une RAISON NEUVE, jamais « je me permets de relancer » (la phrase
 * exacte que `master-rappel` interdit). Ce module porte la DÉCISION ; le tick
 * fait l'I/O (compter les envois, envoyer).
 *
 * ⚠⚠ PAS DE RAISON NEUVE ⇒ PAS DE RELANCE. On réutilise `raisonNeuve`
 * (`lib/raison-neuve.ts`) : elle rend `null` quand aucun fait daté ne justifie
 * un rappel, et `AUCUNE_RAISON` dit alors de NE PAS relancer. Un prétexte
 * fabriqué est pire que le silence — il ne se rejoue pas.
 *
 * ⚠ LE PLAFOND VIENT DU DÉCRET 2022-1313 : 4 sollicitations / 30 jours glissants.
 * 1 cold + 3 relances = 4, au plafond, jamais au-dessus. Le « 4 » DÉRIVE de
 * `RAPPELS_MAX` (call-cadence) — une seule définition du plafond légal, partagée
 * avec la voix.
 * ─────────────────────────────────────────────────────────────────────
 */

/** 1 cold + RAPPELS_MAX relances. Le plafond légal, dérivé, jamais recopié. */
export const CONTACTS_MAX_30J = RAPPELS_MAX + 1;

/**
 * L'espacement des relances email, en HEURES depuis le DERNIER envoi. Trois
 * paliers (≈ 3 j, 4 j, 7 j) — un email se laisse respirer plus qu'un appel.
 * C'est une DÉCISION : aucune vente ne l'a validée, et ça se voit au diff.
 */
export const RELANCE_GAPS_H = [72, 96, 168] as const;

export interface DecisionRelance {
  du: boolean;
  /** Le numéro de la relance (1, 2, 3) si `du`, sinon 0. */
  numero: number;
  /** La raison lisible du oui/non — jamais décorative. */
  motif: string;
}

/**
 * Cette fiche est-elle DUE pour une relance MAINTENANT ? Décision pure : le tick
 * fournit les faits (combien d'envois sur 30 j, quand le dernier, a-t-il
 * répondu, y a-t-il une raison neuve). `maintenant` est injecté, jamais lu de
 * l'horloge (la leçon de `creneauPasse`).
 */
export function relanceDue(opts: {
  nbContacts30j: number;
  dernierEnvoiISO: string | null;
  aRepondu: boolean;
  raisonDisponible: boolean;
  maintenant: number;
}): DecisionRelance {
  // Dès qu'il répond, la cadence s'arrête — l'humain prend la main.
  if (opts.aRepondu) return { du: false, numero: 0, motif: "Il a répondu — la cadence s'arrête, ça remonte à l'humain." };

  // Une relance suppose un 1er contact. Zéro envoi = c'est mail-tick, pas ici.
  if (opts.nbContacts30j <= 0) return { du: false, numero: 0, motif: "Jamais contacté — le 1er envoi est le rôle de mail-tick." };

  // Plafond légal (décret 2022-1313).
  if (opts.nbContacts30j >= CONTACTS_MAX_30J)
    return { du: false, numero: 0, motif: `Plafond ${CONTACTS_MAX_30J}/30 j atteint (décret 2022-1313) — on n'ajoute pas.` };

  // ⚠ Pas de raison neuve ⇒ pas de relance. Jamais « je me permets de relancer ».
  if (!opts.raisonDisponible) return { du: false, numero: 0, motif: AUCUNE_RAISON };

  // Assez de temps depuis le dernier envoi ?
  const dernier = opts.dernierEnvoiISO ? Date.parse(opts.dernierEnvoiISO) : NaN;
  if (Number.isNaN(dernier)) return { du: false, numero: 0, motif: "Date du dernier envoi inconnue — on ne relance pas à l'aveugle." };

  const heures = (opts.maintenant - dernier) / 3_600_000;
  const besoin = RELANCE_GAPS_H[opts.nbContacts30j - 1] ?? RELANCE_GAPS_H[RELANCE_GAPS_H.length - 1];
  if (heures < besoin)
    return { du: false, numero: 0, motif: `Trop tôt : ${Math.floor(heures)} h depuis le dernier envoi, il en faut ${besoin}.` };

  return { du: true, numero: opts.nbContacts30j, motif: `Relance n°${opts.nbContacts30j} due — raison neuve disponible, dans le plafond.` };
}

/** Le prénom d'accroche, ou un « bonjour » neutre. */
function prenomDe(p: Prospect): string {
  return (p.name || "").trim().split(/\s+/)[0] || "bonjour";
}

export interface RelanceMail {
  subject: string;
  body: string;
}

/**
 * Le mail de relance — construit AUTOUR de la raison neuve, pas d'un pitch neuf.
 * `raisonNeuve` a déjà écrit la phrase défendable (sans montant, sans « j'ai vu
 * que vous aviez ouvert ») ; on l'habille d'un bonjour et de la divulgation IA
 * (l'envoi est autonome, art. 50). Déterministe, aucun prix.
 */
export function construireRelanceMail(p: Prospect, raison: RaisonNeuve): RelanceMail {
  const subject = raison.source === "prix-honore" ? "Le tarif que je vous ai annoncé reste valable" : "Toujours un sujet chez vous ?";
  const body = [`Bonjour ${prenomDe(p)},`, "", raison.phrase, "", DIVULGATION_ECRITE].join("\n");
  return { subject, body };
}

/**
 * Raccourci pour le tick : la raison neuve d'une fiche, ou `null`. Réexporte
 * `raisonNeuve` avec le contexte d'ouverture, pour que le tick n'ait qu'un appel.
 */
export function raisonRelance(p: Prospect, maintenant: number, ctx: ContexteRaison = {}): RaisonNeuve | null {
  return raisonNeuve(p, maintenant, ctx);
}
