import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { FLUX_VENTE } from "@/lib/flux-vente";

test("le fil couvre les 7 étapes, ordonnées et sans trou", () => {
  assert.equal(FLUX_VENTE.length, 7);
  FLUX_VENTE.forEach((e, i) => assert.equal(e.ordre, i + 1, `ordre cassé à ${e.id}`));
  const ids = new Set(FLUX_VENTE.map((e) => e.id));
  assert.equal(ids.size, 7, "ids en double");
});

test("⚠ chaque étape pointe vers un ÉCRAN RÉEL — jamais une page morte", () => {
  const ecrans = new Set(
    readdirSync(join(process.cwd(), "app/(app)"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
  for (const e of FLUX_VENTE) {
    const base = e.route.replace(/^\//, "").split("/")[0];
    assert.ok(ecrans.has(base), `${e.id} pointe vers /${base}, qui n'existe pas dans app/(app)`);
    assert.ok(e.produit.trim().length > 0 && e.routeLabel.trim().length > 0, `${e.id} : libellés vides`);
  }
});

test("la livraison reste au CLIENT — la doctrine est écrite dans l'étape de suivi", () => {
  const suivi = FLUX_VENTE.find((e) => e.id === "suivi");
  assert.ok(suivi);
  assert.match(suivi!.note ?? "", /client/i, "l'étape de suivi doit dire que la livraison est au client");
});

