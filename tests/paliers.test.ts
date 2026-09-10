import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PALIERS, palierFor, palierProgress, leverageScore, daysToTarget, yearlyMultiple, DOUBLING_TRUTH,
} from "../lib/paliers";
import { OPPORTUNITIES, prioritized, urgency, daysLeft, opportunityById } from "../lib/opportunites";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ADMISSIBILITÉ N'EST PAS L'ADÉQUATION.
 *
 * ⚠ TROUVÉ EN RELISANT LA DOC CONTRE LE CODE, PAS PAR UN TEST.
 *
 * `README.md` porte, depuis le 3 septembre 2026 : « NON ÉLIGIBLE à cette
 * promotion — le critère d'entrée est 3 M€ de financements et/ou de CA
 * cumulés depuis 2024, EAGLEYE CORP est à 0 €, le seuil est éliminatoire ».
 *
 * `lib/opportunites.ts` ne listait pas ce critère et annonçait
 * `fit: "plausible"`. `/trajectoire` affichait donc « adéquation : plausible »
 * en AMBRE — une couleur qui encourage — et `lib/mission-french-tech.ts`
 * découpait neuf lots de travail pour un dossier rejeté à la première page.
 *
 * La doc disait vrai, le code pilotait l'écran. C'est le défaut récurrent du
 * dépôt appliqué à de l'argent : personne ne relit un README avant de cocher
 * une case dans un tableau de bord.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ une porte FERMÉE se dit, même quand l'adéquation est bonne", () => {
  const ft = OPPORTUNITIES.find((o) => o.id === "french-tech-2030");
  assert.ok(ft, "l'opportunité French Tech doit rester listée — on ne cache pas un dossier, on dit pourquoi il est fermé");

  /**
   * ⚠ On asserte la CONDITION, pas la présence d'un champ : le critère
   * éliminatoire doit être NOMMÉ avec son chiffre. « Non éligible » sans le
   * seuil envoie chercher la promotion suivante, qui appliquera le même seuil.
   */
  assert.ok(ft!.bloquant, "le seuil éliminatoire doit être porté par le CODE, pas seulement par le README");
  assert.match(ft!.bloquant!, /3\s*M€/, "le montant du seuil doit être écrit — c'est lui qu'on doit franchir");
  assert.match(ft!.bloquant!, /0\s*€|zéro/i, "et où on en est réellement");

  // Le critère doit aussi figurer dans la liste d'éligibilité : c'est là qu'on
  // regarde avant de commencer un dossier.
  assert.ok(
    ft!.eligibility.some((e) => /3\s*M€/.test(e)),
    "le seuil doit être dans les critères, pas seulement dans le verdict"
  );

  /**
   * ⚠ ET LA CONTREPARTIE, qui est ce qui rend le champ utile : une
   * opportunité dont la porte est OUVERTE ne doit rien porter. Sans cette
   * moitié, on pourrait remplir `bloquant` partout « par prudence » et
   * l'écran deviendrait un mur rouge que personne ne lit.
   */
  const ouvertes = OPPORTUNITIES.filter((o) => o.id !== "french-tech-2030");
  assert.ok(ouvertes.length > 0, "il doit rester des opportunités ouvertes, sinon ce test ne garde rien");
  for (const o of ouvertes) {
    assert.equal(o.bloquant, undefined, `${o.id} porte un blocage : est-il réel, ou de la prudence recopiée ?`);
  }
});

test("⚠ l'écran GRISE ce qui est fermé — il ne se contente pas de l'écrire", () => {
  /**
   * Un blocage rangé dans une phrase sous la carte se lit après la couleur, et
   * la couleur dit « ambre : encourageant ». Le premier signal doit être le
   * bon, sinon on lit le second en cherchant à le contredire.
   */
  const src = readFileSync(join(process.cwd(), "app/(app)/trajectoire/page.tsx"), "utf8");
  assert.match(src, /o\.bloquant\s*\n?\s*\?\s*"text-paper-faint line-through"/, "un blocage doit primer sur la teinte d'adéquation");
  assert.match(src, /Porte fermée/, "…et se dire en clair");
});
