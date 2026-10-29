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

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE SUITE DE CONVERSATION N'EST PAS UN RECONTACT (29/10/2026).
 *
 * `/api/send` refuse en 409 toute adresse écrite dans les 14 derniers jours
 * (la fenêtre de recontact). Juste pour un PREMIER message : deux campagnes ne
 * doivent pas tomber sur la même boîte. Fatal pour tout le reste — mesuré en
 * suivant le pilote automatique d'un inscrit jusqu'au serveur : la réponse
 * « voici trois créneaux » part quelques jours après le premier message, donc
 * DANS la fenêtre, et chaque relance aussi (72 h, 96 h, 168 h < 14 j). La
 * chaîne cassait au moment exact où le prospect disait oui, et le rendu ne le
 * montrait pas : `/api/send` y était simulé.
 *
 * Le pilote du maître ne l'a jamais vu : ses ticks serveur envoient par le
 * transport direct, sans passer par cette fenêtre.
 *
 * ⚠⚠ `force` N'ÉTAIT PAS LA RÉPONSE. Il passe AUSSI outre le score anti-spam,
 * et ne borne rien. `suite` est plus ÉTROIT, et le serveur le borne lui-même
 * sur SON historique d'envoi (jamais sur ce que dit le navigateur) :
 *  · `reponse` — exige qu'on ait DÉJÀ écrit à cette adresse sur 60 jours.
 *    Sinon ce n'est pas une réponse, c'est un premier message déguisé.
 *  · `relance` — rejoue `relanceDue` sur l'historique du serveur : plafond
 *    légal (décret 2022-1313) et espacement. La raison neuve, le serveur ne
 *    peut pas la voir ; l'appelant l'a tranchée, et elle est dans le texte.
 * Base muette ⇒ historique vide ⇒ REFUS, dans les deux cas. Le doute penche
 * vers le silence, comme partout ici.
 * ─────────────────────────────────────────────────────────────────────
 */
export type SuiteConversation = "reponse" | "relance";

/** Une réponse suppose un message de notre part sur cette fenêtre. */
export const FENETRE_REPONSE_MS = 60 * 86_400_000;
/** Le plafond légal se compte sur 30 jours glissants. */
export const FENETRE_RELANCE_MS = 30 * 86_400_000;

export type DecisionRecontact =
  | { ok: true; motif: string }
  | { ok: false; motif: string; alreadyContacted: boolean };

export function decisionRecontact(opts: {
  suite?: SuiteConversation;
  force: boolean;
  /** L'adresse est-elle dans la fenêtre de recontact (premier message) ? */
  dejaContacte: boolean;
  /** Historique serveur sur la fenêtre de la suite demandée. */
  historique: { count: number; dernierISO: string | null };
  maintenant: number;
}): DecisionRecontact {
  if (opts.suite === "reponse") {
    return opts.historique.count > 0
      ? { ok: true, motif: "Réponse dans une conversation ouverte — la fenêtre de recontact ne s'applique pas." }
      : { ok: false, alreadyContacted: false, motif: "Aucun message de notre part vers cette adresse sur 60 jours : ce n'est pas une réponse." };
  }
  if (opts.suite === "relance") {
    const d = relanceDue({
      nbContacts30j: opts.historique.count,
      dernierEnvoiISO: opts.historique.dernierISO,
      aRepondu: false,
      raisonDisponible: true,
      maintenant: opts.maintenant,
    });
    return d.du ? { ok: true, motif: d.motif } : { ok: false, alreadyContacted: false, motif: `Relance refusée : ${d.motif}` };
  }
  if (opts.dejaContacte && !opts.force) {
    return { ok: false, alreadyContacted: true, motif: "Déjà contacté dans la fenêtre de recontact." };
  }
  return { ok: true, motif: "Premier message." };
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
