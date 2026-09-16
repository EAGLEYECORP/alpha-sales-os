import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIE, PARTAGE, PREUVES, PROMESSE, PROMESSE_COURTE } from "../lib/promesse";

test("⚠⚠ CHAQUE PREUVE NOMME UN MODULE QUI EXISTE — c'est ça qui en fait un fait", () => {
  /**
   * Le point entier du module. Une promesse dont on peut ouvrir le fichier
   * n'est plus un argument de vente, c'est un fait vérifiable. Une preuve dont
   * le module a disparu doit faire TOMBER le build — pas continuer à se dire
   * sur une page publique.
   */
  assert.ok(PREUVES.length >= 6, "une promesse tenue par deux fichiers n'est pas une position");
  for (const p of PREUVES) {
    assert.ok(
      existsSync(join(process.cwd(), p.module)),
      `« ${p.affirmation.slice(0, 50)}… » nomme ${p.module}, qui n'existe pas`,
    );
    assert.ok(p.module.startsWith("lib/"), `${p.module} : une preuve s'applique dans lib/, pas dans un écran`);
    assert.ok(p.affirmation.length > 40, "une affirmation trop courte ne dit pas ce qu'elle garantit");
  }
});

test("⚠⚠ AUCUNE PREUVE N'EST UNE PERFORMANCE — zéro vente, donc zéro mesure à citer", () => {
  /**
   * Ce sont des RÈGLES que le logiciel applique, vérifiables aujourd'hui. Un
   * résultat (« +40 % de RDV ») demande un client, et nous n'en avons aucun :
   * l'écrire serait la preuve inventée que trois gardes refusent déjà ailleurs.
   */
  const tout = PREUVES.map((p) => p.affirmation).join(" ");
  assert.ok(!/\d+\s*%/.test(tout), "aucun pourcentage : ce serait un résultat, pas une règle");
  assert.ok(!/\d+\s*(fois|x)\s+plus/i.test(tout), "aucun multiplicateur de performance");
  assert.ok(
    !/meilleur|leader|numéro un|référence du marché|le plus/i.test(tout),
    "aucun superlatif : invérifiable à zéro vente",
  );
});

test("⚠⚠ ON N'EMPRUNTE LE NOM D'AUCUN ACTEUR — ça contredirait notre propre argument", () => {
  /**
   * « Le <grand acteur> de la vente » se contredit dans la même page : la
   * vitrine défend que l'automatisation commerciale des PME françaises ne
   * devrait pas dépendre d'acteurs américains, et `tests/vitrine-fuite` EXIGE
   * que cet angle reste.
   *
   * ⚠ On cherche la FORME — « le X de » suivi d'un nom propre — et une courte
   * liste de noms de labos, parce que c'est précisément la tentation du jour.
   * Une liste seule serait périmée au prochain acteur à la mode.
   */
  const textes = [PROMESSE, PROMESSE_COURTE, CATEGORIE, ...PREUVES.map((p) => p.affirmation)].join(" ");
  /**
   * ⚠⚠ LE GARDE AVAIT UN TROU, ET LA TENTATION SUIVANTE PASSAIT DEDANS.
   *
   * Il cherchait « le X **de la vente** » et une liste de LABOS. Demandé le
   * 16/09 : « le Apple du GTM ». Deux échappatoires d'un coup — un nom hors
   * de la liste (ce n'est pas un labo, c'est une marque grand public) et un
   * nom commun hors du motif (« du GTM », pas « de la vente »).
   *
   * Le garde ne vise donc plus un domaine : il vise la FORME, quel que soit
   * ce qui suit. C'est la leçon déjà payée ailleurs ici — « une liste seule
   * serait périmée au prochain acteur à la mode », et elle l'était en trois
   * semaines.
   */
  assert.ok(
    !/\b(openai|anthropic|mistral|google|microsoft|salesforce|hubspot|apple|tesla|netflix|uber|stripe|amazon|nvidia)\b/i.test(
      textes,
    ),
    "aucun nom de marque tiers dans la promesse",
  );
  assert.ok(
    !/\bl[ea']?\s+[A-ZÉÈ]\w+\s+(?:de|du|des|de\s+la)\s+\w+/.test(textes),
    "la forme « le <Marque> de <domaine> » signale DÉRIVÉ, quel que soit le domaine",
  );
  assert.ok(
    !/\bl[ea']?\s+\w+\s+(?:de|du|des)\s+la\s+vente\b/i.test(textes),
    "la forme « le X de la vente » signale DÉRIVÉ — et invite la comparaison qu'on perd",
  );
});

test("⚠⚠ LA CATÉGORIE SE DÉRIVE DES PREUVES — ce n'est pas une phrase posée à côté", () => {
  /**
   * L'identité affirme qu'Alpha est « celui qui refuse ». Si les garanties
   * n'étaient pas, elles aussi, des refus, ce serait un slogan collé sur un
   * produit qui fait autre chose — la définition d'un positionnement inventé,
   * et le dépôt en refuse déjà trois familles.
   *
   * On exige donc que la majorité des preuves énoncent une INTERDICTION, pas
   * une capacité. Le jour où quelqu'un ajoute cinq garanties du type « Alpha
   * rédige aussi vos… », la catégorie cesse d'être vraie et ce test le dit
   * AVANT que la phrase parte sur une page publique.
   */
  const refus = PREUVES.filter((p) =>
    /refus|interdi|aucun|jamais|ne (?:l'|le |la )?(?:écrit|produit)|s'arrête|ne passe outre|plafond|sans (?:elle|cadrage)|tiret/i.test(
      p.affirmation,
    ),
  );
  assert.ok(
    refus.length > PREUVES.length / 2,
    `la catégorie dit « celui qui refuse » : il faut que les preuves refusent (${refus.length}/${PREUVES.length})`,
  );
  assert.match(CATEGORIE, /refuse/, "et la phrase doit le dire");
});

test("⚠ LA CATÉGORIE NE PROMET AUCUNE PERFORMANCE", () => {
  // Même règle que les preuves : zéro vente, donc aucune mesure à citer. Un
  // pourcentage dans une phrase d'identité serait la première chose vérifiée.
  assert.ok(!/\d+\s*(?:%|x\b|fois)/i.test(CATEGORIE), "pas de chiffre de performance dans l'identité");
});

test("la promesse dit ce qu'on NE fait pas avant ce qu'on fait", () => {
  // « On ne fabrique pas l'intelligence » d'abord : c'est ce qui désamorce la
  // question « quel modèle entraînez-vous ? » avant qu'elle soit posée.
  assert.match(PROMESSE, /^On ne fabrique pas/);
  assert.match(PROMESSE, /hors la loi/, "et elle nomme le vrai sujet : la déployabilité");
});

test("⚠ LE PARTAGE GARDE SA LIMITE — deux des trois lignes sont au CLIENT", () => {
  /**
   * C'est la ligne qui fait vendre, et c'est la seule qui s'énonce comme une
   * limite. Un partage où tout serait à Alpha se lirait comme une brochure, et
   * se renégocierait au premier jalon.
   */
  assert.equal(PARTAGE.filter((x) => x.qui === "client").length, 2);
  assert.equal(PARTAGE.filter((x) => x.qui === "alpha").length, 1);
  assert.ok(PARTAGE.some((x) => /livraison/i.test(x.quoi) && x.qui === "client"));
  assert.ok(PARTAGE.some((x) => /poignée de main/i.test(x.quoi) && x.qui === "client"));
});

test("⚠⚠ LA PROMESSE N'EST PAS RECOPIÉE — elle se dérive, sinon elle dérive", () => {
  /**
   * Elle vivait à quatre endroits : le README, la section mission, et trois
   * commentaires. Aucun ne faisait autorité. C'est comme ça qu'une doctrine
   * part en morceaux — et c'est la version qu'on ne relit pas qui finit chez
   * un prospect.
   */
  for (const f of ["components/vitrine/mission-section.tsx", "app/vitrine/page.tsx"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    assert.ok(
      !src.includes(PROMESSE),
      `${f} recopie la promesse au lieu de l'importer de lib/promesse`,
    );
  }
});

test("⚠⚠ LA PROMESSE EST SERVIE SUR LA PAGE PUBLIQUE — pas seulement exportée", () => {
  /**
   * Le défaut récurrent du dépôt, et il serait ironique ici : un module de
   * doctrine que personne ne lit est exactement ce que ce fichier existe pour
   * empêcher. La promesse doit ATTEINDRE le visiteur.
   */
  const src = readFileSync(join(process.cwd(), "components/vitrine/mission-section.tsx"), "utf8");
  assert.match(src, /from "@\/lib\/promesse"/, "la vitrine doit importer la source");
  assert.match(src, /\{PROMESSE\}/, "et rendre la phrase, pas une paraphrase");
  assert.match(src, /PREUVES\.map\(/, "les preuves aussi : c'est ce qui la rend vérifiable");
  /**
   * ⚠ LA CATÉGORIE AUSSI, et il aurait été ironique de l'oublier : un export
   * de `lib/` que rien ne consomme est MORT, pas « prêt » — c'est le défaut
   * récurrent du dépôt, et ce module existe précisément pour empêcher qu'une
   * doctrine reste écrite sans atteindre personne.
   */
  assert.match(src, /\{CATEGORIE\}/, "l'identité doit ATTEINDRE le visiteur, pas seulement être exportée");
});

test("⚠ L'ANGLE DE SOUVERAINETÉ RESTE — la promesse s'ajoute, elle ne remplace pas", () => {
  /**
   * `tests/vitrine-fuite` exige déjà cet angle, parce qu'il a remplacé une
   * affiliation inventée et qu'il tient debout sans emprunter la crédibilité
   * de personne. La promesse le COMPLÈTE : elle dit pourquoi un meilleur
   * modèle ailleurs ne nous remplace pas. Les deux ensemble, jamais l'un à la
   * place de l'autre.
   */
  const src = readFileSync(join(process.cwd(), "components/vitrine/mission-section.tsx"), "utf8");
  assert.match(src, /acteurs américains/, "l'angle de souveraineté ne doit pas être remplacé");
  const iSouv = src.indexOf("acteurs américains");
  const iProm = src.indexOf("{PROMESSE}");
  assert.ok(iSouv > 0 && iProm > iSouv, "la promesse vient APRÈS l'angle, elle le prolonge");
});
