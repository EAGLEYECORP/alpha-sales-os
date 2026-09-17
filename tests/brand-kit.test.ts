import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  A_LA_PLACE_DE_LA_PREUVE,
  COULEURS,
  INTERDITS_DE_MARQUE,
  INTERDITS_VISUELS,
  MATERIAUX,
  PORTEE,
  REGLE_DES_ETATS,
  TYPOGRAPHIE,
  VOIX,
} from "../lib/brand-kit";
import { CATEGORIE, PROMESSE, PROMESSE_COURTE } from "../lib/promesse";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE CHARTE DE MARQUE EST, PAR NATURE, LE DOCUMENT QUI RECOPIE.
 *
 * « Bronze : #E8C98A », « titre : 24 px » — c'est à ça que ressemble une
 * charte, et c'est exactement ce que ce dépôt refuse. Une charte périmée ne
 * casse rien : elle MENT à celui qui vient y chercher la règle, ce qui est le
 * mode de panne de `sc-voix-tarifs` (le Cerveau annonçait une grille remplacée
 * dix jours plus tôt) appliqué à l'apparence.
 *
 * Ce fichier vérifie donc UNE chose : que la charte ne fait que NOMMER, et que
 * chaque nom existe vraiment dans la source qui fait autorité.
 * ─────────────────────────────────────────────────────────────────────
 */

const R = process.cwd();
const lire = (p: string) => readFileSync(join(R, p), "utf8");
const KIT = lire("lib/brand-kit.ts");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("⚠⚠ CHAQUE COULEUR NOMMÉE EXISTE — ET DANS LES DEUX THÈMES", () => {
  /**
   * Le clair REDÉFINIT tous ces jetons. Une charte qui n'en vérifierait qu'un
   * seul serait fausse la moitié du temps — et le dépôt a déjà payé ça : le
   * sombre a reçu le flou et la saturation, « le clair ne les a jamais eus ».
   */
  const css = lire("app/globals.css");
  const bloc = (depuis: string) => {
    const i = css.indexOf(depuis);
    assert.ok(i > 0, `le bloc « ${depuis} » doit exister dans globals.css`);
    return css.slice(i, css.indexOf("}", i));
  };
  const sombre = bloc(":root");
  const clair = bloc("html.light");

  const manquants: string[] = [];
  for (const c of COULEURS) {
    if (!sombre.includes(`--${c.jeton}:`)) manquants.push(`${c.jeton} (sombre)`);
    if (!clair.includes(`--${c.jeton}:`)) manquants.push(`${c.jeton} (clair)`);
  }
  assert.deepEqual(manquants, [], "jeton(s) nommé(s) par la charte et absent(s) du CSS");
});

test("⚠⚠ LA CHARTE NE PORTE AUCUNE VALEUR DE COULEUR — elle NOMME", () => {
  /**
   * Le cœur du sujet. Écrire la valeur ici en ferait une deuxième définition,
   * dans le document même censé faire foi. Au premier ajustement de jeton,
   * c'est la charte qu'on ne relit pas qui mentirait.
   *
   * ⚠ On retire les commentaires AVANT de chercher : ils expliquent
   * légitimement la règle en citant un exemple (« bronze-400 = #E8C98A »), et
   * effacer l'explication laisserait la décision sans sa raison. C'est la même
   * leçon que le garde de `lib/auth.ts`, qui avalait la prose.
   */
  const code = sansCommentaires(KIT);
  const valeurs = code.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g) ?? [];
  assert.deepEqual(valeurs, [], `valeur(s) de couleur écrite(s) en dur : ${valeurs.join(", ")}`);

  // Ni triplet RGB nu (« 232 201 138 »), la forme qu'utilise `globals.css`.
  assert.ok(
    !/\b\d{1,3}\s+\d{1,3}\s+\d{1,3}\b/.test(code),
    "un triplet RGB recopié est la même faute, écrite autrement",
  );
});

test("⚠ CHAQUE FAMILLE TYPOGRAPHIQUE EXISTE DANS LA CONFIG TAILWIND", () => {
  const tw = lire("tailwind.config.ts");
  const i = tw.indexOf("fontFamily");
  assert.ok(i > 0, "la config doit déclarer `fontFamily`");
  const bloc = tw.slice(i, i + 400);
  for (const f of TYPOGRAPHIE) {
    assert.ok(bloc.includes(`${f.cle}:`), `la famille « ${f.cle} » doit exister dans tailwind.config.ts`);
  }
  // …et la charte ne recopie aucun nom de police : c'est la config qui décide.
  assert.ok(
    !/Bricolage|Inter|JetBrains/.test(sansCommentaires(KIT)),
    "un nom de police recopié dérive à la première substitution",
  );
});

test("⚠⚠ CHAQUE MATÉRIAU NOMMÉ EST UNE CLASSE QUI EXISTE VRAIMENT", () => {
  /**
   * Une charte qui décrirait une surface disparue enverrait quelqu'un écrire
   * `.surface-machin` dans un composant, où elle ne ferait rien du tout — et
   * une classe sans effet ne lève aucune erreur.
   */
  const css = lire("app/globals.css");
  for (const m of MATERIAUX) {
    assert.ok(
      new RegExp(`\\.${m.classe}\\b`).test(css),
      `la classe « .${m.classe} » est décrite par la charte et n'existe pas dans globals.css`,
    );
    assert.ok(m.piege.trim().length >= 60, `« .${m.classe} » : le piège doit dire quelque chose d'utile`);
  }
});

test("⚠⚠ LA VOIX EST IMPORTÉE DE `promesse.ts`, JAMAIS RÉÉCRITE", () => {
  /**
   * `lib/promesse.ts` existe parce que le positionnement vivait à QUATRE
   * endroits sans qu'aucun fasse autorité. Une charte de marque qui le
   * reformulerait en créerait un cinquième — et ce serait le plus crédible des
   * cinq, puisqu'il s'appelle « la charte ».
   */
  assert.equal(VOIX.promesse, PROMESSE);
  assert.equal(VOIX.promesseCourte, PROMESSE_COURTE);
  assert.equal(VOIX.categorie, CATEGORIE);

  const code = sansCommentaires(KIT);
  assert.ok(
    !code.includes("Les humains closent") && !code.includes("On ne fabrique pas l'intelligence"),
    "la promesse est importée, pas recopiée",
  );
  assert.match(KIT, /from "\.\/promesse"/, "…et elle vient bien de là");
});

test("⚠⚠ AUCUNE RAISON SOCIALE EN DUR — le produit est white-label", () => {
  /**
   * ══ LE DÉFAUT QUE CE FICHIER POURRAIT REFAIRE MIEUX QUE TOUS LES AUTRES ══
   *
   * Une charte de marque est le document où l'on écrit naturellement le nom de
   * la société, l'adresse et le logo. Ici, quatre modules sortants l'ont déjà
   * fait — « un revendeur écrivait à SES prospects sous NOTRE raison sociale ».
   *
   * Ce qui est autorisé, et seulement ça : le nom du PRODUIT, qui nomme
   * l'éditeur de l'outil et reste vrai chez tous les clients.
   */
  const code = sansCommentaires(KIT);
  assert.ok(!/EAGLEYE/i.test(code), "la raison sociale suit le COMPTE, elle ne s'écrit pas dans une charte");
  assert.ok(!/\bLyon\b/.test(code), "…et la ville non plus : un repli d'agence l'a déjà mise en dur");
  assert.ok(code.includes("Alpha Sales OS®"), "la mention de plateforme, elle, est la seule qui survive partout");

  // Et la charte DIT la distinction, au lieu de la laisser deviner.
  const parPortee = (p: string) => PORTEE.filter((e) => e.portee === p);
  assert.ok(parPortee("plateforme").length >= 2, "ce qui est à l'outil doit être listé");
  assert.ok(parPortee("operateur").length >= 2, "ce qui suit le compte aussi — c'est là qu'est le risque");
  for (const e of PORTEE) {
    assert.ok(e.source.trim().length > 0, `« ${e.quoi} » doit nommer le fichier qui fait autorité`);
  }
});

test("⚠⚠ CHAQUE INTERDIT DE MARQUE NOMME LE TEST QUI L'APPLIQUE, ET CE TEST EXISTE", () => {
  /**
   * C'est ce qui sépare une charte d'une liste de bonnes intentions : on peut
   * l'ouvrir. Un interdit dont le garde a disparu fait tomber le build, au lieu
   * de continuer à se dire dans un document que tout le monde croit appliqué —
   * la même discipline que les preuves de `lib/promesse.ts`.
   */
  const tests = new Set(readdirSync(join(R, "tests")));
  for (const i of INTERDITS_DE_MARQUE) {
    const nom = i.garde.replace(/^tests\//, "");
    assert.ok(tests.has(nom), `« ${i.regle.slice(0, 50)}… » cite ${i.garde}, qui n'existe pas`);
    assert.ok(i.regle.trim().length >= 40, "un interdit trop court se fait contourner sans mauvaise foi");
  }
});

test("⚠ CE QUI REMPLACE LA PREUVE N'EST JAMAIS UNE PERFORMANCE", () => {
  /**
   * Zéro vente : aucune mesure à citer. Un pourcentage ou un « X fois plus »
   * glissé ici ressortirait dans la première plaquette fabriquée à partir de
   * la charte — et il serait inventé.
   */
  for (const p of [...A_LA_PLACE_DE_LA_PREUVE, REGLE_DES_ETATS, ...INTERDITS_VISUELS]) {
    assert.ok(!/\d+\s*%|\bx\s?\d+\b|\d+\s*fois plus/i.test(p), `chiffre de performance : « ${p} »`);
  }
});

test("⚠⚠ CHAQUE JETON A SA PASTILLE, ÉCRITE EN ENTIER", () => {
  /**
   * ══ LE PIÈGE TAILWIND, QUI PRODUIT UN ÉCHANTILLON MUET ══
   *
   * `bg-${jeton}` assemblé à l'exécution n'est PAS extrait par Tailwind : la
   * classe n'existe pas dans le CSS final, et le carré sort transparent. Une
   * charte de couleurs dont les pastilles sont invisibles ne lève aucune
   * erreur — elle a juste l'air vide, ce qu'on met sur le compte du thème.
   *
   * Même chose pour les échantillons de typographie : la police par défaut
   * s'afficherait à la place, c'est-à-dire un échantillon qui MONTRE une
   * typographie que le produit n'utilise pas.
   */
  /**
   * ⚠ ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER, et ce n'est pas du
   * confort : ce garde a fait tomber le composant au premier passage, sur le
   * commentaire JSX qui EXPLIQUE le piège en le citant. Effacer l'explication
   * laisserait la décision sans sa raison — c'est la leçon du test de
   * `lib/auth.ts`, dont l'assertion était satisfaite par la prose.
   */
  const src = sansCommentaires(readFileSync(join(R, "components/settings/charte-marque.tsx"), "utf8"));
  for (const c of COULEURS) {
    assert.ok(
      src.includes(`"bg-${c.jeton}"`),
      `le jeton « ${c.jeton} » est déclaré par la charte et n'a pas de pastille écrite en entier`,
    );
  }
  for (const f of TYPOGRAPHIE) {
    assert.ok(src.includes(`"font-${f.cle}"`), `la famille « ${f.cle} » n'a pas d'échantillon`);
  }
  assert.ok(
    !/`bg-\$\{|`font-\$\{/.test(src),
    "une classe assemblée à l'exécution n'est jamais extraite par Tailwind — elle rend du vide",
  );
});

test("⚠⚠ LA CHARTE EST BRANCHÉE — sinon c'est un export mort de plus", () => {
  /**
   * Le défaut de signature du dépôt, et une charte y est particulièrement
   * exposée : elle a l'air complète toute seule. Un module que rien n'affiche
   * est mort, pas « prêt ».
   */
  const fautes: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.tsx$/.test(e.name) && /brand-kit/.test(readFileSync(p, "utf8"))) fautes.push(p);
    }
  };
  parcourir(join(R, "components"));
  assert.ok(fautes.length > 0, "aucun composant ne consomme la charte : elle ne sert à personne");
});
