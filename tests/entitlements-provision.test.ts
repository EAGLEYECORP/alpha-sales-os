import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ETATS_ABO_OUVERTS,
  droitsPourOffre,
  ligneEntitlements,
  ligneRevocation,
  offresSansDroits,
  revocationPour,
} from "../lib/entitlements-provision";
import { OFFRES } from "../lib/offres-publiques";
import { ESSAI_JOURS } from "../lib/client-onboarding";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DE L'ARGENT REÇU AUX DROITS OUVERTS.
 *
 * Le webhook écrivait `subscriptions`. Le contrôle d'accès lit
 * `entitlements`. Les deux tables ne se parlaient pas, et la seconde
 * n'existait dans aucun fichier SQL. Le chemin NORMAL d'un client payant
 * était donc : il paie, on enregistre son abonnement, et l'application le
 * refuse — parce que `resoudreDroits` ne trouve aucune ligne et rend
 * `DROIT_REFUSE`.
 *
 * Ça ne se voyait pas : `comptesActifs()` est faux tant qu'aucun système de
 * comptes n'est configuré, donc le middleware saute ce contrôle. Le jour où
 * on vend en ligne, il ne le saute plus.
 * ─────────────────────────────────────────────────────────────────────
 */

test("CHAQUE offre du catalogue ouvre au moins une brique", () => {
  /**
   * Une offre vendue qui n'ouvre rien ne se découvre qu'au premier client
   * mécontent. Le test tourne sur le catalogue entier, donc il attrape aussi
   * les offres ajoutées plus tard.
   */
  assert.deepEqual(offresSansDroits(), [], "ces offres se vendent sans rien débloquer");
});

test("les droits correspondent aux capacités annoncées sur la page publique", () => {
  // La promesse commerciale et le droit technique doivent être le MÊME objet.
  // S'ils divergent, le client a raison et nous avons tort, chaque fois.
  for (const o of OFFRES) {
    const d = droitsPourOffre(o.id)!;
    assert.deepEqual(
      [...d.bricks].sort(),
      [...o.capacites].sort(),
      `${o.id} : ce qui est vendu et ce qui est ouvert diffèrent`
    );
  }
});

test("l'essai est marqué « essai » et porte sa date de fin", () => {
  const d = droitsPourOffre("essai", "2026-08-27T10:00:00.000Z")!;
  assert.equal(d.statut, "essai", "le marquer « actif » ferait vivre un compte gratuit indéfiniment");
  assert.equal(d.essaiJusquA, new Date(Date.UTC(2026, 7, 27, 10) + ESSAI_JOURS * 86_400_000).toISOString());
});

test("un abonnement payant est « actif » et n'a pas de date de fin d'essai", () => {
  for (const id of ["solo", "pro", "voix-1000"]) {
    const d = droitsPourOffre(id)!;
    assert.equal(d.statut, "actif", `${id} devrait être actif`);
    assert.equal(d.essaiJusquA, null, `${id} ne doit pas porter de fin d'essai`);
  }
});

test("une offre INCONNUE ne provisionne rien — et ce n'est pas « zéro brique »", () => {
  /**
   * La nuance compte : un compte provisionné à zéro brique affiche une
   * application vide, et le client croit avoir acheté du vent. Aucune ligne du
   * tout laisse `resoudreDroits` dire « compte jamais provisionné », ce qui est
   * la vérité et se répare.
   */
  assert.equal(droitsPourOffre("nawak"), null);
  assert.equal(droitsPourOffre(null), null);
  assert.equal(droitsPourOffre(""), null);
  assert.equal(ligneEntitlements({ tenantId: "u1", offreId: "nawak", encaisse: true }), null);
});

test("⚠ un paiement NON ENCAISSÉ n'ouvre aucun droit", () => {
  // Même règle que partout dans ce tunnel : « session terminée » n'est pas
  // « argent reçu ». Ouvrir avant l'encaissement, c'est livrer à crédit sans
  // l'avoir décidé.
  assert.equal(ligneEntitlements({ tenantId: "u1", offreId: "pro", encaisse: false }), null);

  const ok = ligneEntitlements({ tenantId: "u1", offreId: "pro", encaisse: true })!;
  assert.equal(ok.tenant_id, "u1");
  assert.equal(ok.statut, "actif");
  assert.ok(Array.isArray(ok.bricks) && (ok.bricks as string[]).length === 7);
});

test("le webhook provisionne VRAIMENT les droits, pas seulement l'abonnement", () => {
  /**
   * C'est le raccord qui manquait. Sans lui, tout le reste du tunnel —
   * vitrine, souscription, paiement, webhook — s'arrête à un accès refusé.
   */
  const src = readFileSync(join(process.cwd(), "app/api/webhooks/stripe/route.ts"), "utf8");
  assert.match(src, /ligneEntitlements\(/, "le webhook doit calculer les droits");
  assert.match(src, /from\("entitlements"\)/, "…et les écrire");
  assert.match(src, /onConflict: "tenant_id"/, "un rachat met à jour, il ne duplique pas");
  // L'encaissement est la condition, et elle se lit dans le statut écrit.
  assert.match(src, /ETATS_ABO_OUVERTS\.includes\(statut\)/, "les droits ne s'ouvrent que sur un état d'abonnement ouvert");
});

test("les briques provisionnées sont celles que le contrôle d'accès connaît", () => {
  /**
   * Les `capacites` viennent du catalogue public, les droits du type
   * `BrickId`. Deux listes, deux fichiers : elles peuvent diverger sans que
   * rien ne plante — le droit fantôme serait simplement ignoré, et le client
   * n'aurait pas ce qu'il a payé.
   */
  const acces = readFileSync(join(process.cwd(), "lib/bricks-access.ts"), "utf8");
  const bloc = acces.slice(acces.indexOf("export type BrickId"), acces.indexOf("CHEMINS_COMMUNS"));
  const connues = new Set([...bloc.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]));

  for (const o of OFFRES) {
    for (const c of o.capacites) {
      assert.ok(connues.has(c), `l'offre « ${o.id} » vend la capacité « ${c} », que BrickId ne connaît pas`);
    }
  }
});


// ─────────── RÉVOQUER — sinon résilier ne coûte rien ───────────

test("⚠ une résiliation FERME les droits", () => {
  /**
   * LE TROU LAISSÉ PAR LE PROVISIONNEMENT SEUL. On n'écrivait que sur
   * encaissement. À la résiliation, le webhook mettait bien
   * `subscriptions.status = "canceled"` — et la ligne `entitlements` restait
   * `actif`. Le client annulait et gardait l'accès complet, indéfiniment.
   * Les deux tables se contredisaient en silence, et c'est celle des droits
   * qui décide.
   */
  for (const etat of ["canceled", "unpaid", "incomplete_expired", "paused"]) {
    assert.deepEqual(revocationPour(etat), { statut: "suspendu" }, `${etat} doit fermer les droits`);
  }
});

test("…mais un impayé RÉCUPÉRABLE ne coupe pas tout de suite", () => {
  /**
   * `past_due` est un délai de grâce assumé : couper au premier prélèvement
   * raté ne récupère aucun impayé et transforme une carte expirée en client
   * perdu. Stripe réessaie, nous attendons.
   */
  for (const etat of ["active", "trialing", "past_due"]) {
    assert.equal(revocationPour(etat), null, `${etat} doit laisser les droits ouverts`);
  }
  // Un état inconnu ne doit pas se lire comme un état ouvert.
  assert.deepEqual(revocationPour("nawak"), { statut: "suspendu" });
  // Un état absent ne décide de rien : on ne ferme pas sur une ignorance.
  assert.equal(revocationPour(null), null);
});

test("la révocation garde les briques — elle ne fait que suspendre", () => {
  const l = ligneRevocation("u-9");
  assert.equal(l.tenant_id, "u-9");
  assert.equal(l.statut, "suspendu");
  assert.equal("bricks" in l, false, "effacer les briques perdrait ce que le client avait");
});

test("le webhook FERME avant d'ouvrir", () => {
  /**
   * L'ordre est la garde : un état fermé doit l'emporter sur ce que l'offre
   * voudrait provisionner. Inversé, un événement de résiliation portant
   * encore un plan rouvrirait les droits qu'il vient de fermer.
   */
  const src = readFileSync(join(process.cwd(), "app/api/webhooks/stripe/route.ts"), "utf8");
  const iFerme = src.indexOf("revocationPour(statut)");
  const iOuvre = src.indexOf("ligneEntitlements({");
  assert.ok(iFerme > 0 && iOuvre > 0, "les deux chemins doivent exister");
  assert.ok(iFerme < iOuvre, "la fermeture doit être évaluée AVANT l'ouverture");
  assert.match(src, /ligneRevocation\(tenantId\)/, "la fermeture doit être écrite en base");
});

test("les deux listes d'états ouverts ne peuvent pas diverger", () => {
  /**
   * `ACTIVE` dans `lib/billing.ts` gouverne le même jugement côté écran.
   * Deux listes dans deux fichiers finissent toujours par diverger — et là
   * l'écran dirait « actif » pendant que le middleware refuse, ce qui produit
   * un ticket de support impossible à reproduire.
   */
  const billing = readFileSync(join(process.cwd(), "lib/billing.ts"), "utf8");
  const ligne = billing.slice(billing.indexOf("const ACTIVE"), billing.indexOf("const ACTIVE") + 160);
  const cote = [...ligne.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(cote, [...ETATS_ABO_OUVERTS].sort(), "lib/billing.ts et lib/entitlements-provision.ts divergent");
});
