/**
 * ─────────────────────────────────────────────────────────────────────
 * COÛT USINE d'Alpha Voice — ce que nous coûte VRAIMENT 1 000 appels.
 *
 * Objectif : chiffrer l'offre premium sans se raconter d'histoires. Le prix
 * de vente est fixé (364 € HT / 1 000 appels, sans engagement) ; ce module
 * dit ce qu'il reste réellement une fois les fournisseurs payés.
 *
 * ⚠ Les tarifs ci-dessous ont été relevés en AOÛT 2026 sur des sources
 * publiques. Ils changent. Chaque constante porte sa source et sa date —
 * quand un chiffre bouge, on le corrige ICI, et la marge se recalcule
 * partout. Ne jamais laisser un tarif se figer dans une slide.
 *
 * ⚠⚠ LICENCE NVIDIA : l'accès gratuit build.nvidia.com est réservé au
 * développement, aux tests, à la recherche et à l'évaluation. Un usage de
 * PRODUCTION (conduire des transactions commerciales) exige NVIDIA AI
 * Enterprise. Facturer des appels clients servis par le tier gratuit nous
 * met en infraction contractuelle. Voir `LLM_OPTIONS` : le modèle de coût
 * retient un LLM payant, c'est le seul chiffrage honnête.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Taux de change retenu pour convertir les tarifs en USD. Ajustable. */
export const USD_TO_EUR = 0.92;

export interface CostLine {
  id: string;
  label: string;
  /** Coût unitaire en USD par minute de CONVERSATION (sauf mention). */
  usdPerMin: number;
  source: string;
  /** Ce que couvre la ligne, et ce qu'elle ne couvre pas. */
  note?: string;
}

/**
 * Coûts à la minute de conversation (appel décroché, agent en ligne).
 * Relevés en août 2026.
 */
export const COST_LINES: CostLine[] = [
  {
    id: "livekit-agent",
    label: "LiveKit — session agent",
    usdPerMin: 0.01,
    source: "livekit.com/pricing (août 2026) — 0,01 $/min au-delà du quota inclus",
    note: "Le poste le plus lourd de la pile temps réel.",
  },
  {
    id: "livekit-sip",
    label: "LiveKit — SIP",
    usdPerMin: 0.0035,
    source: "livekit.com/pricing (août 2026) — 0,003 à 0,004 $/min",
    note: "Le transport SIP ; le PSTN est facturé à part par l'opérateur.",
  },
  {
    id: "telnyx",
    label: "Telnyx — PSTN France",
    usdPerMin: 0.012,
    source: "telnyx.com/pricing/voice-api — à partir de 0,002 $/min, tarif France non publié",
    note:
      "HYPOTHÈSE PRUDENTE. Le mobile français coûte nettement plus cher que le fixe. " +
      "À remplacer par le tarif réel de ton compte Telnyx — c'est la seule ligne que je n'ai pas pu vérifier.",
  },
  {
    id: "deepgram",
    label: "Deepgram — transcription (Nova-3)",
    usdPerMin: 0.0077,
    source: "Deepgram pricing 2026 — 0,0077 $/min streaming monolingue",
    note: "0,0092 $/min en multilingue. 200 $ de crédit offert à l'inscription, sans expiration.",
  },
  {
    id: "llm",
    label: "LLM conversationnel (payant)",
    usdPerMin: 0.005,
    source: "Estimation : ~1 500 tokens/min sur un modèle économique compatible OpenAI",
    note:
      "NVIDIA NIM gratuit est INTERDIT en production (licence AI Enterprise requise). " +
      "On chiffre donc un LLM payant — c'est le seul calcul honnête.",
  },
  {
    id: "fish",
    label: "Fish Audio — synthèse vocale",
    usdPerMin: 0.0104,
    source: "fish.audio — 15 $ / 1 M octets UTF-8 (~12 h de parole)",
    note:
      "1 min de parole ≈ 1 390 octets ≈ 0,0208 $. L'agent parle ~50 % du temps → 0,0104 $/min de conversation. " +
      "Le français accentué consomme plus d'octets que l'anglais (2 octets par accent).",
  },
];

/** Coût total d'une minute de conversation, en USD. */
export const usdPerConversationMinute = (): number =>
  COST_LINES.reduce((s, l) => s + l.usdPerMin, 0);

export interface FixedCost {
  id: string;
  label: string;
  eurPerMonth: number;
  note?: string;
}

/**
 * Coûts fixes mensuels — ils ne dépendent pas du volume d'appels.
 * C'est ce qui rend le premier client cher et le dixième rentable.
 */
export const FIXED_COSTS: FixedCost[] = [
  { id: "numero", label: "Numéro Telnyx (location)", eurPerMonth: 2, note: "Par numéro sortant." },
  { id: "hebergement", label: "Hébergement (Vercel + Supabase)", eurPerMonth: 45, note: "Mutualisé sur tous les clients." },
  { id: "observabilite", label: "Journalisation & supervision", eurPerMonth: 10 },
];

export interface CallVolumeInput {
  /** Nombre d'appels COMPOSÉS dans le mois. */
  calls: number;
  /** % d'appels décrochés (le reste sonne dans le vide). */
  answerRatePct: number;
  /** Durée moyenne d'une conversation décrochée, en minutes. */
  avgMinutesAnswered: number;
  /** Durée moyenne de sonnerie d'un appel non décroché, en minutes. */
  avgMinutesUnanswered: number;
}

/**
 * Hypothèses par défaut — prospection B2B à froid, prudentes.
 * Un taux de décroché de 30 % est déjà bon en B2B ; 2 minutes de
 * conversation utile aussi. Mieux vaut sous-estimer la marge que l'inverse.
 */
export const defaultVolume: CallVolumeInput = {
  calls: 1000,
  answerRatePct: 30,
  avgMinutesAnswered: 2,
  avgMinutesUnanswered: 0.4,
};

export interface CostBreakdown {
  calls: number;
  answeredCalls: number;
  conversationMinutes: number;
  ringingMinutes: number;
  /** Coût variable (fournisseurs, à la minute) en €. */
  variableEur: number;
  /** Coût fixe mensuel en €. */
  fixedEur: number;
  totalEur: number;
  /** Chiffre d'affaires au tarif public. */
  revenueEur: number;
  marginEur: number;
  marginPct: number;
  /** Coût de revient d'UN appel composé. */
  costPerCallEur: number;
  /** Détail par fournisseur, en €. */
  lines: { id: string; label: string; eur: number; pctOfCost: number }[];
}

/**
 * Le calcul complet. `revenueEur` vient de la grille publique
 * (lib/bricks.ts → outboundPrice) pour qu'il n'existe qu'UN prix.
 */
export function computeCosts(v: CallVolumeInput, revenueEur: number): CostBreakdown {
  const calls = Math.max(0, v.calls);
  const answered = Math.round((calls * Math.min(100, Math.max(0, v.answerRatePct))) / 100);
  const conversationMinutes = answered * Math.max(0, v.avgMinutesAnswered);
  const ringingMinutes = (calls - answered) * Math.max(0, v.avgMinutesUnanswered);

  // Un appel qui sonne sans réponse ne consomme ni STT, ni LLM, ni TTS :
  // seuls le transport SIP et l'opérateur tournent. C'est ce qui rend la
  // prospection à froid moins chère qu'il n'y paraît.
  const ringingLines = new Set(["livekit-sip", "telnyx"]);

  const lines = COST_LINES.map((l) => {
    const minutes = conversationMinutes + (ringingLines.has(l.id) ? ringingMinutes : 0);
    return { id: l.id, label: l.label, eur: l.usdPerMin * minutes * USD_TO_EUR, pctOfCost: 0 };
  });

  const variableEur = lines.reduce((s, l) => s + l.eur, 0);
  const fixedEur = FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0);
  const totalEur = variableEur + fixedEur;
  for (const l of lines) l.pctOfCost = totalEur > 0 ? Math.round((l.eur / totalEur) * 100) : 0;

  const marginEur = revenueEur - totalEur;

  return {
    calls,
    answeredCalls: answered,
    conversationMinutes,
    ringingMinutes,
    variableEur,
    fixedEur,
    totalEur,
    revenueEur,
    marginEur,
    marginPct: revenueEur > 0 ? Math.round((marginEur / revenueEur) * 100) : 0,
    costPerCallEur: calls > 0 ? totalEur / calls : 0,
    lines: lines.sort((a, b) => b.eur - a.eur),
  };
}

// ── Limites des offres GRATUITES — jusqu'où on peut aller sans payer ──

export interface FreeTier {
  provider: string;
  limit: string;
  /** Ce que ça permet, traduit en appels réels. */
  realWorld: string;
  /** Bloquant pour un usage commercial ? */
  commercialOk: boolean;
  warning?: string;
}

export const FREE_TIERS: FreeTier[] = [
  {
    provider: "NVIDIA NIM (build.nvidia.com)",
    limit: "40 requêtes/min, crédits illimités depuis 2026",
    realWorld: "Largement suffisant en volume — ce n'est PAS le volume qui bloque.",
    commercialOk: false,
    warning:
      "INTERDIT EN PRODUCTION. La licence réserve l'accès gratuit au développement, aux tests, à la " +
      "recherche et à l'évaluation. Conduire des transactions commerciales exige NVIDIA AI Enterprise. " +
      "Facturer des appels servis par ce tier nous met en infraction.",
  },
  {
    provider: "Deepgram",
    limit: "200 $ de crédit offert, sans expiration",
    realWorld: "≈ 26 000 minutes de transcription streaming, soit ~13 000 appels de 2 min.",
    commercialOk: true,
    warning: "Le crédit s'épuise une fois. Après, c'est 0,0077 $/min.",
  },
  {
    provider: "Fish Audio",
    limit: "8 000 crédits/mois ≈ 7 minutes de parole",
    realWorld: "≈ 7 appels par mois. Inutilisable au-delà d'une démo.",
    commercialOk: false,
    warning: "L'offre gratuite est réservée à un usage PERSONNEL. Le commercial commence au plan payant.",
  },
  {
    provider: "LiveKit Cloud",
    limit: "Plan Build à 0 $/mois, quota de minutes inclus",
    realWorld: "Suffisant pour les tests ; au-delà du quota, 0,01 $/min de session agent.",
    commercialOk: true,
  },
  {
    provider: "Telnyx",
    limit: "Aucune offre gratuite — crédit d'essai à l'inscription",
    realWorld: "Le PSTN se paie dès le premier appel réel.",
    commercialOk: true,
  },
];

/** Le verdict : peut-on faire tourner l'offre en gratuit ? */
export const FREE_VERDICT =
  "Non. Deux verrous, et aucun n'est une question de volume : NVIDIA gratuit est interdit en " +
  "production (licence), et Fish gratuit est réservé à l'usage personnel (7 min/mois). " +
  "L'organique permet de PROTOTYPER, jamais de facturer. Le jour où on facture, la pile doit être payante.";
