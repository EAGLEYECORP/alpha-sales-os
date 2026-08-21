import type { Prospect, EventKind } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SIGNAUX VITAUX — l'analyse comportementale de l'acheteur.
 *
 * Deux questions, une seule réponse chiffrée :
 *   1. Est-il PRÊT à signer ? (readiness) — et sinon, qu'est-ce qui bloque ?
 *   2. Est-il SATURÉ ? (fatigue) — combien de fois l'a-t-on touché sans
 *      qu'il réponde, et à quel moment peut-on revenir sans l'agacer ?
 *
 * Doctrine du MASTER RAPPEL : on ne rattrape pas un prospect qui se défile
 * en le relançant plus fort — on revient au bon moment, sur le bon canal,
 * avec une raison neuve. Relancer un prospect saturé le brûle définitivement ;
 * ne pas relancer un prospect chaud le laisse au concurrent. Ce module tranche
 * entre les deux avec des faits (dates, réponses), pas à l'intuition.
 *
 * Pur, déterministe, sans réseau : tourne sur tout le pipe à chaque rendu.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Événements qui prouvent que LUI a bougé (pas nous). */
const INBOUND_HINTS = /rappel[ée]|rappelle|il a rappel|r[ée]pond|retour|entrant|re[çc]u de|demande de/i;

/** Canaux sortants — nos tentatives. */
const OUTBOUND_KINDS: EventKind[] = ["appel", "email", "whatsapp", "linkedin", "visite"];

export type Momentum = "accelere" | "stable" | "ralentit" | "eteint";
export type FatigueLevel = "ok" | "prudence" | "sature";

export interface Vital {
  id: string;
  label: string;
  ok: boolean;
  /** Pourquoi ça compte / ce qui manque. */
  why: string;
}

export interface VitalSigns {
  prospectId: string;
  /** 0-100 : à quel point il est prêt à signer MAINTENANT. */
  readiness: number;
  /** Les signaux vitaux du closing, un par un. */
  vitals: Vital[];
  /** Ce qui l'empêche de signer aujourd'hui (les vitaux au rouge). */
  blockers: string[];
  /** Dynamique de la relation. */
  momentum: Momentum;
  /** 0-100 : risque de le saturer si on le retouche maintenant. */
  fatigue: number;
  fatigueLevel: FatigueLevel;
  /** Touches sortantes consécutives SANS réponse de sa part. */
  unansweredTouches: number;
  daysSinceLastTouch: number | null;
  /** Jours depuis un signe de vie DE SA PART (le meilleur prédicteur). */
  daysSinceInbound: number | null;
  /** Quand revenir sans l'agacer, et pourquoi ce moment-là. */
  bestWindow: { at: string; why: string };
  /** Résumé d'une ligne pour la fiche / la salle de contrôle. */
  summary: string;
}

const DAY = 86_400_000;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const days = (from: string, now: Date) => Math.floor((now.getTime() - new Date(from).getTime()) / DAY);

/** Un événement traduit-il une action DE LUI ? */
function isInbound(kind: EventKind, summary: string): boolean {
  if (kind === "note" || kind === "stage") return false;
  return INBOUND_HINTS.test(summary ?? "");
}

export function vitalSigns(p: Prospect, now: Date = new Date()): VitalSigns {
  const events = [...(p.events ?? [])].sort((a, b) => b.date.localeCompare(a.date)); // + récent d'abord
  const last = events[0] ?? null;
  const lastInbound = events.find((e) => isInbound(e.kind, e.summary)) ?? null;

  const daysSinceLastTouch = last ? days(last.date, now) : null;
  const daysSinceInbound = lastInbound ? days(lastInbound.date, now) : null;

  // ── Touches sortantes consécutives sans réponse (le compteur de saturation) ──
  let unanswered = 0;
  for (const e of events) {
    if (isInbound(e.kind, e.summary)) break;
    if (OUTBOUND_KINDS.includes(e.kind)) unanswered += 1;
  }

  // ── Les signaux vitaux du closing ──
  const openObjections = (p.objections ?? []).filter((o) => o.status !== "traitee");
  const blocking = (p.objections ?? []).filter((o) => o.status === "bloquante");
  const c = p.croyances ?? { produit: 0, soutien: 0, pourLui: 0 };
  const nextStepDated = Boolean(p.nextStep?.date);

  const vitals: Vital[] = [
    {
      id: "demo-avant-prix",
      label: "Démo montrée AVANT le prix",
      ok: Boolean(p.demoShownBeforePrice),
      why: p.demoShownBeforePrice
        ? "Il a vu la valeur avant le chiffre."
        : "Annoncer un prix sans démo transforme la conversation en négociation.",
    },
    {
      id: "audit",
      label: "Audit livré (pièce écrite)",
      ok: (p.auditScore ?? 0) >= 50,
      why: (p.auditScore ?? 0) >= 50 ? "La matière écrite existe." : "Sans pièce écrite, le taux reste à zéro (cf. juillet).",
    },
    {
      id: "croyances",
      label: "Les 3 croyances au vert",
      ok: c.produit >= 8 && c.soutien >= 8 && c.pourLui >= 8,
      why:
        c.produit >= 8 && c.soutien >= 8 && c.pourLui >= 8
          ? "Produit, soutien et « ça marche pour MOI » sont acquis."
          : `À renforcer : ${[
              c.produit < 8 ? "le produit fonctionne" : "",
              c.soutien < 8 ? "tu me soutiens" : "",
              c.pourLui < 8 ? "ça marche pour MOI" : "",
            ]
              .filter(Boolean)
              .join(", ")}.`,
    },
    {
      id: "objections",
      label: "Aucune objection bloquante",
      ok: blocking.length === 0,
      why: blocking.length ? `Bloquant : ${blocking.map((o) => o.label).join(" · ")}` : "Rien ne bloque explicitement.",
    },
    {
      id: "prochaine-etape",
      label: "Prochaine étape DATÉE",
      ok: nextStepDated,
      why: nextStepDated ? `Calé : ${p.nextStep!.action}` : "Un échange sans date de suite est un échange perdu.",
    },
    {
      id: "decideur",
      label: "On parle au décideur",
      ok: Boolean(p.name?.trim()) && !/^(g[ée]rant|cabinet|accueil|contact|standard)$/i.test(p.name.trim()),
      why: "Une fonction ne signe pas — une personne signe.",
    },
    {
      id: "budget",
      label: "Valeur du deal connue",
      ok: (p.setupValue ?? 0) > 0 || (p.monthlyValue ?? 0) > 0,
      why: "Sans montant, il n'y a ni devis ni décision possible.",
    },
  ];

  const okCount = vitals.filter((v) => v.ok).length;
  const blockers = vitals.filter((v) => !v.ok).map((v) => `${v.label} — ${v.why}`);

  // ── Readiness : les vitaux pèsent le plus, la relation ajuste ──
  let readiness = Math.round((okCount / vitals.length) * 70);
  readiness += Math.round((p.trust ?? 0) * 0.12);
  readiness += Math.round((p.conviction ?? 0) * 1.2);
  if (openObjections.length) readiness -= Math.min(15, openObjections.length * 5);
  if (blocking.length) readiness -= 15;
  // Un signe de vie récent de SA part est le meilleur prédicteur d'achat.
  if (daysSinceInbound !== null && daysSinceInbound <= 7) readiness += 8;
  readiness = clamp(readiness);

  // ── Momentum ──
  const recent = events.filter((e) => days(e.date, now) <= 14).length;
  const previous = events.filter((e) => {
    const d = days(e.date, now);
    return d > 14 && d <= 28;
  }).length;
  let momentum: Momentum;
  if (daysSinceLastTouch === null || daysSinceLastTouch > 45) momentum = "eteint";
  else if (recent > previous) momentum = "accelere";
  else if (recent === previous) momentum = "stable";
  else momentum = "ralentit";

  // ── Fatigue : c'est le nombre de touches SANS réponse qui brûle, pas le total ──
  let fatigue = Math.min(80, unanswered * 18);
  if (daysSinceLastTouch !== null && daysSinceLastTouch <= 1 && unanswered > 0) fatigue += 15;
  // Le temps répare : chaque semaine de silence de notre part fait retomber.
  if (daysSinceLastTouch !== null) fatigue -= Math.min(40, Math.floor(daysSinceLastTouch / 7) * 12);
  if (daysSinceInbound !== null && daysSinceInbound <= 7) fatigue -= 25; // il vient de répondre : il n'est pas saturé
  fatigue = clamp(fatigue);
  const fatigueLevel: FatigueLevel = fatigue >= 60 ? "sature" : fatigue >= 30 ? "prudence" : "ok";

  // ── La fenêtre : quand revenir sans l'agacer ──
  const bestWindow = computeWindow({ p, now, fatigueLevel, unanswered, daysSinceLastTouch, readiness });

  const summary =
    readiness >= 70
      ? `Prêt à signer (${readiness}/100) — ${blockers.length ? `reste : ${blockers.length} point(s)` : "aucun blocage"}.`
      : fatigueLevel === "sature"
        ? `Saturé (${unanswered} relances sans réponse) — laisser respirer jusqu'au ${new Date(bestWindow.at).toLocaleDateString("fr-FR")}.`
        : `Readiness ${readiness}/100 · momentum ${momentum} — ${blockers[0] ?? "avancer d'une étape"}.`;

  return {
    prospectId: p.id,
    readiness,
    vitals,
    blockers,
    momentum,
    fatigue,
    fatigueLevel,
    unansweredTouches: unanswered,
    daysSinceLastTouch,
    daysSinceInbound,
    bestWindow,
    summary,
  };
}

/**
 * Quand revenir. La logique du MASTER RAPPEL :
 *  · prêt à signer → maintenant, on ne fait pas attendre un acheteur ;
 *  · un RDV daté existe → c'est LUI la fenêtre, on ne double pas ;
 *  · saturé → on laisse un vrai silence, puis on revient avec une raison NEUVE ;
 *  · sinon → cadence normale.
 */
function computeWindow(i: {
  p: Prospect;
  now: Date;
  fatigueLevel: FatigueLevel;
  unanswered: number;
  daysSinceLastTouch: number | null;
  readiness: number;
}): { at: string; why: string } {
  const { p, now, fatigueLevel, unanswered, daysSinceLastTouch, readiness } = i;
  const inDays = (d: number) => new Date(now.getTime() + d * DAY).toISOString();

  if (p.nextStep?.date) {
    return { at: p.nextStep.date, why: `Rendez-vous déjà calé : ${p.nextStep.action}. On ne double pas un créneau existant.` };
  }
  if (readiness >= 70 && fatigueLevel !== "sature") {
    return { at: now.toISOString(), why: "Il est prêt : on ne fait pas attendre un acheteur." };
  }
  if (fatigueLevel === "sature") {
    // Plus il a encaissé de relances sèches, plus le silence doit être long.
    const pause = Math.min(21, 7 + unanswered * 3);
    return {
      at: inDays(pause),
      why: `${unanswered} relances sans réponse : ${pause} jours de silence, puis on revient avec une raison NEUVE (résultat, preuve, actualité) — jamais « je me permets de relancer ».`,
    };
  }
  if (daysSinceLastTouch !== null && daysSinceLastTouch < 3) {
    return { at: inDays(3 - daysSinceLastTouch), why: "Touché il y a moins de 3 jours : laisser le message vivre." };
  }
  return { at: now.toISOString(), why: "Fenêtre ouverte : il n'est ni saturé ni déjà calé." };
}

/**
 * Le pipe trié par « qui mérite mon temps MAINTENANT » : prêts d'abord,
 * saturés écartés. C'est l'ordre d'appel de la journée.
 */
export function triageByReadiness(prospects: Prospect[], now: Date = new Date()): { prospect: Prospect; signs: VitalSigns }[] {
  return prospects
    .map((p) => ({ prospect: p, signs: vitalSigns(p, now) }))
    .filter((x) => x.signs.fatigueLevel !== "sature" || x.signs.readiness >= 70)
    .sort((a, b) => b.signs.readiness - a.signs.readiness);
}
