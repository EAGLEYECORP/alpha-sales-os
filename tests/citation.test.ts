import { test } from "node:test";
import assert from "node:assert/strict";
import { citer } from "../lib/citation";
import { nextBestAction } from "../lib/hormozi";
import { buildArgumentaire } from "../lib/argumentaire";
import { seedProspects } from "../lib/seed";

test("citer — idempotent : une phrase déjà citée ne prend pas une seconde paire", () => {
  assert.equal(citer("C'est trop cher"), "« C'est trop cher »");
  assert.equal(citer("« C'est trop cher »"), "« C'est trop cher »");
  assert.equal(citer('"C\'est trop cher"'), '"C\'est trop cher"');
  assert.equal(citer("“C'est trop cher”"), "“C'est trop cher”");
  assert.equal(citer("  C'est trop cher  "), "« C'est trop cher »");

  // Rien à citer ne produit pas des guillemets vides.
  assert.equal(citer(""), "");
  assert.equal(citer("   "), "");
  assert.equal(citer(undefined), "");
  assert.equal(citer(null), "");

  // Un guillemet ISOLÉ n'est pas une citation fermée.
  assert.equal(citer("«"), "« « »");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT.
 *
 * La prochaine action affichait, sur la fiche ET sur le tableau de bord :
 *
 *   Traiter « « C'est trop cher pour un resto comme le mien » »
 *
 * Les objections sont STOCKÉES avec leurs guillemets — c'est la phrase du
 * prospect, mot pour mot, et c'est voulu. Quatre modules la ré-emballaient.
 *
 * Le test passe par le VRAI point d'entrée avec le VRAI jeu de données :
 * reconstituer une fiche à la main n'aurait pas reproduit le défaut, puisque
 * c'est justement le libellé du seed qui porte déjà ses guillemets.
 * ─────────────────────────────────────────────────────────────────────
 */
test("la prochaine action ne double jamais les guillemets d'une objection", () => {
  const doubles: string[] = [];
  for (const p of seedProspects) {
    const a = nextBestAction(p);
    if (/«\s*«|»\s*»/.test(a.action)) doubles.push(`${p.company} → ${a.action}`);
    if (/«\s*«|»\s*»/.test(a.why)) doubles.push(`${p.company} (why) → ${a.why}`);
  }
  assert.deepEqual(doubles, [], `guillemets doublés dans la prochaine action :\n  ${doubles.join("\n  ")}`);

  // Et la citation doit rester PRÉSENTE : on ne l'a pas supprimée pour faire
  // passer le test — la phrase du prospect doit se lire mot pour mot.
  const redzone = seedProspects.find((p) => p.id === "demo-sccv-canuts")!;
  assert.match(
    nextBestAction(redzone).action,
    /« Un robot au téléphone, sur un achat à 320 000 €, ça ne passera pas »/,
    "la phrase du prospect doit se lire MOT POUR MOT dans la prochaine action"
  );
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE GARDE JUGE LA SORTIE, PAS L'ORTHOGRAPHE DU CODE.
 *
 * ⚠ J'AI ÉCRIT D'ABORD UN SCAN DE SOURCE — « aucun module n'encadre un
 * `.label` de guillemets à la main » — ET IL A LEVÉ CINQ FAUX POSITIFS :
 * `offering.label` (un nom d'offre), `stage.label` (une étape du pipeline),
 * `BLAME_LAYERS[…].label` (une couche de l'oignon), `blocking.label` (un
 * point de contrôle). Aucun de ces libellés ne porte jamais de guillemets :
 * ce ne sont pas des phrases de prospect.
 *
 * Le nom du champ ne distingue pas les deux usages, et un garde qu'il faut
 * faire taire par exceptions est un garde qu'on apprend à ignorer. On teste
 * donc la PROPRIÉTÉ — aucune sortie destinée à l'écran ne double une paire de
 * guillemets — en faisant passer le vrai jeu de démonstration par les vrais
 * points d'entrée. C'est ce jeu-là qui porte les libellés déjà cités, donc
 * c'est lui qui reproduit le défaut.
 * ─────────────────────────────────────────────────────────────────────
 */
const DOUBLE = /«\s*«|»\s*»/;

test("aucune sortie montrée à l'écran ne double les guillemets", () => {
  const fautes: string[] = [];
  const verifier = (ou: string, v: unknown): void => {
    if (typeof v === "string") {
      if (DOUBLE.test(v)) fautes.push(`${ou} → ${v.slice(0, 120)}`);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => verifier(`${ou}[${i}]`, x));
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) verifier(`${ou}.${k}`, x);
    }
  };

  for (const p of seedProspects) {
    verifier(`${p.company} · nextBestAction`, nextBestAction(p));
    verifier(`${p.company} · argumentaire`, buildArgumentaire(p));
  }

  assert.deepEqual(fautes, [], `guillemets doublés dans du texte affiché :\n  ${fautes.join("\n  ")}`);
});
