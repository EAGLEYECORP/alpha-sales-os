import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArgumentaire, argumentaireText } from "../lib/argumentaire";
import type { Prospect } from "../lib/types";

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc Dubois",
    company: "Carrosserie Test",
    sector: "artisan",
    city: "Lyon",
    phone: "0478000000",
    email: "marc@test.fr",
    stage: "contact",
    trust: 50,
    likeness: 50,
    auditScore: 0,
    conviction: 5,
    monthlyValue: 0,
    setupValue: 0,
    probability: 20,
    ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: null,
    tags: [],
    attachments: [],
    notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

/** Une fiche avec de VRAIS chiffres → les pertes sont calculables. */
const chiffree = (over: Partial<Prospect> = {}) =>
  fixture({
    deepAudit: {
      websiteState: "",
      socialState: "",
      localCompetition: "",
      currentProcess: "",
      missedCallsPerWeek: 10,
      avgTicket: 400,
      conversionRate: 25,
    },
    ...over,
  });

test("argumentaire — la structure complète est produite, dans l'ordre", () => {
  const g = buildArgumentaire(chiffree());
  assert.ok(g.intro.includes("Marc Dubois"));
  assert.ok(g.questions.length >= 3);
  assert.ok(g.marketStandard.length >= 3);
  assert.ok(g.ourDuties.length >= 3);
  assert.ok(g.theirRights.length >= 3);
  assert.ok(g.objections.length >= 4);
  assert.ok(g.payment.length >= 4);

  const txt = argumentaireText(g);
  // Le prix arrive APRÈS la valeur — c'est l'ordre qui fait signer.
  assert.ok(txt.indexOf("Ce que ça coûte") < txt.indexOf("Notre offre et son prix"));
  assert.ok(txt.indexOf("Se présenter") < txt.indexOf("Questions qui font constater"));
});

test("argumentaire — les pertes sont chiffrées sur SES données", () => {
  const g = buildArgumentaire(chiffree());
  assert.equal(g.losses.measured, true);
  assert.ok(g.losses.perMonth > 0);
  assert.equal(g.losses.perYear, g.losses.perMonth * 12);
  assert.ok(g.losses.perDay > 0);
  // On annonce que c'est une estimation, pas une promesse.
  assert.match(g.losses.sentence, /estimation/i);
});

test("argumentaire — sans chiffres, on n'invente RIEN", () => {
  const g = buildArgumentaire(fixture());
  assert.equal(g.losses.measured, false);
  assert.equal(g.losses.perMonth, 0);
  assert.match(g.losses.sentence, /je n'ai pas encore vos volumes/i);
  // Et on assume de dire que la perte peut être négligeable.
  assert.match(g.losses.sentence, /négligeable/i);
  // L'urgence ne devient jamais une fausse rareté.
  assert.match(g.urgency, /pas d'urgence artificielle/i);
});

test("argumentaire — la taxe d'ignorance saisie prime sur le calcul", () => {
  const g = buildArgumentaire(chiffree({ ignoranceTax: 3000 }));
  assert.equal(g.losses.perMonth, 3000);
  assert.equal(g.losses.perYear, 36000);
});

test("argumentaire — l'objection prix se répond par le SOLDE, pas par une remise", () => {
  const g = buildArgumentaire(chiffree());
  const prix = g.objections.find((o) => /trop cher/i.test(o.says));
  assert.ok(prix);
  assert.match(prix!.answer, /solde|coûte/i);
  assert.doesNotMatch(prix!.answer, /remise|réduction/i);
});

test("argumentaire — ses objections RÉELLES passent devant les génériques", () => {
  const g = buildArgumentaire(
    chiffree({
      objections: [
        { id: "o1", label: "Attend la réponse au mail avant tout RDV", type: "temps", croyance: 3, status: "ouverte" },
      ],
    })
  );
  assert.match(g.objections[0].says, /Attend la réponse au mail/);
  assert.match(g.objections[0].means, /r[ée]ellement entendue/i);
});

test("argumentaire — le prix suit le compte qui porte le deal", () => {
  // Une ligne de prix « 990 € + abonnement » existait pour le compte du
  // revendeur téléphonique. Le compte est parti ; la ligne avec lui.
  assert.match(buildArgumentaire(chiffree(), "nuwacom").offer.price, /APRÈS le cadrage/i);
  // EAGLEYE sans montant sur la fiche → les deux formats officiels.
  assert.match(buildArgumentaire(chiffree(), "eagleye").offer.price, /10 000 €.*VIP|30 %/s);
});

test("argumentaire — des solutions de paiement existent si le budget est contraint", () => {
  const g = buildArgumentaire(chiffree());
  assert.ok(g.payment.some((x) => /plusieurs fois/i.test(x.label)));
  assert.ok(g.payment.some((x) => /petit/i.test(x.label)), "démarrer par une seule brique");
});

test("argumentaire — nos devoirs incluent de dire quand ça ne sert à rien", () => {
  const g = buildArgumentaire(chiffree());
  assert.ok(g.ourDuties.some((d) => /ne vend pas ce qui ne servira pas/i.test(d)));
  assert.ok(g.theirRights.some((r) => /décidez après le cadrage/i.test(r)));
});
