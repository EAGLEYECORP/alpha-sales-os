import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Infos critiques manquantes — ce qu'il faut OBTENIR (souvent de l'humain)
 * pour que le process avance. Ces trous deviennent des routines et un bandeau
 * sur la fiche ; une fois remplis, on les repousse vers le CRM (Supabase →
 * Google Sheets via n8n) car ce sont des infos critiques et centralisées.
 * ─────────────────────────────────────────────────────────────────────
 */

export type GapSeverity = "bloquant" | "important";

export interface InfoGap {
  field: string;
  label: string;
  why: string;
  severity: GapSeverity;
}

/** Liste les infos critiques manquantes pour faire avancer ce prospect. */
export function criticalGaps(p: Prospect): InfoGap[] {
  const gaps: InfoGap[] = [];
  const stageRank = ["prospect", "contact", "audit", "demo", "offre", "redzone", "signe", "perdu"].indexOf(p.stage);

  if (!p.email && !p.phone) {
    gaps.push({ field: "coordonnee", label: "Email ou téléphone", why: "impossible de contacter sans coordonnée", severity: "bloquant" });
  }
  if (!p.name.trim()) {
    gaps.push({ field: "name", label: "Nom du décideur", why: "on ne closse pas un interlocuteur anonyme", severity: "important" });
  }
  // Chiffres de la Taxe d'Ignorance (dès l'audit)
  if (stageRank >= 2 && stageRank <= 5 && p.ignoranceTax <= 0 && (p.deepAudit.missedCallsPerWeek === undefined || p.deepAudit.avgTicket === undefined)) {
    gaps.push({ field: "taxe", label: "Chiffres de la Taxe d'Ignorance", why: "appels ratés/sem + panier moyen — l'argument massue du closing", severity: "important" });
  }
  // Offre personnalisée avant de closer
  if (stageRank >= 4 && stageRank <= 5 && !p.personalizedOffer.trim()) {
    gaps.push({ field: "personalizedOffer", label: "Offre personnalisée", why: "on ne présente pas d'offre non formulée", severity: "bloquant" });
  }
  // Contrat une fois signé
  if (p.stage === "signe" && p.contract.status === "aucun") {
    gaps.push({ field: "contract", label: "Contrat", why: "signé sans contrat — à faire signer", severity: "bloquant" });
  }
  return gaps;
}

/** Trou le plus grave (pour trier / afficher un badge). */
export function topGapSeverity(p: Prospect): GapSeverity | null {
  const gaps = criticalGaps(p);
  if (gaps.some((g) => g.severity === "bloquant")) return "bloquant";
  if (gaps.length) return "important";
  return null;
}
