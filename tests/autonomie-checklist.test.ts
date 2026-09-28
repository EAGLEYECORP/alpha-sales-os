import { test } from "node:test";
import assert from "node:assert/strict";
import { preparationAutonomie, type HealthCapabilities } from "../lib/autonomie-checklist";

const complet: HealthCapabilities = {
  ai: { configured: true },
  email: { configured: true },
  tracking: { baseUrl: true },
  supabase: { serviceRole: true },
  proprietaire: { coherent: true },
};

test("tout vert côté serveur ⇒ prêt, 0 manquant", () => {
  const p = preparationAutonomie(complet);
  assert.equal(p.pret, true);
  assert.equal(p.manquants, 0);
});

test("⚠ DKIM reste TOUJOURS `inconnu` — le serveur ne voit pas le DNS", () => {
  const p = preparationAutonomie(complet);
  const dkim = p.items.find((i) => i.id === "dkim");
  assert.ok(dkim);
  assert.equal(dkim.etat, "inconnu");
  // et il ne bloque pas le « prêt » serveur, mais reste à confirmer à la main
  assert.equal(dkim.bloquant, false);
});

test("⚠⚠ caps=null (sonde muette / non authentifié) ⇒ rien n'est supposé prêt", () => {
  const p = preparationAutonomie(null);
  assert.equal(p.pret, false);
  // les 5 bloquants sont « manque » ; DKIM reste inconnu (non bloquant)
  assert.equal(p.manquants, 5);
  assert.equal(p.items.find((i) => i.id === "supabase")?.etat, "manque");
  assert.equal(p.items.find((i) => i.id === "dkim")?.etat, "inconnu");
});

test("un prérequis absent ⇒ ce point précis « manque » et bloque", () => {
  const sansSmtp: HealthCapabilities = { ...complet, email: { configured: false } };
  const p = preparationAutonomie(sansSmtp);
  assert.equal(p.pret, false);
  assert.equal(p.manquants, 1);
  assert.equal(p.items.find((i) => i.id === "smtp")?.etat, "manque");
});

test("un champ manquant vaut « pas prêt » (lecture défensive, jamais optimiste)", () => {
  const p = preparationAutonomie({}); // aucun champ
  assert.equal(p.pret, false);
  for (const i of p.items) {
    if (i.bloquant) assert.equal(i.etat, "manque");
  }
});

test("chaque item porte une action non vide (jamais décoratif)", () => {
  for (const i of preparationAutonomie(null).items) {
    assert.ok(i.action.trim().length > 0, `${i.id} sans action`);
    assert.ok(i.label.trim().length > 0);
  }
});
