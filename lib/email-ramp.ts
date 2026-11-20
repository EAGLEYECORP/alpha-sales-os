import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * La montée en charge des envois — ce que la boîte supporte AUJOURD'HUI.
 *
 * Une boîte qui n'a jamais fait de sortant et qui part à 40 emails par
 * jour se fait classer en spam, souvent sans le moindre signal visible.
 * Ce n'est pas une question de domaine neuf ou ancien : la réputation
 * d'envoi se construit par SCHÉMA. Un compte personnel vieux de dix ans
 * qui passe soudain à 120 messages sortants vers des inconnus est
 * exactement l'anomalie que les filtres cherchent.
 *
 * Les plateformes du marché (Instantly, Smartlead) résolvent ça avec un
 * réseau de warmup et une rotation de boîtes. ALPHA n'a ni l'un ni
 * l'autre — c'est écrit noir sur blanc dans docs/MARCHE.md §3. Ce qui
 * reste, et qui marche, c'est la discipline : monter par paliers.
 *
 * Ce module calcule le plafond du jour à partir de la DATE DU PREMIER
 * ENVOI réellement consigné dans le CRM. Pas d'un réglage déclaratif :
 * on ne peut pas se mentir sur l'ancienneté d'une montée en charge.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Point de départ : ce qu'une boîte encaisse sans historique de sortant. */
export const RAMP_START = 5;
/** Palier ajouté chaque semaine tenue. */
export const RAMP_STEP = 5;
/** Plafond soutenable pour UNE boîte, quelle que soit l'ancienneté. */
export const RAMP_CEILING = 40;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA BOÎTE DÉJÀ CHAUDE — 100/jour, et seulement pour une boîte DÉCLARÉE
 * (décision de Zakaria, 20/11/2026).
 *
 * Le barème ci-dessus suppose une boîte SANS historique de sortant : c'est le
 * seul cas où le premier envoi consigné dit l'âge de la réputation. Une boîte
 * qui écrit depuis des années à des humains, et à qui des humains répondent,
 * n'a pas cet âge-là — la brider à 5/jour la confond avec une boîte neuve.
 *
 * ⚠ « Chaude » se DÉCLARE, elle ne se devine pas, et la déclaration vise
 * l'ADRESSE qui envoie réellement (`from` du SMTP résolu), jamais le compte :
 * un inscrit qui branche sa boîte neuve garde 5/jour, même sur notre serveur.
 * La liste : `BOITES_RECHAUFFEES_DECLAREES` + la variable `BOITES_RECHAUFFEES`
 * (adresses séparées par des virgules).
 *
 * ⚠ CE QUE ÇA NE CHANGE PAS : chaude pour de la correspondance n'est pas
 * chaude pour de la prospection. Le schéma change quand même (des inconnus,
 * en série), et `contact@` porte aussi les confirmations d'inscription : une
 * vague de plaintes les fait tomber avec. Le plafond horaire
 * (`MAX_SENDS_PER_HOUR`) reste, et 100 reste un PLAFOND, jamais un objectif.
 * ─────────────────────────────────────────────────────────────────────
 */
export const PALIER_BOITE_RECHAUFFEE = 100;
export const BOITES_RECHAUFFEES_DECLAREES: readonly string[] = ["contact@eagleyecorp.fr"];

/** L'adresse nue d'un `from` (« Nom <a@b.fr> » → « a@b.fr »), en minuscules. */
export function adresseNue(from: string | null | undefined): string {
  const brut = (from ?? "").trim();
  return (brut.match(/<([^>]+)>/)?.[1] ?? brut).trim().toLowerCase();
}

/** Cette adresse d'envoi est-elle déclarée chaude ? Inconnue ou vide ⇒ non. */
export function boiteRechauffee(from: string | null | undefined, declarees: string | undefined = process.env.BOITES_RECHAUFFEES): boolean {
  const a = adresseNue(from);
  if (!a || !a.includes("@")) return false;
  const liste = [...BOITES_RECHAUFFEES_DECLAREES, ...(declarees ?? "").split(",")].map((x) => adresseNue(x)).filter(Boolean);
  return liste.includes(a);
}

export interface EmailRamp {
  /** Plafond applicable aujourd'hui. */
  today: number;
  /** Semaines pleines depuis le premier envoi consigné. */
  weeks: number;
  /** Aucun envoi consigné : la montée n'a pas commencé. */
  fresh: boolean;
  /** Le plafond de croisière est atteint. */
  ceiling: boolean;
  /** Jours restants avant le palier suivant (0 si au plafond). */
  daysToNext: number;
  /** Ce que sera le palier suivant (= today si déjà au plafond). */
  next: number;
  /** Dit à l'opérateur, pas caché. */
  why: string;
}

/** Date du premier email consigné, tous prospects confondus. */
export function firstEmailDate(prospects: Prospect[]): string | null {
  let first: string | null = null;
  for (const p of prospects) {
    for (const e of p.events) {
      if (e.kind === "email" && (!first || e.date < first)) first = e.date;
    }
  }
  return first;
}

const DAY = 86_400_000;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BARÈME, EXTRAIT POUR N'EXISTER QU'UNE FOIS.
 *
 * ⚠ IL ÉTAIT ENFERMÉ DANS `emailRamp`, QUI PREND DES `Prospect[]` — donc
 * inatteignable depuis le serveur, qui n'a pas le CRM du navigateur.
 *
 * Conséquence, mesurée avant d'écrire ces lignes : la montée en charge coupait
 * la FILE de l'écran `/outbox` et rien d'autre. `/api/send` ne connaissait que
 * `MAX_SENDS_PER_HOUR` (40/h) — un autre appelant (revue de campagne,
 * newsletter, recette) pouvait donc dépasser le palier du jour sans que rien
 * ne le voie. Le palier tenait par l'USAGE, pas par une contrainte.
 *
 * Le refactor est minuscule et c'est tout l'intérêt : il n'y a pas deux
 * barèmes à tenir d'accord. L'écran passe par les fiches, le serveur passe par
 * la date du premier envoi consigné en base, et les deux traversent CETTE
 * fonction.
 * ─────────────────────────────────────────────────────────────────────
 */
export function rampDepuisPremierEnvoi(first: string | null, now = new Date(), opts: { rechauffee?: boolean } = {}): EmailRamp {
  if (opts.rechauffee) {
    return {
      today: PALIER_BOITE_RECHAUFFEE,
      weeks: 0,
      fresh: false,
      ceiling: true,
      daysToNext: 0,
      next: PALIER_BOITE_RECHAUFFEE,
      why: `Boîte déclarée déjà chaude (des années de correspondance) : plafond ${PALIER_BOITE_RECHAUFFEE}/jour. Une boîte neuve, elle, démarre à ${RAMP_START}/jour. Surveille les réponses « STOP » et les rebonds : c'est là que la réputation se lit.`,
    };
  }
  if (!first) {
    return {
      today: RAMP_START,
      weeks: 0,
      fresh: true,
      ceiling: false,
      daysToNext: 7,
      next: RAMP_START + RAMP_STEP,
      why: `Aucun envoi consigné : la boîte n'a pas d'historique de sortant. On démarre à ${RAMP_START}/jour. Partir plus haut, c'est se faire classer sans même le voir.`,
    };
  }

  const days = Math.max(0, Math.floor((now.getTime() - new Date(first).getTime()) / DAY));
  const weeks = Math.floor(days / 7);
  const today = Math.min(RAMP_CEILING, RAMP_START + weeks * RAMP_STEP);
  const ceiling = today >= RAMP_CEILING;

  return {
    today,
    weeks,
    fresh: false,
    ceiling,
    daysToNext: ceiling ? 0 : 7 - (days % 7),
    next: ceiling ? RAMP_CEILING : Math.min(RAMP_CEILING, today + RAMP_STEP),
    why: ceiling
      ? `Plafond de croisière atteint : ${RAMP_CEILING}/jour sur une seule boîte. Au-delà, on ne gagne pas plus — on grille le domaine et on perd tout d'un coup. Pour aller plus haut, il faut plusieurs boîtes et une rotation, qui n'existent pas dans ALPHA.`
      : `${weeks} semaine${weeks > 1 ? "s" : ""} depuis le premier envoi : plafond ${today}/jour. Palier suivant (${
          RAMP_START + (weeks + 1) * RAMP_STEP > RAMP_CEILING ? RAMP_CEILING : RAMP_START + (weeks + 1) * RAMP_STEP
        }/jour) dans ${7 - (days % 7)} jour${7 - (days % 7) > 1 ? "s" : ""}.`,
  };
}

/**
 * Le plafond du jour, vu depuis le NAVIGATEUR : la date du premier envoi se
 * lit dans les timelines des fiches.
 */
export function emailRamp(prospects: Prospect[], now = new Date()): EmailRamp {
  return rampDepuisPremierEnvoi(firstEmailDate(prospects), now);
}

/**
 * Le palier vu du SERVEUR, pour la boîte qui envoie vraiment. Une seule
 * définition pour `/api/send` et les ticks : `from` absent ⇒ barème neuf.
 */
export function rampServeur(first: string | null, from: string | null | undefined, now = new Date()): EmailRamp {
  return rampDepuisPremierEnvoi(first, now, { rechauffee: boiteRechauffee(from) });
}

/** L'adresse d'envoi de NOTRE boîte, lue dans l'environnement (ticks sans SMTP résolu). */
export function fromMaison(): string | undefined {
  return process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || undefined;
}

/**
 * Combien de boîtes il faudrait pour tenir un objectif — et le dire
 * plutôt que de laisser croire qu'une seule y arrivera.
 */
export function mailboxesNeeded(target: number): number {
  return Math.max(1, Math.ceil(target / RAMP_CEILING));
}
