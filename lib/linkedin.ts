import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LinkedIn — canal de prospection ASSISTÉ, jamais automatisé.
 *
 * Décision d'architecture (assumée) : PAS de bot qui se connecte avec
 * tes identifiants. LinkedIn détecte et bannit ces comptes (Linked
 * Helper, PhantomBuster & co), et ton profil est un actif commercial
 * irremplaçable. À la place, le même patron que WhatsApp (wa.me) :
 *   l'app PRÉPARE tout (message calibré, lien direct, quota du jour)
 *   → un clic ouvre LinkedIn au bon endroit, le message est dans le
 *   presse-papier → TU colles et envoies. ~15 s par touche, 100 %
 *   conforme, indétectable — parce que c'est réellement toi.
 *
 * Passage à l'échelle (documenté dans docs/MULTICANAL.md) : API tierces
 * légitimes type Unipile/HeyReach (payantes, compte connecté côté
 * fournisseur) — branchables plus tard via n8n sans changer l'app.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Quota prudent d'actions LinkedIn sortantes par jour (invitations + DM).
 *  Les comptes neufs/basiques se font restreindre au-delà de ~25-30/j. */
export const LINKEDIN_DAILY_SAFE = 25;

/** URL cible : le profil stocké sur la fiche, sinon la recherche de personnes. */
export function linkedinUrl(p: Prospect): string {
  const direct = p.linkedin?.trim();
  if (direct) {
    // tolère « linkedin.com/in/x » sans protocole
    return /^https?:\/\//i.test(direct) ? direct : `https://${direct.replace(/^\/+/, "")}`;
  }
  const q = [p.name, p.company, p.city].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

/** Touches LinkedIn effectuées AUJOURD'HUI (événements timeline, tous prospects). */
export function linkedinTouchesToday(prospects: Prospect[]): number {
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const p of prospects) {
    for (const e of p.events) {
      if (e.kind === "linkedin" && e.date.slice(0, 10) === today) n++;
    }
  }
  return n;
}

/** Message d'invitation LinkedIn : la limite dure est 300 caractères. */
export const LINKEDIN_INVITE_LIMIT = 300;

const JOUR = 86_400_000;

/**
 * Touches LinkedIn sur les 7 DERNIERS JOURS.
 *
 * C'est l'unité que LinkedIn compte réellement. Le compteur journalier seul
 * laissait passer 125 invitations dans la semaine : voir `linkedin-plan.ts`.
 */
export function linkedinTouchesSemaine(prospects: Prospect[], now = new Date()): number {
  const debut = now.getTime() - 7 * JOUR;
  let n = 0;
  for (const p of prospects) {
    for (const e of p.events) {
      if (e.kind !== "linkedin") continue;
      const t = new Date(e.date).getTime();
      if (Number.isFinite(t) && t >= debut && t <= now.getTime()) n++;
    }
  }
  return n;
}

/**
 * Depuis combien de semaines ce compte envoie-t-il ?
 *
 * Sert à piloter la rampe de montée en charge : un compte qui n'envoyait rien
 * ne passe pas à plein régime du jour au lendemain. On le déduit de la
 * PREMIÈRE touche consignée plutôt que d'un réglage — un réglage se met à 10
 * le jour où la file paraît longue, une date ne se négocie pas.
 */
export function semaineCampagne(prospects: Prospect[], now = new Date()): number {
  let premiere = Infinity;
  for (const p of prospects) {
    for (const e of p.events) {
      if (e.kind !== "linkedin") continue;
      const t = new Date(e.date).getTime();
      if (Number.isFinite(t) && t < premiere) premiere = t;
    }
  }
  if (!Number.isFinite(premiere)) return 0;
  return Math.max(0, Math.floor((now.getTime() - premiere) / (7 * JOUR)));
}
