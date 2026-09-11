import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const scene = readFileSync(join(RACINE, "scripts/pub/scene.html"), "utf8");
const doc = readFileSync(join(RACINE, "docs/PUB-MOTION-MOA.md"), "utf8");

/**
 * Le texte réellement DESSINÉ : premier argument de `lines(...)` et libellés
 * des plaques. On lit la source du rendu, pas une liste tenue à la main —
 * une liste recopiée diverge, et c'est précisément ce qu'on teste.
 */
function textesALEcran(): string[] {
  const out: string[] = [];
  for (const m of scene.matchAll(/lines\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    out.push(m[1].replace(/\\n/g, "\n"));
  }
  // Les quatre lignes de la file du plan 4, déclarées en tableau.
  const bloc = scene.match(/\[\s*"Qui rappeler[\s\S]*?\]\s*\.forEach/);
  if (bloc) for (const m of bloc[0].matchAll(/"([^"]+)"/g)) out.push(m[1]);
  return out;
}

test("⚠ chaque phrase à l'écran figure dans le script arrêté", () => {
  const textes = textesALEcran();
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
    "ces phrases sont DESSINÉES mais n'existent pas dans docs/PUB-MOTION-MOA.md — " +
      "le script relu n'est pas celui qui part :\n  " + absentes.join("\n  ")
  );
});

test("⚠ la pub ne montre AUCUN prix — le prix arrive après la démonstration", () => {
  /**
   * Décision du dossier : la vidéo amène au cadrage, pas au devis. Un montant
   * à l'écran filtre plus vite, mais il affiche un prix qu'aucune vente n'a
   * validé et il brûle le levier de la démo.
   */
  for (const t of textesALEcran()) {
    assert.doesNotMatch(t, /\d+\s*(?:€|EUR|euros)/i, `montant à l'écran : « ${t} »`);
    assert.doesNotMatch(t, /\b(?:990|149|349|10\s?000)\b/, `tarif reconnaissable : « ${t} »`);
  }
});

test("⚠ la pub ne montre aucun CHIFFRE DE RÉSULTAT", () => {
  /**
   * Zéro vente à ce jour : aucun taux, aucun « +X % », aucun « N clients »
   * n'est mesuré. Un pourcentage à l'écran est une promesse.
   *
   * ⚠ « 4 mois » et « 20 minutes » restent autorisés, et la distinction est le
   * sujet : ce sont une DURÉE publique (l'affichage d'un permis) et un
   * ENGAGEMENT de notre part. Ni l'une ni l'autre n'affirme un résultat obtenu.
   */
  for (const t of textesALEcran()) {
    assert.doesNotMatch(t, /\d+\s*%/, `pourcentage à l'écran : « ${t} »`);
    assert.doesNotMatch(t, /\b\d+\s*(?:clients?|entreprises?|rdv|rendez-vous)\b/i, `résultat compté : « ${t} »`);
  }
});

test("⚠ LE PLAN QUI DIT LA LIMITE ne disparaît pas", () => {
  /**
   * C'est le plan le plus important de la pub, et le premier qu'on coupera
   * pour « gagner trois secondes ». Il est vrai, il est rare, et c'est lui qui
   * rend les quatre précédents croyables : une pub qui ne promet que du bien
   * se lit comme toutes les autres.
   *
   * La doctrine le pose : « on fait tout sauf la livraison et la poignée de
   * main ». Le retirer de l'écran ferait promettre à la vidéo ce que le
   * produit refuse explicitement de faire.
   */
  const textes = textesALEcran().map((t) => t.toLowerCase());
  assert.ok(textes.some((t) => t.includes("ne construit pas")), "la limite « il ne construit pas »");
  assert.ok(textes.some((t) => t.includes("serre pas") && t.includes("main")), "la limite « il ne serre pas la main »");
});

test("⚠ la palette est celle du produit, pas une palette inventée", () => {
  /**
   * Les couleurs sont recopiées de `app/globals.css`. Les recopier est déjà un
   * second endroit ; ce test empêche au moins qu'elles DÉRIVENT — une pub aux
   * couleurs approchantes de la marque est pire qu'une pub neutre.
   */
  const css = readFileSync(join(RACINE, "app/globals.css"), "utf8");
  const rgbVersHex = (v: string) =>
    "#" + v.split(/\s+/).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();

  for (const [jeton, nomScene] of [["--ink-950", "INK"], ["--paper", "PAPER"], ["--bronze-400", "BRONZE"]]) {
    const m = css.match(new RegExp(`${jeton}:\\s*([\\d\\s]+);`));
    assert.ok(m, `jeton ${jeton} introuvable dans globals.css`);
    const attendu = rgbVersHex(m![1].trim());
    const dansScene = scene.match(new RegExp(`${nomScene}\\s*=\\s*"(#[0-9A-Fa-f]{6})"`));
    assert.ok(dansScene, `couleur ${nomScene} introuvable dans scene.html`);
    assert.equal(
      dansScene![1].toUpperCase(),
      attendu,
      `${nomScene} a dérivé de ${jeton} — la pub ne porte plus les couleurs du produit`
    );
  }
});
