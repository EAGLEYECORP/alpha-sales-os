import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyStripeSignature,
  statusGrantsAccess,
  isOwnerServer,
  planForPriceId,
} from "../lib/stripe";

const SECRET = "whsec_test_0123456789abcdef";

/** Forge un en-tête Stripe-Signature comme Stripe le ferait. */
function sign(payload: string, secret = SECRET, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const NOW = Math.floor(Date.now() / 1000);
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

test("stripe — signature valide dans la tolérance → acceptée", () => {
  assert.equal(verifyStripeSignature(BODY, sign(BODY), SECRET, 300, NOW), true);
});

test("stripe — mauvais secret → refusée", () => {
  assert.equal(verifyStripeSignature(BODY, sign(BODY, "whsec_pirate"), SECRET, 300, NOW), false);
});

test("stripe — corps falsifié après signature → refusé", () => {
  const header = sign(BODY);
  assert.equal(verifyStripeSignature(BODY + "x", header, SECRET, 300, NOW), false);
});

test("stripe — horodatage hors tolérance (rejeu) → refusé", () => {
  const old = NOW - 10_000;
  assert.equal(verifyStripeSignature(BODY, sign(BODY, SECRET, old), SECRET, 300, NOW), false);
});

test("stripe — en-tête absent ou malformé → refusé, ne jette pas", () => {
  assert.equal(verifyStripeSignature(BODY, null, SECRET), false);
  assert.equal(verifyStripeSignature(BODY, "n'importe quoi", SECRET), false);
  assert.equal(verifyStripeSignature(BODY, `t=${NOW}`, SECRET, 300, NOW), false); // pas de v1
});

test("stripe — plusieurs v1, un seul bon → accepté", () => {
  const t = NOW;
  const good = createHmac("sha256", SECRET).update(`${t}.${BODY}`).digest("hex");
  const header = `t=${t},v1=deadbeef,v1=${good}`;
  assert.equal(verifyStripeSignature(BODY, header, SECRET, 300, NOW), true);
});

test("stripe — statuts qui donnent accès", () => {
  for (const s of ["active", "trialing", "past_due"]) assert.equal(statusGrantsAccess(s), true, s);
  for (const s of ["canceled", "unpaid", "inactive", "", null, undefined]) assert.equal(statusGrantsAccess(s), false, String(s));
});

test("stripe — allowlist propriétaire (insensible à la casse)", () => {
  process.env.OWNER_EMAILS = "Boss@Eagleye.fr, autre@x.fr";
  assert.equal(isOwnerServer("boss@eagleye.fr"), true);
  assert.equal(isOwnerServer("BOSS@EAGLEYE.FR"), true);
  assert.equal(isOwnerServer("intrus@x.fr"), false);
  assert.equal(isOwnerServer(null), false);
  delete process.env.OWNER_EMAILS;
  assert.equal(isOwnerServer("boss@eagleye.fr"), false, "sans allowlist, personne n'est proprio");
});

test("stripe — résolution plan ↔ prix depuis l'env", () => {
  process.env.STRIPE_PRICE_SOLO = "price_solo_1";
  process.env.STRIPE_PRICE_PRO = "price_pro_1";
  assert.equal(planForPriceId("price_solo_1"), "solo");
  assert.equal(planForPriceId("price_pro_1"), "pro");
  assert.equal(planForPriceId("price_inconnu"), null);
  assert.equal(planForPriceId(null), null);
  delete process.env.STRIPE_PRICE_SOLO;
  delete process.env.STRIPE_PRICE_PRO;
});
