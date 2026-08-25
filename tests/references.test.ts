import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIABILITES, STATUTS, alertes, entete, idDepuisTitre, referenceVersNotes, resumer,
  utilisables, validerReference, type Reference,
} from "../lib/references";
import { CASHVERTISING, REFERENCES_LIVREES } from "../lib/references-seed";
import { contextFromNotes, search, type KnowledgeNote } from "../lib/knowledge";
import { elaguer, MAX_LECONS_TERRAIN } from "../lib/apprentissage";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES RÉFÉRENCES — faire entrer un livre sans dégrader la doctrine.
 *
 * La demande était « des VÉRITÉS qui nous évitent des erreurs ». Un livre
 * n'est pas une vérité : c'est l'affirmation d'un praticien. Ce qui évite
 * réellement une erreur, c'est que chaque affirmation garde attachés sa
 * PROVENANCE, son NIVEAU DE PREUVE, et le fait qu'elle CONTREDISE ou non une
 * règle maison.
 *
 * Ces tests protègent les trois. Le troisième est celui qui compte : la
 * doctrine alimente les prompts, les prompts produisent de vrais emails
 * envoyés sous le nom de Zakaria.
 * ─────────────────────────────────────────────────────────────────────
 */

const ref = (over: Partial<Reference> = {}): Reference => ({
  id: "test-source",
  titre: "Une source de test",
  auteur: "Quelqu'un",
  type: "livre",
  fiabilite: "praticien",
  pourquoi: "Elle apporte une mécanique de copywriting qu'on n'a pas ailleurs.",
  lecons: [
    {
      id: "l1",
      titre: "Une leçon",
      quoi: "Une affirmation résumée en une phrase complète, assez longue pour se relire.",
      statut: "applicable",
    },
  ],
  ...over,
});

// ── LA VALIDATION ──────────────────────────────────────────────────────

test("référence — un conflit de doctrine SANS réserve écrite est refusé", () => {
  /**
   * C'est la règle qui sauve. Marquer une leçon « contredit la doctrine » sans
   * écrire QUELLE règle elle heurte, c'est laisser un avertissement sans
   * contenu : dans six mois personne ne saura quoi arbitrer, et la leçon sera
   * appliquée par défaut.
   */
  const err = validerReference(
    ref({ lecons: [{ id: "l1", titre: "X", quoi: "Une affirmation assez longue pour passer le seuil.", statut: "conflit-doctrine" }] })
  );
  assert.ok(err.some((e) => e.champ.endsWith(".reserve")), "un conflit sans réserve doit être refusé");

  // Avec la réserve, elle passe.
  assert.deepEqual(
    validerReference(
      ref({ lecons: [{ id: "l1", titre: "X", quoi: "Une affirmation assez longue pour passer le seuil.", statut: "conflit-doctrine", reserve: "Contredit la règle Y." }] })
    ),
    []
  );
});

test("référence — même exigence pour « bloqué » et « sous condition »", () => {
  for (const statut of ["bloque", "sous-condition"] as const) {
    const err = validerReference(
      ref({ lecons: [{ id: "l1", titre: "X", quoi: "Une affirmation assez longue pour passer le seuil.", statut }] })
    );
    assert.ok(err.some((e) => e.champ.endsWith(".reserve")), `${statut} sans réserve doit être refusé`);
  }
});

test("référence — le niveau de preuve est OBLIGATOIRE", () => {
  // C'est lui qui empêche de citer un livre comme un fait maison. Sans lui,
  // toutes les affirmations arrivent au même rang dans le contexte IA.
  const err = validerReference({ ...ref(), fiabilite: undefined });
  assert.ok(err.some((e) => e.champ === "fiabilite"));
});

test("référence — une source qu'on ne sait pas justifier est refusée", () => {
  // Ajoutée par réflexe, elle diluera les recherches du Cerveau sans rien y
  // apporter : le Cerveau est un RAG lexical, chaque note en plus est du bruit
  // en plus sur toutes les autres requêtes.
  assert.ok(validerReference(ref({ pourquoi: "bien" })).some((e) => e.champ === "pourquoi"));
  assert.ok(validerReference(ref({ lecons: [] })).some((e) => e.champ === "lecons"));
});

test("référence — une leçon réduite à un fragment est refusée", () => {
  const err = validerReference(ref({ lecons: [{ id: "l", titre: "T", quoi: "trop court", statut: "applicable" }] }));
  assert.ok(err.some((e) => e.champ.endsWith(".quoi")));
});

// ── LA PROVENANCE VOYAGE AVEC LA NOTE ──────────────────────────────────

test("référence — chaque note porte son en-tête de provenance", () => {
  /**
   * L'en-tête est en TÊTE du corps, donc il survit à la troncature du contexte
   * et il est lu avant l'affirmation. Sans lui, une phrase de livre revient
   * dans un email au même rang qu'un chiffre mesuré sur nos propres affaires.
   */
  const notes = referenceVersNotes(ref());
  const lecon = notes.find((n) => !n.id.endsWith("-index"))!;
  assert.match(lecon.body, /^> \*\*Source externe/, "l'en-tête doit ouvrir la note");
  assert.match(lecon.body, /Praticien/);
  assert.equal(lecon.source, "reference");
});

test("référence — le contexte IA MARQUE les notes de source externe", () => {
  /**
   * Ceinture en plus des bretelles : le marquage est dans le titre du bloc, là
   * où aucune troncature ne peut l'emporter. L'erreur, ici, s'envoie.
   */
  const notes = referenceVersNotes(ref());
  const ctx = contextFromNotes(notes.map((note) => ({ note, score: 1 })), 5000);
  assert.match(ctx, /\[SOURCE EXTERNE — non vérifiée chez nous\]/);

  // Une note maison, elle, n'est pas marquée : le marquage doit rester rare
  // pour rester lisible.
  const maison: KnowledgeNote = {
    id: "n1", title: "Doctrine", body: "Règle maison.", tags: [],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", source: "playbook",
  };
  assert.doesNotMatch(contextFromNotes([{ note: maison, score: 1 }]), /SOURCE EXTERNE/);
});

test("référence — une leçon par note, jamais un pavé de 35", () => {
  /**
   * Le Cerveau cherche en BM25. Un document de 35 leçons remonterait en entier
   * sur n'importe quelle requête, écraserait les notes courtes et pertinentes,
   * et remplirait le budget de contexte avec 34 leçons hors sujet.
   */
  const notes = referenceVersNotes(CASHVERTISING);
  assert.equal(notes.length, CASHVERTISING.lecons.length + 1, "une note par leçon, plus l'index");

  const trouve = search("peur acariens oreiller", notes, 3);
  assert.ok(trouve.length > 0);
  assert.ok(
    trouve[0].note.title.toLowerCase().includes("peur"),
    `la recherche remonte « ${trouve[0].note.title} » au lieu de la leçon sur la peur`
  );
});

test("référence — réimporter ne duplique pas", () => {
  // Les identifiants sont déterministes : une mise à jour de la source écrase
  // les notes existantes au lieu d'en créer une seconde série.
  const a = referenceVersNotes(ref()).map((n) => n.id);
  const b = referenceVersNotes(ref()).map((n) => n.id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length, "des identifiants en double dans un même import");
  assert.equal(idDepuisTitre("Cash·vertising !! 2008"), "cash-vertising-2008");
});

test("référence — les notes de référence ne sont JAMAIS élaguées", () => {
  /**
   * `elaguer` plafonne les leçons de terrain à 400 pour tenir dans le
   * localStorage. Une référence n'est pas une leçon de terrain : elle ne
   * s'accumule pas toute seule et elle a été choisie à la main. La voir
   * disparaître silencieusement serait pire qu'un dépassement de quota.
   */
  const refs = referenceVersNotes(CASHVERTISING);
  const terrain: KnowledgeNote[] = Array.from({ length: MAX_LECONS_TERRAIN + 50 }, (_, i) => ({
    id: `t${i}`, title: `Leçon ${i}`, body: "x", tags: [],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    source: "terrain",
  }));
  const apres = elaguer([...refs, ...terrain]);
  for (const r of refs) {
    assert.ok(apres.some((n) => n.id === r.id), `la note de référence « ${r.title} » a été élaguée`);
  }
});

// ── LE TRI, QUI EST LE VRAI TRAVAIL ────────────────────────────────────

test("référence — « utilisables » exclut les conflits et les bloquées", () => {
  // Les inclure « pour voir » est exactement la manière dont une règle maison
  // se perd : elle ne se perd jamais par décision, toujours par inattention.
  const r = ref({
    lecons: [
      { id: "a", titre: "A", quoi: "Une affirmation assez longue pour passer le seuil.", statut: "applicable" },
      { id: "b", titre: "B", quoi: "Une affirmation assez longue pour passer le seuil.", statut: "sous-condition", reserve: "Si X." },
      { id: "c", titre: "C", quoi: "Une affirmation assez longue pour passer le seuil.", statut: "conflit-doctrine", reserve: "Contredit Y." },
      { id: "d", titre: "D", quoi: "Une affirmation assez longue pour passer le seuil.", statut: "bloque", reserve: "Manque Z." },
    ],
  });
  assert.deepEqual(utilisables(r).map((l) => l.id), ["a", "b"]);
  assert.deepEqual(alertes(r).map((l) => l.leconId), ["c", "d"]);
  assert.match(resumer(r).verdict, /contredisent la doctrine/);
});

test("référence — un verdict sans conflit le dit clairement", () => {
  assert.match(resumer(ref()).verdict, /aucune ne heurte la doctrine/);
});

// ── CASHVERTISING, LA SOURCE LIVRÉE ────────────────────────────────────

test("cashvertising — la référence livrée est valide", () => {
  assert.deepEqual(validerReference(CASHVERTISING), []);
  assert.ok(CASHVERTISING.lecons.length >= 30, "la synthèse porte 35 leçons, on n'en perd pas la moitié en route");
  assert.equal(REFERENCES_LIVREES[0].id, "cashvertising");
});

test("cashvertising — les leçons qui heurtent la doctrine sont MARQUÉES", () => {
  /**
   * C'est tout l'intérêt de l'exercice. Recopier 35 leçons prend dix minutes
   * et ne vaut rien ; dire lesquelles contredisent ce qu'on fait est ce qui
   * évite l'erreur. Ces quatre-là sont les pièges connus :
   *
   *  · vendre par la peur, alors que la doctrine interdit les € perdus à froid ;
   *  · bombarder de bénéfices, alors que la règle est UNE capacité à la bascule ;
   *  · la rareté fabriquée, alors que la fréquence suit la réactivité ;
   *  · la « règle de 7 », alors que 3 touches ignorées imposent de changer de canal.
   */
  const conflits = new Set(
    CASHVERTISING.lecons.filter((l) => l.statut === "conflit-doctrine").map((l) => l.id)
  );
  for (const id of ["l11-peur", "l14-bombarder-benefices", "l15-rarete", "l24-repetition"]) {
    assert.ok(conflits.has(id), `« ${id} » devrait être marquée comme contredisant la doctrine`);
  }
});

test("cashvertising — tout ce qui exige des clients est BLOQUÉ", () => {
  /**
   * Zéro vente à ce jour. Témoignages, logos, célébrités, « 101 histoires de
   * réussite » : appliquer ces leçons produirait des preuves inventées — ce
   * que les tests de la vitrine refusent déjà côté site.
   */
  const bloquees = new Set(CASHVERTISING.lecons.filter((l) => l.statut === "bloque").map((l) => l.id));
  for (const id of ["l05-modeles", "l09-preuve-valeur", "l13-credibilite-transferee", "l16-preuve-sociale", "l17-longueur-force"]) {
    assert.ok(bloquees.has(id), `« ${id} » suppose des clients qu'on n'a pas`);
  }
});

test("cashvertising — le folklore est nommé comme tel", () => {
  // La « règle de 7 » est recopiée depuis les années 1930 sans source
  // primaire. L'accepter en silence, c'est bâtir une cadence de relance
  // dessus.
  const l = CASHVERTISING.lecons.find((x) => x.id === "l24-repetition")!;
  assert.match(l.reserve ?? "", /folklore/i);
  assert.match(CASHVERTISING.pourquoi, /folklore/i, "l'avertissement doit être visible au niveau de la source");
});

test("cashvertising — aucune leçon ne se présente comme un fait mesuré chez nous", () => {
  /**
   * `mesure-maison` est la seule catégorie qui mérite le mot « vérité », et
   * elle est réservée à ce qu'on a constaté sur nos propres affaires. Un livre
   * ne peut jamais y prétendre — c'est le garde-fou de tout le module.
   */
  assert.notEqual(CASHVERTISING.fiabilite, "mesure-maison");
  const notes = referenceVersNotes(CASHVERTISING);
  for (const n of notes) {
    assert.ok(!n.tags.includes("mesure-maison"), `« ${n.title} » se présente comme mesuré chez nous`);
  }
});

test("référence — les échelles restent courtes et revues à la main", () => {
  // Une échelle de preuve à quinze niveaux ne se lit plus, donc ne s'applique
  // plus. Même logique que la liste fermée des types de proposition.
  assert.ok(FIABILITES.length <= 5);
  assert.ok(STATUTS.length <= 5);
  assert.equal(entete(ref(), ref().lecons[0]).split("\n").length, 2, "l'en-tête tient en deux lignes");
});
