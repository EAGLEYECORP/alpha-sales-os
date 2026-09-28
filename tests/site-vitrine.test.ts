import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIE } from "../lib/promesse";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SITE SOCIÉTÉ (`site/`) — du HTML statique qui RECOPIE de la doctrine.
 *
 * ══ ⚠⚠ POURQUOI CE FICHIER EXISTE ══
 *
 * `eagleyecorp.fr` est servi par Netlify depuis `site/`, en statique. Il ne
 * peut donc pas IMPORTER `lib/promesse.ts` comme le fait la vitrine du
 * produit : toute doctrine qui s'y affiche est forcément une **seconde
 * définition** — exactement ce que ce dépôt refuse partout ailleurs, et pour
 * une raison déjà payée quatre fois : c'est la version qu'on ne relit pas qui
 * finit chez un prospect.
 *
 * On ne peut pas supprimer la recopie sans ajouter une étape de build à un
 * site dont le `netlify.toml` dit « aucun build, on publie le dossier tel
 * quel ». On la TIENT donc, caractère par caractère. Changer `CATEGORIE` sans
 * toucher au site fait tomber le build — c'est le seul moyen honnête de
 * recopier une doctrine.
 *
 * ⚠ Ce test ne dit RIEN de ce qui est réellement en ligne : le proxy sortant
 * de l'environnement de développement refuse de charger la page (403). Il
 * garde la SOURCE. Un déploiement oublié reste un déploiement oublié — c'est
 * ce que le branchement git répare, pas ce test.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠⚠ ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER — ET ÇA A ÉTÉ PAYÉ ICI MÊME.
 *
 * Le garde « ne promets pas la conformité » est tombé sur **son propre
 * commentaire HTML**, celui qui cite la phrase interdite pour l'interdire :
 * `⚠⚠ CE QUI NE DOIT JAMAIS ÊTRE ÉCRIT ICI : « vous serez conforme »`.
 *
 * C'est la variante en miroir d'un défaut déjà payé deux fois dans ce dépôt —
 * « **l'assertion était satisfaite par la PROSE** » pour `deploiementSansSerrure`,
 * et le motif de `lib/auth.ts` qui lit ses propres explications. Ici la prose
 * ne satisfait pas le garde, elle le **déclenche** : même cause, effet opposé,
 * et le réflexe de réparation est le pire des deux — on est tenté d'effacer
 * l'explication pour faire passer le build, donc de perdre la raison de la
 * règle.
 *
 * Un commentaire n'atteint AUCUN visiteur. Ce qui se juge est ce qui est
 * SERVI. Même principe que les citations exclues dans `tests/voice-script` :
 * une phrase rapportée n'est pas une phrase affirmée.
 *
 * ⚠ Bénéfice de bord, et il n'est pas mince : chercher dans le texte servi
 * rend aussi impossible de satisfaire un garde depuis un commentaire. Un
 * `<!-- CATEGORIE: … -->` ne compterait plus comme « la phrase est affichée ».
 */
const servi = () =>
  readFileSync(join(process.cwd(), "site/index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");

const index = servi;

test("⚠⚠ LA CATÉGORIE DU SITE EST EXACTEMENT CELLE DU CODE", () => {
  /**
   * MUTATION JOUÉE : changer un mot de la phrase dans le HTML. Ce test tombe.
   * Sans lui, le site et `lib/promesse.ts` diraient deux choses légèrement
   * différentes, et personne ne saurait laquelle fait autorité — l'état exact
   * dans lequel la promesse a vécu à quatre endroits avant d'être centralisée.
   */
  assert.ok(
    index().includes(CATEGORIE),
    `site/index.html doit contenir CATEGORIE au caractère près :\n  attendu : « ${CATEGORIE} »`,
  );
});

test("⚠ LE SITE NE PROMET PAS LA CONFORMITÉ DU CLIENT", () => {
  /**
   * ⚠⚠ LA PHRASE À NE JAMAIS ÉCRIRE : « vous serez conforme ».
   *
   * La conformité d'une entreprise dépend de ce qu'elle FAIT, pas de l'outil
   * qu'elle achète. La promettre serait deux fautes d'un coup : un conseil
   * juridique qu'on n'a pas qualité pour donner, et une promesse qu'on ne
   * peut pas tenir — celle qui se découvre au pire moment, c'est-à-dire
   * pendant un contrôle.
   *
   * Le motif vise l'ENGAGEMENT (« vous êtes / serez / rend conforme »), pas
   * le mot « conforme », qui a des usages parfaitement justes — la section
   * elle-même s'appelle « Conformité ».
   */
  const html = index();
  /**
   * ⚠⚠ CE MOTIF A DÛ ÊTRE RESSERRÉ LE JOUR MÊME — il a refusé une phrase VRAIE.
   *
   * Première rédaction, sans les deux anticipations négatives : elle mordait
   * sur « aucune ne **vous rend conforme** à notre place », c'est-à-dire sur la
   * réserve honnête que la section existe pour porter. Le garde refusait
   * exactement ce qu'il devait protéger.
   *
   * C'est la leçon déjà écrite ailleurs ici : **un garde qui refuse une phrase
   * juste est un garde qu'on assouplira au mauvais endroit la fois suivante.**
   * Ce qui est interdit est la promesse AFFIRMATIVE ; la même formule niée est
   * la seule façon correcte de dire les choses.
   */
  const PROMESSE_DE_CONFORMITE = /(?<!\bne\s)(?<!\bn')vous\s+(?:êtes|serez|rendra|rend)\s+(?:donc\s+)?(?:en\s+)?conform/i;
  assert.ok(
    !PROMESSE_DE_CONFORMITE.test(html),
    "le site ne doit pas promettre la conformité de celui qui l'achète",
  );
  // Le contre-test, obligatoire : le garde doit laisser passer la négation,
  // sinon il pousse à supprimer la réserve pour faire passer le build.
  assert.ok(
    !PROMESSE_DE_CONFORMITE.test("aucune ne vous rend conforme à notre place"),
    "la forme NIÉE est la bonne : le garde ne doit pas la refuser",
  );
  assert.ok(
    PROMESSE_DE_CONFORMITE.test("avec Alpha vous êtes conforme"),
    "…mais il doit toujours attraper la promesse affirmative",
  );
  assert.ok(
    !/\b(?:100\s*%|totalement|entièrement|pleinement)\s+conforme\b/i.test(html),
    "aucune conformité absolue : elle dépend de l'usage, pas de l'outil",
  );
  // Et la réserve doit RESTER : c'est elle qui rend la section honnête.
  assert.match(
    html,
    /ne vous rend conforme à notre place/,
    "la réserve qui dit que la conformité dépend de lui doit rester servie",
  );
});

test("⚠ AUCUN LABEL, AUCUN ORGANISME, AUCUNE CERTIFICATION", () => {
  /**
   * La famille d'affirmations la plus dangereuse du dépôt, et celle qui a déjà
   * mordu en public : une affiliation se vérifie auprès de l'organisme, sans
   * nous prévenir. Un témoignage inventé se démonte en conversation ; un label
   * inventé se démonte dans le dos.
   */
  const html = index();
  assert.ok(
    !/\b(?:certifié|labellisé|agréé|accrédité|lauréat|french tech|bpifrance)\b/i.test(html),
    "aucun label ni organisme : ça se vérifie auprès d'un tiers",
  );
});

test("⚠ AUCUN MONTANT D'AMENDE SUR UNE PAGE DE VENTE", () => {
  /**
   * Les amendes du règlement sont publiques et exactes. Les citer ici n'en
   * ferait pas un argument faux — ça en ferait un argument de PEUR, et c'est
   * le contraire exact de la voix de ce site, qui vend en disant ce qu'il
   * refuse. Qui veut le chiffre le trouve en une recherche.
   */
  const section = index().split('id="conformite"')[1]?.split("</section>")[0] ?? "";
  assert.ok(section.length > 0, "la section conformité doit exister");
  assert.ok(
    !/\b(?:amende|sanction|pénalité)s?\b[^<]{0,120}\d/i.test(section),
    "pas de montant d'amende : on vend ce qu'on applique, pas ce qu'il risque",
  );
});

test("⚠ LA SECTION CONFORMITÉ EST ATTEIGNABLE — pas seulement présente", () => {
  /**
   * Le défaut récurrent du dépôt, transposé à une page : une section qu'aucun
   * lien ne désigne existe pour le code source et pour personne d'autre. Sur
   * un téléphone, on ne défile pas jusqu'à la cinquième bande par curiosité.
   */
  const html = index();
  assert.match(html, /<a href="#conformite">/, "la navigation doit y mener");
  assert.match(html, /id="conformite"/, "et la cible doit exister");
});

test("⚠⚠ AUCUNE CONFIG NETLIFY NE PEUT PUBLIER LA RACINE DU DÉPÔT", () => {
  /**
   * LA GARDE LA PLUS CHÈRE DE CE FICHIER, et elle ne parle pas de marketing.
   *
   * Le jour où ce dépôt est relié à Netlify, « quel dossier publie-t-on ? » se
   * répond automatiquement à chaque push. Une publication STATIQUE de la racine
   * servirait `donnees-privees/` (78 fiches réelles, dont une personne physique
   * avec son mobile), le code, la doctrine, et tout `.env.local` présent sur la
   * machine de build — en HTTP, sans que personne clone ni attaque.
   *
   * Ce dépôt a déjà publié des données personnelles de tiers une fois. Le
   * modèle de menace d'alors — « un attaquant qui passe par le produit » —
   * ratait le clone ; celui-ci rate le DÉPLOIEMENT. C'est la troisième porte.
   *
   * ══ ⚠⚠ LA GARDE A CHANGÉ DE MÉCANISME LE 17/09 — MÊME INTENTION ══
   *
   * La racine ne confine plus à `site/` (`base = "site"`) : elle CONSTRUIT
   * l'app Alpha. Un build Next.js ne sert JAMAIS l'arbre du dépôt — il sert la
   * sortie du build (`public/` + fonctions). Le danger n'a jamais été « la
   * racine est la base », c'était « la racine est publiée EN STATIQUE ». La
   * garde vise donc désormais la vraie cause :
   *   1. la racine CONSTRUIT (runtime Next présent = preuve qu'on ne sert pas
   *      l'arbre) ;
   *   2. aucune config ne déclare un `publish` statique de la racine.
   *
   * ⚠ MUTATIONS JOUÉES : mettre `publish = "."` à la racine, et retirer le
   * runtime Next. Les deux font tomber ce test.
   */
  const racine = readFileSync(join(process.cwd(), "netlify.toml"), "utf8").replace(/^\s*#.*$/gm, "");

  // 1. La racine construit l'app — c'est ce qui garantit que l'arbre n'est
  //    jamais servi tel quel.
  assert.match(
    racine,
    /@netlify\/plugin-nextjs/,
    "la config racine doit déclarer le runtime Next : un build ne sert pas l'arbre du dépôt, une publication statique si",
  );

  // 2. Et elle ne publie RIEN en statique — ni la racine (`.`), ni un parent,
  //    ni un `publish` vide qui vaut la racine.
  assert.ok(
    !/publish\s*=\s*"\.?\.?"/.test(racine),
    "la racine ne déclare aucun `publish` statique — le runtime Next pose la sienne (`.next`)",
  );

  /**
   * ⚠ Et le fichier du site vitrine ne doit pas se mettre à publier au-dessus
   * de lui-même. `publish = ".."` depuis `site/` ramènerait exactement le trou
   * qu'on vient de fermer, par l'autre bout — indépendamment de ce que fait la
   * racine.
   */
  const dusite = readFileSync(join(process.cwd(), "site/netlify.toml"), "utf8").replace(/^\s*#.*$/gm, "");
  assert.match(dusite, /publish\s*=\s*"\."/, "le site publie SON dossier");
  assert.ok(!/publish\s*=\s*"\.\./.test(dusite), "et jamais un dossier parent");
});

test("⚠⚠ AUCUN SÉLECTEUR CSS ORPHELIN — le défaut qui a écrasé la carte noire", () => {
  /**
   * ⚠⚠ LE GARDE LE PLUS UTILE DE CE FICHIER, et il vient d'un vrai bug servi
   * en public pendant deux semaines.
   *
   * Le 04/09, le HTML a été réécrit (« eagleyecorp.fr devient la SOCIÉTÉ »)
   * sans nettoyer la feuille de style. Environ un tiers du CSS décrivait
   * alors une page disparue : `.dlist`, `.num`, `.feat`, `.f`, `.tier`,
   * `.pricing`, `.shot`, `.badge`, `.price`, `.psub`, `.ic`, `.tag`.
   *
   * Ce n'est pas du poids mort inoffensif. `.dlist` portait la grille à deux
   * colonnes du bloc « ce qu'on refuse » ET son repli mobile. Les deux morts,
   * il restait `.d{display:flex}` avec un `<h3>` et un `<p>` en enfants
   * directs : titre et texte côte à côte, en deux colonnes étroites, sur tous
   * les écrans. « On ne livre pas votre prestation » tombait sur quatre
   * lignes dans 90 pixels.
   *
   * **Un sélecteur orphelin ne fait rien tomber.** Il laisse la mise en page
   * se rabattre sur des valeurs par défaut qui ont l'air volontaires, et il
   * fait croire au lecteur suivant que la structure existe. C'est la forme
   * CSS du défaut récurrent de ce dépôt : un mécanisme juste, branché nulle
   * part.
   */
  const html = readFileSync(join(process.cwd(), "site/index.html"), "utf8");
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  // Les classes réellement posées dans le markup.
  const posees = new Set<string>();
  for (const m of html.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) posees.add(c);
  }
  /**
   * ⚠ On retire les COMMENTAIRES du CSS avant de chercher : ils citent des
   * noms de classes retirées pour expliquer pourquoi elles l'ont été. Même
   * leçon que le garde de conformité plus haut — la prose déclenchait le
   * contrôle qu'elle servait à documenter.
   */
  const regles = style.replace(/\/\*[\s\S]*?\*\//g, "");
  const orphelins = new Set<string>();
  for (const m of regles.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    const c = m[1];
    if (!posees.has(c)) orphelins.add(c);
  }
  assert.deepEqual(
    [...orphelins].sort(),
    [],
    `du CSS décrit un markup qui n'existe pas : .${[...orphelins].sort().join(", .")}`,
  );
});

test("⚠ LA CAPTURE PRODUIT EST SERVIE — pas seulement déployée", () => {
  /**
   * `assets/produit-pipeline.{webp,jpg}` est en ligne depuis le 04/09 et
   * n'était référencé NULLE PART : 264 Ko dans le déploiement que personne ne
   * voyait. Et la page vendait un logiciel sans jamais le montrer.
   *
   * ⚠ Les dimensions sont EXIGÉES et doivent être les vraies (2200x1375,
   * relevées dans le fichier). Sans elles, l'arrivée de l'image décale tout
   * ce qui suit ; fausses, elles produisent le même décalage en prétendant
   * l'éviter.
   */
  const html = readFileSync(join(process.cwd(), "site/index.html"), "utf8");
  assert.match(html, /produit-pipeline\.webp/, "la version webp doit être proposée en premier");
  assert.match(html, /produit-pipeline\.jpg/, "et le jpg servir de repli");
  assert.match(html, /width="2200" height="1375"/, "les dimensions réelles réservent la place");
  assert.match(html, /loading="lazy"/, "elle est sous la ligne de flottaison");
  const alt = /<img[^>]*alt="([^"]+)"/.exec(html)?.[1] ?? "";
  assert.ok(alt.length > 40, `l'alt doit décrire ce qu'on voit, pas nommer le fichier (vu : « ${alt} »)`);
});

test("⚠ LE BOUTON DU HAUT NE SE COUPE PAS — il raccourcit", () => {
  /**
   * « Demander un cadrag », coupé net par le bord droit du téléphone, sur
   * quatre captures. Le bouton porte `white-space:nowrap` : il ne peut pas se
   * réduire, donc il sortait de l'écran et entraînait le body dans un
   * défilement horizontal.
   *
   * Deux libellés dans le markup, pas un `text-overflow` : un bouton tronqué
   * par des points de suspension n'est pas un bouton, c'est un bug qui a
   * l'air volontaire.
   */
  const html = readFileSync(join(process.cwd(), "site/index.html"), "utf8");
  assert.match(html, /<span class="long">Demander un cadrage<\/span><span class="court">/);
  const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(style, /\.btn \.long\{display:none\}/, "le libellé long disparaît sous le point de rupture");
  assert.match(style, /overflow-x:clip/, "et un filet empêche un débordement futur de casser la page");
});

test("⚠ LA DATE D'ENTRÉE EN APPLICATION EST CELLE DU RÈGLEMENT", () => {
  /**
   * Le 2 août 2026. Une date fausse sur une page publique, à propos d'un texte
   * de loi, est la faute la plus facile à vérifier qui existe — et elle
   * disqualifie tout ce qui l'entoure, y compris ce qui est vrai.
   */
  assert.match(index(), /2 août 2026/, "la date doit être exacte et présente");
});
