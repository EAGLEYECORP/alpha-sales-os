import { test } from "node:test";
import assert from "node:assert/strict";
import { leconDeDebrief, leconDObjection, leconDePerte, empreinte } from "../lib/apprentissage";
import { commissionFor } from "../lib/accounts-commercial";
import { search } from "../lib/knowledge";
import type { KnowledgeNote } from "../lib/knowledge";
import { prospect } from "./fixtures";

/**
 * La mémoire qui s'écrit toute seule.
 *
 * Aucun modèle n'est entraîné ici — le dire autrement serait mentir. Ce qui
 * change, c'est que le Cerveau n'est plus en lecture seule pour la machine :
 * ce qui se passe en rendez-vous y entre, avec le secteur et le segment, et
 * ressort sur le prospect SUIVANT du même métier.
 */

const NOW = new Date("2026-08-23T10:00:00+02:00");
const daté = (l: ReturnType<typeof leconDeDebrief>): KnowledgeNote =>
  ({ ...l!, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() });

test("apprentissage — un débrief vide n'écrit RIEN", () => {
  // Règle 2 : une mémoire qui absorbe tout devient du bruit, et une recherche
  // lexicale noyée dans le bruit ressort n'importe quoi.
  const rien = leconDeDebrief({ prospect: prospect({ company: "Garage X" }), resume: "   ", now: NOW });
  assert.equal(rien, null);
});

test("apprentissage — l'identifiant est STABLE : rejouer met à jour, ne duplique pas", () => {
  // Un bouton cliqué deux fois ne doit pas doubler la mémoire.
  const p = prospect({ id: "p1", company: "Garage X" });
  const a = leconDeDebrief({ prospect: p, resume: "Il veut voir la démo.", now: NOW });
  const b = leconDeDebrief({ prospect: p, resume: "Il veut voir la démo, et parler budget.", now: NOW });
  assert.equal(a!.id, b!.id, "même prospect, même jour = même leçon");

  // Une objection différente donne un id différent — sinon on écraserait.
  const o1 = leconDObjection({ prospect: p, objection: "C'est trop cher", reponse: "…", aDebloque: true });
  const o2 = leconDObjection({ prospect: p, objection: "J'ai pas le temps", reponse: "…", aDebloque: true });
  assert.notEqual(o1!.id, o2!.id);
});

test("apprentissage — la leçon est RETROUVABLE sur un prospect similaire", () => {
  /**
   * C'est tout l'intérêt du dispositif, et le point où il pouvait rater en
   * silence : la recherche est LEXICALE. Une leçon dont le corps ne contient
   * pas le mot du métier ne ressortira jamais, même parfaitement taguée.
   */
  const source = prospect({ id: "p1", company: "Carrosserie des Lilas", sector: "artisan" });
  const lecon = daté(
    leconDeDebrief({
      prospect: source,
      resume: "Le patron est sous un capot toute la journée, personne ne décroche.",
      cequiAMarche: "Lui faire compter ses appels manqués du mois devant moi.",
      now: NOW,
    })
  );

  // Un AUTRE prospect, même métier : la leçon doit remonter.
  const suivant = prospect({ id: "p2", company: "Garage Vaillant", sector: "artisan" });
  const hits = search(`${suivant.company} ${suivant.sector} appels manqués`, [lecon], 3);
  assert.ok(hits.length > 0, "la leçon d'un artisan doit ressortir pour un autre artisan");
  assert.match(hits[0].note.body, /artisan/i, "le secteur doit être dans le CORPS, pas seulement en tag");
});

test("apprentissage — une objection qui a raté est marquée comme telle", () => {
  // Resservir une réponse qui n'a pas marché est pire que ne rien dire :
  // l'IA la rejouerait avec assurance.
  const p = prospect({ company: "Garage X", sector: "artisan" });
  const rate = leconDObjection({ prospect: p, objection: "C'est trop cher", reponse: "J'ai baissé le prix.", aDebloque: false });
  assert.match(rate!.body, /N'a PAS débloqué/);
  assert.ok(rate!.tags.includes("rate"));

  const marche = leconDObjection({ prospect: p, objection: "C'est trop cher", reponse: "Je lui ai fait chiffrer sa perte.", aDebloque: true });
  assert.match(marche!.body, /A DÉBLOQUÉ/);
  assert.ok(marche!.tags.includes("marche"));
});

test("apprentissage — une perte sans raison n'entre pas dans le Cerveau", () => {
  const p = prospect({ company: "Garage X" });
  assert.equal(leconDePerte({ prospect: p, raison: "" }), null);
  const vraie = leconDePerte({ prospect: p, raison: "Parti chez un concurrent moins cher.", concurrent: "WebLyon" });
  assert.match(vraie!.body, /WebLyon/);
  assert.equal(vraie!.source, "terrain");
});

test("apprentissage — tout ce qui est appris est marqué « terrain »", () => {
  // Une leçon tirée d'UN cas ne pèse pas comme une règle de la maison.
  // L'opérateur doit pouvoir faire le tri d'un coup d'œil.
  const p = prospect({ company: "Garage X" });
  for (const l of [
    leconDeDebrief({ prospect: p, resume: "x", now: NOW }),
    leconDObjection({ prospect: p, objection: "a", reponse: "b", aDebloque: true }),
    leconDePerte({ prospect: p, raison: "c" }),
  ]) {
    assert.equal(l!.source, "terrain");
    assert.ok(l!.tags.includes("terrain"));
  }
});

test("empreinte — déterministe, et deux textes proches ne collent pas", () => {
  assert.equal(empreinte("C'est trop cher"), empreinte("  c'est TROP cher  "));
  assert.notEqual(empreinte("C'est trop cher"), empreinte("C'est trop long"));
});

// ── LES TERMES DU DEAL PRIMENT SUR LA RÉFÉRENCE ────────────────────────

test("deal — le taux négocié écrase la référence, et l'écart est dit", () => {
  /**
   * Chaque affaire se structure différemment. Le barème dit ce qu'on VISE ; la
   * fiche dit ce qui sera FACTURÉ. Afficher le barème quand la réalité est
   * ailleurs, c'est se mentir sur ses propres prévisions.
   */
  const reference = commissionFor("nuwacom", { amountHT: 60000 });
  assert.equal(reference.pct, 15);
  assert.equal(reference.source, "reference");

  const negocie = commissionFor("nuwacom", { amountHT: 60000, deal: { commissionPct: 25 } });
  assert.equal(negocie.pct, 25);
  assert.equal(negocie.amount, 15000);
  assert.equal(negocie.source, "deal");
  assert.equal(negocie.referencePct, 15, "on garde le point de comparaison");
});

test("deal — 15 % chez Nuwacom est un PLANCHER, et l'app le dit", () => {
  // Écrire un chiffre fixe faisait croire que le taux était acquis — donc le
  // laissait sur la table. Le contrat se dresse après le cadrage : il est
  // encore temps de le remonter, à condition qu'on le rappelle.
  const q = commissionFor("nuwacom", { amountHT: 60000 });
  assert.ok(q.offering.pctEstPlancher, "l'offre porte un plancher");
  assert.match(q.alerte ?? "", /PLANCHER/);
  assert.ok((q.offering.leviers ?? []).length >= 2, "les leviers doivent être nommés, pas sous-entendus");
});

test("deal — signer SOUS le plancher se voit", () => {
  const q = commissionFor("nuwacom", { amountHT: 60000, deal: { commissionPct: 10 } });
  assert.equal(q.pct, 10);
  assert.match(q.alerte ?? "", /SOUS le plancher/);
});

test("deal — une offre sans plancher ne déclenche aucune alerte", () => {
  // Le bruit tue l'alerte : si tout alerte, plus rien n'alerte.
  const q = commissionFor("scintia", { amountHT: 990 });
  assert.equal(q.alerte, undefined);
  const e = commissionFor("eagleye", { amountHT: 12000, offeringKey: "digitalisation" });
  assert.equal(e.alerte, undefined);
});
