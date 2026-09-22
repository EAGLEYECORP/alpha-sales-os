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
 * fermée à deux créneaux. La divulgation IA CLÔT le corps parce que l'envoi est
 * autonome.
 *
 * ⚠ La signature de l'expéditeur (nom + société) et le pied « STOP » sont
 * ajoutés par le RENDU (`renderEmail`) depuis l'habillage du compte — on ne les
 * met pas ici, sinon ils partiraient en double et échapperaient au white-label.
 */
export function construireMailCold(p: Prospect): MailCold {
  const prenom = prenomDe(p);
  const societe = (p.company || "votre structure").trim();
  const body = [
    `Bonjour ${prenom},`,
    "",
    "Sur un programme neuf, il passe plus de contacts acquéreurs au bureau de " +
      "vente que deux commerciaux ne peuvent en rappeler. Les tièdes — ceux qui " +
      "ont visité, hésité, puis plus de nouvelles — sont ceux qui coûtent le plus " +
      "cher à laisser refroidir.",
    "",
    `${societe} en a forcément une réserve. On a construit un outil qui reprend ce ` +
      "fil tout seul : il relance, qualifie, et ne vous rend que les acquéreurs " +
      "redevenus chauds — pour que vos équipes ne passent leur temps que sur ceux " +
      "qui signent.",
    "",
    "15 minutes pour vous le montrer sur un de vos programmes — plutôt mardi 15h " +
      "ou jeudi 10h ?",
    "",
    // ⚠ Divulgation IA obligatoire (envoi autonome). Importée, jamais recopiée.
    DIVULGATION_ECRITE,
  ].join("\n");
  return { subject: "Vos acquéreurs déjà passés au bureau de vente", body };
}
