import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const R = process.cwd();

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE DOC QUI COMPTE À LA MAIN MENT AU PREMIER COMMIT SUIVANT.
 *
 * ⚠ CONSTATÉ, PAS SUPPOSÉ. Huit fichiers annonçaient un nombre de tests, et
 * les huit étaient faux — 579, 1 080, 1 126, 1 137, 1 165, 1 173, 1 194, ~235,
 * pour un total réel de 1 314. Le README annonçait aussi « 108 modules,
 * 39 pages, 38 routes API, 63 composants » là où il y en avait 161, 41, 51 et
 * 84. Aucun de ces chiffres n'a jamais été mis à jour, parce que personne ne
 * pense à rouvrir huit fichiers après avoir ajouté un test.
 *
 * Un compteur figé n'est pas une information : c'est une date de péremption
 * qu'on n'a pas écrite. Ce qui ne périme pas, c'est la COMMANDE qui produit le
 * chiffre — `npm test`, `find app -name page.tsx | wc -l`.
 *
 * ── CE QUE CE TEST NE GARDE PAS, ET POURQUOI ──
 *
 * Les JOURNAUX (`ANGLES-MORTS.md` et consorts) ont le droit de dire « 1 165
 * tests verts » : c'est un relevé daté, il raconte un moment. Un journal ne
 * périme pas, il archive. La règle ne vaut donc que pour les documents qui
 * prétendent décrire l'état COURANT.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les docs qui décrivent l'état COURANT du produit. */
const ETAT_COURANT = [
  "README.md",
  "CLAUDE.md",
  "docs/ARCHITECTURE.md",
  "docs/EAGLE-EYE.md",
  "docs/ETAT-COMPLET.md",
  "docs/CHECKLIST-LANCEMENT.md",
];

/** Un compteur figé : « 1 234 tests », « 42 routes API », « 63 composants ». */
const COMPTEUR =
  /\b\d[\d\s ]{1,6}\s*(tests?|modules?|composants?|routes? API|écrans?|pages?)\b/gi;

test("⚠ aucun document d'état courant n'annonce un compteur figé", () => {
  const fautes: string[] = [];

  for (const f of ETAT_COURANT) {
    const lignes = readFileSync(join(R, f), "utf8").split("\n");
    lignes.forEach((ligne, i) => {
      /**
       * Une ligne peut légitimement citer un nombre dans une phrase de
       * doctrine (« 5 rappels sur 2 jours », « 4 sollicitations »). On ne
       * cible que les unités qui décrivent la TAILLE DU DÉPÔT — celles qui
       * changent à chaque commit sans que personne y pense.
       */
      for (const m of ligne.matchAll(COMPTEUR)) {
        fautes.push(`${f}:${i + 1} → « ${m[0].trim()} »`);
      }
    });
  }

  assert.deepEqual(
    fautes,
    [],
    "Ces compteurs périmeront au prochain commit. Écris la COMMANDE qui les produit, pas le résultat :\n  " +
      fautes.join("\n  ")
  );
});

/**
 * Le pendant du test précédent : la commande doit être là. Retirer le chiffre
 * sans dire comment l'obtenir remplacerait un mensonge par un trou.
 */
test("le README dit comment obtenir les chiffres au lieu de les recopier", () => {
  const readme = readFileSync(join(R, "README.md"), "utf8");
  assert.match(readme, /npm test/, "la commande qui produit le compte doit être écrite");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES MODULES LIVRÉS CETTE SESSION DOIVENT ÊTRE DOCUMENTÉS QUELQUE PART.
 *
 * ⚠ Un module `lib/` que personne ne mentionne dans la doc est un module que
 * la prochaine session redécouvrira — ou pire, réécrira à côté. C'est le
 * défaut récurrent de ce dépôt, appliqué à la documentation.
 * ─────────────────────────────────────────────────────────────────────
 */
test("les modules qui portent une doctrine sont cités dans la documentation", () => {
  const docs = [
    ...readdirSync(join(R, "docs"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => join("docs", f)),
    "README.md",
    "CLAUDE.md",
  ]
    .map((f) => readFileSync(join(R, f), "utf8"))
    .join("\n");

  /**
   * Pas TOUS les modules : ceux qui portent une décision qu'on regretterait
   * de réinventer. La liste est courte et explicite — un contrôle qui exige
   * de documenter 161 fichiers ne serait jamais respecté.
   */
  const doctrinaires = [
    "hydratation",
    "paliers-campagne",
    "validation-partenaire",
    "capacite-appels",
    "call-cadence",
    "checkpoints",
    "calibration",
  ];

  const absents = doctrinaires.filter((m) => !docs.includes(m));
  assert.deepEqual(absents, [], `modules doctrinaires non documentés : ${absents.join(", ")}`);
});
