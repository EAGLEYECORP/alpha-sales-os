import type { Prospect } from "./types";
import { LINKEDIN_DAILY_SAFE, linkedinTouchesToday } from "./linkedin";
import { buildLinkedinQueue } from "./linkedin-sequence";
import { buildCallSession } from "./call-session";
import { VERTICALS } from "./playbook";
import { emailRamp } from "./email-ramp";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le volume du jour — le moteur de rentabilité.
 *
 * L'arithmétique, sans illusion : un client signé demande ~5 à 10 vraies
 * conversations ; une conversation demande ~10 à 20 touches utiles. Un
 * client coûte donc 50 à 200 touches. Pour 2 à 4 clients par mois, il
 * faut tenir 60 à 90 touches PAR JOUR, tous canaux confondus.
 *
 * Ce n'est pas le volume d'un outil de cold-email de masse — c'est le
 * volume soutenable d'un opérateur avec une seule boîte d'envoi et un
 * seul profil LinkedIn. Au-delà, on ne gagne pas plus : on grille le
 * domaine et le compte, et on perd tout d'un coup.
 *
 * Ce module calcule ce qui est réellement exécutable aujourd'hui, par
 * canal, en tenant compte des quotas et de ce qui est déjà fait.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Objectif quotidien par défaut, toutes touches confondues. */
export const DEFAULT_DAILY_TARGET = 60;

/**
 * Plafond journalier des appels pour UN opérateur.
 * L'équivalent email n'est PAS une constante : il dépend de la montée en
 * charge de la boîte (voir lib/email-ramp.ts, RAMP_CEILING pour la croisière).
 */
export const CALL_DAILY_SAFE = 30; // au-delà, la qualité de conversation décroche

const TOUCH_KINDS = ["appel", "visite", "email", "whatsapp", "linkedin", "demo", "meeting"] as const;

const isToday = (iso: string) => iso.slice(0, 10) === new Date().toISOString().slice(0, 10);

/** Touches consignées aujourd'hui, tous canaux et toutes fiches. */
export function touchesToday(prospects: Prospect[]): number {
  let n = 0;
  for (const p of prospects) {
    for (const e of p.events) {
      if (isToday(e.date) && (TOUCH_KINDS as readonly string[]).includes(e.kind)) n++;
    }
  }
  return n;
}

function emailsToday(prospects: Prospect[]): number {
  let n = 0;
  for (const p of prospects) {
    for (const e of p.events) if (isToday(e.date) && e.kind === "email") n++;
  }
  return n;
}

function callsToday(prospects: Prospect[]): number {
  let n = 0;
  for (const p of prospects) {
    for (const e of p.events) if (isToday(e.date) && (e.kind === "appel" || e.kind === "visite")) n++;
  }
  return n;
}

export interface ChannelPlan {
  id: "linkedin" | "email" | "appel";
  label: string;
  /** Touches déjà faites aujourd'hui sur ce canal. */
  done: number;
  /** Plafond journalier soutenable. */
  capacity: number;
  /** Fiches réellement prêtes à être touchées maintenant. */
  ready: number;
  /** Ce qu'il reste à faire aujourd'hui = min(capacité restante, prêtes). */
  todo: number;
  href: string;
  /** Pourquoi ce plafond — dit à l'opérateur, pas caché. */
  why: string;
}

export interface DailyPlan {
  target: number;
  done: number;
  /** Total exécutable maintenant, tous canaux. */
  todo: number;
  channels: ChannelPlan[];
  /** L'objectif est atteignable aujourd'hui avec le pipe actuel. */
  reachable: boolean;
  /** Fiches actives disponibles — le vrai carburant. */
  fuel: number;
}

export function buildDailyPlan(prospects: Prospect[], target = DEFAULT_DAILY_TARGET): DailyPlan {
  const active = prospects.filter((p) => p.stage !== "signe" && p.stage !== "perdu");

  // LinkedIn — quota dur, et seules les fiches dont la cadence est mûre.
  const liDone = linkedinTouchesToday(prospects);
  const liReady = buildLinkedinQueue(prospects).filter((t) => t.ready).length;
  const liCapacity = LINKEDIN_DAILY_SAFE;

  // Email — le plafond n'est pas fixe : il dépend de la montée en charge
  // réelle de la boîte. Afficher 40 dès le premier jour reviendrait à
  // conseiller exactement ce qui grille un domaine.
  const ramp = emailRamp(prospects);
  const mailDone = emailsToday(prospects);
  const mailReady = active.filter(
    (p) => p.email?.trim() && !p.events.some((e) => isToday(e.date) && e.kind === "email")
  ).length;

  // Appels — plafond de qualité ; les cibles viennent des sessions par verticale.
  const callDone = callsToday(prospects);
  const callReady = VERTICALS.reduce(
    (sum, v) => sum + buildCallSession(prospects, v.id).targets.filter((t) => !t.prospect.events.some((e) => isToday(e.date) && e.kind === "appel")).length,
    0
  );

  const mk = (
    id: ChannelPlan["id"],
    label: string,
    done: number,
    capacity: number,
    ready: number,
    href: string,
    why: string
  ): ChannelPlan => ({
    id,
    label,
    done,
    capacity,
    ready,
    todo: Math.max(0, Math.min(capacity - done, ready)),
    href,
    why,
  });

  const channels = [
    mk("linkedin", "LinkedIn", liDone, liCapacity, liReady, "/linkedin", "Au-delà de 25 actions/jour, les comptes se font restreindre."),
    mk("email", "Email", mailDone, ramp.today, mailReady, "/newsletter", ramp.why),
    mk("appel", "Appels & visites", callDone, CALL_DAILY_SAFE, callReady, "/appels", "Au-delà de 30 appels, la qualité de conversation chute — et c'est elle qui signe."),
  ];

  const done = touchesToday(prospects);
  const todo = channels.reduce((s, c) => s + c.todo, 0);

  return {
    target,
    done,
    todo,
    channels,
    reachable: done + todo >= target,
    fuel: active.length,
  };
}
