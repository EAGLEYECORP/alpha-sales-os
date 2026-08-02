import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_ARCHETYPES,
  archetypeById,
  partnerPotential,
  prescripteurPrompt,
} from "../lib/prescripteurs";

/**
 * La doctrine prescripteur EST le produit ici : c'est elle qui part dans
 * les prompts et qui s'affiche à l'écran. Une erreur ne casse pas un
 * calcul — elle fait perdre un partenariat, c'est-à-dire des années de
 * flux. D'où des tests sur le contenu, pas seulement sur la forme.
 */

test("archétypes — chacun est complet, aucun n'est une ébauche", () => {
  assert.ok(PARTNER_ARCHETYPES.length >= 6);
  for (const a of PARTNER_ARCHETYPES) {
    assert.ok(a.motivations.length >= 2, `${a.id} : au moins deux motivations`);
    assert.ok(a.diagnostic.length >= 2, `${a.id} : au moins deux questions`);
    assert.ok(a.objections.length >= 2, `${a.id} : au moins deux objections`);
    assert.ok(a.fear.length > 40, `${a.id} : la peur doit être explicitée, pas nommée`);
    assert.ok(a.deal.why.length > 60, `${a.id} : la structure de deal doit être justifiée`);
    // La demande doit être petite et concrète — jamais « un partenariat ».
    assert.doesNotMatch(a.ask.toLowerCase(), /un partenariat/, `${a.id} : demande trop vague`);
    for (const o of a.objections) {
      assert.ok(o.a.length > 60, `${a.id} : réponse trop courte à « ${o.q} »`);
    }
  }
});

test("archétypes — les identifiants sont uniques", () => {
  const ids = PARTNER_ARCHETYPES.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("doctrine — l'argent n'est pas l'argument premier chez l'expert-comptable", () => {
  // C'est LA règle qui fait perdre ce canal quand on l'ignore : proposer une
  // commission à un expert-comptable le transforme en vendeur, rôle qu'il
  // refuse. Si un jour quelqu'un « harmonise » les structures de deal, ce
  // test doit tomber.
  const ec = archetypeById("expert-comptable")!;
  assert.match(ec.deal.structure, /[Aa]ucune commission/);

  // À l'inverse, le vendeur de caisses attend un chiffre dès le premier
  // rendez-vous : ne pas en parler passe pour de l'amateurisme.
  const caisse = archetypeById("vendeur-caisse")!;
  assert.match(caisse.deal.structure, /[Cc]ommission/);
  assert.match(caisse.deal.structure, /\d+ (à|%)/);
});

test("doctrine — le réseau consulaire ne peut pas être rémunéré", () => {
  const cci = archetypeById("reseau-consulaire")!;
  assert.match(cci.deal.structure, /[Aa]ucune commission/);
  assert.match(cci.deal.why, /détruit le canal|renouvelable/);
});

test("potentiel — toujours une fourchette, jamais un chiffre unique", () => {
  const ec = archetypeById("expert-comptable")!;
  const pot = partnerPotential(ec, 1500, 200);
  assert.ok(pot.clientsHigh > pot.clientsLow, "une projection unique ne survit pas au trimestre");
  assert.equal(pot.setupLow, pot.clientsLow * 1500);
  assert.equal(pot.recurringHigh, pot.clientsHigh * 200);
  assert.ok(pot.assumptions.length >= 3, "un chiffre sans hypothèse ne vaut rien");
});

test("potentiel — les taux restent réalistes, pas flatteurs", () => {
  for (const a of PARTNER_ARCHETYPES) {
    assert.ok(a.penetration.low > 0, `${a.id} : un plancher nul rendrait la fourchette inutile`);
    assert.ok(a.penetration.high <= 0.3, `${a.id} : au-delà de 30 % on ment au partenaire`);
    assert.ok(a.penetration.high > a.penetration.low);
  }
});

test("potentiel — un portefeuille annoncé par le partenaire remplace l'estimation", () => {
  const ec = archetypeById("expert-comptable")!;
  const pot = partnerPotential(ec, 1500, 200, 120);
  assert.equal(pot.portfolioLow, 120);
  assert.equal(pot.portfolioHigh, 120);
  assert.match(pot.assumptions[0], /120 à 120/);
});

test("prompt — la règle « ce n'est pas un prospect » est toujours présente", () => {
  // Sans elle, le modèle sert l'argumentaire appels manqués à un
  // expert-comptable et le perd en une phrase.
  for (const id of [undefined, "expert-comptable", "inconnu"]) {
    const prompt = prescripteurPrompt(id);
    assert.match(prompt, /n'est PAS un prospect/);
    assert.match(prompt, /Ne JAMAIS lui servir l'argumentaire prospect/);
    assert.match(prompt, /fourchette/);
  }
});

test("prompt — un archétype connu injecte son économie complète", () => {
  const prompt = prescripteurPrompt("assureur-pro");
  const a = archetypeById("assureur-pro")!;
  assert.match(prompt, /Assureur \/ courtier pro/);
  assert.ok(prompt.includes(a.fear));
  assert.ok(prompt.includes(a.ask));
  assert.ok(prompt.includes(a.objections[0].a));
});

test("prompt — un archétype inconnu ne fabrique pas de faux contexte", () => {
  const prompt = prescripteurPrompt("archetype-qui-nexiste-pas");
  assert.doesNotMatch(prompt, /## Archétype/);
  assert.match(prompt, /Doctrine prescripteurs/);
});

test("archetypeById — null plutôt qu'un archétype par défaut trompeur", () => {
  assert.equal(archetypeById(null), null);
  assert.equal(archetypeById(undefined), null);
  assert.equal(archetypeById("expert-comptable")?.id, "expert-comptable");
});
