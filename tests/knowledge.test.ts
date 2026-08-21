import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, extractLinks, backlinks, search, contextFromNotes, seedKnowledge, type KnowledgeNote } from "../lib/knowledge";

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
  const notes = [
    note("t", "Callflow", "un mot"),
    note("b", "Autre", "callflow callflow mentionné dans le corps"),
  ];
  const hits = search("callflow", notes);
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
  const { notesForAccount, seedScintia, seedKnowledge } = await import("../lib/knowledge");
  const all = [...seedKnowledge, ...seedScintia];

  // Depuis ScintIA : ses notes + les communes, jamais celles d'un autre compte.
  const vueScintia = notesForAccount(all, "scintia");
  assert.ok(vueScintia.some((n) => n.accountId === "scintia"));
  assert.ok(vueScintia.some((n) => !n.accountId), "les notes communes restent visibles");
  assert.equal(
    vueScintia.some((n) => n.accountId && n.accountId !== "scintia"),
    false,
    "aucune note d'un autre compte ne doit fuiter"
  );

  // Depuis EAGLEYE (client, non maître) : pas les notes ScintIA.
  const vueEagleye = notesForAccount(all, "eagleye");
  assert.equal(vueEagleye.some((n) => n.accountId === "scintia"), false);

  // Depuis le MAÎTRE : tout le portefeuille.
  assert.equal(notesForAccount(all, "eagleye", true).length, all.length);
});

test("cerveau — ScintIA est semé avec les chiffres RÉELS de juillet", async () => {
  const { seedScintia, search } = await import("../lib/knowledge");
  assert.ok(seedScintia.length >= 4);
  assert.ok(seedScintia.every((n) => n.accountId === "scintia"));

  // La leçon de juillet est retrouvable — c'est elle qui pilote la doctrine.
  const hits = search("audit taux plomberie appels", seedScintia, 3);
  assert.ok(hits.length > 0);
  assert.match(hits[0].note.body, /26/, "les 26 appels sans audit doivent être dans la note");

  // La cadence exigée par ScintIA est présente et exacte.
  const cadence = seedScintia.find((n) => /cadence/i.test(n.title))!;
  assert.match(cadence.body, /5 rappels sur 2 jours/);
  assert.match(cadence.body, /ARRÊTE/);
});
