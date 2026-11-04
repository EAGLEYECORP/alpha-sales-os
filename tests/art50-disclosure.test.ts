import test from "node:test";
import assert from "node:assert/strict";
import { DIVULGATION_ECRITE, divulgation, verifieDivulgation } from "../lib/signature-ia";
import { DISCLOSURE_REQUIREMENTS, auditScript } from "../lib/voice-script";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ART. 50 (Règlement UE 2024/1689) — LA DIVULGATION NE SE CONTOURNE PAS.
 *
 * Ces tests remplacent les gabarits du 31/10/2026, qui importaient
 * `../lib/...` et appelaient une fonction qui n'existe pas : ils ne
 * compilaient pas, et `npm test` commence par `tsc` — toute la suite était
 * tombée. Un test qui ne compile pas ne prouve rien, il empêche les autres
 * de prouver. Ceux-ci appellent les DEUX vraies portes :
 *  · l'appel vocal → `auditScript` (`lib/voice-script.ts`) ;
 *  · l'écrit autonome → `verifieDivulgation` (`lib/signature-ia.ts`), appelée
 *    par `/api/send` avant tout envoi.
 * ─────────────────────────────────────────────────────────────────────
 */

test("appel : un script sans divulgation est refusé, avec chacune des trois exigences nommées", () => {
  const r = auditScript("Bonjour, je vous appelle au sujet de votre activité.");
  assert.equal(r.ok, false);
  assert.equal(r.manquantes.length, DISCLOSURE_REQUIREMENTS.length);
});

test("appel : la phrase complète (IA, pas une personne, pour le compte de) passe", () => {
  const r = auditScript(
    "Bonjour, je suis un assistant vocal, une intelligence artificielle, pas une personne, et j'appelle pour le compte de la société Démo.",
  );
  assert.deepEqual(r.manquantes, []);
});

test("appel : il ne suffit pas de dire « IA » — ne pas être une personne et le mandant sont exigés aussi", () => {
  const r = auditScript("Bonjour, je suis une intelligence artificielle.");
  assert.equal(r.ok, false);
  assert.ok(r.manquantes.length >= 2);
});

test("écrit autonome : sans aveu d'IA, l'envoi est refusé ; avec la mention, il passe", () => {
  assert.equal(verifieDivulgation("Bonjour, une question rapide sur votre agence.", "email", "autonome").length, 1);
  assert.deepEqual(verifieDivulgation(`Bonjour.\n\n${DIVULGATION_ECRITE}`, "email", "autonome"), []);
});

test("⚠ l'inverse est refusé aussi : écrire « IA » sur un message relu par un humain serait FAUX", () => {
  assert.equal(verifieDivulgation(`Bonjour.\n\n${DIVULGATION_ECRITE}`, "email", "valide-par-humain").length, 1);
  assert.equal(divulgation("email", "valide-par-humain").interdite, true);
});
