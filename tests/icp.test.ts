import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveICP, mergeICP, type ICP } from "../lib/icp";

test("icp — offre logiciel de vente → ICP force de vente (famille 1)", () => {
  const icp = deriveICP({ agencyName: "EAGLEYE", whatYouSell: "Alpha Sales OS — l'OS de vente", city: "Lyon" });
  assert.match(icp.buyer.toLowerCase(), /commercial|closer|dirigeant|agence/);
  assert.ok(icp.pains.length >= 3);
  assert.ok(icp.triggers.length >= 3);
  assert.equal(icp.refined, false);
  assert.match(icp.geo, /Lyon/);
});

test("icp — offre proximité → ICP commerce local (famille 2)", () => {
  const icp = deriveICP({ agencyName: "Callflow", whatYouSell: "remplir l'agenda des commerces de proximité", city: "Lyon" });
  assert.match(icp.sector.toLowerCase(), /commerce|garage|artisan|proximité/);
  assert.match(icp.buyer.toLowerCase(), /gérant|patron/);
});

test("icp — offre inconnue → cadre par défaut, jamais vide", () => {
  const icp = deriveICP({ agencyName: "Acme", whatYouSell: "conseil quantique", valueProp: "on divise vos coûts" });
  assert.ok(icp.label.length > 0);
  assert.ok(icp.pains.length >= 1);
  assert.ok(icp.channels.length >= 1);
  assert.equal(icp.refined, false);
});

test("icp — offre vide ne casse pas", () => {
  const icp = deriveICP({});
  assert.ok(icp.label.length > 0);
  assert.ok(icp.buyer.length > 0);
});

test("icp — mergeICP complète les trous de l'IA avec le squelette", () => {
  const offer = { agencyName: "EAGLEYE", whatYouSell: "Alpha Sales OS" };
  const partial: Partial<ICP> = { label: "Mon ICP affiné", pains: ["douleur précise"] };
  const merged = mergeICP(offer, partial);
  assert.equal(merged.label, "Mon ICP affiné"); // valeur IA gardée
  assert.deepEqual(merged.pains, ["douleur précise"]);
  assert.ok(merged.buyer.length > 0); // comblé par le squelette
  assert.ok(merged.channels.length > 0);
  assert.equal(merged.refined, true);
});

test("icp — mergeICP(null) renvoie le squelette", () => {
  const merged = mergeICP({ whatYouSell: "Alpha Sales OS" }, null);
  assert.equal(merged.refined, false);
});

test("icp — mergeICP ignore les tableaux IA vides", () => {
  const merged = mergeICP({ whatYouSell: "Alpha Sales OS" }, { pains: [] });
  assert.ok(merged.pains.length > 0); // repli sur le squelette, pas un tableau vide
});
