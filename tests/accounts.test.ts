import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCOUNTS, getAccount, masterAccount, applyAccount, accountICP, routeAccount } from "../lib/accounts";
import { ACCOUNTS_COMMERCIAL, commercialFor, commissionFor } from "../lib/accounts-commercial";
import { tauxVitrinePct } from "../lib/taux-vitrine";
import { matchOffer } from "../lib/offer-match";

test("accounts — le portefeuille contient EAGLEYE (maître) et Nuwacom", () => {
  const ids = ACCOUNTS.map((a) => a.id);
  assert.ok(ids.includes("eagleye"));
  assert.ok(ids.includes("nuwacom"));
  /**
   * ⚠ UN TROISIÈME COMPTE A ÉTÉ RETIRÉ : le revendeur qui portait l'accueil
   * téléphonique. L'accord est mort. Son offre n'a pas disparu avec lui — elle
   * est revenue chez EAGLEYE sous le nom d'Alpha Voice, à 100 % au lieu de
   * 30 % + 10 %.
   */
  assert.equal(ids.length, 2, "le portefeuille ne compte plus que deux comptes");
  assert.ok(!ids.includes("scintia"), "le compte du revendeur ne doit plus exister");
  const masters = ACCOUNTS.filter((a) => a.kind === "master");
  assert.equal(masters.length, 1, "un seul compte maître");
  assert.equal(masterAccount().id, "eagleye");
});

test("⚠ un compte revendeur reste borné à SES offres, même contre l'audit", () => {
  const nuwacom = getAccount("nuwacom");
  assert.ok(!nuwacom.offers.includes("alpha-voice"), "Nuwacom ne vend pas notre agent vocal");

  /**
   * L'audit crie « accueil téléphonique » (beaucoup d'appels manqués, métier
   * au téléphone) — et le routeur doit quand même rendre une offre que CE
   * compte a le droit de vendre. C'est la garde qui empêche de proposer au
   * nom d'un partenaire quelque chose qu'il ne porte pas.
   */
  const m = matchOffer({ missedCallsPerWeek: 12, sector: "garage" }, nuwacom.offers);
  assert.notEqual(m.primary, "alpha-voice");
  assert.ok(nuwacom.offers.includes(m.primary), "l'offre rendue doit être autorisée pour le compte");

  // Et le compte maître, lui, y a droit.
  assert.equal(matchOffer({ missedCallsPerWeek: 12, sector: "garage" }, getAccount("eagleye").offers).primary, "alpha-voice");
});

test("accounts — Nuwacom : commission 15 %, plancher 40 k, entrée FR", () => {
  const nc = commercialFor("nuwacom");
  // ⚠ Cette ligne lisait `getAccount("nuwacom").commissionPct`. Le taux est
  // sorti du registre client : il descendait dans un chunk public. On le lit
  // là où il vit maintenant — dans les offres du compte.
  assert.equal(tauxVitrinePct(nc), 15);
  assert.equal(nc.targetPerProject, 40000);
  assert.match(nc.note ?? "", /Allemagne|Benelux|Christophe/);
  const transfo = nc.offerings.find((o) => o.key === "transformation");
  assert.equal(transfo?.minHT, 40000);
});

test("⚠ Alpha Voice est chiffré chez EAGLEYE, à 100 %", () => {
  const e = commercialFor("eagleye");
  const voix = e.offerings.find((o) => o.key === "alpha-voice");
  assert.ok(voix, "l'offre vocale doit exister côté EAGLEYE");
  assert.equal(voix!.commissionPct, 100, "c'est notre offre : rien à reverser");
  assert.equal(voix!.recurringPct, 100);
  /**
   * ⚠ LE PRIX N'EST PAS ENCORE LE NÔTRE, et ça se vérifie ici plutôt que dans
   * un commentaire : la grille (990 € + paliers) était celle de l'ancien
   * partenaire. Tant que Zakaria n'a pas tranché, l'offre ne porte pas de
   * `setupHT` — elle se chiffre au cadrage.
   */
  assert.equal(voix!.setupHT, undefined, "un prix négocié par un tiers ne devient pas le nôtre par défaut");

  // La digitalisation < 40 k reste à EAGLEYE.
  const digi = e.offerings.find((o) => o.key === "digitalisation");
  assert.equal(digi?.maxHT, 40000);
  assert.ok(e.offerings.some((o) => o.key === "visibilite"), "la visibilité est à EAGLEYE");
});

test("accounts-commercial — chaque compte du portefeuille a son volet commercial", () => {
  // Le registre est scindé en DEUX fichiers pour que les montants ne descendent
  // pas dans le navigateur. Le risque de la scission, c'est qu'un compte ajouté
  // d'un côté soit oublié de l'autre — et qu'un devis se chiffre au taux de
  // repli sans que personne ne le voie.
  for (const a of ACCOUNTS) {
    const c = commercialFor(a.id);
    assert.ok(c.offerings.length > 0, `${a.id} n'a aucune offre chiffrée`);
    assert.ok(c.closing, `${a.id} n'a pas de coordonnées de closing`);
  }
});

test("accounts — le registre client ne porte ni montant ni coordonnée partenaire", () => {
  // Ce fichier est importé par le store et par cinq composants client : tout ce
  // qu'il contient part dans un chunk téléchargeable. La règle se vérifie sur
  // les DONNÉES, pas sur le type — un champ ajouté hors type passerait.
  const brut = JSON.stringify(ACCOUNTS);
  assert.doesNotMatch(brut, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, "aucune adresse email");
  assert.doesNotMatch(brut, /sales\.scintiacallflow/, "aucun panel de vente partenaire");
  assert.doesNotMatch(brut, /Christophe/i, "aucun nom de dirigeant partenaire");
  assert.doesNotMatch(brut, /"(setupHT|targetPerProject|recurringPct)"/, "aucun montant par offre");
  // 10 000 et 990 sont nos prix de setup : ils vivent dans le module serveur.
  assert.doesNotMatch(brut, /\b(10000|990)\b/, "aucun prix de setup");
});

test("routage — > 40 k → Nuwacom · tout le reste → EAGLEYE", () => {
  /**
   * ⚠ IL Y AVAIT UNE MARCHE AVANT CELLE-CI : l'accueil téléphonique partait
   * chez un revendeur QUELLE QUE SOIT la taille du deal — l'offre primait sur
   * le montant. Elle a disparu avec l'accord. Alpha Voice suit donc la règle
   * générale : faisable par nous → on le garde.
   */
  assert.equal(routeAccount({ offer: "alpha-voice", amountHT: 990 }).accountId, "eagleye");
  // Et il n'y a plus d'exception d'offre : au-delà du seuil, c'est la TAILLE
  // qui décide, pour Alpha Voice comme pour le reste.
  assert.equal(routeAccount({ offer: "alpha-voice", amountHT: 90000 }).accountId, "nuwacom");
  assert.equal(routeAccount({ offer: "visibilite-growth", amountHT: 60000 }).accountId, "nuwacom");
  // Pile au seuil : 40 k reste faisable par nous.
  assert.equal(routeAccount({ offer: "alpha-sales-os", amountHT: 40000 }).accountId, "eagleye");
  assert.equal(routeAccount({ offer: "visibilite-growth", amountHT: 3000 }).accountId, "eagleye");
  // Sans info : on garde le deal (défaut = EAGLEYE).
  assert.equal(routeAccount({}).accountId, "eagleye");
});

test("⚠ Alpha Voice ne reverse plus rien — ni sur le setup, ni sur le mensuel", () => {
  /**
   * Cette offre rapportait 30 % du setup et 10 % du mensuel : c'était la part
   * qui nous revenait en tant qu'INTERMÉDIAIRE. Nous ne le sommes plus. Un
   * taux partiel qui survivrait ici ferait disparaître du chiffre d'affaires
   * des payouts, en silence — le mode d'échec exact que ce fichier surveille.
   */
  const setup = commissionFor("eagleye", { amountHT: 990, offeringKey: "alpha-voice" });
  assert.equal(setup.offering.key, "alpha-voice");
  assert.equal(setup.pct, 100);
  assert.equal(setup.amount, 990);
  const monthly = commissionFor("eagleye", { amountHT: 300, recurring: true, offeringKey: "alpha-voice" });
  assert.equal(monthly.pct, 100);
  assert.equal(monthly.amount, 300);
});

test("accounts — TOUTE offre EAGLEYE est à 100 % : c'est notre société", () => {
  // Le taux mesure ce qui NOUS revient, pas ce que le client paie. Sur nos
  // propres offres il n'y a personne à qui reverser — un taux partiel ici
  // ferait disparaître du chiffre d'affaires des payouts sans que ça se voie.
  const digi = commissionFor("eagleye", { amountHT: 12000, offeringKey: "digitalisation" });
  assert.equal(digi.pct, 100);
  assert.equal(digi.amount, 12000);

  for (const o of commercialFor("eagleye").offerings) {
    assert.equal(o.commissionPct, 100, `${o.key} : une offre à nous n'est jamais partielle`);
    assert.equal(o.recurringPct, 100, `${o.key} : le récurrent non plus`);
  }
  assert.equal(tauxVitrinePct(commercialFor("eagleye")), 100);

  // Et les offres nommées par la doctrine sont bien là.
  const cles = commercialFor("eagleye").offerings.map((o) => o.key);
  for (const attendue of ["visibilite", "alpha-sales-os-vip", "alpha-sales-os-carte", "os-personnalise"]) {
    assert.ok(cles.includes(attendue), `offre EAGLEYE manquante : ${attendue}`);
  }
});

test("accounts — les taux partiels ne concernent QUE les intermédiaires", () => {
  // Nuwacom est un tiers : là, on reverse. C'est la seule situation où le taux
  // descend sous 100 %. Il en restait deux ; il n'en reste qu'un.
  assert.equal(tauxVitrinePct(commercialFor("nuwacom")), 15);
  assert.ok(
    commercialFor("nuwacom").offerings.some((o) => o.commissionPct < 100),
    "un compte intermédiaire doit porter un taux partiel"
  );

  /**
   * ⚠ LE PENDANT, ET C'EST LUI QUI ATTRAPE LA RÉGRESSION : aucun compte
   * NON-intermédiaire ne doit porter de taux partiel. Sans cette moitié, une
   * offre laissée à 30 % après le départ d'un partenaire passerait inaperçue.
   */
  for (const o of commercialFor("eagleye").offerings) {
    assert.equal(o.commissionPct, 100, `${o.key} : EAGLEYE ne reverse à personne`);
  }
});

test("accounts — Nuwacom : 15 % au-delà de 40 k", () => {
  const deal = commissionFor("nuwacom", { amountHT: 60000 });
  assert.equal(deal.offering.key, "transformation");
  assert.equal(deal.pct, 15);
  assert.equal(deal.amount, 9000);
});

test("accounts — l'ICP d'un partenaire a quitté le NAVIGATEUR, pas le produit", () => {
  /**
   * ⚠ CE TEST LISAIT `accountICP("nuwacom")`, DONC LE REGISTRE CLIENT.
   *
   * Il vérifiait le bon contenu au mauvais endroit : cet ICP — acheteur cible,
   * douleurs, déclencheurs, canaux, disqualifiants, angle — est notre travail
   * de ciblage SUR un partenaire, et il partait dans un chunk
   * `_next/static/**` téléchargeable sans compte. Depuis que l'inscription est
   * libre, n'importe qui lisait le dossier.
   *
   * Il vit maintenant dans `lib/accounts-commercial.ts`, servi par
   * `/api/catalogue` au compte MAÎTRE seulement. Le test suit la donnée.
   */
  const nuwa = ACCOUNTS_COMMERCIAL.find((c) => c.accountId === "nuwacom");
  assert.ok(nuwa?.icp, "le ciblage d'un partenaire doit vivre côté serveur");
  const icp = nuwa.icp;
  assert.match((icp.sector ?? "").toLowerCase(), /assur/);
  assert.match(icp.companySize ?? "", /25/);
  assert.match(icp.companySize ?? "", /2\s?000|2000/);
  assert.match(`${icp.label} ${icp.angle}`.toLowerCase(), /transformation|digital|parcours/);
});

test("⚠ accounts — le registre CLIENT ne porte plus le dossier d'un partenaire", () => {
  /**
   * La contrepartie du test précédent, et c'est elle qui garde la fuite
   * fermée. On vérifie la CONDITION sur le fichier qui descend réellement
   * dans le navigateur, pas sur une intention.
   *
   * Ce qui RESTE volontairement : l'id et les familles d'offres. Elles
   * ROUTENT (qui a le droit de porter quelle offre) et 14 tests le prouvent —
   * les retirer casse le périmètre d'offre, les rituels de closing, le
   * deep-dive et les segments. Sans nom en face, « ce compte peut porter
   * visibilite-growth » ne dit rien à personne.
   */
  const src = readFileSync(join(process.cwd(), "lib/accounts.ts"), "utf8");
  for (const secret of ["nuwacom.fr", "nuwacom.com", "Assureur en transformation", "Directeur transformation"]) {
    assert.ok(!src.includes(secret), `« ${secret} » ne doit plus descendre dans le navigateur`);
  }
});

test("accounts — applyAccount produit un patch d'identité restreint (pas de fuite EAGLEYE)", () => {
  const patch = applyAccount("nuwacom");
  assert.equal(patch.accountId, "nuwacom");
  assert.equal(patch.agencyName, "Nuwacom");
  /**
   * ⚠ CETTE LIGNE ATTENDAIT `patch.commissionPct === 15`. L'ABSENCE EST
   * MAINTENANT LE CORRECTIF, PAS UNE RÉGRESSION.
   *
   * `applyAccount` vit dans un module qui descend dans le navigateur : le
   * taux qu'il recopiait descendait avec, et publiait notre part chez
   * Nuwacom dans un chunk servi sans mot de passe. Le taux vient du serveur,
   * et c'est le sélecteur qui l'écrit dans les Réglages une fois reçu.
   *
   * On vérifie donc l'inverse de ce qui était vérifié : le patch ne DOIT
   * plus porter de taux.
   */
  assert.equal(patch.commissionPct, undefined, "le taux ne voyage plus dans le patch d'identité");
  assert.equal(patch.offer?.city, "Lyon");
  assert.match(patch.offer?.whatYouSell ?? "", /[Tt]ransformation/);
  // Ne doit JAMAIS toucher aux données/sécurité en basculant de compte.
  assert.equal((patch as Record<string, unknown>).prospects, undefined);
  assert.equal((patch as Record<string, unknown>).security, undefined);
});

test("accounts — id inconnu retombe sur le compte maître", () => {
  assert.equal(getAccount("inconnu-xyz").id, "eagleye");
  assert.equal(getAccount(undefined).id, "eagleye");
});

test("offer-match — sans contrainte, le maître garde les trois offres", () => {
  const m = matchOffer({ websiteState: "aucun", googleReviews: 0 });
  assert.equal(m.primary, "visibilite-growth");
  // allowed d'une seule offre force cette offre même sur signaux contraires.
  const forced = matchOffer({ websiteState: "aucun", googleReviews: 0 }, ["alpha-voice"]);
  assert.equal(forced.primary, "alpha-voice");
});
