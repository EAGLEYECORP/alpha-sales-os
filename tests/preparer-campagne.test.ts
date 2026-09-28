import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prospect } from "../lib/types";
import { prospectDefaults } from "../lib/seed";
import { preparerCampagne } from "../lib/preparer-campagne";
import { verifieDivulgation } from "../lib/signature-ia";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";
import { DO_NOT_CALL_TAG } from "../lib/voice-script";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PRÉPARER UNE CAMPAGNE — le plan qui n'envoie rien.
 *
 * Ce que le test tient :
 *  · qui entre dans le lot (éligible à froid) et qui en sort, avec la raison ;
 *  · le palier du jour PLAFONNE (il ne décore pas) : le reste attend ;
 *  · la divulgation IA (art. 50) est présente sur CHAQUE mail retenu, vérifiée
 *    par la MÊME fonction que `/api/send` ;
 *  · `envoiBranche` est toujours `false` — rien ne part d'ici.
 * ─────────────────────────────────────────────────────────────────────
 */

// Domaine NON réservé (≠ example.*/.test/.invalid) pour ne pas être pris pour
// une adresse de démo, et nom d'entreprise manifestement fictif.
let n = 0;
function prospect(over: Partial<Prospect> = {}): Prospect {
  n += 1;
  const now = new Date().toISOString();
  return {
    ...prospectDefaults,
    id: `fix-${n}`,
    company: `Fixture Promotion ${n}`,
    name: `Prénom${n} Nom${n}`,
    email: `contact${n}@acme-fixture-${n}.fr`,
    stage: "prospect",
    createdAt: now,
    updatedAt: now,
    ...over,
  } as Prospect;
}

test("un prospect à froid éligible entre dans le lot, avec objet + corps", () => {
  const plan = preparerCampagne([prospect()]);
  assert.equal(plan.retenus.length, 1);
  assert.equal(plan.ecartes.length, 0);
  assert.equal(plan.eligiblesTotal, 1);
  assert.ok(plan.retenus[0].subject.length > 0);
  assert.ok(plan.retenus[0].body.length > 0);
});

test("⚠ le plan ne rend AUCUNE adresse email — seulement le texte à relire", () => {
  const p = prospect({ email: "secret@acme-fixture-x.fr" });
  const plan = preparerCampagne([p]);
  const dump = JSON.stringify(plan);
  assert.ok(!dump.includes("secret@acme-fixture-x.fr"), "l'email ne doit jamais sortir dans le plan");
});

test("⚠⚠ chaque mail retenu porte la divulgation IA (art. 50), et le préflight le confirme", () => {
  const plan = preparerCampagne([prospect(), prospect()]);
  assert.equal(plan.divulgationManquante.length, 0);
  for (const l of plan.retenus) {
    assert.ok(l.body.includes(DIVULGATION_ECRITE), "le corps doit contenir la divulgation exacte");
  }
});

test("le garde du préflight MORD : un corps sans aveu IA est refusé par verifieDivulgation", () => {
  // On prouve que la fonction utilisée par le préflight attrape bien un mail
  // autonome sans divulgation — sinon `divulgationManquante` serait décoratif.
  const sansAveu = "Bonjour, 15 minutes pour vous montrer notre outil ? Bien à vous.";
  assert.ok(verifieDivulgation(sansAveu, "email", "autonome").length > 0);
});

test("sans email → écarté avec raison", () => {
  const plan = preparerCampagne([prospect({ email: undefined })]);
  assert.equal(plan.retenus.length, 0);
  assert.equal(plan.ecartes.length, 1);
  assert.match(plan.ecartes[0].raison, /email/i);
});

test("mauvais stade (offre) → écarté : ce n'est pas un premier contact", () => {
  const plan = preparerCampagne([prospect({ stage: "offre" })]);
  assert.equal(plan.retenus.length, 0);
  assert.equal(plan.ecartes.length, 1);
  assert.match(plan.ecartes[0].raison, /stade|contact/i);
});

test("prospect en opposition (ne-pas-appeler) → écarté", () => {
  const plan = preparerCampagne([prospect({ tags: [DO_NOT_CALL_TAG] })]);
  assert.equal(plan.retenus.length, 0);
  assert.equal(plan.ecartes.length, 1);
});

test("chaque écarté porte une raison non vide (jamais décoratif)", () => {
  const plan = preparerCampagne([prospect({ email: undefined }), prospect({ stage: "offre" })]);
  assert.equal(plan.ecartes.length, 2);
  for (const e of plan.ecartes) assert.ok(e.raison.trim().length > 0);
});

test("⚠⚠ le palier du jour PLAFONNE le lot — le reste attend un prochain tour", () => {
  const lot = [prospect(), prospect(), prospect(), prospect()]; // 4 éligibles
  const plan = preparerCampagne(lot, { plafond: 2 });
  assert.equal(plan.eligiblesTotal, 4);
  assert.equal(plan.retenus.length, 2, "coupé au palier");
  assert.equal(plan.plafonneAuPalier, true);
  assert.equal(plan.plafond, 2);
});

test("sous le palier, rien n'est coupé et plafonneAuPalier est faux", () => {
  const plan = preparerCampagne([prospect(), prospect()], { plafond: 5 });
  assert.equal(plan.retenus.length, 2);
  assert.equal(plan.plafonneAuPalier, false);
});

test("⚠ envoiBranche est TOUJOURS false — le plan n'envoie rien", () => {
  const vide = preparerCampagne([]);
  const plein = preparerCampagne([prospect()], { plafond: 10 });
  assert.equal(vide.envoiBranche, false);
  assert.equal(plein.envoiBranche, false);
});

test("⚠⚠ la ROUTE /api/v1/campagne ne peut pas envoyer — aucun transport importé", () => {
  // Le plan pur ne sort rien ; la route non plus. Sans cette garde, une
  // session future y coudrait un `sendMail` « pour finir le taff » et la
  // gâchette passerait à l'agent. Le seul envoi légitime est `/api/send`,
  // gardé et armé par un humain.
  const src = readFileSync(join(process.cwd(), "app/api/v1/campagne/route.ts"), "utf8");
  assert.doesNotMatch(
    src,
    /nodemailer|createTransport|sendMail|["'`][^"'`]*\/api\/send/,
    "un chemin/transport d'ENVOI apparaît dans la route de préparation",
  );
});
