import { test } from "node:test";
import assert from "node:assert/strict";
import { estimeJetons, assemble, consommation, budgetPour, CHARS_PAR_JETON, type Bloc } from "../lib/token-budget";

const bloc = (nom: string, chars: number, priorite: 1 | 2 | 3): Bloc => ({
  nom,
  texte: `${nom} `.padEnd(chars, "x"),
  priorite,
});

test("estimation — calibrée sur le FRANÇAIS, plus coûteux que l'anglais", () => {
  assert.ok(CHARS_PAR_JETON < 4, "l'anglais fait ~4 caractères par jeton, le français moins");
  assert.equal(estimeJetons(""), 0);
  assert.equal(estimeJetons("x".repeat(36)), 10);
});

test("assemblage — sous le budget, rien n'est touché", () => {
  const r = assemble([bloc("doctrine", 360, 1), bloc("fiche", 360, 2)], 1000);
  assert.equal(r.coupes.length, 0);
  assert.match(r.texte, /doctrine/);
  assert.match(r.texte, /fiche/);
});

test("assemblage — on coupe par PRIORITÉ, pas par taille", () => {
  // Couper le plus gros est le réflexe naturel et c'est souvent le mauvais :
  // le plus gros est fréquemment l'état du pipeline, dont le modèle a besoin
  // pour ne pas inventer de chiffres.
  const r = assemble([bloc("doctrine", 3600, 1), bloc("appoint", 360, 3)], 1000);
  assert.ok(r.coupes.some((c) => c.nom === "appoint"), "l'appoint saute en premier");
  assert.match(r.texte, /doctrine/, "la doctrine reste, même si elle est dix fois plus grosse");
});

test("assemblage — un bloc de priorité 1 n'est JAMAIS coupé", () => {
  // Mieux vaut dépasser en le signalant que produire une réponse qui a perdu
  // ses règles de sécurité.
  const r = assemble([bloc("regles", 36_000, 1)], 100);
  assert.equal(r.coupes.length, 0);
  assert.ok(r.jetons > r.budget, "le dépassement est visible, pas masqué");
  assert.match(r.texte, /regles/);
});

test("assemblage — les doublons sont payés une seule fois", () => {
  const meme = { nom: "a", texte: "même bloc de doctrine", priorite: 2 as const };
  const r = assemble([meme, { ...meme, nom: "b" }, { ...meme, nom: "c" }], 10_000);
  assert.equal(r.doublons.length, 2);
  assert.equal(r.texte.split("même bloc").length - 1, 1);
});

test("assemblage — une troncature se voit dans le texte", () => {
  const r = assemble([bloc("gros", 36_000, 3)], 1000);
  assert.match(r.texte, /tronqué pour tenir dans le budget/);
  // Sans marque, le modèle complèterait le texte coupé au hasard.
});

test("consommation — le coût est ventilé par route, pour savoir où couper", () => {
  const c = consommation([
    { route: "/api/agent", jetonsEntree: 20_000, jetonsSortie: 500, at: "" },
    { route: "/api/ai", jetonsEntree: 2_000, jetonsSortie: 400, at: "" },
  ]);
  assert.equal(c.appels, 2);
  assert.equal(c.parRoute[0].route, "/api/agent", "la route la plus chère en tête");
  assert.ok(c.coutEur > 0);
});

test("consommation — le conseil dit quand le contexte DILUE, pas seulement qu'il coûte", () => {
  const gros = Array.from({ length: 12 }, () => ({
    route: "/api/agent",
    jetonsEntree: 30_000,
    jetonsSortie: 400,
    at: "",
  }));
  const c = consommation(gros);
  assert.match(c.conseil ?? "", /dilue/);
  // En dessous de 10 appels, pas assez de matière pour conseiller quoi que ce soit.
  assert.equal(consommation(gros.slice(0, 3)).conseil, undefined);
});

test("budgets — différents par route, parce que les usages le sont", () => {
  assert.ok(budgetPour("/api/agent") > budgetPour("/api/ai"), "l'agent a besoin du pipeline entier");
  assert.equal(budgetPour("/api/inconnue"), 6_000, "un repli existe pour une route non listée");
});
