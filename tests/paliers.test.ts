import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PALIERS, palierFor, palierProgress, leverageScore, daysToTarget, yearlyMultiple, DOUBLING_TRUTH,
} from "../lib/paliers";
import { OPPORTUNITIES, prioritized, urgency, daysLeft, opportunityById } from "../lib/opportunites";

test("paliers — les 4 paliers se suivent sans trou ni chevauchement", () => {
  assert.equal(PALIERS.length, 4);
  for (let i = 1; i < PALIERS.length; i++) {
    assert.equal(PALIERS[i].fromEur, PALIERS[i - 1].toEur, "les bornes doivent se toucher exactement");
  }
  assert.equal(PALIERS[0].fromEur, 0);
  assert.equal(PALIERS[PALIERS.length - 1].toEur, 10_000_000);
});

test("paliers — chaque palier nomme UNE contrainte et ses portes mesurables", () => {
  for (const p of PALIERS) {
    assert.ok(p.constraint.length > 10, `${p.id} sans contrainte`);
    assert.ok(p.gates.length >= 3, `${p.id} doit avoir des portes de sortie`);
    for (const g of p.gates) assert.ok(g.measure.length > 10, `${p.id}: porte « ${g.label} » non mesurable`);
    assert.ok(p.daily.length >= 3, `${p.id} sans actions quotidiennes`);
    assert.ok(p.dontYet.length >= 1, `${p.id} doit dire ce qu'on ne fait PAS encore`);
  }
});

test("paliers — le palier suit le CA cumulé", () => {
  assert.equal(palierFor(0).id, "p0");
  assert.equal(palierFor(50_000).id, "p0");
  assert.equal(palierFor(100_000).id, "p1");
  assert.equal(palierFor(2_000_000).id, "p2");
  assert.equal(palierFor(9_000_000).id, "p3");
  // Au-delà de 10 M, on reste sur le dernier palier plutôt que de planter.
  assert.equal(palierFor(50_000_000).id, "p3");
});

test("paliers — la progression est bornée et cohérente", () => {
  assert.equal(palierProgress(0), 0);
  assert.equal(palierProgress(50_000), 50);
  assert.equal(palierProgress(550_000), 50);
  assert.ok(palierProgress(99_999) >= 99);
});

test("levier — le score récompense l'automatisation, pas le volume brut", () => {
  const manuel = leverageScore({ hours: 8, touches: 80, conversations: 8, meetings: 2, cashEur: 0, automatedTouches: 0 });
  const outille = leverageScore({ hours: 8, touches: 80, conversations: 8, meetings: 2, cashEur: 0, automatedTouches: 64 });
  assert.ok(outille.score > manuel.score, "à résultat égal, la machine doit primer sur la sueur");
  assert.equal(outille.automationPct, 80);
  assert.match(manuel.bottleneck, /manuel/i);
});

test("levier — le goulot nommé change avec la faiblesse réelle", () => {
  const mauvaisCiblage = leverageScore({ hours: 8, touches: 200, conversations: 4, meetings: 2, cashEur: 0, automatedTouches: 180 });
  assert.match(mauvaisCiblage.bottleneck, /ciblage|accroche/i);

  const mauvaisScript = leverageScore({ hours: 8, touches: 100, conversations: 30, meetings: 3, cashEur: 0, automatedTouches: 90 });
  assert.match(mauvaisScript.bottleneck, /script/i);
});

test("levier — les taux et le rendement horaire sont exacts", () => {
  const s = leverageScore({ hours: 4, touches: 100, conversations: 20, meetings: 5, cashEur: 2000, automatedTouches: 50 });
  assert.equal(s.touchesPerHour, 25);
  assert.equal(s.automationPct, 50);
  assert.equal(s.contactRate, 20);
  assert.equal(s.meetingRate, 25);
  assert.equal(s.eurPerHour, 500);
});

test("levier — la vérité arithmétique du « doublement quotidien » est dite", () => {
  assert.match(DOUBLING_TRUTH, /impossible/i);
  assert.match(DOUBLING_TRUTH, /levier/i);
  // +1 %/jour ≈ ×37,8 sur un an — le chiffre annoncé doit être exact.
  assert.ok(Math.abs(yearlyMultiple(1) - 37.78) < 0.5, `×${yearlyMultiple(1).toFixed(2)} attendu ~37,8`);
  assert.ok(yearlyMultiple(2) > 1000);
});

test("levier — le nombre de jours pour atteindre une cible est calculable", () => {
  // De 100 k à 10 M à +1 %/jour : ~463 jours. On vérifie l'ordre de grandeur.
  const d = daysToTarget(100_000, 10_000_000, 1)!;
  assert.ok(d > 400 && d < 500, `${d} jours hors plage attendue`);
  // Cas impossibles → null, jamais un chiffre inventé.
  assert.equal(daysToTarget(0, 1000, 1), null);
  assert.equal(daysToTarget(1000, 500, 1), null);
  assert.equal(daysToTarget(1000, 5000, 0), null);
});

test("opportunités — French Tech 2030 porte la vraie échéance et une adéquation honnête", () => {
  const ft = opportunityById("french-tech-2030")!;
  assert.ok(ft.deadline?.startsWith("2026-09-04"));
  assert.equal(ft.fit, "plausible", "ne pas prétendre que c'est gagné d'avance");
  assert.match(ft.fitWhy, /souveraineté/i);
  assert.ok((ft.risks ?? []).length > 0, "les risques doivent être nommés");
  assert.ok(ft.steps.length >= 5);
});

test("opportunités — l'urgence suit l'échéance", () => {
  const now = new Date("2026-08-30T09:00:00+02:00");
  const ft = opportunityById("french-tech-2030")!;
  assert.equal(urgency(ft, now), "critique", "à 5 jours, c'est critique");
  assert.ok((daysLeft(ft, now) ?? 0) <= 7);
  // Après la date, l'opportunité est expirée et sort de la liste de travail.
  const apres = new Date("2026-09-10T09:00:00+02:00");
  assert.equal(urgency(ft, apres), "expiree");
  assert.equal(prioritized(apres).some((o) => o.id === "french-tech-2030"), false);
});

test("opportunités — le tri met l'urgent et le pertinent devant", () => {
  const now = new Date("2026-08-30T09:00:00+02:00");
  const list = prioritized(now);
  assert.equal(list[0].id, "french-tech-2030", "5 jours avant l'échéance, rien ne passe devant");
  // Les opportunités permanentes à forte adéquation restent présentes.
  assert.ok(list.some((o) => o.id === "cir-cii"));
  assert.ok(OPPORTUNITIES.every((o) => o.eligibility.length > 0 && o.steps.length > 0));
});
