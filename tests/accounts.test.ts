import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNTS, getAccount, masterAccount, applyAccount, accountICP } from "../lib/accounts";
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

test("accounts — Nuwacom : commission 15 %, objectif 5 500 €, ex-ScintIA Lab", () => {
  const n = getAccount("nuwacom");
  assert.equal(n.commissionPct, 15);
  assert.equal(n.targetPerProject, 5500);
  assert.ok(/lab/i.test(n.note ?? ""));
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
