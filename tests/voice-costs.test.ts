import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COST_LINES, FIXED_COSTS, FREE_TIERS, computeCosts, defaultVolume,
  usdPerConversationMinute, USD_TO_EUR,
} from "../lib/voice-costs";
import { outboundPrice } from "../lib/bricks";

test("coûts — chaque ligne porte sa source (un tarif sans source se périme en silence)", () => {
  for (const l of COST_LINES) {
    assert.ok(l.usdPerMin > 0, `${l.id} sans coût`);
    assert.ok(l.source.length > 10, `${l.id} sans source`);
  }
});

test("coûts — 1 000 appels au tarif public dégagent une marge, et elle est calculée", () => {
  const revenue = outboundPrice(1000).monthlyHT; // 364 €
  const c = computeCosts(defaultVolume, revenue);
  assert.equal(c.calls, 1000);
  assert.equal(c.answeredCalls, 300);
  assert.equal(c.conversationMinutes, 600);
  assert.ok(c.totalEur > 0);
  assert.equal(c.revenueEur, 364);
  assert.equal(c.marginEur, revenue - c.totalEur);
  // L'offre doit être rentable : sinon le prix public est faux.
  assert.ok(c.marginEur > 0, `marge négative : ${c.marginEur} €`);
  assert.ok(c.marginPct > 50, `marge trop faible (${c.marginPct} %) pour absorber les imprévus`);
});

test("coûts — un appel sans réponse ne consomme ni STT, ni LLM, ni TTS", () => {
  // Même volume, mais 0 % de décroché : seuls SIP et opérateur tournent.
  const aucun = computeCosts({ ...defaultVolume, answerRatePct: 0 }, 364);
  const stt = aucun.lines.find((l) => l.id === "deepgram")!;
  const tts = aucun.lines.find((l) => l.id === "fish")!;
  const llm = aucun.lines.find((l) => l.id === "llm")!;
  assert.equal(stt.eur, 0);
  assert.equal(tts.eur, 0);
  assert.equal(llm.eur, 0);
  // Le transport, lui, est bien facturé pendant la sonnerie.
  assert.ok(aucun.lines.find((l) => l.id === "telnyx")!.eur > 0);
});

test("coûts — plus de décrochés = plus cher : le modèle suit la réalité", () => {
  const bas = computeCosts({ ...defaultVolume, answerRatePct: 10 }, 364);
  const haut = computeCosts({ ...defaultVolume, answerRatePct: 60 }, 364);
  assert.ok(haut.totalEur > bas.totalEur);
  assert.ok(haut.marginEur < bas.marginEur);
});

test("coûts — le coût fixe est indépendant du volume (le 1er client porte tout)", () => {
  const petit = computeCosts({ ...defaultVolume, calls: 100 }, outboundPrice(100).monthlyHT);
  const gros = computeCosts({ ...defaultVolume, calls: 4000 }, outboundPrice(4000).monthlyHT);
  assert.equal(petit.fixedEur, gros.fixedEur);
  assert.equal(petit.fixedEur, FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0));
  // Le coût par appel s'effondre avec le volume — c'est ça, l'effet d'échelle.
  assert.ok(gros.costPerCallEur < petit.costPerCallEur);
});

test("coûts — le palier 4 000 (4e millier offert) reste rentable", () => {
  const c = computeCosts({ ...defaultVolume, calls: 4000 }, outboundPrice(4000).monthlyHT);
  assert.equal(c.revenueEur, 1092);
  assert.ok(c.marginEur > 0, `le palier de montée en charge doit rester rentable (${c.marginEur} €)`);
});

test("coûts — la somme des lignes vaut le coût total variable", () => {
  const c = computeCosts(defaultVolume, 364);
  const sum = c.lines.reduce((s, l) => s + l.eur, 0);
  assert.ok(Math.abs(sum - c.variableEur) < 0.01);
  assert.ok(Math.abs(c.totalEur - (c.variableEur + c.fixedEur)) < 0.01);
});

test("coûts — la minute de conversation est cohérente en USD et en €", () => {
  const usd = usdPerConversationMinute();
  assert.ok(usd > 0.03 && usd < 0.08, `minute hors plage plausible : ${usd} $`);
  assert.ok(USD_TO_EUR > 0 && USD_TO_EUR < 2);
});

test("gratuit — NVIDIA et Fish bloquent l'usage commercial, et c'est dit", () => {
  const nvidia = FREE_TIERS.find((f) => /NVIDIA/i.test(f.provider))!;
  assert.equal(nvidia.commercialOk, false);
  assert.match(nvidia.warning ?? "", /production/i);

  const fish = FREE_TIERS.find((f) => /Fish/i.test(f.provider))!;
  assert.equal(fish.commercialOk, false);
  assert.match(fish.warning ?? "", /personnel/i);

  // Deepgram et LiveKit, eux, sont utilisables commercialement.
  assert.equal(FREE_TIERS.find((f) => /Deepgram/i.test(f.provider))!.commercialOk, true);
});
