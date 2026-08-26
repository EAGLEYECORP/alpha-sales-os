import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { doitSOuvrirSeul, lireProgression, PROGRESS_KEY } from "../lib/wizard-progress";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ASSISTANT QUI NE SE FERMAIT PAS.
 *
 * Trouvé en pilotant un navigateur neuf, pas par un test : sur CHAQUE écran,
 * un panneau `fixed inset-0 z-[95]` recouvrait l'application et interceptait
 * tous les clics. La croix le refermait — jusqu'au chargement suivant, où il
 * revenait, parce qu'elle ne basculait qu'un `useState` local.
 *
 * Conséquence réelle : personne ne peut REGARDER le produit avant d'avoir
 * traversé les dix étapes d'installation. Pour une app qu'on s'apprête à
 * montrer en public, c'est la première chose que voit un visiteur.
 * ─────────────────────────────────────────────────────────────────────
 */

const neuf = { step: 0, sheetsReady: false, workflowReady: false, differe: false };

test("un arrivant sans rien voit l'assistant s'ouvrir tout seul", () => {
  assert.equal(doitSOuvrirSeul(false, neuf), true);
});

test("celui qui a REPOUSSÉ ne le reprend plus en pleine figure", () => {
  assert.equal(doitSOuvrirSeul(false, { ...neuf, differe: true }), false);
});

test("celui qui a TERMINÉ non plus", () => {
  assert.equal(doitSOuvrirSeul(true, neuf), false);
});

test("repousser n'est pas déclarer la machine configurée", () => {
  /**
   * La correction évidente — poser `onboarded: true` à la fermeture — aurait
   * été un mensonge : ce drapeau ouvre le tour opérateur et fait croire aux
   * écrans que n8n, l'envoi et Supabase sont branchés. Les deux états doivent
   * donc rester distincts, et c'est ce que ce test verrouille.
   */
  const src = readFileSync(join(process.cwd(), "components/setup-wizard.tsx"), "utf8");
  const differer = src.slice(src.indexOf("const differer ="), src.indexOf("const saveConn"));
  assert.ok(differer.length > 0, "la fermeture doit passer par une fonction dédiée");
  assert.doesNotMatch(differer, /onboarded:\s*true/, "fermer ≠ avoir configuré");
  assert.match(differer, /differe:\s*true/, "fermer doit poser le report");
});

test("la croix appelle bien le report, pas la fermeture nue", () => {
  const src = readFileSync(join(process.cwd(), "components/setup-wizard.tsx"), "utf8");
  const croix = src.slice(src.indexOf(`aria-label="Fermer l'assistant"`) - 400, src.indexOf(`aria-label="Fermer l'assistant"`));
  assert.match(croix, /onClick=\{differer\}/, "sinon le panneau revient au chargement suivant");
});

test("l'ouverture automatique et l'écriture lisent la MÊME clé", () => {
  // Deux composants, un seul état : une clé recopiée à la main dans l'un des
  // deux et le report ne serait jamais relu.
  const onb = readFileSync(join(process.cwd(), "components/onboarding.tsx"), "utf8");
  assert.match(onb, /doitSOuvrirSeul\(onboarded, chargerProgression\(\)\)/);
  assert.equal(PROGRESS_KEY, "alpha_wizard_progress_v2");
});

test("avancer d'une étape ne réarme pas l'ouverture automatique", () => {
  // L'enregistrement de progression tourne à chaque changement d'étape. S'il
  // repartait d'un objet neuf, rouvrir l'assistant depuis les Réglages puis
  // cliquer « suivant » effacerait le report — et le panneau reviendrait.
  const src = readFileSync(join(process.cwd(), "components/setup-wizard.tsx"), "utf8");
  const effet = src.slice(src.indexOf("enregistrerProgression({ ...chargerProgression()"), src.indexOf("const finish"));
  assert.ok(effet.includes("...chargerProgression()"), "la progression existante doit être reprise, pas écrasée");
});

// ─────────── La lecture doit survivre à n'importe quel stockage ───────────

test("une progression illisible ne fait pas tomber l'app", () => {
  for (const brut of [null, "", "{", "[]", "null", '"texte"', '{"step":"deux"}']) {
    const p = lireProgression(brut);
    assert.equal(typeof p.step, "number");
    assert.ok(Number.isFinite(p.step) && p.step >= 0, `step invalide pour ${brut}`);
    assert.equal(typeof p.differe, "boolean");
  }
});

test("une progression d'AVANT le report se relit sans faire revenir le panneau à tort", () => {
  // Les navigateurs existants portent `{step, sheetsReady, workflowReady}`
  // sans `differe`. Absent = jamais repoussé : l'assistant s'ouvre, ce qui est
  // le comportement d'avant. On ne casse personne, on ajoute une sortie.
  const p = lireProgression(JSON.stringify({ step: 4, sheetsReady: true, workflowReady: false }));
  assert.equal(p.step, 4);
  assert.equal(p.sheetsReady, true);
  assert.equal(p.differe, false);
  assert.equal(doitSOuvrirSeul(false, p), true);
});
