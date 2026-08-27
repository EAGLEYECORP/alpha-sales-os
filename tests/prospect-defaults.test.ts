import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prospectDefaults } from "../lib/seed";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RÈGLE D'ÉCRAN N° 1, ET LE TEST QU'ELLE PROMETTAIT SANS L'AVOIR.
 *
 * `prospectDefaults` n'est pas un jeu de démonstration : c'est le SOCLE de
 * tous les imports. Une fiche terrain n'apporte qu'un nom, une ville et un
 * numéro ; tout le reste vient d'ici. Un champ non optionnel de `Prospect`
 * absent de ce socle produit une fiche à trou — et l'écran qui la lit tombe.
 *
 * C'est arrivé : cinq tableaux manquaient, et `/aujourdhui` rendait un écran
 * BLANC après un import terrain. Pas une erreur lisible, pas un message :
 * une page vide, en clientèle.
 *
 * ⚠ CE QUI A MOTIVÉ CE FICHIER. L'en-tête de `lib/seed.ts` affirme :
 *
 *   « TOUT champ de `Prospect` qui n'est pas optionnel dans le type a sa
 *     valeur neutre ici, et `tests/store.test.ts` le vérifie champ par champ. »
 *
 * `tests/store.test.ts` ne contient AUCUNE occurrence de `prospectDefaults`.
 * La phrase décrivait une garde qui n'existait pas — et elle rassurait
 * exactement là où il fallait vérifier. C'est la même famille que les autres
 * défauts de cette passe : le code est juste, la doctrine est juste, et rien
 * ne relie les deux.
 *
 * Deuxième raison de le dériver du TYPE plutôt que de lister les champs à la
 * main : `prospectDefaults` est un littéral sans annotation. Ajouter un champ
 * non optionnel à `Prospect` ne produit donc aucune erreur de compilation ici.
 * Le compilateur ne dira rien ; ce test, si.
 * ─────────────────────────────────────────────────────────────────────
 */

const types = readFileSync(join(process.cwd(), "lib/types.ts"), "utf8");

/**
 * Les champs de `Prospect`, lus dans le type lui-même.
 *
 * On accepte que ce découpage soit grossier — il ne sert qu'à énumérer des
 * noms de propriétés au premier niveau. Les objets imbriqués (`funding: {…}`)
 * sont sautés en suivant les accolades : sans ça, leurs champs internes
 * remonteraient comme s'ils étaient des champs de `Prospect`.
 */
function champsDeProspect(): { nom: string; optionnel: boolean }[] {
  const debut = types.indexOf("export interface Prospect {");
  assert.ok(debut >= 0, "l'interface Prospect doit exister");
  const corps = types.slice(debut + "export interface Prospect {".length);

  const out: { nom: string; optionnel: boolean }[] = [];
  let profondeur = 0;
  let dansBloc = false;

  for (const ligne of corps.split("\n")) {
    const t = ligne.trim();
    if (t === "}" && profondeur === 0) break;

    // Commentaires : ils contiennent des exemples qui ressemblent à des champs.
    if (dansBloc) {
      if (t.includes("*/")) dansBloc = false;
      continue;
    }
    if (t.startsWith("/*")) {
      if (!t.includes("*/")) dansBloc = true;
      continue;
    }
    if (t.startsWith("//") || t.startsWith("*")) continue;

    if (profondeur === 0) {
      const m = /^([A-Za-z_$][\w$]*)(\?)?\s*:/.exec(t);
      if (m) out.push({ nom: m[1], optionnel: Boolean(m[2]) });
    }
    profondeur += (t.match(/\{/g) ?? []).length - (t.match(/\}/g) ?? []).length;
  }
  return out;
}

/**
 * Les champs qu'un IMPORT fournit toujours lui-même : l'identité de la fiche.
 * Ils n'ont pas de valeur neutre — une fiche sans entreprise n'est pas une
 * fiche « par défaut », c'est une fiche vide.
 */
const FOURNIS_A_L_IMPORT = new Set(["id", "name", "company", "sector", "city", "stage", "createdAt", "updatedAt"]);

test("⚠ le socle d'import couvre TOUT champ non optionnel de Prospect", () => {
  const champs = champsDeProspect();
  assert.ok(champs.length > 25, `lecture du type cassée : ${champs.length} champs trouvés`);

  const cles = new Set(Object.keys(prospectDefaults));
  const manquants = champs
    .filter((c) => !c.optionnel && !FOURNIS_A_L_IMPORT.has(c.nom) && !cles.has(c.nom))
    .map((c) => c.nom);

  assert.deepEqual(
    manquants,
    [],
    "ces champs n'ont pas de valeur neutre dans `prospectDefaults` — une fiche importée les aura " +
      "`undefined`, et l'écran qui les lit tombera en page blanche :\n  " +
      manquants.join("\n  ")
  );
});

test("le socle ne porte RIEN qui ne soit un champ de Prospect", () => {
  /**
   * L'autre sens compte aussi, moins gravement : une clé qui ne correspond à
   * aucun champ est du poids mort recopié sur CHAQUE fiche importée. Le
   * localStorage est plafonné à 5 Mo et une fiche pèse environ 1,3 Ko — c'est
   * déjà la moitié du quota pour mille numéros.
   */
  const noms = new Set(champsDeProspect().map((c) => c.nom));
  const intrus = Object.keys(prospectDefaults).filter((k) => !noms.has(k));
  assert.deepEqual(intrus, [], `clés sans champ correspondant dans Prospect : ${intrus.join(", ")}`);
});

test("les valeurs neutres sont NEUTRES — pas des données de démonstration", () => {
  /**
   * Un socle qui porte « ***NOM-RETIRE*** » ou 3 500 € tamponne une fausse donnée sur
   * chaque fiche importée, et personne ne le voit : ça ressemble à une fiche
   * remplie. On vérifie donc que chaque valeur est vide, zéro, ou l'état
   * initial explicite d'une machine à états.
   */
  const suspects: string[] = [];

  /**
   * ⚠ LA PREMIÈRE VERSION DE CE TEST SIGNALAIT `delivery: "non-demarre"`, ET
   * ELLE AVAIT TORT.
   *
   * « non-demarre » n'est pas une donnée : c'est l'état initial explicite
   * d'une machine à états, et il est plus honnête qu'une chaîne vide. Ce qu'on
   * cherche, c'est une DONNÉE tamponnée sur chaque fiche — un nom, une ville,
   * une phrase. Le discriminant est la forme : un état est un identifiant d'un
   * seul tenant ; une donnée porte une espace, un chiffre, une arobase ou un
   * accent.
   */
  const estUnEtat = (v: string) => /^[a-z][a-z0-9-]*$/.test(v);

  for (const [k, v] of Object.entries(prospectDefaults as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      if (v.length) suspects.push(`${k} (tableau pré-rempli)`);
    } else if (typeof v === "string") {
      if (v.trim() && !estUnEtat(v)) suspects.push(`${k} = "${v}"`);
    } else if (typeof v === "number") {
      /**
       * Les curseurs 0–100 ont un plancher assumé, documenté dans `lib/seed.ts`
       * (trust 10, conviction 8, probability 5) : une fiche importée n'est pas
       * à zéro de confiance, elle est très bas. Un MONTANT par défaut, lui,
       * n'est jamais neutre — il invente du chiffre d'affaires.
       */
      const curseur = /likeness|trust|probability|score|conviction/i.test(k);
      if (v !== 0 && !curseur) suspects.push(`${k} = ${v}`);
      if (curseur && (v < 0 || v > 100)) suspects.push(`${k} = ${v} (hors 0–100)`);
    }
  }
  assert.deepEqual(suspects, [], "valeurs non neutres dans le socle d'import :\n  " + suspects.join("\n  "));
});
