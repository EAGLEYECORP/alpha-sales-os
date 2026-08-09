import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeAudit, prospectSiteUrl } from "../lib/audit-apply";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";

function fiche(over: Partial<Prospect>): Prospect {
  return { ...prospectDefaults, id: "p1", company: "***NOM-RETIRE***", city: "Lyon", createdAt: "", updatedAt: "", ...over } as Prospect;
}

test("audit-apply — remplit les champs vides sans écraser les saisies manuelles", () => {
  const p = fiche({ solution: "MA solution à moi", personalizedOffer: "", problems: ["déjà là"] });
  const patch = mergeAudit(p, {
    rating: 4.2,
    solution: "solution IA",
    personalizedOffer: "offre IA",
    problems: ["nouveau", "déjà là"],
    missedCallsPerWeek: 10,
    avgTicket: 60,
  });
  assert.equal(patch.solution, "MA solution à moi", "la solution manuelle n'est pas écrasée");
  assert.equal(patch.personalizedOffer, "offre IA", "l'offre vide est remplie");
  assert.equal(patch.deepAudit?.googleRating, 4.2);
  assert.deepEqual(patch.problems, ["déjà là", "nouveau"], "problèmes fusionnés sans doublon");
});

test("audit-apply — recalcule la Taxe d'Ignorance depuis la douleur chiffrée", () => {
  const p = fiche({});
  const patch = mergeAudit(p, { missedCallsPerWeek: 10, avgTicket: 60 });
  // 10 * 4.33 * 30% * 60 ≈ 779
  assert.equal(patch.ignoranceTax, Math.round(10 * 4.33 * 0.3 * 60));
});

test("audit-apply — note la provenance quand l'audit vient d'un site", () => {
  const p = fiche({ notes: "" });
  const patch = mergeAudit(p, { summary: "résumé" }, "https://corzani.fr");
  assert.match(String(patch.notes), /audit auto \(site\)/);
  assert.match(String(patch.notes), /https:\/\/corzani\.fr/);
});

test("audit-apply — prospectSiteUrl extrait l'URL de websiteState", () => {
  assert.equal(prospectSiteUrl(fiche({ deepAudit: { ...prospectDefaults.deepAudit, websiteState: "vieux site https://corzani.fr daté" } })), "https://corzani.fr");
  assert.equal(prospectSiteUrl(fiche({ deepAudit: { ...prospectDefaults.deepAudit, websiteState: "aucun site" } })), null);
});
