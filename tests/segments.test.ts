import { test } from "node:test";
import assert from "node:assert/strict";
import { SEGMENTS, segmentById, segmentsForBrick, segmentsForAccount, guessSegment, guessSegmentForProspect } from "../lib/segments";
import { BRICKS } from "../lib/bricks";
import { getAccount } from "../lib/accounts";

test("segments — chacun porte une douleur, des déclencheurs et des disqualifiants", () => {
  for (const s of SEGMENTS) {
    assert.ok(s.corePain.length > 40, `${s.id} : la douleur centrale doit être précise`);
    assert.ok(s.pains.length >= 3, `${s.id} : trop peu de douleurs`);
    assert.ok(s.triggers.length >= 3, `${s.id} : sans déclencheur, on ne sait pas QUAND approcher`);
    // Dire non vite vaut mieux que traîner un dossier qui ne signera pas.
    assert.ok(s.disqualifiers.length >= 2, `${s.id} : sans disqualifiant, on perd du temps`);
    assert.ok(s.entryBricks.length >= 1, `${s.id} : aucune brique d'entrée`);
    assert.ok(s.examples.length >= 3, `${s.id} : trop abstrait pour être reconnu`);
  }
});

test("segments — les briques d'entrée existent réellement au catalogue", () => {
  const ids = new Set(BRICKS.map((b) => b.id));
  for (const s of SEGMENTS) {
    for (const b of s.entryBricks) {
      assert.ok(ids.has(b), `${s.id} pointe vers une brique inexistante : ${b}`);
    }
  }
});

test("segments — l'ICP ne se limite plus à l'artisan local", () => {
  const ids = SEGMENTS.map((s) => s.id);
  assert.ok(ids.includes("equipe-terrain"), "les équipes terrain (toiture, photovoltaïque) sont couvertes");
  assert.ok(ids.includes("centre-appels"), "les centres d'appels sont couverts");
  assert.ok(ids.includes("reseau-franchise"), "les réseaux et franchises sont couverts");
  assert.ok(ids.includes("commerce-local"), "le marché d'origine reste couvert");
  assert.ok(SEGMENTS.length >= 6);
});

test("segments — une brique renvoie les segments qu'elle sert", () => {
  const voice = segmentsForBrick("alpha-voice").map((s) => s.id);
  assert.ok(voice.includes("centre-appels"));
  assert.ok(voice.includes("commerce-local"));

  // Alpha Live est la brique d'ENTRÉE des équipes terrain : c'est elle qu'ils
  // achètent, parce qu'elle agit pendant le rendez-vous.
  const live = segmentsForBrick("alpha-live").map((s) => s.id);
  assert.ok(live.includes("equipe-terrain"), "Alpha Live sert d'abord les équipes terrain");
});

test("segments — un compte mono-offre ne voit que ses segments", () => {
  const scintia = segmentsForAccount(getAccount("scintia").offers);
  assert.ok(scintia.every((s) => s.offer === "callflow"));
  assert.ok(scintia.some((s) => s.id === "centre-appels"));
  // Le compte maître les voit tous ou presque.
  assert.ok(segmentsForAccount(getAccount("eagleye").offers).length >= scintia.length);
});

test("devine — le secteur oriente vers le bon segment", () => {
  assert.equal(guessSegment({ sector: "centre d'appels" })?.id, "centre-appels");
  assert.equal(guessSegment({ sector: "Isolation et photovoltaïque" })?.id, "equipe-terrain");
  assert.equal(guessSegment({ sector: "carrosserie" })?.id, "commerce-local");
  assert.equal(guessSegment({ sector: "agence marketing" })?.id, "agence-b2b");
  assert.equal(guessSegment({ sector: "mutuelle santé" })?.id, "assurance-transformation");
  assert.equal(guessSegment({ sector: "réseau de franchises" })?.id, "reseau-franchise");
});

test("devine — sans signal clair, on renvoie null plutôt qu'un mauvais segment", () => {
  // Un pitch adressé au mauvais profil prouve qu'on n'a pas compris.
  assert.equal(guessSegment({ sector: "" }), null);
  assert.equal(guessSegment({ sector: "activité indéterminée" }), null);
  // Mais une équipe commerciale de 3+ suffit à trancher.
  assert.equal(guessSegment({ sector: "inconnu", salesTeamSize: 8 })?.id, "equipe-terrain");
});

test("devine — sur une fiche réelle, le métier vient des NOTES, pas de l'enum secteur", () => {
  // Le cas qui compte : `sector` vaut « autre » (l'enum n'a que 5 valeurs) et
  // le vrai métier a atterri dans les notes à l'import CSV.
  const poseur = guessSegmentForProspect({
    sector: "autre",
    company: "Toitures du Rhône",
    notes: "Métier : couverture et isolation. 12 commerciaux en porte-à-porte.",
  });
  assert.equal(poseur?.id, "equipe-terrain");

  const plateau = guessSegmentForProspect({
    sector: "autre",
    company: "Groupe Sélénis",
    notes: "Métier : centre d'appels, 60 positions.",
  });
  assert.equal(plateau?.id, "centre-appels");

  // Et le marché d'origine ne doit pas régresser : « pub » manquait au filtre.
  assert.equal(guessSegmentForProspect({ sector: "pub", company: "The Smoking Dog" })?.id, "commerce-local");
  assert.equal(guessSegmentForProspect({ sector: "ambulance" })?.id, "commerce-local");

  // Rien de parlant nulle part → toujours null, jamais un segment au hasard.
  assert.equal(guessSegmentForProspect({ sector: "autre", company: "SARL Dupont", notes: "" }), null);
});

test("segments — chaque angle nomme LEUR problème, pas notre produit", () => {
  for (const s of SEGMENTS) {
    assert.match(s.angle, /«/, `${s.id} : l'angle doit être une phrase dicible`);
    // Aucun angle ne doit commencer par le nom du produit.
    assert.doesNotMatch(s.angle, /^«\s*(Alpha|Notre|Nous)/i, `${s.id} : l'angle parle de nous, pas de lui`);
  }
});

test("segments — un id inconnu ne fait pas planter", () => {
  assert.equal(segmentById("nawak" as never), undefined);
  assert.deepEqual(segmentsForBrick("inexistant"), []);
});
