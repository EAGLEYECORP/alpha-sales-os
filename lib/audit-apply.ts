import type { Prospect } from "./types";
import type { ExtractedAudit } from "./audit-extract";

/**
 * Fusionne un audit extrait dans une fiche — CONSERVATEUR (doctrine « rien ne
 * s'écrase à la main ») : remplit les champs vides, fusionne les problèmes sans
 * doublon, recalcule la Taxe d'Ignorance, note la provenance. Ne touche jamais
 * la solution/offre saisies à la main. Renvoie le patch (pas de pièce jointe —
 * c'est spécifique à l'UI de recherche collée). Pur → testable, réutilisé par
 * la fiche (deep-dive) ET la génération en lot (/audits).
 */
export function mergeAudit(p: Prospect, x: ExtractedAudit, source?: string | null): Partial<Prospect> {
  const d = p.deepAudit;
  const deepAudit: Prospect["deepAudit"] = {
    ...d,
    googleRating: x.rating ?? d.googleRating,
    googleReviews: x.reviews ?? d.googleReviews,
    websiteState: x.websiteState ?? d.websiteState,
    socialState: x.socialState ?? d.socialState,
    localCompetition: x.localCompetition ?? d.localCompetition,
    currentProcess: x.currentProcess ?? d.currentProcess,
    missedCallsPerWeek: x.missedCallsPerWeek ?? d.missedCallsPerWeek,
    avgTicket: x.avgTicket ?? d.avgTicket,
    updatedAt: new Date().toISOString(),
  };
  const tax =
    deepAudit.missedCallsPerWeek && deepAudit.avgTicket
      ? Math.round(deepAudit.missedCallsPerWeek * 4.33 * ((deepAudit.conversionRate ?? 30) / 100) * deepAudit.avgTicket)
      : p.ignoranceTax;

  const mergedProblems = [...p.problems];
  for (const pb of x.problems ?? []) {
    if (!mergedProblems.some((e) => e.toLowerCase() === pb.toLowerCase())) mergedProblems.push(pb);
  }

  const noteLines = [
    source ? `Audit auto depuis ${source}` : "",
    x.marketPosition ? `Position marché : ${x.marketPosition}` : "",
    x.audience ? `Son offre parle à : ${x.audience}` : "",
    x.summary ? `Résumé recherche : ${x.summary}` : "",
  ].filter(Boolean);
  const label = source ? "audit auto (site)" : "recherche importée";

  return {
    deepAudit,
    ignoranceTax: tax,
    problems: mergedProblems,
    solution: p.solution.trim() ? p.solution : x.solution ?? p.solution,
    personalizedOffer: p.personalizedOffer.trim() ? p.personalizedOffer : x.personalizedOffer ?? p.personalizedOffer,
    notes: noteLines.length
      ? `${p.notes ? p.notes + "\n" : ""}[${new Date().toISOString().slice(0, 10)} — ${label}]\n${noteLines.join("\n")}`
      : p.notes,
  };
}

/** URL du site d'un prospect si présente dans websiteState (pour l'audit auto). */
export function prospectSiteUrl(p: Prospect): string | null {
  const m = (p.deepAudit?.websiteState ?? "").match(/https?:\/\/[^\s)]+/i);
  return m ? m[0] : null;
}
