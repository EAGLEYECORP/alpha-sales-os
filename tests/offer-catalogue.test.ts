import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAMILLES, OFFRES_SYSTEME, idDepuisLabel, offrePourFamille, offresActives,
  peutSupprimer, validerOffre, type Offre,
} from "../lib/offer-catalogue";
import { DEFAULT_BUSINESS_RULES } from "../lib/business-rules";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES OFFRES SONT DE LA DONNÉE, PAS DU CODE.
 *
 * Tout était en dur : `EagleyeOffer` est une union de types, les catalogues
 * sont des tableaux `const`. Ajouter une offre demandait un commit et un
 * déploiement — rédhibitoire pour un produit white-label, où chaque client
 * vend autre chose que nous.
 * ─────────────────────────────────────────────────────────────────────
 */

const offre = (over: Partial<Offre> = {}): Offre => ({
  id: "x",
  label: "Rénovation énergétique",
  what: "On refait l'isolation et on monte le dossier d'aides à votre place.",
  pitch: "",
  setupHT: 0,
  monthlyHT: 0,
  famille: "visibilite-growth",
  actif: true,
  ...over,
});

test("validation — on refuse ce qui produirait un email cassé", () => {
  // Un libellé vide sort TEL QUEL dans un email au prospect. Une description
  // vide fait écrire du vide à l'IA. Ce sont les deux seuls refus durs.
  assert.ok(validerOffre({ label: "", what: "x".repeat(20), famille: "callflow" }).some((e) => e.champ === "label"));
  assert.ok(validerOffre({ label: "Toiture", what: "trop court", famille: "callflow" }).some((e) => e.champ === "what"));
  assert.deepEqual(validerOffre(offre()), [], "une offre complète passe");
});

test("validation — une offre SANS famille est refusée", () => {
  /**
   * C'est la règle qui évite l'offre fantôme : la famille décide du compte,
   * de l'aimant et de la marche de l'escalier. Sans elle, l'offre s'affiche
   * partout et n'est traitée nulle part — pire que pas d'offre.
   */
  const err = validerOffre({ label: "Truc", what: "Une description assez longue.", famille: undefined });
  assert.ok(err.some((e) => e.champ === "famille"));
  // Et une famille inventée ne passe pas non plus.
  const err2 = validerOffre({ label: "Truc", what: "Une description assez longue.", famille: "inventee" as never });
  assert.ok(err2.some((e) => e.champ === "famille"));
});

test("validation — un prix à zéro est légitime, un prix négatif non", () => {
  // Zéro = « sur devis », cas le plus fréquent en B2B. Le confondre avec une
  // erreur obligerait à saisir un faux prix.
  assert.deepEqual(validerOffre(offre({ setupHT: 0, monthlyHT: 0 })), []);
  assert.ok(validerOffre(offre({ setupHT: -1 })).some((e) => e.champ === "setupHT"));
});

test("validation — deux offres homonymes rendent tout choix ambigu", () => {
  const existantes = [offre({ id: "a", label: "Toiture complète" })];
  const err = validerOffre(
    { label: "toiture COMPLÈTE", what: "Une description assez longue.", famille: "callflow" },
    existantes
  );
  assert.ok(err.some((e) => e.champ === "label"), "la comparaison ignore la casse");
  // Se renommer soi-même reste possible.
  assert.deepEqual(
    validerOffre({ id: "a", label: "Toiture complète", what: "Une description assez longue.", famille: "callflow" }, existantes),
    []
  );
});

test("identifiant — lisible, sans accent, et jamais en collision", () => {
  // Un id lisible se retrouve dans un export CSV ; un aléatoire non.
  assert.equal(idDepuisLabel("Rénovation Énergétique — 2024"), "renovation-energetique-2024");
  const existantes = [offre({ id: "toiture" }), offre({ id: "toiture-2" })];
  assert.equal(idDepuisLabel("Toiture", existantes), "toiture-3");
  // Un libellé sans aucun caractère utilisable ne doit pas produire un id vide.
  assert.equal(idDepuisLabel("!!!"), "offre");
});

// ── SUPPRESSION : le garde-fou qui protège l'historique ────────────────

test("suppression — une offre du socle ne s'efface pas", () => {
  // Le routage s'appuie dessus. La désactivation couvre le besoin réel
  // (« je ne vends plus ça ») sans casser les fiches signées.
  const toutes = [...OFFRES_SYSTEME];
  for (const o of OFFRES_SYSTEME) {
    const v = peutSupprimer(o, toutes);
    assert.equal(v.ok, false, `${o.id} ne doit pas être supprimable`);
    assert.match(v.raison ?? "", /désactive/i, "et il faut dire quoi faire à la place");
  }
});

test("suppression — la DERNIÈRE offre active d'une famille est protégée", () => {
  /**
   * Sans ce garde-fou, supprimer la dernière offre d'une famille laisserait
   * des prospects sans destination — et rien ne casserait visiblement.
   */
  const seule = offre({ id: "perso", famille: "callflow", systeme: undefined });
  const v = peutSupprimer(seule, [seule]);
  assert.equal(v.ok, false);
  assert.match(v.raison ?? "", /dernière offre active/i);

  // Avec une sœur active, la suppression passe.
  const soeur = offre({ id: "perso2", famille: "callflow" });
  assert.equal(peutSupprimer(seule, [seule, soeur]).ok, true);
  // Une sœur DÉSACTIVÉE ne compte pas : elle ne reçoit aucun prospect.
  assert.equal(peutSupprimer(seule, [seule, { ...soeur, actif: false }]).ok, false);
});

test("routage — chaque famille garde une destination, même tout désactivé", () => {
  // Un opérateur qui désactive tout ne doit pas obtenir un script qui parle
  // d'une offre vide : on retombe sur le libellé du socle.
  const toutDesactive = OFFRES_SYSTEME.map((o) => ({ ...o, actif: false }));
  for (const f of FAMILLES) {
    const o = offrePourFamille(toutDesactive, f.id);
    assert.ok(o, `${f.id} sans destination`);
    assert.ok(o!.label.trim().length > 0);
  }
});

test("routage — toute famille du routage a au moins une offre au socle", () => {
  // Le socle ne doit pas livrer une famille orpheline : elle n'apparaîtrait
  // dans aucune liste et le routage y enverrait quand même des prospects.
  for (const f of FAMILLES) {
    assert.ok(OFFRES_SYSTEME.some((o) => o.famille === f.id), `aucune offre système pour ${f.id}`);
  }
  assert.equal(offresActives(OFFRES_SYSTEME).length, OFFRES_SYSTEME.length);
});

// ── LA RÉPARTITION DU TRAVAIL ──────────────────────────────────────────

test("doctrine — ce qu'Alpha fait et ce que le client garde est écrit", () => {
  /**
   * La promesse floue se paie à la livraison. Alpha ne livre pas le chantier
   * et ne remplace pas la personne qui rassure ; il supprime tout ce qui se
   * trouve avant et autour. C'est injecté dans TOUTES les routes IA, donc
   * dit de la même façon partout.
   */
  assert.match(DEFAULT_BUSINESS_RULES, /LIVRAISON/);
  assert.match(DEFAULT_BUSINESS_RULES, /RÉASSURANCE HUMAINE/i);
  assert.match(DEFAULT_BUSINESS_RULES, /jamais de livrer à sa place/i);
});

test("doctrine — aucune affirmation invérifiable de supériorité", () => {
  /**
   * « Les meilleurs du marché » est une conviction, pas une preuve : zéro
   * vente à ce jour. La doctrine est injectée dans les prompts — une
   * superlative ici ressortirait dans un email envoyé à un vrai prospect,
   * et se retournerait au premier qui demande une référence.
   */
  assert.doesNotMatch(DEFAULT_BUSINESS_RULES, /meilleurs? du marché|n°\s*1|numéro un|leader/i);
});
