import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToProspects } from "../lib/csv";
import { PROSPECTS_ICP_CSV, PROSPECTS_ICP_COUNT } from "../lib/prospects-icp";
import { FIXTURE_ICP_CSV, FIXTURE_ICP_COUNT } from "./fixtures-icp";
import { withMetierBenchmark, auditReadiness, auditFilename } from "../lib/audit-batch";
import { verticalForProspect } from "../lib/playbook";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEUX FAMILLES DE TESTS, ET IL FAUT LES GARDER SÉPARÉES.
 *
 * Ce fichier assertait tout sur `PROSPECTS_ICP_CSV`, qui se charge depuis
 * `donnees-privees/` — hors dépôt. Trois tests tombaient sur un clone propre
 * (vérifié en déplaçant le dossier et en relançant la suite), et deux d'entre
 * eux nommaient en dur de VRAIES entreprises lyonnaises issues des feuilles
 * de prospection : elles étaient donc publiées, dans un dépôt public, par le
 * fichier de test lui-même. `tests/vitrine-fuite.test.ts` refuse cette classe
 * de fuite depuis le 10/09 — sur la vitrine, pas sur les tests. Une règle
 * branchée à un endroit sur deux, une fois de plus.
 *
 * · PROPRIÉTÉS DU CODE (parseur, routage) → sur la FIXTURE. Elles tournent
 *   partout, y compris en CI.
 * · PROPRIÉTÉS DE LA DONNÉE (aucune ligne perdue, chaque fiche joignable) →
 *   sur le VRAI fichier, et **skip** déclaré quand il est absent.
 *
 * ⚠ Le `skip` n'est pas une commodité, c'est le seul choix honnête : un test
 * qui s'exécuterait sur une chaîne vide passerait en vert sans rien mesurer,
 * et personne ne le verrait jamais. Un `skip` se compte dans le rapport.
 * ─────────────────────────────────────────────────────────────────────
 */
const SANS_CSV_REEL = PROSPECTS_ICP_CSV.trim() === "";
const MOTIF_SKIP = "donnees-privees/prospects-icp.csv absent (clone propre) : rien à mesurer sur la donnée réelle";

// ── Propriétés du CODE : la fixture suffit, et elle ne ment pas ──────────

test("csvToProspects — tient le point-virgule cité, les guillemets doublés et la cellule vide", () => {
  const { prospects, skipped } = csvToProspects(FIXTURE_ICP_CSV);
  assert.equal(skipped, 0, "aucune ligne ignorée");
  assert.equal(prospects.length, FIXTURE_ICP_COUNT, "toutes les lignes ressortent");

  // Le cas qui casse tout `split(";")` : le séparateur À L'INTÉRIEUR d'un champ.
  const garage = prospects.find((p) => p.company === "Garage Ternova")!;
  assert.match(garage.notes, /carrosserie ; deux lignes fixes/, "le point-virgule cité reste dans la cellule");

  // Guillemets doublés `""` → un vrai guillemet, et pas une fin de champ.
  const regie = prospects.find((p) => p.company === "Régie Almandin")!;
  assert.match(regie.notes, /"urgences plomberie"/, "les guillemets doublés sont déséchappés");

  // Une cellule vide n'est pas une ligne perdue.
  const autoEcole = prospects.find((p) => p.company === "Auto-école Vireval")!;
  assert.equal(autoEcole.email ?? "", "", "email vide accepté");
  assert.ok((autoEcole.phone ?? "").trim().length > 0, "la fiche reste joignable par téléphone");
});

test("csvToProspects — un secteur hors enum retombe sur « autre » sans jeter la ligne", () => {
  const { prospects } = csvToProspects(FIXTURE_ICP_CSV);
  const hors = prospects.find((p) => p.company === "Ateliers Kervost")!;
  assert.ok(hors, "la ligne au secteur inconnu survit");
  assert.equal(hors.sector, "autre", "elle retombe sur « autre » plutôt que d'être ignorée");
});

test("csvToProspects — les `problems` se découpent sur `|`", () => {
  const { prospects } = csvToProspects(FIXTURE_ICP_CSV);
  const cabinet = prospects.find((p) => p.company === "Cabinet Yssembre")!;
  assert.deepEqual(cabinet.problems, ["Créneaux annulés", "Rappels manuels"]);
});

test("verticalForProspect — les métiers écrits dans les notes tombent sur la bonne verticale", () => {
  /**
   * C'est la convention dont dépend l'import ICP : le petit enum `Sector` ne
   * distingue pas garage / auto-école / régie, donc `prospects-icp` répète le
   * métier dans `notes` et c'est LUI que lit le playbook.
   *
   * ⚠ Aucun tag sur ces fiches, et c'est voulu : on veut mesurer le chemin de
   * repli par le TEXTE. Le chemin par tag, qui prime, est couvert dans
   * `tests/permis-construire.test.ts` — c'est là qu'il avait été payé (huit
   * fiches de maîtrise d'ouvrage tombaient sur la verticale auto-école).
   */
  const { prospects } = csvToProspects(FIXTURE_ICP_CSV);
  const par = (nom: string) => prospects.find((p) => p.company === nom)!;
  assert.equal(par("Garage Ternova").tags.length, 0, "aucun tag : c'est bien le texte qu'on mesure");

  assert.equal(verticalForProspect(par("Garage Ternova"))?.id, "garage-carrosserie");
  assert.equal(verticalForProspect(par("Régie Almandin"))?.id, "immobilier");
  assert.equal(verticalForProspect(par("Auto-école Vireval"))?.id, "auto-ecole");
  assert.equal(verticalForProspect(par("Cabinet Yssembre"))?.id, "sante-cabinet");
});

// ── Propriétés de la DONNÉE : le vrai fichier, ou rien ───────────────────

test("PROSPECTS_ICP_CSV — parse en totalité, aucune ligne perdue", { skip: SANS_CSV_REEL && MOTIF_SKIP }, () => {
  const { prospects, skipped } = csvToProspects(PROSPECTS_ICP_CSV);
  assert.equal(skipped, 0, "aucune ligne ignorée");
  assert.equal(prospects.length, PROSPECTS_ICP_COUNT, "le compte annoncé correspond au parse");
  assert.ok(prospects.length >= 20, "au moins 20 fiches ICP");
});

test("PROSPECTS_ICP_CSV — toutes joignables (téléphone), et un vrai email pour certaines", { skip: SANS_CSV_REEL && MOTIF_SKIP }, () => {
  const { prospects } = csvToProspects(PROSPECTS_ICP_CSV);
  assert.ok(
    prospects.every((p) => (p.phone ?? "").trim().length > 0),
    "chaque fiche ICP a un téléphone (elle est actionnable)"
  );
  const withEmail = prospects.filter((p) => /@/.test(p.email ?? ""));
  assert.ok(withEmail.length >= 3, "plusieurs fiches ont un email (utilisables en Boîte d'envoi)");
});

test("PROSPECTS_ICP_CSV — chaque fiche porte son métier en clair dans les notes", { skip: SANS_CSV_REEL && MOTIF_SKIP }, () => {
  /**
   * Remplace l'ancienne assertion, qui nommait trois entreprises réelles pour
   * vérifier leur verticale. Le ROUTAGE se mesure désormais sur la fixture ;
   * ce qui reste à vérifier sur la vraie liste est la propriété dont le
   * routage dépend — que chaque fiche soit rattachable. Aucun nom n'est cité.
   *
   * ⚠ LA LIGNE `length > 0` N'EST PAS DÉCORATIVE, elle a été ajoutée après
   * mutation. Sur une liste vide, `filter` rend `[]` et l'assertion suivante
   * passe : le test était VACANT dès que le CSV manquait. Il n'était donc
   * tenu que par le `skip` — or un test protégé par un seul garde extérieur
   * repasse en vert silencieusement le jour où ce garde saute. Un test doit
   * tomber tout seul quand il n'a rien mesuré.
   */
  const { prospects } = csvToProspects(PROSPECTS_ICP_CSV);
  assert.ok(prospects.length > 0, "aucune fiche lue : ce test n'aurait rien mesuré");
  const orphelines = prospects.filter((p) => verticalForProspect(p) === null);
  assert.deepEqual(
    orphelines.map((p) => p.company),
    [],
    "toute fiche ICP doit tomber sur une verticale du playbook, sinon elle part à l'appel sans script"
  );
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
  // ⚠ Raisons sociales INVENTÉES. Elles nommaient deux entreprises lyonnaises
  // réelles : un test n'a pas besoin d'un vrai nom pour vérifier un slug, et
  // un dépôt public publie ses tests comme le reste.
  assert.equal(auditFilename(fiche({ company: "Éts Vaubrenne & Fils" })), "audit-ets-vaubrenne-fils.html");
  assert.equal(auditFilename(fiche({ company: "K.R.T Lyon (bar à ongles)" })), "audit-k-r-t-lyon-bar-a-ongles.html");
});
