/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTOPILOTE D'ENVOI À FROID — la partie PURE et testable.
 *
 * Décidé le 22/09/2026. Le propriétaire veut que l'APP envoie les campagnes à
 * froid toute seule, pour sortir de la boucle. Ce module porte les deux
 * décisions qui ne dépendent d'aucune base : QUI est éligible à un premier mail
 * à froid, et QUEL texte part. La route `/api/campaign/mail-tick` fait l'I/O
 * (lire les prospects, les gardes de délivrabilité, l'envoi SMTP).
 *
 * ⚠⚠ L'ENVOI AUTONOME PORTE LA DIVULGATION IA, ET CE N'EST PAS NÉGOCIABLE.
 * Un message « rédigé ET envoyé sans relecture humaine » relève de l'article 50
 * du règlement IA (applicable depuis le 02/08/2026) : l'interlocuteur doit
 * savoir qu'il parle à une IA. On IMPORTE la phrase (`DIVULGATION_ECRITE`), on
 * ne la recopie pas, et on la met DANS le corps — sinon `verifieDivulgation`
 * refuse l'envoi. Conséquence assumée et dite au propriétaire : un mail
 * autonome sonne différemment d'un mail qu'un humain a relu. Qui veut le pitch
 * sans l'aveu doit relire lui-même (mode `valide-par-humain`), donc ne pas
 * automatiser. On ne contourne pas la loi pour mieux vendre.
 *
 * ⚠ LE TEXTE EST FIXE, PAS ENGENDRÉ PAR UN MODÈLE. Un script à froid n'a droit
 * à aucune improvisation (doctrine de l'appel à froid), et auto-envoyer du
 * texte non relu écrit par un modèle est précisément ce qu'on refuse pour les
 * réponses (`lib/reponse-auto.ts`). Ici le gabarit est déterministe, conforme à
 * la verticale maîtrise d'ouvrage : l'angle est « les acquéreurs déjà passés au
 * bureau de vente que personne n'a rappelés », JAMAIS « vous ratez des appels ».
 * ─────────────────────────────────────────────────────────────────────
 */

import type { Prospect } from "@/lib/types";
import { DIVULGATION_ECRITE } from "@/lib/signature-ia";
import { estAdresseDeDemo } from "@/lib/seed";
import { aRefuseTouteRelance } from "@/lib/voice-script";

/**
 * Tag posé à l'import sur une fiche qui a DÉJÀ reçu un premier mail par un autre
 * canal (Gmail, outil tiers). Exporté : l'import et les tests le posent, jamais
 * recopié en dur.
 */
export const TAG_DEJA_ECRIT = "deja-ecrit-hors-alpha";

/** Les stades depuis lesquels un PREMIER mail à froid a du sens. */
const STADES_FROID: ReadonlySet<Prospect["stage"]> = new Set(["prospect", "contact"]);

/** Un email a-t-il la forme minimale d'une adresse ? (pas de validation réseau) */
function ressembleAUnEmail(email: string): boolean {
  const e = email.trim();
  return e.length >= 5 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

export interface Eligibilite {
  ok: boolean;
  /** Pourquoi non — utile au plan de tri du tick (jamais décoratif). */
  raison: string;
}

/**
 * Ce prospect peut-il recevoir un premier mail à froid MAINTENANT ?
 *
 * ⚠ Ce prédicat est COARSE : il écarte l'inéligible évident (pas d'email,
 * fiche de démo, refus explicite, mauvais stade). La dédup fine « déjà écrit »
 * et le palier du jour vivent dans la route (ils exigent la base). On ne
 * dédouble pas ces règles ici — elles ont UNE définition, côté serveur.
 */
export function eligibleColdMail(p: Prospect): Eligibilite {
  const email = (p.email ?? "").trim();
  if (!email) return { ok: false, raison: "pas d'email" };
  if (!ressembleAUnEmail(email)) return { ok: false, raison: "email invalide" };
  // Écrire à une fiche de démo produit un rebond dur — la même garde qu'à
  // l'envoi (`/api/send`), posée en amont pour ne pas la tenter.
  if (estAdresseDeDemo(email)) return { ok: false, raison: "adresse de démonstration" };
  if (aRefuseTouteRelance(p)) return { ok: false, raison: "a demandé à ne plus être contacté" };
  if (!STADES_FROID.has(p.stage)) return { ok: false, raison: `stade « ${p.stage} » — pas un premier contact` };
  // ⚠⚠ DÉJÀ ÉCRIT AILLEURS QU'ICI (30/09/2026). La dédup de la route ne voit
  // que les envois TRACÉS par Alpha. Les premiers mails partis d'un autre canal
  // (une boîte Gmail, un outil tiers, un envoi à la main) n'y laissent aucune
  // trace — et la fiche, restée au stade « contact », repassait éligible : le
  // même promoteur recevait un DEUXIÈME premier mail. Un événement email sur la
  // fiche, ou le tag posé à l'import, suffit à dire « ce n'est plus un premier
  // contact ». L'inverse (écrire deux fois le même premier mail) ne se rattrape pas.
  if (p.tags.includes(TAG_DEJA_ECRIT)) return { ok: false, raison: "déjà écrit hors Alpha (tag)" };
  if ((p.events ?? []).some((e) => e.kind === "email")) return { ok: false, raison: "déjà un email dans l'historique" };
  return { ok: true, raison: "" };
}

export interface MailCold {
  subject: string;
  body: string;
}

/** Le prénom pour l'accroche, ou un « bonjour » neutre si le nom manque. */
function prenomDe(p: Prospect): string {
  const prenom = (p.name || "").trim().split(/\s+/)[0];
  return prenom || "bonjour";
}

/**
 * Le gabarit à froid pour la verticale maîtrise d'ouvrage. Déterministe,
 * conforme à la verticale (angle acquéreurs refroidis, aucun prix, aucune
 * mention de permis/adresse/lots à froid), objectif unique = le RDV, question
 * fermée à deux options de moment. La divulgation IA CLÔT le corps parce que l'envoi est
 * autonome.
 *
 * ⚠ La signature de l'expéditeur (nom + société) et le pied « STOP » sont
 * ajoutés par le RENDU (`renderEmail`) depuis l'habillage du compte — on ne les
 * met pas ici, sinon ils partiraient en double et échapperaient au white-label.
 */
export function construireMailCold(p: Prospect): MailCold {
  const prenom = prenomDe(p);
  // ⚠ 30/09/2026 — le texte rejoint celui qui part RÉELLEMENT depuis la routine
  // (feuille « Modèles ») : une question que le prospect peut vérifier chez lui,
  // puis l'offre PILOTE (30 jours, un seul programme) — un chèque d'installation
  // à froid ne se signe pas, un essai borné si. Ce qu'on a retiré, et pourquoi :
  // · « X en a forcément une réserve » affirmait un fait sur SA société qu'on
  //   n'a pas constaté ;
  // · « mardi 15h ou jeudi 10h » étaient des créneaux FIGÉS, faux le jour où le
  //   mail part un mercredi soir — et jamais vérifiés contre l'agenda.
  const body = [
    `Bonjour ${prenom},`,
    "",
    "Je m'adresse aux maîtres d'ouvrage de la région qui ont un programme en " +
      "cours de commercialisation, avec une question précise : un acquéreur qui a " +
      "visité il y a trois semaines et que personne n'a rappelé, comment le " +
      "sauriez-vous aujourd'hui ?",
    "",
    "C'est ce que nous installons : le système qui tient la liste des acquéreurs " +
      "à votre place. Le même principe qu'un planning de chantier : on ne le " +
      "regarde pas pour savoir ce qui est fait, mais pour voir ce qui a pris du retard.",
    "",
    "Je vous propose de le tester 30 jours sur un seul de vos programmes. Quinze " +
      "minutes en visio pour vous le montrer : plutôt fin de semaine ou début de " +
      "la prochaine ?",
    "",
    // ⚠ Divulgation IA obligatoire (envoi autonome). Importée, jamais recopiée.
    DIVULGATION_ECRITE,
  ].join("\n");
  return { subject: "Vos acquéreurs déjà passés au bureau de vente", body };
}
