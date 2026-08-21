import type { Prospect, TimelineEvent } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TICK DE CAMPAGNE — la partie PURE du déclencheur automatique.
 *
 * ⚠ LE DANGER À COMPRENDRE AVANT DE LIRE LE RESTE.
 *
 * La cadence de rappel se déduit de la TIMELINE du prospect
 * (`attemptsFromEvents`). Un appel automatique qui part sans écrire son
 * événement en retour est invisible au tick suivant : la machine rappellerait
 * la même personne, encore et encore, toutes les heures.
 *
 * C'est le pire bug possible dans cet outil — pas une gêne technique, un
 * harcèlement téléphonique. La règle est donc absolue :
 *
 *   ÉCRIRE L'ÉVÉNEMENT D'ABORD, DÉCLENCHER L'APPEL ENSUITE.
 *
 * En cas de crash entre les deux, on aura un appel enregistré qui n'a pas eu
 * lieu — un manque à gagner. L'ordre inverse produirait un appel non
 * enregistré, donc répété. On préfère perdre un appel que d'en répéter un.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Plafond DUR par tick, quoi que demande l'appelant. */
export const MAX_CALLS_PER_TICK = 5;

/**
 * Ajoute la tentative d'appel à la timeline. Le résumé est volontairement
 * neutre (« Appel automatique — en attente du résultat ») : `attemptsFromEvents`
 * le lira comme « sans-reponse », ce qui fait avancer la cadence sans jamais
 * conclure à tort qu'il a répondu. Le vrai résultat arrivera par le journal
 * de session (transcription) et corrigera la fiche.
 */
export function appendCallAttempt(p: Prospect, at: Date = new Date()): Prospect {
  const ev: TimelineEvent = {
    id: `auto-${at.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    date: at.toISOString(),
    kind: "appel",
    summary: "Appel automatique — en attente du résultat",
  };
  return {
    ...p,
    events: [ev, ...(p.events ?? [])],
    updatedAt: at.toISOString(),
  };
}

/** Cet appel a-t-il DÉJÀ été tenté automatiquement dans la dernière heure ? */
export function calledRecently(p: Prospect, now: Date = new Date(), withinMs = 3600_000): boolean {
  return (p.events ?? []).some(
    (e) => e.kind === "appel" && now.getTime() - new Date(e.date).getTime() < withinMs
  );
}

export interface TickPlan {
  /** Les prospects retenus pour CE tick, déjà plafonnés. */
  take: string[];
  /** Ceux qu'on écarte parce qu'ils viennent d'être appelés. */
  tooSoon: string[];
  /** Plafond réellement appliqué. */
  cap: number;
}

/**
 * Ce que le tick doit réellement appeler : la tête de file, plafonnée, et
 * débarrassée de tout prospect déjà touché dans l'heure.
 *
 * Ce double garde-fou est volontairement redondant avec la cadence : en
 * automatique, une seule ligne de défense ne suffit pas.
 */
export function planTick(
  queueIds: string[],
  prospects: Prospect[],
  opts: { max?: number; now?: Date } = {}
): TickPlan {
  const now = opts.now ?? new Date();
  const cap = Math.min(MAX_CALLS_PER_TICK, Math.max(0, opts.max ?? MAX_CALLS_PER_TICK));
  const byId = new Map(prospects.map((p) => [p.id, p]));

  const take: string[] = [];
  const tooSoon: string[] = [];

  for (const id of queueIds) {
    const p = byId.get(id);
    if (!p) continue;
    if (calledRecently(p, now)) {
      tooSoon.push(id);
      continue;
    }
    if (take.length < cap) take.push(id);
  }

  return { take, tooSoon, cap };
}
