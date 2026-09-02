import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_MAGNETS, magnetsFor, pickMagnet, magnetEmail, magnetById } from "../lib/lead-magnet";
import { getAccount, ACCOUNTS } from "../lib/accounts";
import type { Prospect } from "../lib/types";

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc Dubois", company: "Carrosserie Test", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "contact", trust: 50, likeness: 50, auditScore: 60,
    conviction: 5, monthlyValue: 0, setupValue: 0, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("tiers — EAGLEYE est interne, TOUT client est VIP d'emblée", () => {
  assert.equal(getAccount("eagleye").tier, "interne");
  for (const a of ACCOUNTS.filter((x) => x.kind === "client")) {
    assert.equal(a.tier, "vip", `${a.id} doit entrer directement en VIP`);
  }
});

test("aimant — chaque aimant est utile même sans achat, et ciblé", () => {
  for (const m of LEAD_MAGNETS) {
    assert.ok(m.contains.length >= 3, `${m.id} trop maigre`);
    assert.ok(m.standaloneValue.length > 40, `${m.id} sans valeur autonome`);
    assert.ok(m.triggers.length >= 2, `${m.id} sans déclencheur — donc non ciblé`);
    assert.ok(m.targets.length > 20);
    // Il mène au cadrage, pas à la vente : on ne demande jamais plus qu'un créneau.
    assert.match(m.ask, /minutes|quart d'heure/i);
  }
});

test("⚠ aimant — un compte ne sert que les aimants de SES offres", () => {
  /**
   * Le compte mono-offre qui servait d'exemple ici (le revendeur téléphonique)
   * a disparu, et l'audit téléphone est revenu chez EAGLEYE. L'invariant tient
   * toujours : un compte ne peut pas promettre un document rattaché à une
   * offre qu'il n'a pas le droit de vendre.
   */
  const nuwacom = magnetsFor("nuwacom");
  assert.ok(!nuwacom.some((m) => m.id === "audit-telephone"), "Nuwacom ne vend pas notre agent vocal");
  for (const m of nuwacom) {
    assert.ok(
      getAccount("nuwacom").offers.includes(m.offer),
      `${m.id} : un aimant servi doit correspondre à une offre du compte`
    );
  }

  // EAGLEYE, lui, porte les trois — dont l'audit téléphone, désormais à nous.
  const eagleye = magnetsFor("eagleye");
  assert.equal(eagleye.length, 3);
  assert.ok(eagleye.some((m) => m.id === "audit-telephone"));
});

test("aimant — le choix suit le deep-dive, pas le hasard", () => {
  // Appels manqués → audit téléphone.
  const tel = pickMagnet(
    fixture({ deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 9 } })
  )!;
  assert.equal(tel.magnet.offer, "alpha-voice");

  // Invisible en ligne → audit visibilité.
  const vis = pickMagnet(
    fixture({ deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "", currentProcess: "", googleReviews: 2 } })
  )!;
  assert.equal(vis.magnet.offer, "visibilite-growth");
});

test("aimant — le teaser n'existe QUE si les chiffres sont mesurés", () => {
  const chiffre = pickMagnet(
    fixture({
      deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 10, avgTicket: 400 },
    })
  )!;
  assert.ok(chiffre.teaser, "avec des chiffres réels, on accroche avec le montant");
  assert.match(chiffre.teaser!, /€ par mois/);

  // Sans données : aucun teaser inventé.
  const vide = pickMagnet(fixture())!;
  assert.equal(vide.teaser, undefined);
  assert.match(vide.why, /trop pauvre/i);
});

test("aimant — le crochet est personnalisé avec le prénom quand on l'a", () => {
  const avec = pickMagnet(fixture({ name: "Marc Dubois", deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 8 } }))!;
  assert.match(avec.hook, /« Marc,/);
  // « Gérant » n'est pas un prénom : on ne l'utilise pas.
  const sans = pickMagnet(fixture({ name: "Gérant", deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 8 } }))!;
  assert.doesNotMatch(sans.hook, /« Gérant,/);
});

test("aimant — l'email ne contient JAMAIS de prix", () => {
  const p = fixture({ deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 10, avgTicket: 400 } });
  const pick = pickMagnet(p)!;
  const mail = magnetEmail(pick, p, "Zakaria", "EAGLEYE CORP");
  assert.match(mail.subject, /Carrosserie Test/);
  assert.match(mail.body, /C'est à vous, que l'on travaille ensemble ou non/);
  // Aucune mention tarifaire : le prix vient après le cadrage.
  assert.doesNotMatch(mail.body, /10 000|990 €|364 €|30 %|tarif|prix/i);
});

test("aimant — un compte sans offre correspondante ne sert rien plutôt qu'un hors-sujet", () => {
  assert.equal(magnetById("inconnu"), undefined);
  // Nuwacom : visibilité + alpha-sales-os autorisés, donc pas d'audit téléphone.
  const n = magnetsFor("nuwacom");
  assert.equal(n.some((m) => m.offer === "alpha-voice"), false);
});
