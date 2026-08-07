import type { Prospect } from "./types";
import { verticalForProspect } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Outils du LOT d'audits — préparer et générer l'audit cadeau pour une
 * fiche OU plusieurs, depuis un endroit central (/audits).
 *
 * Rien ici ne remplace le deep-dive fiche par fiche : c'est le même
 * document (`renderAuditSheet`), mais produit en série. Deux aides :
 *  · `withMetierBenchmark` remplit la douleur chiffrée (Taxe d'Ignorance)
 *    depuis les repères de la verticale, UNIQUEMENT là où la fiche est
 *    vide — pour qu'un audit généré en lot ne sorte pas sans son chiffre.
 *  · `auditReadiness` dit, sans jargon, ce que l'audit contiendra.
 *
 * Doctrine : ces chiffres sont des ORDRES DE GRANDEUR diagnostiques, pas
 * des chiffres audités. Le document le dit lui-même (« estimation à
 * valider »). On ne les présente jamais comme certains.
 * ─────────────────────────────────────────────────────────────────────
 */

const WEEKS_PER_MONTH = 4.33;

/**
 * Renvoie une COPIE de la fiche avec la douleur chiffrée complétée depuis
 * la verticale du playbook — sans jamais écraser une valeur déjà saisie.
 * Si aucune verticale ne correspond, la fiche est renvoyée inchangée.
 */
export function withMetierBenchmark(p: Prospect): Prospect {
  const v = verticalForProspect(p);
  if (!v) return p;
  const d = p.deepAudit;
  const missedCallsPerWeek = d.missedCallsPerWeek ?? Math.round((v.leak.callsPerMonth * v.leak.missRate) / WEEKS_PER_MONTH);
  const avgTicket = d.avgTicket ?? v.leak.avgTicket;
  const conversionRate = d.conversionRate ?? Math.round(v.leak.convertRate * 100);
  const deepAudit = { ...d, missedCallsPerWeek, avgTicket, conversionRate, updatedAt: d.updatedAt ?? new Date().toISOString() };
  const ignoranceTax =
    p.ignoranceTax > 0
      ? p.ignoranceTax
      : Math.round(missedCallsPerWeek * WEEKS_PER_MONTH * (conversionRate / 100) * avgTicket);
  return { ...p, deepAudit, ignoranceTax };
}

export interface AuditReadiness {
  /** L'audit affichera-t-il la Taxe d'Ignorance (chiffre) ? */
  hasTax: boolean;
  /** L'audit affichera-t-il des constats ? */
  hasProblems: boolean;
  /** Des données marché (note Google, site…) sont-elles présentes ? */
  hasMarket: boolean;
  /** Une verticale du playbook est-elle reconnue (repères disponibles) ? */
  hasVertical: boolean;
}

export function auditReadiness(p: Prospect): AuditReadiness {
  const d = p.deepAudit;
  return {
    hasTax: p.ignoranceTax > 0 || (d.missedCallsPerWeek !== undefined && d.avgTicket !== undefined),
    hasProblems: p.problems.length > 0,
    hasMarket: d.googleRating !== undefined || Boolean(d.websiteState?.trim()) || Boolean(d.socialState?.trim()),
    hasVertical: verticalForProspect(p) !== null,
  };
}

/** Nom de fichier propre pour un audit téléchargé. */
export function auditFilename(p: Prospect): string {
  const slug = p.company.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `audit-${slug || "prospect"}.html`;
}
