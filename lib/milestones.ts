import type { Prospect, Stage } from "./types";
import type { CampaignFunnel } from "./campaign-funnel";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Jalons & cycle infini — la croissance mesurée sur la CONVERSATION,
 * pas sur la tech.
 *
 * Trois idées, une page :
 *  · La profondeur d'audit (connaît-on VRAIMENT ce prospect ?) pilote la
 *    qualité de chaque message — c'est le levier n°1 du taux de réponse.
 *  · Le cycle est une BOUCLE : l'upsell d'un client livré redevient un
 *    prospect ; un STOP est remplacé par une cible de niveau supérieur.
 *    Le pipeline ne se vide jamais, il s'élève.
 *  · Les jalons (10 → 100 → 1 000 → 10 000 → 100 000) ont des portes de
 *    passage MESURÉES (RUNBOOK) : on ne monte pas en volume tant que la
 *    conversation ne convertit pas.
 * ─────────────────────────────────────────────────────────────────────
 */

const RANK: Record<Stage, number> = {
  prospect: 0, contact: 1, audit: 2, demo: 3, offre: 4, redzone: 5, signe: 6, perdu: -1,
};

// ── Profondeur d'audit ────────────────────────────────────────────────
// 10 dimensions = ce qu'il faut savoir pour que le message soit
// irrésistible : où il est sur son marché, à qui parle son offre, ce que
// l'inaction lui coûte, et quoi lui proposer exactement.

export interface AuditDimension {
  key: string;
  label: string;
  filled: boolean;
}
export interface AuditDepth {
  score: number; // 0–100
  dims: AuditDimension[];
}

const has = (s?: string) => Boolean(s && s.trim());

export function auditDepth(p: Prospect): AuditDepth {
  const d = p.deepAudit;
  const dims: AuditDimension[] = [
    { key: "decideur", label: "Décideur identifié", filled: has(p.name) },
    { key: "canal", label: "Canal direct (email / tél)", filled: has(p.email) || has(p.phone) },
    { key: "marche", label: "Position marché (note + avis)", filled: d.googleRating !== undefined && d.googleReviews !== undefined },
    { key: "presence", label: "Présence en ligne (site, réseaux)", filled: has(d.websiteState) },
    { key: "concurrence", label: "Concurrence locale", filled: has(d.localCompetition) },
    { key: "process", label: "Son process de vente actuel", filled: has(d.currentProcess) },
    { key: "douleur", label: "Douleur chiffrée (ratés × panier)", filled: d.missedCallsPerWeek !== undefined && d.avgTicket !== undefined },
    { key: "taxe", label: "Taxe d'ignorance calculée", filled: p.ignoranceTax > 0 },
    { key: "problemes", label: "Problèmes identifiés", filled: p.problems.length > 0 },
    { key: "offre", label: "Offre personnalisée rédigée", filled: has(p.personalizedOffer) },
  ];
  const filled = dims.filter((x) => x.filled).length;
  return { score: Math.round((filled / dims.length) * 100), dims };
}

/** Moyenne de profondeur sur les prospects actifs (hors perdus). */
export function avgAuditDepth(prospects: Prospect[]): number | null {
  const active = prospects.filter((p) => p.stage !== "perdu");
  if (active.length === 0) return null;
  return Math.round(active.reduce((s, p) => s + auditDepth(p).score, 0) / active.length);
}

// ── Le cycle infini ───────────────────────────────────────────────────

export interface CycleStage {
  key: string;
  label: string;
  desc: string;
  /** valeur mesurée (null = pas encore de données) */
  value: number | null;
  /** cible « ligne dorée » (null = qualitatif) */
  target: number | null;
  unit: "%" | "/100";
  hint: string;
}

const ratio = (n: number, base: number): number | null => (base > 0 ? Math.round((n / base) * 100) : null);

export function computeCycle(prospects: Prospect[], funnel: CampaignFunnel | null): CycleStage[] {
  const signed = prospects.filter((p) => p.stage === "signe");
  const deliveredClients = signed.filter((p) => p.delivery === "livre" || p.delivery === "maintenance");
  const sat = signed.filter((p) => p.satisfaction !== undefined);
  const satAvg = sat.length ? Math.round(sat.reduce((s, p) => s + (p.satisfaction ?? 0), 0) / sat.length) : null;

  return [
    {
      key: "ciblage",
      label: "Deep-dive ciblage",
      desc: "Où il est sur son marché, à qui parle son offre, ce que l'inaction lui coûte.",
      value: avgAuditDepth(prospects),
      target: 80,
      unit: "%",
      hint: "Profondeur d'audit moyenne des prospects actifs — le levier n°1 du taux de réponse.",
    },
    {
      key: "awareness",
      label: "Awareness",
      desc: "Le message arrive et se fait ouvrir.",
      value: funnel ? ratio(funnel.opened, funnel.people) : null,
      target: 40,
      unit: "%",
      hint: "Ouvertures / personnes touchées. Sous 25 % → objet ou délivrabilité.",
    },
    {
      key: "education",
      label: "Éducation → réponse",
      desc: "Tant de valeur révélée qu'il DOIT répondre.",
      value: funnel ? ratio(funnel.responded, funnel.people) : null,
      target: 5,
      unit: "%",
      hint: "Réponses / touchés. LA porte du checkpoint 100 : ≥ 5 %.",
    },
    {
      key: "vente",
      label: "Conversation de vente",
      desc: "La réponse devient un rendez-vous (audit → démo).",
      value: funnel ? ratio(funnel.followThru, funnel.responded) : null,
      target: 50,
      unit: "%",
      hint: "Répondants amenés jusqu'à la démo. Rappel sous 24 h, next step daté.",
    },
    {
      key: "closing",
      label: "Closing",
      desc: "Démo avant prix, 3 croyances à 10, contrat + paiement.",
      value: funnel ? ratio(funnel.closed, funnel.followThru) : null,
      target: 40,
      unit: "%",
      hint: "Démos converties en signature.",
    },
    {
      key: "onboarding",
      label: "Onboarding",
      desc: "Le 2e cycle commence : livrer ce qui a été vendu.",
      value: signed.length ? ratio(signed.filter((p) => p.delivery !== "non-demarre").length, signed.length) : null,
      target: 100,
      unit: "%",
      hint: "Signés dont la livraison a démarré.",
    },
    {
      key: "delivery",
      label: "Delivery",
      desc: "Statut suivi jusqu'à « livré » — sur-communiquer.",
      value: signed.length ? ratio(deliveredClients.length, signed.length) : null,
      target: 100,
      unit: "%",
      hint: "Signés livrés (ou en maintenance).",
    },
    {
      key: "satisfaction",
      label: "Satisfaction",
      desc: "Mesurée, pas supposée — c'est elle qui autorise la suite.",
      value: satAvg,
      target: 90,
      unit: "/100",
      hint: "Moyenne des scores de satisfaction sur les clients signés.",
    },
    {
      key: "testimonial",
      label: "Témoignages",
      desc: "La preuve sociale qui nourrit l'awareness du cycle suivant.",
      value: deliveredClients.length ? ratio(deliveredClients.filter((p) => has(p.testimonial)).length, deliveredClients.length) : null,
      target: 60,
      unit: "%",
      hint: "Clients livrés avec témoignage recueilli.",
    },
    {
      key: "upsell",
      label: "Analyse marché → upsell",
      desc: "Son activité relue pour l'opportunité suivante → il REDEVIENT un prospect. ↺",
      value: deliveredClients.length ? ratio(deliveredClients.filter((p) => p.upsell && p.upsell.status !== "aucun").length, deliveredClients.length) : null,
      target: 50,
      unit: "%",
      hint: "Clients livrés avec une opportunité d'upsell scorée — la boucle infinie.",
    },
  ];
}

/** Efficacité de conversation globale : moyenne des étapes mesurées vs cible (borné 100). */
export function conversationEfficiency(cycle: CycleStage[]): number | null {
  const measured = cycle.filter((s) => s.value !== null && s.target !== null && s.target > 0);
  if (measured.length === 0) return null;
  const sum = measured.reduce((s, x) => s + Math.min(100, ((x.value as number) / (x.target as number)) * 100), 0);
  return Math.round(sum / measured.length);
}

// ── Jalons ────────────────────────────────────────────────────────────

export interface Gate {
  label: string;
  /** null = pas encore mesurable (donnée absente) */
  pass: boolean | null;
  detail: string;
}

export interface MilestoneState {
  n: number;
  title: string;
  motto: string;
  gates: Gate[];
  focus: string[];
  status: "done" | "current" | "locked";
}

/** Prospects réellement engagés (une conversation a commencé). */
export function engagedCount(prospects: Prospect[], funnelPeople: number): number {
  const engaged = prospects.filter((p) => p.stage === "perdu" || RANK[p.stage] >= 1 || p.events.length > 0).length;
  return Math.max(engaged, funnelPeople);
}

export function computeMilestones(prospects: Prospect[], funnel: CampaignFunnel | null): {
  milestones: MilestoneState[];
  engaged: number;
  current: MilestoneState;
} {
  const engaged = engagedCount(prospects, funnel?.people ?? 0);
  const depth = avgAuditDepth(prospects);
  const respRate = funnel && funnel.people > 0 ? (funnel.responded / funnel.people) * 100 : null;
  const openRate = funnel && funnel.people > 0 ? (funnel.opened / funnel.people) * 100 : null;
  const meetings = funnel?.followThru ?? 0;
  const signed = prospects.filter((p) => p.stage === "signe");
  const delivered = signed.filter((p) => p.delivery === "livre" || p.delivery === "maintenance");
  const sat = signed.filter((p) => p.satisfaction !== undefined);
  const satAvg = sat.length ? sat.reduce((s, p) => s + (p.satisfaction ?? 0), 0) / sat.length : null;
  const testiRate = delivered.length ? (delivered.filter((p) => has(p.testimonial)).length / delivered.length) * 100 : null;
  const upsellRate = delivered.length ? (delivered.filter((p) => p.upsell && p.upsell.status !== "aucun").length / delivered.length) * 100 : null;

  const gate = (label: string, pass: boolean | null, detail: string): Gate => ({ label, pass, detail });
  const numGate = (label: string, value: number | null, target: number, unit: string): Gate =>
    gate(label, value === null ? null : value >= target, value === null ? `pas encore de données — cible ≥ ${target}${unit}` : `${Math.round(value)}${unit} / cible ≥ ${target}${unit}`);

  const defs: Omit<MilestoneState, "status">[] = [
    {
      n: 10,
      title: "La preuve de courage",
      motto: "10 conversations parfaites valent mieux que 1 000 emails moyens.",
      gates: [
        numGate("10 prospects engagés", engaged, 10, ""),
        numGate("Profondeur d'audit moyenne", depth, 70, " %"),
        gate("Recette GOOD TO GO passée", null, "page Recette — la boucle prouvée avant le premier vrai prospect"),
      ],
      focus: [
        "Chaque email relu, personnalisé à la main — zéro modèle brut",
        "Deep-dive complet AVANT le premier contact : sa note, ses avis, son site, sa concurrence, sa taxe",
        "Objectif : apprendre, pas vendre — noter ce qui déclenche une réponse",
      ],
    },
    {
      n: 100,
      title: "Valider le message",
      motto: "Rien à automatiser tant que le message ne convertit pas.",
      gates: [
        numGate("100 prospects engagés", engaged, 100, ""),
        numGate("Taux de réponse", respRate, 5, " %"),
        numGate("Taux d'ouverture", openRate, 40, " %"),
        numGate("Rendez-vous obtenus", meetings, 3, ""),
      ],
      focus: [
        "1 domaine d'envoi, SPF + DKIM + DMARC, ~20 emails/h max",
        "Warm-up : 10/jour semaine 1, on double chaque semaine",
        "Un seul segment, un seul message — on isole ce qui marche",
      ],
    },
    {
      n: 1_000,
      title: "La première machine",
      motto: "Un flux régulier de RDV — la conversation devient un système.",
      gates: [
        numGate("1 000 prospects engagés", engaged, 1_000, ""),
        numGate("Taux de réponse maintenu", respRate, 5, " %"),
        numGate("RDV / répondants", funnel && funnel.responded > 0 ? (funnel.followThru / funnel.responded) * 100 : null, 40, " %"),
        gate("Sourcing actif (chaque STOP remplacé par une cible supérieure)", null, "formulaire alpha-sourcing branché — le pipeline ne rétrécit jamais"),
      ],
      focus: [
        "SMTP dédié (Brevo/OVH), 2–4 inbox chauffées, DMARC quarantine",
        "Supabase durable : dédup + rate-limit globaux",
        "Suivi des taux PAR INDUSTRIE — doubler là où ça répond",
      ],
    },
    {
      n: 10_000,
      title: "L'industrialisation",
      motto: "Volume prévisible, réputation intacte, satisfaction mesurée.",
      gates: [
        numGate("10 000 prospects engagés", engaged, 10_000, ""),
        numGate("Satisfaction clients", satAvg, 85, "/100"),
        numGate("Témoignages sur livrés", testiRate, 60, " %"),
        gate("Validation d'emails avant envoi (bounce-check)", null, "obligatoire à cette échelle — protège la réputation"),
      ],
      focus: [
        "5–10 domaines × plusieurs inbox, rotation, IP dédiées",
        "One-click unsubscribe (règles Google/Yahoo) EN PLUS du STOP",
        "Les témoignages du cycle N nourrissent l'awareness du cycle N+1",
      ],
    },
    {
      n: 100_000,
      title: "L'opération",
      motto: "Le MOAT n'est pas le volume — c'est le ciblage + la doctrine.",
      gates: [
        numGate("100 000 prospects engagés", engaged, 100_000, ""),
        numGate("Boucle upsell (clients re-pipelinés)", upsellRate, 50, " %"),
        gate("Un(e) responsable délivrabilité", null, "à cette échelle, ce n'est plus un réglage, c'est un métier"),
      ],
      focus: [
        "Multi-secteurs : le deep-dive s'adapte, la doctrine ne change pas",
        "A/B continu sur les messages, cohortes par industrie",
        "La bonne métrique reste le RDV QUALIFIÉ, jamais l'email parti",
      ],
    },
  ];

  // done = la porte volume est passée ET toutes les portes mesurées passent.
  const milestones: MilestoneState[] = [];
  let currentAssigned = false;
  for (const d of defs) {
    const volumePass = engaged >= d.n;
    const measured = d.gates.filter((g) => g.pass !== null);
    const allPass = volumePass && measured.every((g) => g.pass);
    let status: MilestoneState["status"];
    if (allPass) status = "done";
    else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else status = "locked";
    milestones.push({ ...d, status });
  }
  const current = milestones.find((m) => m.status === "current") ?? milestones[milestones.length - 1];
  return { milestones, engaged, current };
}
