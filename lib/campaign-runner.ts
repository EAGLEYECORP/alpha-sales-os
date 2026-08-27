import type { Prospect } from "./types";
import { cadenceFor, cibleDepuisProspect } from "./call-cadence";
import { attemptsFromEvents } from "./master-rappel";
import { vitalSigns } from "./vital-signs";
import { deepDive, briefForScript } from "./deep-dive";
import { buildArgumentaire } from "./argumentaire";
import { callAllowedNow, outboundComplianceGate, toE164, DO_NOT_CALL_TAG, type CallMode } from "./voice-script";
import { CALL_DAILY_SAFE } from "./daily-plan";
import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ORCHESTRATEUR DE CAMPAGNE — le volume, sans perdre la personnalisation.
 *
 * C'est ici que « 1 000 prospects » devient une file d'appels réelle. Le
 * module ne passe AUCUN appel : il décide QUI appeler, DANS QUEL ORDRE,
 * et surtout qui NE PAS appeler. L'exécution reste à la route /api/voice/call.
 *
 * Toutes les portes existantes sont réutilisées, jamais recodées :
 *   · droit d'opposition + cible professionnelle → outboundComplianceGate
 *   · fenêtre horaire → callAllowedNow
 *   · cadence 5 rappels / 2 jours → cadenceFor
 *   · saturation → vitalSigns
 *   · numéro valide → toE164
 *
 * Chaque appel part avec SON script, dérivé du deep-dive de SA fiche. Un
 * script générique envoyé à 1 000 personnes ne convertit pas — c'est la
 * seule chose qui nous distingue vraiment du marché.
 *
 * Un plafond quotidien existe et il est volontaire : au-delà de ~30 appels,
 * la qualité de conversation décroche et on brûle du fichier pour rien.
 * ─────────────────────────────────────────────────────────────────────
 */

export type SkipReason =
  | "opposition"
  | "sature"
  | "cadence-attente"
  | "cadence-epuisee"
  | "a-repondu"
  | "numero-invalide"
  | "hors-icp"
  | "plafond-atteint"
  | "conformite";

export interface CallTask {
  prospectId: string;
  company: string;
  /** Numéro composable (E.164). */
  phone: string;
  /** Rang dans la file — 1 = à appeler en premier. */
  rank: number;
  /** Rappel n°X sur 5, ou 0 pour le premier appel. */
  recallIndex: number;
  /** Score de priorité (readiness + chaleur du deep-dive). */
  priority: number;
  /** Le brief personnalisé injecté dans le script vocal. */
  brief: string;
  /** L'objectif unique de CET appel. */
  objective: string;
  /** Compte au nom duquel on appelle. */
  accountId: string;
  /**
   * ── L'OFFRE REPRÉSENTÉE, ET LE MAILLON QUI LA LAISSAIT TOMBER ──
   *
   * `deepDive` la calcule déjà, contrainte aux offres autorisées du compte, et
   * `briefForScript` l'écrit en toutes lettres dans le brief. Mais la tâche
   * d'appel ne transportait que le brief : le script vocal, lui, annonçait
   * « un audit de leur accueil téléphonique » en dur, c'est-à-dire Callflow,
   * quel que soit le routage.
   *
   * Un prospect routé vers la visibilité partait donc avec un RÔLE Callflow et
   * un DOSSIER visibilité dans le même prompt. Le champ existe pour que
   * l'offre arrive jusqu'à l'agent, et pas seulement jusqu'à la prose.
   */
  offre: EagleyeOffer;
  /** Ce qu'il faut absolument récolter pendant l'appel. */
  mustCapture: string[];
}

export interface SkippedCall {
  prospectId: string;
  company: string;
  reason: SkipReason;
  detail: string;
}

export interface CampaignRun {
  /** La file d'appels, prête à exécuter. */
  queue: CallTask[];
  /** Ce qui a été écarté, avec la raison — la transparence évite les surprises. */
  skipped: SkippedCall[];
  /** La fenêtre horaire est-elle ouverte ? */
  windowOpen: boolean;
  windowWhy: string;
  /** Plafond quotidien appliqué. */
  dailyCap: number;
  /** Appels déjà passés aujourd'hui (comptés depuis la timeline). */
  alreadyToday: number;
  summary: string;
}

export interface RunOptions {
  now?: Date;
  accountId?: string;
  mode?: CallMode;
  /** Plafond quotidien — défaut : le seuil au-delà duquel la qualité décroche. */
  dailyCap?: number;
  /** Forcer hors fenêtre horaire (démo calée un samedi, ça arrive). */
  forceWindow?: boolean;
  /**
   * Historique de conversation par prospect (transcriptions des appels
   * précédents, via conversationContext()). Injecté dans le brief : c'est ce
   * qui rend le contexte CUMULATIF d'un appel à l'autre.
   */
  historyByProspect?: Record<string, string>;
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Appels déjà passés aujourd'hui, tous prospects confondus. */
export function callsMadeToday(prospects: Prospect[], now: Date): number {
  let n = 0;
  for (const p of prospects) {
    for (const e of p.events ?? []) {
      if (e.kind === "appel" && isSameDay(new Date(e.date), now)) n += 1;
    }
  }
  return n;
}

/**
 * Construit la file d'appels d'une campagne.
 *
 * L'ordre est : ce qui est le plus près de signer d'abord. Un rappel dû sur
 * un prospect chaud passe avant un premier appel sur un prospect froid —
 * la campagne sert à CLOSER, pas à épuiser un fichier.
 */
export function buildCampaignRun(prospects: Prospect[], opts: RunOptions = {}): CampaignRun {
  const now = opts.now ?? new Date();
  const accountId = opts.accountId ?? "eagleye";
  const mode: CallMode = opts.mode ?? "prospection-b2b";
  const dailyCap = opts.dailyCap ?? CALL_DAILY_SAFE;

  const window = callAllowedNow(now);
  const windowOpen = window.allowed || opts.forceWindow === true;

  const alreadyToday = callsMadeToday(prospects, now);
  let budget = Math.max(0, dailyCap - alreadyToday);

  const queue: CallTask[] = [];
  const skipped: SkippedCall[] = [];
  const push = (p: Prospect, reason: SkipReason, detail: string) =>
    skipped.push({ prospectId: p.id, company: p.company, reason, detail });

  // ── 1. Filtrage : on écarte AVANT de trier, pour ne pas classer du vide ──
  interface Candidate { p: Prospect; priority: number; recallIndex: number; brief: string; objective: string; mustCapture: string[]; phone: string; offre: EagleyeOffer }
  const candidates: Candidate[] = [];

  for (const p of prospects) {
    if (p.stage === "signe" || p.stage === "perdu") continue;

    // Droit d'opposition + cible professionnelle : porte dure, non contournable.
    const optedOut = (p.tags ?? []).includes(DO_NOT_CALL_TAG);
    const gate = outboundComplianceGate({ mode, isProfessional: true, optedOut, now });
    if (!gate.ok) {
      push(p, optedOut ? "opposition" : "conformite", gate.blockers.join(" "));
      continue;
    }

    const phone = toE164(p.phone ?? "");
    if (!phone) {
      push(p, "numero-invalide", p.phone ? `Numéro inexploitable : « ${p.phone} »` : "Aucun numéro sur la fiche.");
      continue;
    }

    /**
     * Cadence : c'est elle qui dit si un appel est dû MAINTENANT.
     *
     * ⚠ La CIBLE est passée, pas seulement les tentatives. Sans elle, le
     * plafond légal ne s'applique jamais : `plafondRappels` ne peut pas savoir
     * si le prospect est une entreprise inscrite (SIREN) ou un artisan en nom
     * propre sur son mobile. Le runner appelait sans cible, donc la cadence
     * longue partait sur tout le monde.
     *
     * Le SIREN se lit dans les notes : c'est là que l'import terrain l'écrit
     * après croisement avec le registre.
     */
    const cadence = cadenceFor(attemptsFromEvents(p), now, cibleDepuisProspect(p));
    if (cadence.state === "repondu-passer-humain") {
      push(p, "a-repondu", "Il a répondu — Alpha Voice s'arrête, la main est au closer.");
      continue;
    }
    if (cadence.state === "stop-definitif") {
      push(p, "opposition", cadence.reason);
      continue;
    }
    if (cadence.state === "epuisee") {
      push(p, "cadence-epuisee", cadence.reason);
      continue;
    }
    if (!cadence.callNow) {
      push(p, "cadence-attente", cadence.reason);
      continue;
    }

    // Saturation : un prospect saturé qu'on rappelle est un prospect brûlé.
    const signs = vitalSigns(p, now);
    if (signs.fatigueLevel === "sature") {
      push(p, "sature", `${signs.unansweredTouches} relances sans réponse — ${signs.bestWindow.why}`);
      continue;
    }

    // Deep-dive : le script de CET appel, et la valeur de la fiche.
    const dive = deepDive(p, accountId);
    if (dive.fit === "hors-icp") {
      push(p, "hors-icp", `Fiche trop pauvre (${dive.score}/100) — à compléter avant d'appeler.`);
      continue;
    }

    const argu = buildArgumentaire(p, accountId);
    const brief = [
      briefForScript(dive, p, opts.historyByProspect?.[p.id]),
      "",
      "Questions qui font constater (poser, puis SE TAIRE) :",
      ...argu.questions.map((q) => `- ${q}`),
    ].join("\n");

    // La priorité mêle l'imminence du closing et la qualité de la fiche.
    const priority = Math.round(signs.readiness * 0.6 + dive.score * 0.4);

    candidates.push({
      p,
      priority,
      recallIndex: cadence.recallsUsed,
      brief,
      // L'offre vient du MÊME `deepDive` que le brief : une seule décision,
      // pas deux qui peuvent diverger.
      offre: dive.offer,
      objective: dive.objective,
      mustCapture: dive.gaps.slice(0, 4),
      phone,
    });
  }

  // ── 2. Tri : le plus près de signer d'abord ──
  candidates.sort((a, b) => b.priority - a.priority);

  // ── 3. Plafond quotidien : la qualité de conversation avant le volume ──
  for (const c of candidates) {
    if (budget <= 0) {
      push(c.p, "plafond-atteint", `Plafond de ${dailyCap} appels/jour atteint — au-delà, la qualité de conversation décroche.`);
      continue;
    }
    queue.push({
      prospectId: c.p.id,
      company: c.p.company,
      phone: c.phone,
      rank: queue.length + 1,
      recallIndex: c.recallIndex,
      priority: c.priority,
      brief: c.brief,
      objective: c.objective,
      accountId,
      // La même offre que celle écrite dans le brief — une seule décision,
      // prise par `deepDive`, portée jusqu'au script.
      offre: c.offre,
      mustCapture: c.mustCapture,
    });
    budget -= 1;
  }

  const summary = !windowOpen
    ? `File prête (${queue.length} appels) mais la fenêtre est fermée : ${window.why}`
    : queue.length === 0
      ? `Aucun appel à passer maintenant. ${skipped.length} fiche(s) écartée(s) — voir les raisons.`
      : `${queue.length} appel(s) à passer${alreadyToday > 0 ? ` (${alreadyToday} déjà passés aujourd'hui)` : ""}. ` +
        `${skipped.length} écartée(s).`;

  return { queue, skipped, windowOpen, windowWhy: window.why, dailyCap, alreadyToday, summary };
}

/** Répartition des écarts par raison — pour comprendre ce qui bloque le volume. */
export function skipBreakdown(run: CampaignRun): { reason: SkipReason; count: number }[] {
  const m = new Map<SkipReason, number>();
  for (const s of run.skipped) m.set(s.reason, (m.get(s.reason) ?? 0) + 1);
  return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export const SKIP_LABELS: Record<SkipReason, string> = {
  opposition: "Droit d'opposition — ne jamais rappeler",
  sature: "Saturé — laisser respirer",
  "cadence-attente": "Rappel pas encore dû",
  "cadence-epuisee": "5 rappels épuisés — changer de canal",
  "a-repondu": "A répondu — la main est au closer",
  "numero-invalide": "Numéro absent ou inexploitable",
  "hors-icp": "Fiche trop pauvre — à compléter",
  "plafond-atteint": "Plafond quotidien atteint",
  conformite: "Bloqué par la conformité",
};
