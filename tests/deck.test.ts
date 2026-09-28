import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeck, renderDeck, type DeckPrix } from "../lib/deck";
import { quoteBricks, PACK_SETUP_HT, PACK_MONTHLY_HT } from "../lib/bricks";
import { guessSegmentForProspect } from "../lib/segments";
import { prospect } from "./fixtures";
import type { Stage } from "../lib/types";

const AVANT_OFFRE: Stage[] = ["prospect", "contact", "audit", "demo"];
const APRES_OFFRE: Stage[] = ["offre", "redzone", "signe"];

/**
 * Le chiffrage tel que le SERVEUR le produit — le test le fabrique lui-même,
 * parce que `lib/deck.ts` ne peut plus importer la grille : il est appelé
 * depuis une page client, et tout ce qu'il importe part dans le navigateur.
 */
const prixDe = (p: Parameters<typeof buildDeck>[0]): DeckPrix => {
  const seg = guessSegmentForProspect({ sector: p.sector, company: p.company, notes: p.notes, problems: p.problems });
  const q = quoteBricks(seg?.entryBricks ?? []);
  return {
    setupHT: q.setupHT,
    monthlyHT: q.monthlyHT,
    recommendation: q.recommendation,
    packSetupHT: PACK_SETUP_HT,
    packMonthlyHT: PACK_MONTHLY_HT,
  };
};

const texte = (stage: Stage, over = {}) => {
  const p = prospect({ stage, company: "Toitures du Rhône", ...over });
  return JSON.stringify(buildDeck(p, "eagleye", new Date(), prixDe(p)));
};

test("prix — AUCUN montant avant l'étape offre, à aucune étape", () => {
  // La règle la plus chère de la maison. Elle est tenue par CONSTRUCTION :
  // la fonction ne produit pas la diapositive, ce n'est pas un réglage qu'on
  // peut oublier de cocher.
  for (const stage of AVANT_OFFRE) {
    const p = prospect({ stage, setupValue: 3500, monthlyValue: 364 });
    // On FOURNIT le chiffrage : la preuve n'a de valeur que si le prix était
    // disponible et que la fonction a quand même refusé de l'afficher.
    const d = buildDeck(p, "eagleye", new Date(), prixDe(p));
    const brut = JSON.stringify(d);
    assert.doesNotMatch(brut, /HT\/mois|d'installation|Installation :/, `${stage} : un prix a fui`);
    assert.ok(
      d.omissions.some((o) => /Aucun prix/.test(o)),
      `${stage} : l'absence de prix doit être expliquée à l'opérateur`
    );
  }
});

test("prix — il apparaît à partir de l'offre, avec l'ancrage sur le pack", () => {
  for (const stage of APRES_OFFRE) {
    const brut = texte(stage);
    assert.match(brut, /Installation :/, `${stage} : le prix doit être là`);
    assert.match(brut, /pack complet/, `${stage} : l'ancrage doit être montré, pas plaidé`);
  }
});

test("prix — sans chiffrage serveur, aucun montant inventé : l'omission est dite", () => {
  // Le chiffrage se calcule côté serveur pour que la grille ne parte pas dans
  // le navigateur. Le risque introduit : si l'appel échoue, la présentation
  // pourrait afficher un prix approximatif. Elle n'en affiche aucun — et elle
  // le DIT à l'opérateur, sinon il présente sans savoir qu'il manque une
  // diapositive.
  for (const stage of APRES_OFFRE) {
    const d = buildDeck(prospect({ stage, company: "Toitures du Rhône" }));
    assert.doesNotMatch(JSON.stringify(d), /Installation :/, `${stage} : pas de prix sans chiffrage`);
    assert.ok(
      d.omissions.some((o) => /chiffrage n'a pas répondu/.test(o)),
      `${stage} : l'opérateur doit savoir que le prix manque`
    );
  }
});

test("chiffres — la perte n'apparaît que si elle a été SAISIE", () => {
  const sans = buildDeck(prospect({ stage: "audit", ignoranceTax: 0 }));
  assert.ok(!sans.slides.some((s) => s.figure), "aucun chiffre inventé");
  assert.ok(sans.omissions.some((o) => /n'a pas été chiffré/.test(o)));

  const avec = buildDeck(prospect({ stage: "audit", ignoranceTax: 2400 }));
  const fig = avec.slides.find((s) => s.figure)!.figure!;
  assert.match(fig.value, /2\s*400/);
  assert.match(fig.label, /28\s*800/, "le montant annuel se déduit, il ne s'invente pas");
  // Toujours annoncé comme une hypothèse : un chiffre présenté comme une
  // garantie se retourne au premier rendez-vous technique.
  assert.match(fig.caveat ?? "", /à valider|jamais une garantie/);
});

test("étape froide — on vend le rendez-vous, pas la solution", () => {
  for (const stage of ["prospect", "contact"] as Stage[]) {
    const d = buildDeck(prospect({ stage }));
    const brut = JSON.stringify(d);
    assert.match(brut, /Vingt minutes/);
    assert.match(brut, /aucun prix annoncé/i);
  }
  // Dès l'audit, on montre ce qu'on installe.
  assert.doesNotMatch(texte("audit"), /Vingt minutes, chez vous/);
});

test("chaque présentation se termine par une suite DATÉE", () => {
  const sansDate = buildDeck(prospect({ stage: "demo", nextStep: null }));
  const derniere = sansDate.slides[sansDate.slides.length - 1];
  assert.match(JSON.stringify(derniere), /À dater maintenant/);

  const avecDate = buildDeck(prospect({ stage: "demo", nextStep: { date: "2026-09-02T10:00:00+02:00", action: "Démo mobile" } }));
  assert.match(JSON.stringify(avecDate.slides.at(-1)), /Démo mobile/);
});

test("le rituel de closing du compte est celui de la dernière diapositive", () => {
  // Se tromper de rituel perd le deal au dernier mètre : un deal Nuwacom ne se
  // close pas avec un devis EAGLEYE.
  const eagleye = JSON.stringify(buildDeck(prospect({ stage: "offre" }), "eagleye").slides.at(-1));
  assert.match(eagleye, /DEVIS EAGLEYE/i);

  const nuwacom = JSON.stringify(buildDeck(prospect({ stage: "offre" }), "nuwacom").slides.at(-1));
  assert.match(nuwacom, /CADRAGE/i);
  assert.doesNotMatch(nuwacom, /DEVIS EAGLEYE/i, "le rituel du maître ne doit pas fuiter sur un revendeur");
});

test("l'opérateur est averti quand le prix part sur un dossier froid", () => {
  const froid = buildDeck(prospect({ stage: "offre", trust: 10, conviction: 2, demoShownBeforePrice: false }));
  assert.ok(froid.omissions.some((o) => /Signaux vitaux/.test(o)), "afficher un prix sur un vital rouge doit alerter");
});

test("chaque diapositive porte une intention, et une seule", () => {
  const d = buildDeck(prospect({ stage: "offre", ignoranceTax: 1200, problems: ["Devis jamais relancés"] }));
  assert.ok(d.slides.length >= 5 && d.slides.length <= 9, `${d.slides.length} diapositives — trop, ou trop peu`);
  for (const s of d.slides) {
    assert.ok(s.title.length > 3, "une diapositive sans titre n'a pas d'intention");
    assert.ok(s.bullets.length <= 5, "au-delà de 5 puces, personne ne lit");
  }
});

test("rendu HTML — autonome, échappé, imprimable", () => {
  const d = buildDeck(prospect({ stage: "offre", company: 'Toitures <script>alert("x")</script>' }));
  const html = renderDeck(d);
  assert.match(html, /^<!doctype html>/);
  // Aucune ressource externe : le document doit s'ouvrir hors ligne, dans dix
  // ans, sans que rien n'ait bougé.
  assert.doesNotMatch(html, /<script[^>]*src=|https?:\/\/(?!schema)/);
  // Le nom de société est échappé — un client peut avoir un nom biscornu.
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /@media print/);
});
