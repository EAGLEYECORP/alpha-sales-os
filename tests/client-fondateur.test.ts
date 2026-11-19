import test from "node:test";
import assert from "node:assert/strict";
import { OFFRE_CLIENT_FONDATEUR, PACK_SETUP_HT, placesFondateurRestantes } from "../lib/offres-publiques";
import { prixAlphaVendAlpha } from "../lib/alpha-vend-alpha";
import { closingPret } from "../lib/reponses-inscrit";

/**
 * L'offre « client fondateur » (décidée le 19/11/2026) : une installation
 * réduite contre le droit de mesurer et de citer le résultat. Elle se dit tant
 * qu'il reste des places, et se tait ensuite.
 */

test("les places restantes sont un fait : places − places prises, jamais négatif", () => {
  assert.equal(OFFRE_CLIENT_FONDATEUR.places, 3);
  assert.equal(placesFondateurRestantes(), OFFRE_CLIENT_FONDATEUR.places - OFFRE_CLIENT_FONDATEUR.placesPrises);
  assert.ok(placesFondateurRestantes() >= 0);
});

test("l'installation fondateur est sous l'installation normale, et elle a ses trois bords", () => {
  assert.ok(OFFRE_CLIENT_FONDATEUR.installationHT < PACK_SETUP_HT);
  assert.ok(OFFRE_CLIENT_FONDATEUR.garantieJours > 0, "une durée");
  assert.ok(OFFRE_CLIENT_FONDATEUR.contreparties.some((c) => /mesur|chiffres/.test(c)), "la mesure, qui est la raison de l'offre");
  assert.ok(OFFRE_CLIENT_FONDATEUR.contreparties.some((c) => /relecture/.test(c)), "on ne cite rien sans relecture du client");
});

test("⚠ la réponse du pilote à « c'est combien ? » dit l'offre, dérivée des constantes, et tient dans les bornes du closing", () => {
  const p = prixAlphaVendAlpha();
  if (placesFondateurRestantes() > 0) {
    assert.ok(p.includes(OFFRE_CLIENT_FONDATEUR.installationHT.toLocaleString("fr-FR")));
    assert.match(p, new RegExp(`${OFFRE_CLIENT_FONDATEUR.garantieJours} jours`));
  } else {
    assert.doesNotMatch(p, /client fondateur|premiers clients/, "plus de place : l'offre se tait");
  }
  assert.ok(closingPret({ prix: p }).prix, `${p.length} caractères`);
});
