import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToProspects } from "../lib/csv";
import { PROSPECTS_ICP_CSV, PROSPECTS_ICP_COUNT } from "../lib/prospects-icp";
import { withMetierBenchmark, auditReadiness, auditFilename } from "../lib/audit-batch";
import { verticalForProspect } from "../lib/playbook";
import type { Prospect } from "../lib/types";

test("PROSPECTS_ICP_CSV — parse en totalité, aucune ligne perdue", () => {
  const { prospects, skipped } = csvToProspects(PROSPECTS_ICP_CSV);
  assert.equal(skipped, 0, "aucune ligne ignorée");
  assert.equal(prospects.length, PROSPECTS_ICP_COUNT, "le compte annoncé correspond au parse");
  assert.ok(prospects.length >= 20, "au moins 20 fiches ICP");
});

test("PROSPECTS_ICP_CSV — toutes joignables (téléphone), et un vrai email pour certaines", () => {
  const { prospects } = csvToProspects(PROSPECTS_ICP_CSV);
  assert.ok(
    prospects.every((p) => (p.phone ?? "").trim().length > 0),
    "chaque fiche ICP a un téléphone (elle est actionnable)"
  );
  const withEmail = prospects.filter((p) => /@/.test(p.email ?? ""));
  assert.ok(withEmail.length >= 3, "plusieurs fiches ont un email (utilisables en Boîte d'envoi)");
});

test("PROSPECTS_ICP_CSV — les métiers tombent sur la bonne verticale du playbook", () => {
  const { prospects } = csvToProspects(PROSPECTS_ICP_CSV);
  const byId = (name: string) => prospects.find((p) => p.company.includes(name))!;
  assert.equal(verticalForProspect(byId("***NOM-RETIRE***"))?.id, "garage-carrosserie");
  assert.equal(verticalForProspect(byId("***NOM-RETIRE***"))?.id, "immobilier");
  assert.equal(verticalForProspect(byId("***NOM-RETIRE***"))?.id, "auto-ecole");
});

function fiche(over: Partial<Prospect>): Prospect {
  const { prospectDefaults } = require("../lib/seed") as typeof import("../lib/seed");
  return { ...prospectDefaults, id: "t", company: "Garage T", city: "Lyon", createdAt: "", updatedAt: "", ...over } as Prospect;
}

test("withMetierBenchmark — remplit la Taxe d'Ignorance depuis la verticale quand la fiche est vide", () => {
  // Un garage sans douleur chiffrée → la verticale garage la fournit.
  const p = fiche({ notes: "garage à Lyon 7", ignoranceTax: 0 });
  const before = auditReadiness(p);
  assert.equal(before.hasTax, false, "au départ, aucune taxe");
  const after = withMetierBenchmark(p);
  assert.ok(after.ignoranceTax > 0, "la taxe est estimée depuis les repères métier");
  assert.equal(auditReadiness(after).hasTax, true);
});

test("withMetierBenchmark — n'écrase JAMAIS une valeur déjà saisie", () => {
  const p = fiche({ notes: "garage", ignoranceTax: 4200 });
  assert.equal(withMetierBenchmark(p).ignoranceTax, 4200, "la taxe saisie est préservée");
});

test("withMetierBenchmark — repli sur la verticale générique pour un secteur « autre »", () => {
  // « autre » retombe sur la verticale générique : on obtient un ordre de
  // grandeur plutôt que rien (le document le présente comme une estimation).
  const p = fiche({ notes: "activité de service", sector: "autre", ignoranceTax: 0 });
  const after = withMetierBenchmark(p);
  assert.ok(after.ignoranceTax > 0, "un ordre de grandeur générique est fourni");
  assert.ok(after.deepAudit.avgTicket !== undefined, "le panier moyen générique est renseigné");
});

test("auditFilename — slug propre, sans accents ni caractères spéciaux", () => {
  assert.equal(auditFilename(fiche({ company: "***NOM-RETIRE*** & Fils" })), "audit-ets-deguillien-fils.html");
  assert.equal(auditFilename(fiche({ company: "***NOM-RETIRE***" })), "audit-o-p-i-lyon-bar-a-ongles.html");
});
