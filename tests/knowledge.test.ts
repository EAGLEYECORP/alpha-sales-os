import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, extractLinks, backlinks, search, contextFromNotes, type KnowledgeNote } from "../lib/knowledge";
import { seedKnowledge, seedTerrain, SEED_NOTES } from "../lib/knowledge-seed";

function note(id: string, title: string, body: string): KnowledgeNote {
  return { id, title, body, tags: [], createdAt: "2026-08-10T00:00:00Z", updatedAt: "2026-08-10T00:00:00Z", source: "manuel" };
}

test("knowledge — tokenize : minuscules, sans accents, sans stopwords", () => {
  const t = tokenize("Le Générateur d'ICP à Lyon");
  assert.ok(t.includes("generateur"));
  assert.ok(t.includes("icp"));
  assert.ok(t.includes("lyon"));
  assert.ok(!t.includes("le")); // stopword
  assert.ok(!t.includes("a")); // stopword court
});

test("knowledge — extractLinks lit les [[wikilinks]] (dédupliqués)", () => {
  const links = extractLinks("voir [[Offre]] et [[Chiffres]] puis encore [[Offre]]");
  assert.deepEqual(links.sort(), ["Chiffres", "Offre"]);
});

test("knowledge — backlinks trouve qui mentionne une note", () => {
  const notes = [
    note("a", "Offre", "le produit"),
    note("b", "Play", "utilise [[Offre]] ici"),
    note("c", "Autre", "rien"),
  ];
  const bl = backlinks("Offre", notes);
  assert.equal(bl.length, 1);
  assert.equal(bl[0].id, "b");
});

test("knowledge — search classe la note pertinente en premier", () => {
  const notes = [
    note("1", "Délivrabilité email", "SPF DKIM DMARC réputation d'envoi"),
    note("2", "Closing terrain", "objection prix silence next step"),
    note("3", "Voix", "agent vocal divulgation"),
  ];
  const hits = search("comment améliorer la délivrabilité de mes emails", notes);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].note.id, "1");
});

test("knowledge — search : le titre pèse plus que le corps", () => {
  // Terme neutre : ce test mesure le classement, pas le nom d'une offre —
  // qu'il portait avant, et qui a bougé quand l'offre a changé de nom.
  const notes = [
    note("t", "Standard", "un mot"),
    note("b", "Autre", "standard standard mentionné dans le corps"),
  ];
  const hits = search("standard", notes);
  // Le titre exact doit sortir en tête malgré la fréquence plus faible.
  assert.equal(hits[0].note.id, "t");
});

test("knowledge — search vide / sans correspondance renvoie []", () => {
  assert.deepEqual(search("", [note("a", "x", "y")]), []);
  assert.deepEqual(search("zzz introuvable", [note("a", "x", "y")]), []);
});

test("knowledge — contextFromNotes respecte le plafond de caractères", () => {
  const notes = [note("a", "Un", "x".repeat(200)), note("b", "Deux", "y".repeat(200))];
  const hits = notes.map((n) => ({ note: n, score: 1 }));
  const ctx = contextFromNotes(hits, 250);
  assert.ok(ctx.includes("Un"));
  assert.ok(!ctx.includes("Deux")); // coupé par le plafond
});

test("knowledge — le socle de départ est cohérent et relié", () => {
  assert.ok(seedKnowledge.length >= 3);
  // « Offre » pointe vers « Chiffres — preuve de concept ».
  const offre = seedKnowledge.find((n) => n.id === "seed-offre")!;
  assert.ok(extractLinks(offre.body).some((l) => l.includes("Chiffres")));
  // Les rétroliens fonctionnent sur le socle.
  const bl = backlinks("Routage d'offre", seedKnowledge);
  assert.ok(bl.length >= 1);
});

test("cerveau — les notes sont cloisonnées par compte", async () => {
  const { notesForAccount } = await import("../lib/knowledge");
  /**
   * ⚠ Le socle ne porte plus de note rattachée à un compte revendeur : le pipe
   * de juillet appartenait au partenaire disparu et il est revenu chez EAGLEYE.
   * Le CLOISONNEMENT, lui, doit continuer de marcher — c'est ce que ce test
   * garde. On le vérifie donc sur une note construite ici, pas sur le hasard
   * du contenu du socle : sinon le test deviendrait vert par vacuité.
   */
  const all = [
    ...SEED_NOTES,
    { ...note("x", "Note revendeur", "réservée à un compte tiers"), accountId: "nuwacom" },
  ];

  // Depuis Nuwacom : ses notes + les communes, jamais celles d'un autre compte.
  const vueNuwacom = notesForAccount(all, "nuwacom");
  assert.ok(vueNuwacom.some((n) => n.accountId === "nuwacom"));
  assert.ok(vueNuwacom.some((n) => !n.accountId), "les notes communes restent visibles");
  assert.equal(
    vueNuwacom.some((n) => n.accountId && n.accountId !== "nuwacom"),
    false,
    "aucune note d'un autre compte ne doit fuiter"
  );

  // Depuis EAGLEYE (non maître) : pas les notes Nuwacom.
  const vueEagleye = notesForAccount(all, "eagleye");
  assert.equal(vueEagleye.some((n) => n.accountId === "nuwacom"), false);

  // Depuis le MAÎTRE : tout le portefeuille.
  assert.equal(notesForAccount(all, "eagleye", true).length, all.length);
});

test("cerveau — le socle porte les chiffres RÉELS de juillet, rapatriés chez EAGLEYE", async () => {
  assert.ok(seedTerrain.length >= 4);
  assert.ok(seedTerrain.every((n) => n.accountId === "eagleye"));

  // La leçon de juillet est retrouvable — c'est elle qui pilote la doctrine.
  const hits = search("audit taux plomberie appels", seedTerrain, 3);
  assert.ok(hits.length > 0);
  assert.match(hits[0].note.body, /26/, "les 26 appels sans audit doivent être dans la note");

  // La cadence de rappel est présente et exacte.
  const cadence = seedTerrain.find((n) => /cadence/i.test(n.title))!;
  assert.match(cadence.body, /5 rappels sur 2 jours/);
  assert.match(cadence.body, /ARRÊTE/);
});
