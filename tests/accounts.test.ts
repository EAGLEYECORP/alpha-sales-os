import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNTS, getAccount, masterAccount, applyAccount, accountICP, routeAccount } from "../lib/accounts";
import { commercialFor, commissionFor } from "../lib/accounts-commercial";
import { matchOffer } from "../lib/offer-match";

test("accounts — le portefeuille contient EAGLEYE (maître), ScintIA, Nuwacom", () => {
  const ids = ACCOUNTS.map((a) => a.id);
  assert.ok(ids.includes("eagleye"));
  assert.ok(ids.includes("scintia"));
  assert.ok(ids.includes("nuwacom"));
  const masters = ACCOUNTS.filter((a) => a.kind === "master");
  assert.equal(masters.length, 1, "un seul compte maître");
  assert.equal(masterAccount().id, "eagleye");
});

test("accounts — ScintIA ne propose QUE callflow", () => {
  const scintia = getAccount("scintia");
  assert.deepEqual(scintia.offers, ["callflow"]);
  // Même un audit qui hurle « visibilité » (site absent) reste sur callflow.
  const m = matchOffer({ websiteState: "aucun", googleReviews: 0, sector: "assurance" }, scintia.offers);
  assert.equal(m.primary, "callflow");
});

test("accounts — Nuwacom : commission 15 %, plancher 40 k, entrée FR", () => {
  const n = getAccount("nuwacom");
  assert.equal(n.commissionPct, 15);
  const nc = commercialFor("nuwacom");
  assert.equal(nc.targetPerProject, 40000);
  assert.match(nc.note ?? "", /Allemagne|Benelux|Christophe/);
  const transfo = nc.offerings.find((o) => o.key === "transformation");
  assert.equal(transfo?.minHT, 40000);
});

test("accounts — ScintIA n'a QUE Callflow (le Lab est repassé à EAGLEYE)", () => {
  const s = commercialFor("scintia");
  assert.equal(s.offerings.length, 1);
  assert.equal(s.offerings[0].key, "callflow");
  assert.equal(s.offerings.some((o) => /lab/i.test(o.key)), false);
  // Et EAGLEYE porte bien la digitalisation < 40 k (l'ex-Lab).
  const e = commercialFor("eagleye");
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

test("routage — Callflow → ScintIA · > 40 k → Nuwacom · le reste → EAGLEYE", () => {
  assert.equal(routeAccount({ offer: "callflow", amountHT: 990 }).accountId, "scintia");
  // Callflow reste à ScintIA même sur un gros montant : l'offre prime.
  assert.equal(routeAccount({ offer: "callflow", amountHT: 90000 }).accountId, "scintia");
  assert.equal(routeAccount({ offer: "visibilite-growth", amountHT: 60000 }).accountId, "nuwacom");
  // Pile au seuil : 40 k reste faisable par nous.
  assert.equal(routeAccount({ offer: "alpha-sales-os", amountHT: 40000 }).accountId, "eagleye");
  assert.equal(routeAccount({ offer: "visibilite-growth", amountHT: 3000 }).accountId, "eagleye");
  // Sans info : on garde le deal (défaut = EAGLEYE).
  assert.equal(routeAccount({}).accountId, "eagleye");
});

test("accounts — commission Callflow : 30 % du setup, 10 % du mensuel", () => {
  const setup = commissionFor("scintia", { amountHT: 990 });
  assert.equal(setup.offering.key, "callflow");
  assert.equal(setup.pct, 30);
  assert.equal(setup.amount, 297); // 30 % de 990
  const monthly = commissionFor("scintia", { amountHT: 300, recurring: true });
  assert.equal(monthly.pct, 10);
  assert.equal(monthly.amount, 30);
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
  assert.equal(getAccount("eagleye").commissionPct, 100);

  // Et les offres nommées par la doctrine sont bien là.
  const cles = commercialFor("eagleye").offerings.map((o) => o.key);
  for (const attendue of ["visibilite", "alpha-sales-os-vip", "alpha-sales-os-carte", "os-personnalise"]) {
    assert.ok(cles.includes(attendue), `offre EAGLEYE manquante : ${attendue}`);
  }
});

test("accounts — les taux partiels ne concernent QUE les intermédiaires", () => {
  // ScintIA et Nuwacom sont des tiers : là, on reverse. C'est la seule
  // situation où le taux descend sous 100 %.
  assert.equal(getAccount("scintia").commissionPct, 30);
  assert.equal(getAccount("nuwacom").commissionPct, 15);
  for (const id of ["scintia", "nuwacom"]) {
    assert.ok(
      commercialFor(id).offerings.some((o) => o.commissionPct < 100),
      `${id} : un compte intermédiaire doit porter un taux partiel`
    );
  }
});

test("accounts — Nuwacom : 15 % au-delà de 40 k", () => {
  const deal = commissionFor("nuwacom", { amountHT: 60000 });
  assert.equal(deal.offering.key, "transformation");
  assert.equal(deal.pct, 15);
  assert.equal(deal.amount, 9000);
});

test("accounts — l'ICP Nuwacom cible l'assurance 25-2000 en transformation digitale", () => {
  const icp = accountICP("nuwacom");
  assert.match(icp.sector.toLowerCase(), /assur/);
  assert.match(icp.companySize, /25/);
  assert.match(icp.companySize, /2\s?000|2000/);
  assert.match(`${icp.label} ${icp.angle}`.toLowerCase(), /transformation|digital|parcours/);
  assert.equal(icp.refined, true, "ICP curé = affiné");
});

test("accounts — applyAccount produit un patch d'identité restreint (pas de fuite EAGLEYE)", () => {
  const patch = applyAccount("nuwacom");
  assert.equal(patch.accountId, "nuwacom");
  assert.equal(patch.agencyName, "Nuwacom");
  assert.equal(patch.commissionPct, 15);
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
  const forced = matchOffer({ websiteState: "aucun", googleReviews: 0 }, ["callflow"]);
  assert.equal(forced.primary, "callflow");
});
