import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRIQUES_GRATUITES, DROIT_GRATUIT, autorise } from "../lib/entitlements";
import { CHEMIN_PAR_API } from "../lib/api-access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE GRATUIT NE DÉPENSE PAS CHEZ NOUS — vérifié sur la vraie carte des API.
 *
 * Remplace le gabarit du 31/10/2026 (fonction `peutOuvrir` inexistante, ne
 * compilait pas). Le middleware traduit une API en chemin métier par le
 * PREMIER préfixe de `CHEMIN_PAR_API` qui correspond, puis pose `autorise` :
 * le test rejoue exactement ces deux gestes.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();

function cheminDe(api: string): string {
  for (const [prefixe, chemin] of Object.entries(CHEMIN_PAR_API)) {
    if (api === prefixe || api.startsWith(prefixe + "/")) return chemin;
  }
  return api;
}

const QUI_DEPENSENT: Record<string, string> = {
  "/api/send": "notre SMTP",
  "/api/voice/call": "nos minutes de téléphonie",
  "/api/ai": "nos jetons de modèle",
  "/api/agent": "nos jetons de modèle",
};

for (const [api, quoi] of Object.entries(QUI_DEPENSENT)) {
  test(`un compte gratuit n'atteint pas ${api} (${quoi})`, () => {
    assert.equal(autorise(DROIT_GRATUIT, cheminDe(api)), false, `${api} → ${cheminDe(api)} doit rester fermé au gratuit`);
  });
}

test("…et le socle gratuit reste ouvert (sinon un produit entièrement fermé passerait le test ci-dessus)", () => {
  assert.deepEqual([...BRIQUES_GRATUITES].sort(), ["alpha-live", "cerveau", "closer", "crm", "pilotage"]);
  for (const chemin of ["/pipeline", "/closer", "/cerveau", "/aujourdhui"]) assert.equal(autorise(DROIT_GRATUIT, chemin), true, chemin);
});

test("le middleware pose bien la question avec cette carte-là (pas une copie)", () => {
  const mw = readFileSync(join(RACINE, "middleware.ts"), "utf8");
  assert.match(mw, /CHEMIN_PAR_API/);
});
