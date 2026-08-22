import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseStorage, utf16Bytes, isQuotaError, QUOTA_BYTES } from "../lib/storage-health";

const store = (state: Record<string, unknown>) => ({ "alpha-sales-os-v2": JSON.stringify({ state, version: 5 }) });

test("poids — on compte en UTF-16, comme le navigateur", () => {
  // localStorage stocke de l'UTF-16 : c'est ça que compte le quota, pas la
  // longueur UTF-8. Un texte français accentué pèse plus qu'on ne croit.
  assert.equal(utf16Bytes("abc"), 6);
  assert.equal(utf16Bytes("éàü"), 6, "un accent coûte autant qu'une lettre en UTF-16");
});

test("verdict — silencieux tant qu'il n'y a rien à dire", () => {
  const h = analyseStorage(store({ prospects: [{ id: "p1" }] }));
  assert.equal(h.level, "ok");
  assert.equal(h.message, "", "une alerte permanente n'est plus une alerte");
});

test("verdict — les paliers déclenchent le bon niveau", () => {
  // Un « document » = 400 000 caractères = 800 Ko en UTF-16. Le quota retenu
  // est de 5 Mo, donc ~6,5 documents. C'est peu : quelques audits de
  // cinquante pages y suffisent, et c'est exactement le point.
  const doc = "x".repeat(400_000);
  const n = (k: number) => analyseStorage(store({ notes: Array(k).fill(doc) }), QUOTA_BYTES).level;
  assert.equal(n(4), "ok");
  assert.equal(n(5), "surveiller");
  assert.equal(n(6), "critique");
  assert.equal(n(7), "sature");
});

test("verdict — on NOMME le plus gros poste, pas juste « c'est plein »", () => {
  // « Stockage plein » sans « c'est le Cerveau » n'aide personne à agir.
  const leger = analyseStorage(
    store({ prospects: [{ id: "p1", notes: "court" }], notes: [{ body: "y".repeat(300_000) }] })
  );
  assert.equal(leger.heaviest?.key, "notes", "le poste le plus lourd se repère même quand tout va bien");
  assert.match(leger.heaviest!.label, /Cerveau/);
  assert.equal(leger.message, "", "mais on ne dit rien tant qu'il n'y a rien à faire");

  // Dès qu'il y a un message, il nomme le coupable.
  const charge = analyseStorage(store({ notes: Array(5).fill("y".repeat(400_000)) }));
  assert.match(charge.message, /Cerveau/);
  assert.match(charge.message, /Ko\)/, "avec son poids, pour qu'on mesure l'effort");
});

test("verdict — la saturation dit la CONSÉQUENCE, pas le pourcentage", () => {
  const h = analyseStorage(store({ notes: ["z".repeat(3_000_000)] }));
  assert.equal(h.level, "sature");
  // Un opérateur doit comprendre qu'il est en train de perdre son travail.
  assert.match(h.message, /perdu en fermant l'onglet/);
  assert.match(h.message, /synchronisation/, "et savoir quoi faire");
});

test("analyse — un contenu illisible ne fait pas tomber la mesure", () => {
  const h = analyseStorage({ "alpha-x": "{pas du JSON", "alpha-y": "" });
  assert.ok(h.usedBytes > 0, "le poids se mesure même sans pouvoir parser");
  assert.equal(h.heaviest, undefined);
});

test("erreur de quota — reconnue quel que soit le navigateur", () => {
  const chrome = new Error("dépassement");
  chrome.name = "QuotaExceededError";
  assert.ok(isQuotaError(chrome));

  const firefox = new Error("plein");
  firefox.name = "NS_ERROR_DOM_QUOTA_REACHED";
  assert.ok(isQuotaError(firefox));

  // Certaines versions ne donnent que le code numérique.
  const parCode = Object.assign(new Error("plein"), { code: 22 });
  assert.ok(isQuotaError(parCode));

  // Et une erreur ordinaire ne doit PAS être avalée comme un quota : la
  // masquer ferait disparaître un vrai bug.
  assert.ok(!isQuotaError(new Error("réseau indisponible")));
  assert.ok(!isQuotaError("plein"));
});
