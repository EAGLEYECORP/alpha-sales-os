import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const FICHIER = join(RACINE, "components", "setup-wizard.tsx");
const src = readFileSync(FICHIER, "utf8");

/** Le garde juge du CODE, pas de la prose : un commentaire qui explique la
 *  règle ne doit pas déclencher la règle. (Leçon apprise cinq fois ici.) */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const code = sansCommentaires(src);

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN BOUTON QUI DIT « PASSER » DOIT SORTIR DE L'ASSISTANT.
 *
 * Le défaut d'origine : le lien « Passer — je veux d'abord tester l'app sans
 * Google Sheets » appelait `next`. Il déposait l'opérateur sur l'étape 2
 * (n8n), verrouillée par une case à cocher et sans aucune sortie libellée. Le
 * bouton promettait d'entrer dans l'app et livrait un mur d'installation.
 *
 * Le garde ne recopie pas la liste des boutons : il la DÉDUIT de la source.
 * Toute étape future qui gagne un lien « Passer » est couverte le jour où
 * elle est écrite, sans que personne pense à revenir ici.
 * ─────────────────────────────────────────────────────────────────────
 */
test("tout lien « Passer » de l'assistant sort de l'assistant, il n'avance pas d'une étape", () => {
  // On repère les blocs <SortirDeLAssistant …>…</SortirDeLAssistant> et les
  // <button …>…</button> dont le libellé commence par « Passer ».
  const boutonsPasser = [...code.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(([, , txt]) =>
    /Passer\s*(&mdash;|—|-)/.test(txt)
  );

  for (const [bloc, attrs] of boutonsPasser) {
    assert.ok(
      !/onClick=\{next\}/.test(attrs),
      `Un lien « Passer » est câblé sur next() — il fait avancer d'une étape au lieu de sortir :\n${bloc.slice(0, 200)}`
    );
  }

  // Et la voie normale : les libellés « Passer » passent par le composant de
  // sortie, dont l'unique implémentation appelle `differer`.
  const sorties = [...code.matchAll(/<SortirDeLAssistant\b([^>]*)>/g)];
  assert.ok(sorties.length >= 2, `Attendu au moins deux sorties libellées (étapes Sheets et n8n), trouvé ${sorties.length}`);
  for (const [, attrs] of sorties) {
    assert.match(attrs, /onClick=\{differer\}/, "Une sortie d'assistant ne passe pas par `differer`");
  }
});

/**
 * Les deux étapes verrouillées sont celles qui exigent une case à cocher :
 * `sheetsReady` (Google Sheets) et `workflowReady` (n8n). Elles sont lues dans
 * la condition `disabled` du bouton Suivant — donc si quelqu'un en ajoute une
 * troisième, ce test réclame la sortie correspondante tout seul.
 */
test("chaque étape dont « Suivant » est verrouillé offre une sortie", () => {
  const cond = code.match(/disabled=\{\(step === 1[^}]*\}/)?.[0] ?? "";
  assert.ok(cond, "La condition de verrouillage du bouton Suivant est introuvable — le garde ne sait plus quoi couvrir.");

  // Les étapes verrouillées par une case à cocher (pas par un champ à remplir,
  // qui, lui, se remplit sans rien installer).
  const verrouillees = [...cond.matchAll(/step === (\d+) && !(\w+)/g)]
    .filter(([, , flag]) => new RegExp(`checked=\\{${flag}\\}`).test(code))
    .map(([, n]) => Number(n));

  assert.deepEqual(verrouillees, [1, 2], "Les étapes verrouillées par une case ont changé : la couverture des sorties est à revoir.");

  const sorties = [...code.matchAll(/<SortirDeLAssistant\b/g)].length;
  assert.ok(
    sorties >= verrouillees.length,
    `${verrouillees.length} étape(s) verrouillée(s) par une case à cocher mais seulement ${sorties} sortie(s) : au moins une est un cul-de-sac.`
  );
});

/**
 * La sortie ne doit PAS marquer la configuration comme faite. `differer`
 * n'écrit pas `onboarded: true` — c'est `finish` qui le fait, au bout du
 * parcours. Confondre les deux ferait croire à tous les écrans que la machine
 * est branchée alors que rien ne l'est.
 */
test("sortir n'est pas avoir configuré : `differer` ne pose pas onboarded", () => {
  const differer = code.match(/const differer = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";
  assert.ok(differer, "`differer` introuvable");
  assert.ok(!/onboarded/.test(differer), "`differer` marque l'app comme configurée — elle ne l'est pas.");
  assert.match(differer, /differe: true/, "`differer` ne note pas le report : l'assistant se rouvrira par-dessus l'app.");
});
