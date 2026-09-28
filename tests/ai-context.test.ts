import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateTokens,
  estimateCostEUR,
  compressContext,
  compressMessages,
} from "../lib/ai-context";

test("ai-context — estimation de tokens croît avec le texte, 0 sur vide", () => {
  assert.equal(estimateTokens(""), 0);
  const short = estimateTokens("bonjour");
  const long = estimateTokens("bonjour ".repeat(100));
  assert.ok(short > 0);
  assert.ok(long > short, "plus de texte = plus de tokens");
});

test("ai-context — coût estimé proportionnel au tarif", () => {
  assert.equal(estimateCostEUR(1_000_000, 15), 15);
  assert.equal(estimateCostEUR(500_000, 15), 7.5);
  assert.equal(estimateCostEUR(0, 15), 0);
});

test("ai-context — sous le budget : normalise les espaces, ne coupe pas", () => {
  const out = compressContext("Ligne A    avec   trop  d'espaces\n\n\n\nLigne B", { maxChars: 1000 });
  assert.ok(!out.includes("coupé"), "pas de coupe sous le budget");
  assert.ok(!out.includes("    "), "espaces multiples réduits");
  assert.ok(!out.includes("\n\n\n"), "lignes vides réduites");
});

test("ai-context — au-dessus du budget : garde tête + queue, élide le milieu", () => {
  const text = "DEBUT_CONSIGNES " + "bla ".repeat(500) + " FIN_RECENTE";
  const out = compressContext(text, { maxChars: 120 });
  assert.ok(out.length <= 120 + 40, "borné au budget (+ marqueur)");
  assert.ok(out.includes("DEBUT_CONSIGNES"), "les consignes de tête sont gardées");
  assert.ok(out.includes("FIN_RECENTE"), "le contexte récent de queue est gardé");
  assert.ok(out.includes("coupé"), "le milieu est élidé et signalé");
});

test("ai-context — headRatio pousse plus de budget vers la tête", () => {
  const text = "H".repeat(400) + "T".repeat(400);
  const headHeavy = compressContext(text, { maxChars: 120, headRatio: 0.9 });
  const tailHeavy = compressContext(text, { maxChars: 120, headRatio: 0.1 });
  const hCount = (headHeavy.match(/H/g) ?? []).length;
  const hCount2 = (tailHeavy.match(/H/g) ?? []).length;
  assert.ok(hCount > hCount2, "headRatio élevé garde plus de tête");
});

test("ai-context — compressMessages est pur et n'altère pas l'original", () => {
  const msgs = [{ role: "system", content: "x ".repeat(200) }];
  const out = compressMessages(msgs, { maxChars: 50 });
  assert.ok(out[0].content.length <= 90);
  assert.equal(msgs[0].content.length, 400, "l'entrée n'est pas mutée");
  assert.notEqual(out, msgs);
});
