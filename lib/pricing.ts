/**
 * ─────────────────────────────────────────────────────────────────────
 * Modèle économique EAGLEYE — outreach ultra-qualifié pour les entreprises.
 * Deux offres, calées sur les standards du marché (agences outbound + SaaS
 * de prospection type Apollo / Lemlist / Instantly, facturés au volume) :
 *
 *   1. Performance — frais de setup + 30 % du CA généré via nous.
 *      Incitations alignées : on ne gagne que si le client gagne.
 *   2. Abonnement — frais de setup + mensuel par palier de prospects gérés.
 *      Coût fixe et prévisible ; le client garde 100 % de son CA.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Frais de setup one-shot (audit, séquences, infra, délivrabilité). */
export const SETUP_FEE = 2500;

/** Part EAGLEYE sur le CA généré (modèle Performance). */
export const REV_SHARE = 0.3;

export interface Tier {
  id: string;
  name: string;
  /** Nombre de prospects travaillés / mois inclus. */
  maxProspects: number;
  /** Mensuel € (null = sur devis). */
  monthly: number | null;
  blurb: string;
  features: string[];
}

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    maxProspects: 250,
    monthly: 490,
    blurb: "Lancer une machine à RDV",
    features: ["Jusqu'à 250 prospects/mois", "1 secteur ciblé", "Emails HTML + tracking", "Relecture avant envoi"],
  },
  {
    id: "growth",
    name: "Growth",
    maxProspects: 1000,
    monthly: 1490,
    blurb: "Le flux de RDV en continu",
    features: ["Jusqu'à 1 000 prospects/mois", "Multi-canal (email + DM)", "Agent IA + doctrine de closing", "Délivrabilité gérée"],
  },
  {
    id: "scale",
    name: "Scale",
    maxProspects: 5000,
    monthly: 3900,
    blurb: "Plusieurs secteurs en parallèle",
    features: ["Jusqu'à 5 000 prospects/mois", "Multi-secteurs / multi-marchés", "Reporting par industrie", "Priorité support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    maxProspects: Infinity,
    monthly: null,
    blurb: "Volume illimité, sur mesure",
    features: ["Volume illimité", "SLA + intégrations dédiées", "Account manager", "Sur devis"],
  },
];

export function tierFor(prospects: number, tiers: Tier[] = TIERS): Tier {
  return tiers.find((t) => prospects <= t.maxProspects) ?? tiers[tiers.length - 1];
}

/**
 * Tarification d'un compte (white-label). Chaque compte peut définir SES prix ;
 * défaut = le modèle EAGLEYE (constantes ci-dessus).
 */
export interface PricingConfig {
  /** Frais de setup one-shot (€). */
  setupFee: number;
  /** Part sur le CA généré, en POURCENT (ex. 30). */
  revSharePct: number;
  tiers: Tier[];
}

export const defaultPricing: PricingConfig = {
  setupFee: SETUP_FEE,
  revSharePct: REV_SHARE * 100,
  tiers: TIERS,
};

export interface CalcInput {
  /** Prospects contactés / mois. */
  prospects: number;
  /** Taux de réponse / RDV obtenu (%). */
  replyRate: number;
  /** Taux de conversion RDV → vente (%). */
  closeRate: number;
  /** Valeur moyenne d'une vente (€). */
  avgSale: number;
}

export interface CalcResult {
  meetings: number;
  sales: number;
  revenue: number; // CA généré / mois
  // Performance
  perfCut: number; // part EAGLEYE / mois
  clientKeepsPerf: number; // ce que garde le client / mois
  perfYear1: number; // coût client an 1 (setup + 12× cut)
  // Abonnement
  tier: Tier;
  subMonthly: number | null;
  subYear1: number | null; // setup + 12× mensuel
  // Comparaison
  cheaperForClient: "performance" | "abonnement" | "égal" | "devis";
  clientRoiPerf: number; // (CA gardé an1) / (coût an1)
}

export function calc(input: CalcInput, pricing: PricingConfig = defaultPricing): CalcResult {
  const prospects = Math.max(0, input.prospects);
  const meetings = prospects * (input.replyRate / 100);
  const sales = meetings * (input.closeRate / 100);
  const revenue = sales * input.avgSale;

  const revShare = pricing.revSharePct / 100;
  const perfCut = revenue * revShare;
  const clientKeepsPerf = revenue - perfCut;
  const perfYear1 = pricing.setupFee + perfCut * 12;

  const tier = tierFor(prospects, pricing.tiers);
  const subMonthly = tier.monthly;
  const subYear1 = subMonthly === null ? null : pricing.setupFee + subMonthly * 12;

  let cheaperForClient: CalcResult["cheaperForClient"];
  if (subYear1 === null) cheaperForClient = "devis";
  else if (Math.abs(perfYear1 - subYear1) < 1) cheaperForClient = "égal";
  else cheaperForClient = perfYear1 < subYear1 ? "performance" : "abonnement";

  const clientRoiPerf = perfYear1 > 0 ? (revenue * 12 - perfYear1) / perfYear1 : 0;

  return {
    meetings,
    sales,
    revenue,
    perfCut,
    clientKeepsPerf,
    perfYear1,
    tier,
    subMonthly,
    subYear1,
    cheaperForClient,
    clientRoiPerf,
  };
}
