import { test } from "node:test";
import assert from "node:assert/strict";
import { apercuPour, secteursDisponibles } from "@/lib/premier-resultat";
import { VERTICALS } from "@/lib/playbook";

test("la liste des marchés couvre toutes les verticales, avec un libellé", () => {
  const s = secteursDisponibles();
  assert.equal(s.length, VERTICALS.length);
  for (const e of s) {
    assert.ok(e.id.length > 0 && e.label.length > 0, `entrée vide : ${JSON.stringify(e)}`);
  }
});

test("chaque marché rend un aperçu COMPLET — jamais un écran vide", () => {
  for (const v of VERTICALS) {
    const a = apercuPour(v.id);
    assert.ok(a, `aperçu manquant pour ${v.id}`);
    assert.ok(a!.message.trim().length > 0, `message vide pour ${v.id}`);
    assert.ok(a!.angle.trim().length > 0, `angle vide pour ${v.id}`);
    assert.ok(a!.label.trim().length > 0, `label vide pour ${v.id}`);
  }
});

test("id inconnu ⇒ null, jamais un aperçu deviné", () => {
  assert.equal(apercuPour("secteur-qui-nexiste-pas"), null);
  assert.equal(apercuPour(""), null);
});

test("⚠ le message montré respecte les interdits de SA verticale", () => {
  // Le message est un sous-ensemble de l'opener, déjà croisé ailleurs — mais on
  // le revérifie ICI : afficher en onboarding une phrase interdite serait pire
  // que dans un script (c'est la première chose que voit un inscrit).
  for (const v of VERTICALS) {
    const a = apercuPour(v.id);
    assert.ok(a);
    for (const f of v.forbidden) {
      if (f.motif) {
        assert.ok(!f.motif.test(a!.message), `${v.id} : le message d'aperçu déclenche un interdit (${f.regle})`);
      }
    }
  }
});

test("maîtrise d'ouvrage — sert l'OS de vente, jamais l'angle « appels manqués »", () => {
  const a = apercuPour("maitrise-ouvrage");
  assert.ok(a);
  assert.equal(a!.offre, "alpha-sales-os");
  assert.ok(!/ratez des appels|appels? manqués?/i.test(a!.message), "angle téléphone servi à un promoteur");
});
