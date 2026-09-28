import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUS_AGENTS, missionEtat, HEURES_PAR_JOUR, MISSION_CIBLE } from "../lib/mission-french-tech";

/** Un mardi, avec beaucoup de marge avant la date limite du 4 septembre. */
const TOT = new Date("2026-08-04T09:00:00+02:00");
/** Trois jours avant. */
const TARD = new Date("2026-09-01T09:00:00+02:00");
/** Après. */
const APRES = new Date("2026-09-10T09:00:00+02:00");

test("lots — chacun a un livrable, un porteur et un piège nommé", () => {
  for (const a of SOUS_AGENTS) {
    assert.ok(a.livrable.length > 25, `${a.id} : un livrable vague ne se commence jamais`);
    assert.ok(a.heures > 0 && a.heures <= 8, `${a.id} : ${a.heures} h — un lot de plus d'une journée est mal découpé`);
    // Le piège est ce qui distingue une liste de tâches d'un plan.
    assert.ok(a.piege.length > 40, `${a.id} : le piège doit être précis`);
    assert.ok(["alpha", "zakaria", "duo"].includes(a.porteur));
  }
});

test("lots — les dépendances existent et ne bouclent pas", () => {
  const ids = new Set(SOUS_AGENTS.map((a) => a.id));
  for (const a of SOUS_AGENTS) {
    for (const d of a.depend) assert.ok(ids.has(d), `${a.id} dépend de « ${d} » qui n'existe pas`);
  }
  // Un lot ne peut dépendre que de lots déclarés AVANT lui : l'ordre du
  // tableau est l'ordre d'exécution, et une boucle bloquerait tout.
  const vus = new Set<string>();
  for (const a of SOUS_AGENTS) {
    for (const d of a.depend) assert.ok(vus.has(d), `${a.id} dépend de « ${d} », déclaré après lui`);
    vus.add(a.id);
  }
});

test("lots — ce que Zakaria seul peut faire est distingué du reste", () => {
  // Confondre les deux, c'est croire qu'un lot avance alors qu'il attend.
  const sien = SOUS_AGENTS.filter((a) => a.porteur === "zakaria");
  assert.ok(sien.some((a) => a.id === "pieces"), "les pièces légales ne se délèguent pas");
  assert.ok(sien.some((a) => a.id === "traction"), "les chiffres réels non plus");
  assert.ok(SOUS_AGENTS.some((a) => a.porteur === "alpha"), "et ALPHA doit porter de vrais lots");
});

test("état — le verdict dit la vérité quand le temps ne suffit pas", () => {
  const rien: string[] = [];
  const tard = missionEtat(rien, TARD);
  assert.equal(tard.verdict, "intenable");
  // Deux issues honnêtes, pas de « il faut s'y mettre ».
  assert.match(tard.message, /réduire le périmètre|dégager plus de temps/);
  assert.match(tard.message, /grille la candidature/, "le coût d'un dépôt bâclé doit être dit");
});

test("état — avec de la marge, on dit de s'en servir, pas de se rassurer", () => {
  const large = missionEtat([], TOT);
  assert.ok(["confortable", "tendu"].includes(large.verdict));
  if (large.verdict === "confortable") assert.match(large.message, /faire relire, pas pour repousser/);
});

test("état — les heures disponibles ne comptent QUE les jours ouvrés", () => {
  // Compter les week-ends serait se mentir sur la capacité réelle, et c'est
  // exactement le mensonge qui fait rater une date.
  const e = missionEtat([], TOT);
  const joursCalendaires = e.joursRestants;
  assert.ok(
    e.heuresDisponibles < joursCalendaires * HEURES_PAR_JOUR,
    "les week-ends doivent être retirés du budget"
  );
});

test("état — seuls les lots dont les dépendances sont satisfaites sont proposés", () => {
  const debut = missionEtat([], TOT);
  // Au départ, la rédaction ne peut pas commencer : elle dépend de cinq lots.
  assert.ok(!debut.prochains.some((a) => a.id === "redaction"));
  assert.ok(debut.prochains.some((a) => a.id === "eligibilite"));

  const avance = missionEtat(["eligibilite", "souverainete", "traction", "technique", "marche", "equipe"], TOT);
  assert.ok(avance.prochains.some((a) => a.id === "redaction"));
});

test("état — le goulot est le lot qui débloque le plus de suite", () => {
  const e = missionEtat([], TOT);
  // « souverainete » commande la technique puis la rédaction : c'est par lui
  // qu'il faut commencer, pas par le plus facile.
  assert.ok(e.goulot, "il doit toujours y avoir un point de départ nommé");
  assert.ok(["eligibilite", "souverainete", "traction"].includes(e.goulot!.id));
});

test("état — dépassé, on arrête de parler de dépôt", () => {
  const e = missionEtat([], APRES);
  assert.equal(e.verdict, "depasse");
  assert.match(e.message, /prochaine échéance/);
  assert.ok(e.joursRestants < 0);
});

test("état — tout fait = plus rien à dire", () => {
  const e = missionEtat(SOUS_AGENTS.map((a) => a.id), TOT);
  assert.equal(e.verdict, "confortable");
  assert.equal(e.prochains.length, 0);
  assert.equal(e.heuresRestantes, 0);
});

test("le label n'est pas présenté comme de l'argent", () => {
  // Confondre les deux fait construire un plan de trésorerie sur une
  // subvention qui n'existe pas.
  assert.match(MISSION_CIBLE.apport, /n'est pas un chèque/);
  assert.match(MISSION_CIBLE.apport, /vient toujours des clients/);
});
