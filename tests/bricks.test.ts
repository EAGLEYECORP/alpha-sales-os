import { test } from "node:test";
import assert from "node:assert/strict";
import { BRICKS, quoteBricks, quoteText, unlockedRoutes, PACK_SETUP_HT, getBrick } from "../lib/bricks";

test("bricks — chaque brique a un prix, un argument et des routes", () => {
  for (const b of BRICKS) {
    assert.ok(b.setupHT > 0, `${b.id} sans prix d'installation`);
    assert.ok(b.monthlyHT > 0, `${b.id} sans abonnement`);
    assert.ok(b.why.length > 30, `${b.id} sans argument`);
    assert.ok(b.unlocks.length > 0, `${b.id} n'ouvre rien`);
  }
});

test("bricks — l'ANCRAGE tient : la somme des briques dépasse largement le pack", () => {
  const total = BRICKS.reduce((s, b) => s + b.setupHT, 0);
  assert.ok(total > PACK_SETUP_HT * 1.5, `somme ${total} doit écraser le pack ${PACK_SETUP_HT}`);
});

test("bricks — une seule brique : on ne pousse PAS le pack", () => {
  const q = quoteBricks(["alpha-voice"]);
  assert.equal(q.bricks.length, 1);
  assert.equal(q.recommendPack, false);
  assert.match(q.recommendation, /n'est pas justifié aujourd'hui/i);
});

test("bricks — Alpha Voice seul : setup + mensuel + première année", () => {
  const q = quoteBricks(["alpha-voice"]);
  assert.equal(q.setupHT, 3500);
  assert.equal(q.monthlyHT, 390);
  assert.equal(q.firstYearHT, 3500 + 390 * 12);
});

test("bricks — à partir de 3 briques, le pack devient arithmétiquement évident", () => {
  const q = quoteBricks(["alpha-voice", "campagnes", "cerveau"]);
  assert.equal(q.setupHT, 8500);
  assert.equal(q.recommendPack, true);
  // Ici la carte est encore moins chère : on le dit honnêtement, sans mentir.
  // \s : toLocaleString("fr-FR") sépare les milliers par U+202F, pas un espace.
  assert.match(q.recommendation, /pour 1\s500 € de plus/i);
});

test("bricks — quand la carte dépasse le pack, l'économie est chiffrée", () => {
  const q = quoteBricks(["alpha-voice", "campagnes", "cerveau", "crm", "audits"]);
  assert.ok(q.setupHT > PACK_SETUP_HT);
  assert.equal(q.recommendPack, true);
  assert.equal(q.packSavesSetup, q.setupHT - PACK_SETUP_HT);
  assert.match(q.recommendation, /économisez/i);
});

test("bricks — un id inconnu est ignoré, pas d'erreur", () => {
  const q = quoteBricks(["alpha-voice", "nawak"]);
  assert.equal(q.bricks.length, 1);
  assert.equal(getBrick("nawak"), undefined);
});

test("bricks — le client ne voit QUE les routes de ses briques", () => {
  const routes = unlockedRoutes(["alpha-voice"]);
  assert.ok(routes.includes("/voice"));
  assert.equal(routes.includes("/campaigns"), false, "il n'a pas pris les campagnes");
});

test("bricks — le devis est complet et mentionne les coûts à la charge du client", () => {
  const txt = quoteText(quoteBricks(["alpha-voice"]), "ScintIA");
  assert.match(txt, /DEVIS — ScintIA/);
  assert.match(txt, /contact@eagleyecorp\.fr/);
  assert.match(txt, /3\s500 € HT/);
  assert.match(txt, /390 € HT\/mois/);
  // On n'enterre pas les coûts externes dans une note de bas de page.
  assert.match(txt, /À votre charge/);
  assert.match(txt, /Bon pour accord/);
  // Les droits du client figurent noir sur blanc.
  assert.match(txt, /Aucun engagement de durée/);
});
