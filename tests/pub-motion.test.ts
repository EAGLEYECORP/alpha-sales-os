import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PUB DIT EXACTEMENT CE QUE LE SCRIPT DIT.
 *
 * ⚠ DEUX ENDROITS POSENT LA MÊME QUESTION, et c'est le défaut signature de ce
 * dépôt : `docs/PUB-MOTION-MOA.md` porte le script arrêté (avec ce qu'il
 * s'interdit et pourquoi), `scripts/pub/scene.html` porte ce qui est
 * RÉELLEMENT dessiné à l'écran. C'est le second qui part chez des gens.
 *
 * Une divergence ne casserait rien : elle ferait relire un script conforme
 * pendant qu'une vidéo non conforme circule. Et contrairement à une page
 * qu'on corrige en redéployant, **une vidéo publiée ne se rappelle pas**.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();

/**
 * ⚠ LES DEUX PUBS PASSENT PAR LES MÊMES GARDES, ET C'EST LE POINT.
 *
 * La première version de ce fichier ne connaissait qu'une scène. Ajouter une
 * deuxième pub sans l'inscrire ici l'aurait laissée sortir sans aucun
 * contrôle — le défaut signature du dépôt, appliqué au fichier même qui
 * existe pour l'empêcher. La liste est donc DÉRIVÉE du dossier : une scène
 * neuve entre d'office, et sans son script arrêté le test tombe.
 */
const SCRIPTS: Record<string, string> = {
  scene: "docs/PUB-MOTION-MOA.md",
  "scene-app": "docs/PUB-MOTION-APP.md",
};

const scenes = readdirSync(join(RACINE, "scripts/pub"))
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""));

/**
 * Le texte réellement DESSINÉ : premier argument de `lines(...)`, les trois
 * chaînes de `titre(...)`, et les libellés déclarés en tableau. On lit la
 * source du rendu, pas une liste tenue à la main — une liste recopiée diverge,
 * et c'est précisément ce qu'on teste.
 */
function textesALEcran(scene: string): string[] {
  const out: string[] = [];
  for (const m of scene.matchAll(/lines\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    out.push(m[1].replace(/\\n/g, "\n"));
  }
  // `titre(t, sur-titre, ligne1, ligne2)` — trois chaînes d'affilée.
  for (const m of scene.matchAll(/titre\(\s*\w+\s*,\s*((?:"(?:[^"\\]|\\.)*"\s*,?\s*){2,3})\)/g)) {
    for (const s of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) out.push(s[1]);
  }
  // Les quatre lignes de la file du plan 4 de la pub typographique.
  const bloc = scene.match(/\[\s*"Qui rappeler[\s\S]*?\]\s*\.forEach/);
  if (bloc) for (const m of bloc[0].matchAll(/"([^"]+)"/g)) out.push(m[1]);
  return out;
}

test("⚠ toute scène de pub a un script arrêté en face", () => {
  /**
   * ⚠ LA GARDE QUI REND LES SUIVANTES POSSIBLES. Sans elle, ajouter
   * `scene-truc.html` sans l'inscrire dans `SCRIPTS` ferait passer la nouvelle
   * pub À CÔTÉ de tous les contrôles ci-dessous — et rien ne le dirait, parce
   * qu'un test qui n'examine rien passe.
   */
  assert.ok(scenes.length >= 2, `extraction cassée : ${scenes.length} scène(s) trouvée(s)`);
  const orphelines = scenes.filter((s) => !SCRIPTS[s]);
  assert.deepEqual(orphelines, [], `scène(s) sans script arrêté : ${orphelines.join(", ")}`);
});

for (const nom of Object.keys(SCRIPTS)) {
  const scene = readFileSync(join(RACINE, `scripts/pub/${nom}.html`), "utf8");
  const doc = readFileSync(join(RACINE, SCRIPTS[nom]), "utf8");
  const textes = textesALEcran(scene);

  test(`⚠ [${nom}] chaque phrase à l'écran figure dans le script arrêté`, () => {
    // Non-vacuité : une extraction cassée rendrait `[]` et ce test passerait
    // sans rien comparer. Le piège déjà payé trois fois ici.
    assert.ok(textes.length >= 12, `extraction cassée : ${textes.length} texte(s) lu(s)`);

    // ⚠ On compare du TEXTE, pas du balisage : le doc est en Markdown et porte
    // des `**`, des `>` et des `*` qui n'existent pas à l'écran. Sans ça, le
    // test échouerait sur de la mise en forme et on l'assouplirait par lassitude.
    const normalise = (s: string) =>
      s.replace(/[*>_`]/g, "").replace(/\s+/g, " ").replace(/[’']/g, "'").trim().toLowerCase();
    const docN = normalise(doc);

    const absentes = textes.filter((t) => !docN.includes(normalise(t)));
    assert.deepEqual(
      absentes,
      [],
      `ces phrases sont DESSINÉES mais n'existent pas dans ${SCRIPTS[nom]} — ` +
        "le script relu n'est pas celui qui part :\n  " + absentes.join("\n  ")
    );
  });

  test(`⚠ [${nom}] la pub ne montre AUCUN prix`, () => {
    /**
     * Décision du dossier : la vidéo amène au cadrage, pas au devis. Un montant
     * à l'écran filtre plus vite, mais il affiche un prix qu'aucune vente n'a
     * validé et il brûle le levier de la démo.
     */
    for (const t of textes) {
      assert.doesNotMatch(t, /\d+\s*(?:€|EUR|euros)/i, `montant à l'écran : « ${t} »`);
      assert.doesNotMatch(t, /\b(?:990|149|349|10\s?000)\b/, `tarif reconnaissable : « ${t} »`);
    }
  });

  test(`⚠ [${nom}] la pub ne montre aucun CHIFFRE DE RÉSULTAT`, () => {
    /**
     * Zéro vente à ce jour : aucun taux, aucun « +X % », aucun « N clients »
     * n'est mesuré. Un pourcentage à l'écran est une promesse.
     *
     * ⚠ « 4 mois » et « 20 minutes » restent autorisés, et la distinction est le
     * sujet : ce sont une DURÉE publique (l'affichage d'un permis) et un
     * ENGAGEMENT de notre part. Ni l'une ni l'autre n'affirme un résultat obtenu.
     */
    for (const t of textes) {
      assert.doesNotMatch(t, /\d+\s*%/, `pourcentage à l'écran : « ${t} »`);
      assert.doesNotMatch(t, /\b\d+\s*(?:clients?|entreprises?|rdv|rendez-vous)\b/i, `résultat compté : « ${t} »`);
    }
  });

  test(`⚠ [${nom}] la palette est celle du produit, pas une palette inventée`, () => {
    /**
     * Les couleurs sont recopiées de `app/globals.css`. Les recopier est déjà un
     * second endroit ; ce test empêche au moins qu'elles DÉRIVENT — une pub aux
     * couleurs approchantes de la marque est pire qu'une pub neutre.
     */
    const css = readFileSync(join(RACINE, "app/globals.css"), "utf8");
    const rgbVersHex = (v: string) =>
      "#" + v.split(/\s+/).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();

    for (const [jeton, nomCouleur] of [["--ink-950", "INK"], ["--paper", "PAPER"], ["--bronze-400", "BRONZE"]]) {
      const m = css.match(new RegExp(`${jeton}:\\s*([\\d\\s]+);`));
      assert.ok(m, `jeton ${jeton} introuvable dans globals.css`);
      const attendu = rgbVersHex(m![1].trim());
      const dansScene = scene.match(new RegExp(`${nomCouleur}\\s*=\\s*"(#[0-9A-Fa-f]{6})"`));
      assert.ok(dansScene, `couleur ${nomCouleur} introuvable dans ${nom}.html`);
      assert.equal(
        dansScene![1].toUpperCase(),
        attendu,
        `${nomCouleur} a dérivé de ${jeton} — la pub ne porte plus les couleurs du produit`
      );
    }
  });

  test(`⚠ [${nom}] un instant de contrôle par plan, et ils sont DANS la vidéo`, () => {
    /**
     * `rendre.mjs` photographie `window.__PLANS` pour qu'on REGARDE le rendu.
     * Une liste vide ferait une vérification muette ; un instant au-delà de la
     * durée rendrait une image noire qu'on prendrait pour un plan.
     */
    const plans = scene.match(/__PLANS\s*=\s*\[([^\]]+)\]/);
    assert.ok(plans, `${nom}.html ne déclare aucun instant de contrôle`);
    const instants = plans![1].split(",").map((s) => Number(s.trim()));
    const duree = Number(scene.match(/DUR\s*=\s*([\d.]+)/)![1]);
    assert.ok(instants.length >= 5, `${instants.length} instant(s) — un par plan, au minimum`);
    for (const t of instants) {
      assert.ok(Number.isFinite(t) && t >= 0 && t < duree, `instant ${t} hors de la vidéo (0 → ${duree}s)`);
    }
  });
}

test("⚠ LE PLAN QUI DIT LA LIMITE ne disparaît pas", () => {
  /**
   * C'est le plan le plus important de la pub typographique, et le premier
   * qu'on coupera pour « gagner trois secondes ». Il est vrai, il est rare, et
   * c'est lui qui rend les quatre précédents croyables : une pub qui ne promet
   * que du bien se lit comme toutes les autres.
   *
   * ⚠ Il vise `scene` NOMMÉMENT, pas toutes les scènes. La pub des captures ne
   * porte pas cette limite et n'a pas à la porter : elle ne promet rien, elle
   * montre. Étendre ce garde à toute scène future obligerait chaque pièce à
   * réciter la même phrase, et c'est comme ça qu'on finit par la désarmer.
   */
  const textes = textesALEcran(readFileSync(join(RACINE, "scripts/pub/scene.html"), "utf8")).map((t) =>
    t.toLowerCase()
  );
  assert.ok(textes.some((t) => t.includes("ne construit pas")), "la limite « il ne construit pas »");
  assert.ok(textes.some((t) => t.includes("serre pas") && t.includes("main")), "la limite « il ne serre pas la main »");
});

test("⚠ [scene-app] la vidéo DIT que les données sont de démonstration", () => {
  /**
   * ⚠⚠ CE GARDE PROTÈGE LE SEUL ENDROIT OÙ CETTE PUB PEUT MENTIR.
   *
   * Les captures portent des montants (« en jeu », « pondéré ») issus du jeu de
   * démonstration. Sans cette ligne à l'écran, ils se lisent comme des
   * résultats — et il n'y en a AUCUN : `JUILLET_REEL.gagnes` vaut 0.
   *
   * C'est aussi la première ligne qu'on coupera pour « alléger le plan 1 ».
   */
  const textes = textesALEcran(readFileSync(join(RACINE, "scripts/pub/scene-app.html"), "utf8")).map((t) =>
    t.toLowerCase()
  );
  assert.ok(
    textes.some((t) => t.includes("démonstration") || t.includes("démo")),
    "aucune mention de démonstration à l'écran — les chiffres des captures se liraient comme des résultats"
  );
});
