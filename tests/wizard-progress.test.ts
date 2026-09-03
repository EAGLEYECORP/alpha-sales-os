import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { doitSOuvrirSeul, lireProgression, visiteDoitSOuvrir, PROGRESS_KEY } from "../lib/wizard-progress";

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

/* ═══════════════════════════════════════════════════════════════════
   LA VISITE GUIDÉE — la même question, une condition de plus
   ═══════════════════════════════════════════════════════════════════ */

test("visite — elle s'ouvre seule sur la 1re étape, et là seulement", () => {
  const base = { onboarded: true, dejaFaite: false, premiereEtape: "/" };
  assert.equal(visiteDoitSOuvrir({ ...base, chemin: "/" }), true, "sur le tableau de bord : elle s'ouvre");

  /**
   * ⚠ LE DÉFAUT RÉEL, CONSTATÉ SUR UNE PRODUCTION.
   *
   * `OperatorTour` est monté dans la coquille, donc sur les 38 écrans. Sans
   * cette condition, il s'ouvrait 800 ms après l'arrivée sur n'importe quelle
   * page — et comme l'effet d'alignement du composant pousse vers la 1re
   * étape, il DÉPLAÇAIT l'opérateur. On ouvrait `/settings`, on commençait à
   * lire, et l'app partait sur `/`.
   *
   * On mute la CONDITION (le chemin), pas la présence de l'appel : c'est le
   * piège que ce dépôt a payé quatre fois.
   */
  for (const ailleurs of ["/settings", "/pipeline", "/aujourdhui", "/prospects/abc", "/voice"]) {
    assert.equal(
      visiteDoitSOuvrir({ ...base, chemin: ailleurs }),
      false,
      `${ailleurs} : s'ouvrir ici revient à emmener l'opérateur ailleurs`
    );
  }
});

test("visite — les deux autres verrous tiennent toujours", () => {
  const surLEtape = { chemin: "/", premiereEtape: "/" };
  // Pendant l'assistant : jamais. On ne superpose pas deux onboardings.
  assert.equal(visiteDoitSOuvrir({ ...surLEtape, onboarded: false, dejaFaite: false }), false);
  // Déjà faite : jamais. « Une fois » veut dire une fois.
  assert.equal(visiteDoitSOuvrir({ ...surLEtape, onboarded: true, dejaFaite: true }), false);
});

test("visite — le composant délègue la règle, il ne la réécrit pas", () => {
  /**
   * Le pendant du contrôle qui existe déjà pour l'assistant. Deux définitions
   * de « faut-il ouvrir ? » finiraient par diverger, et c'est celle du
   * composant qui gagnerait — sans test.
   */
  const src = readFileSync(join(process.cwd(), "components/tour/operator-tour.tsx"), "utf8");

  /**
   * ⚠ La 1re version cherchait `visiteDoitSOuvrir({` n'importe où. Une
   * mutation l'a démontée : `if (false && !visiteDoitSOuvrir({…` contient
   * toujours la chaîne, le test restait vert, et la visite se rouvrait
   * partout. On exige donc que l'appel SOIT la garde — rien entre le `if (`
   * et la négation.
   */
  assert.match(
    src,
    /if \(!visiteDoitSOuvrir\(\{/,
    "l'appel doit être la condition elle-même, pas une expression noyée dans un `&&`"
  );

  /**
   * Et il doit lui passer le VRAI chemin. Une règle juste nourrie d'une
   * constante rend toujours la même réponse : `chemin: "/"` en dur ferait
   * repasser la visite sur les 38 écrans, avec la règle intacte et le test
   * vert. C'est le défaut récurrent de ce dépôt — le mécanisme correct,
   * branché sur rien.
   */
  assert.match(src, /chemin: pathname\b/, "le chemin passé doit être celui affiché, pas une constante");
  assert.match(src, /premiereEtape: STOPS\[0\]\.href/, "la 1re étape se lit dans STOPS, elle ne se recopie pas");
  assert.doesNotMatch(
    src.replace(/\/\*[\s\S]*?\*\//g, ""),
    /if\s*\(\s*!settings\.onboarded\s*\)\s*return/,
    "plus de condition d'ouverture recopiée dans le composant"
  );
});
