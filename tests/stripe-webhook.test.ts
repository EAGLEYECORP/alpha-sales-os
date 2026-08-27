import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compteDe,
  ligneDepuisAbonnement,
  ligneDepuisSession,
  paiementEncaisse,
  planDe,
  sansInconnus,
} from "../lib/stripe-webhook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE DERNIER MÈTRE DU TUNNEL — celui qui se parcourt après le paiement.
 *
 * Trois défauts y vivaient, tous invisibles à 1 025 tests : ils étaient dans
 * un `if` d'une route qu'aucun test ne pouvait appeler sans Supabase et sans
 * signature Stripe valide. Le client payait, et rien ne s'ouvrait.
 * ─────────────────────────────────────────────────────────────────────
 */

// ─────────── 1. LE CONTRAT ENTRE LES DEUX FICHIERS ───────────

/**
 * Reproduit EXACTEMENT ce que `createCheckoutSession` envoie à Stripe, en le
 * lisant dans la source. Un test qui recopierait les clés à la main
 * revaliderait la copie, pas le contrat — et c'est précisément la copie qui
 * avait divergé.
 */
function metadataEnvoyee(abonnement: boolean): Record<string, string> {
  const src = readFileSync(join(process.cwd(), "lib/stripe.ts"), "utf8");
  const bloc = src.slice(src.indexOf("createCheckoutSession"), src.indexOf("createPortalSession"));
  const out: Record<string, string> = {};
  // `metadata[x]` de la session ; puis `subscription_data[metadata][x]`,
  // qui n'est repris que si l'on est en abonnement.
  for (const m of bloc.matchAll(/"(subscription_data\[metadata\]\[|metadata\[)([a-z_]+)\]"/g)) {
    const surAbonnement = m[1].startsWith("subscription_data");
    if (surAbonnement && !abonnement) continue;
    out[m[2]] = m[2] === "user_id" ? "u-42" : "essai";
  }
  return out;
}

test("le PLAN survit au trajet checkout → webhook (paiement unique)", () => {
  /**
   * LE BUG. Le checkout posait `metadata[offre]`, le webhook lisait
   * `metadata.plan`. L'essai à 290 € était encaissé, et la ligne s'écrivait
   * avec `plan: null` : payé, aucun droit ouvert, aucune erreur nulle part.
   */
  const meta = metadataEnvoyee(false);
  const ligne = ligneDepuisSession({
    client_reference_id: "u-42",
    metadata: meta,
    payment_status: "paid",
  })!;
  assert.equal(ligne.plan, "essai", `le plan s'est perdu — métadonnées envoyées : ${JSON.stringify(meta)}`);
  assert.equal(ligne.user_id, "u-42");
  assert.equal(ligne.status, "active");
});

test("…et pour un ABONNEMENT, la session porte le plan elle aussi", () => {
  /**
   * L'abonnement ne posait de métadonnées QUE sur l'abonnement. L'événement
   * de session arrivait donc sans plan, écrivait `null`, et ne se rattrapait
   * que si `customer.subscription.created` arrivait APRÈS — ce que Stripe ne
   * garantit pas.
   */
  const ligne = ligneDepuisSession({
    client_reference_id: "u-7",
    metadata: metadataEnvoyee(true),
    payment_status: "paid",
  })!;
  assert.equal(ligne.plan, "essai", "la session d'un abonnement doit porter son plan");
});

test("les sessions de l'ANCIENNE clé se relisent encore", () => {
  // Elles existent chez Stripe et peuvent rejouer. On ne casse pas un
  // encaissement passé pour avoir renommé une clé.
  const ligne = ligneDepuisSession({ client_reference_id: "u-1", metadata: { offre: "solo" } })!;
  assert.equal(ligne.plan, "solo");
});

test("le compte vient de client_reference_id EN PRIORITÉ", () => {
  // C'est le champ que Stripe recopie tel quel depuis notre appel.
  assert.equal(compteDe({ client_reference_id: "u-1", metadata: { user_id: "u-2" } }), "u-1");
  assert.equal(compteDe({ metadata: { user_id: "u-2" } }), "u-2");
  // Sans compte, on n'écrit RIEN : mieux vaut un droit non ouvert qu'une
  // ligne rattachée au mauvais client.
  assert.equal(compteDe({}), null);
  assert.equal(ligneDepuisSession({ metadata: { plan: "pro" } }), null);
});

// ─────────── 2. « SESSION TERMINÉE » ≠ « ARGENT REÇU » ───────────

test("un paiement DIFFÉRÉ n'ouvre pas les droits", () => {
  /**
   * Sur prélèvement SEPA ou virement, la session se termine sans que rien
   * ne soit encaissé. On écrivait `status: "active"` sans regarder
   * `payment_status` — donc on livrait avant d'être payé.
   *
   * C'est exactement ce qu'on s'interdit d'écrire côté écran (« jamais
   * “paiement confirmé” sur une redirection »). La même règle doit valoir
   * ici, sinon l'honnêteté est cosmétique.
   */
  const attente = ligneDepuisSession({ client_reference_id: "u-9", payment_status: "unpaid" })!;
  assert.equal(attente.status, "pending");

  const absent = ligneDepuisSession({ client_reference_id: "u-9" })!;
  assert.equal(absent.status, "pending", "sans information, on n'ouvre pas l'accès");
});

test("…mais un montant nul ouvre bien les droits", () => {
  // Essai à 0 €, code promo à 100 % : il n'y a rien à encaisser, l'accès est dû.
  const offert = ligneDepuisSession({ client_reference_id: "u-9", payment_status: "no_payment_required" })!;
  assert.equal(offert.status, "active");
  assert.equal(paiementEncaisse({ payment_status: "paid" }), true);
  assert.equal(paiementEncaisse({ payment_status: "processing" }), false);
});

// ─────────── 3. UN ÉVÉNEMENT PARTIEL N'EFFACE RIEN ───────────

test("ce qu'on ignore n'écrase pas ce qu'on sait", () => {
  /**
   * `upsert` met à jour les colonnes fournies, `null` compris. Stripe ne
   * garantit pas l'ordre des webhooks : reçu après l'abonnement, l'événement
   * de session remettait `plan` et `current_period_end` à `null`, et
   * l'abonnement devenait invisible pour les droits d'accès.
   */
  const partielle = sansInconnus({ user_id: "u-3", plan: null, email: undefined, status: "active" });
  assert.deepEqual(Object.keys(partielle).sort(), ["status", "user_id"]);
  assert.equal("plan" in partielle, false, "un plan inconnu ne doit pas partir en base");

  // La clé du conflit survit même si tout le reste est inconnu.
  assert.deepEqual(sansInconnus({ user_id: "u-4", plan: null }), { user_id: "u-4" });
});

test("l'ordre des webhooks ne peut plus casser un abonnement", () => {
  // Simulation du mauvais ordre : l'abonnement d'abord, la session ensuite.
  const abo = sansInconnus(
    ligneDepuisAbonnement("customer.subscription.created", {
      id: "sub_1",
      metadata: { user_id: "u-5", plan: "pro" },
      status: "active",
      current_period_end: 1_800_000_000,
    }, () => null)!
  );
  const session = sansInconnus(ligneDepuisSession({ client_reference_id: "u-5", payment_status: "paid" })!);

  const enBase = { ...abo, ...session };
  assert.equal(enBase.plan, "pro", "la session ne doit pas effacer le plan de l'abonnement");
  assert.ok(enBase.current_period_end, "ni la date de fin de période");
});

// ─────────── 4. Le cycle de vie de l'abonnement ───────────

test("une résiliation se lit comme une résiliation", () => {
  const l = ligneDepuisAbonnement(
    "customer.subscription.deleted",
    { id: "sub_2", metadata: { user_id: "u-6" }, status: "active" },
    () => null
  )!;
  assert.equal(l.status, "canceled", "le type de l'événement prime sur le statut de l'objet");
});

test("un abonnement sans métadonnées retombe sur l'ID de prix", () => {
  const l = ligneDepuisAbonnement(
    "customer.subscription.updated",
    { id: "sub_3", metadata: { user_id: "u-8" }, items: { data: [{ price: { id: "price_pro" } }] } },
    (id) => (id === "price_pro" ? "pro" : null)
  )!;
  assert.equal(l.plan, "pro");
  assert.equal(l.status, "inactive", "un statut absent ne doit jamais passer pour actif");
});

// ─────────── 5. La route n'a plus de décision à elle ───────────

test("la route ne redécide rien dans son coin", () => {
  /**
   * Toute la logique est sortie pour être testable. Si une condition revient
   * dans la route, elle redevient invisible aux tests — et c'est exactement
   * comme ça que les trois défauts ci-dessus ont vécu.
   */
  const src = readFileSync(join(process.cwd(), "app/api/webhooks/stripe/route.ts"), "utf8");
  assert.match(src, /ligneDepuisSession\(obj\)/);
  assert.match(src, /ligneDepuisAbonnement\(type, obj/);
  assert.match(src, /sansInconnus\(ligne\)/, "l'écriture doit passer par le filtre");
  assert.doesNotMatch(src, /status:\s*"active"/, "aucune décision de statut ne doit rester dans la route");
});
