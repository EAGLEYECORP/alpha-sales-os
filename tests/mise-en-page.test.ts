import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const R = process.cwd();

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISE EN PAGE EST UN MÉCANISME, PAS UNE HABITUDE.
 *
 * Ce fichier garde deux choses qui, laissées libres, dérivent SANS JAMAIS
 * PLANTER — la forme exacte du défaut récurrent de ce dépôt :
 *
 *   1. le RYTHME d'un écran (`.page`) ;
 *   2. le MATÉRIAU des surfaces (`.card` translucide, `.panel` creusé).
 *
 * ── CE QUI A ÉTÉ CONSTATÉ, PAS SUPPOSÉ ──
 *
 * Avant ce test, sur les écrans de l'app :
 *   · trois valeurs d'espacement racine (`space-y-4`, `-5`, `-6`) sans qu'aucune
 *     ne soit un choix — c'était l'ordre d'écriture des pages ;
 *   · deux écrans (`/controle`, `/trajectoire`) ajoutaient `p-4` PAR-DESSUS le
 *     padding de la coquille, donc un cadre plus épais qu'ailleurs ;
 *   · trois écrans n'avaient pas l'apparition en fondu et « claquaient » ;
 *   · la classe de titre `font-display text-2xl font-bold text-paper` était
 *     recopiée à la main dans 35 fichiers ;
 *   · `.card` avait DEUX définitions (une par thème) : le sombre avait gagné le
 *     flou, le clair ne l'a jamais reçu ;
 *   · 22 surfaces « carte » étaient bricolées à la main avec des valeurs
 *     d'encre en dur, et ne recevaient donc aucun de ces effets ;
 *   · trois surfaces de chrome portaient trois opacités différentes (60/90/95 %)
 *     pour encadrer le même contenu.
 *
 * Aucune de ces divergences n'a jamais fait échouer quoi que ce soit. C'est
 * exactement pourquoi il faut un test : rien d'autre ne les signale.
 * ─────────────────────────────────────────────────────────────────────
 */

const CSS = readFileSync(join(R, "app/globals.css"), "utf8");

/** Extrait le corps d'une règle CSS `sélecteur { … }`, ou "" si absente. */
function regle(selecteur: string): string {
  const i = CSS.indexOf(selecteur + " {");
  if (i < 0) return "";
  const debut = CSS.indexOf("{", i);
  const fin = CSS.indexOf("}", debut);
  return CSS.slice(debut + 1, fin);
}

/** Tous les `page.tsx` sous `app/(app)`, chemins relatifs à la racine. */
function pagesApp(): string[] {
  const base = join(R, "app", "(app)");
  const out: string[] = [];
  const marche = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) marche(p);
      else if (e === "page.tsx") out.push(p.slice(R.length + 1));
    }
  };
  marche(base);
  return out.sort();
}

/** Tous les composants et pages, pour les contrôles de surface. */
function sourcesTsx(): string[] {
  const out: string[] = [];
  const marche = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) marche(p);
      else if (e.endsWith(".tsx")) out.push(p.slice(R.length + 1));
    }
  };
  marche(join(R, "app"));
  marche(join(R, "components"));
  return out.sort();
}

/* ═══════════════════════════════════════════════════════════════════
   1. LE RYTHME D'ÉCRAN
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Les écrans qui ne portent PAS `.page`, chacun avec sa raison.
 *
 * ⚠ Une exception sans motif écrit redevient un oubli au bout d'une session.
 * Et le test vérifie que le fichier existe encore : une page supprimée ne doit
 * pas laisser derrière elle une autorisation que la suivante héritera.
 */
const HORS_RYTHME: Record<string, string> = {
  "app/(app)/agent/page.tsx":
    "conversation à hauteur fixe : `space-y-*` sur un parent flex-col décale la zone flex-1 et sort la saisie du cadre",
  "app/(app)/login/page.tsx":
    "carte unique centrée verticalement, sans titre d'écran ni pile de sections",
  "app/(app)/overlay/page.tsx":
    "fenêtre Electron transparente : elle n'est pas dans la coquille et ne doit surtout pas peindre de fond",
};

test("chaque écran de l'app suit le même rythme, ou dit pourquoi il ne le suit pas", () => {
  const fautes: string[] = [];
  for (const f of pagesApp()) {
    const src = readFileSync(join(R, f), "utf8");
    const aLeRythme = /className="page(?:[ "])/.test(src);
    const exception = HORS_RYTHME[f];
    if (aLeRythme && exception) fautes.push(`${f} → porte .page ET figure dans les exceptions : retire l'exception`);
    if (!aLeRythme && !exception) fautes.push(`${f} → ni .page ni exception justifiée`);
  }
  assert.deepEqual(fautes, [], fautes.join("\n  "));
});

test("aucune exception de rythme ne survit à la page qu'elle couvrait", () => {
  const morts = Object.keys(HORS_RYTHME).filter((f) => !existsSync(join(R, f)));
  assert.deepEqual(morts, [], `exceptions orphelines : ${morts.join(", ")}`);
});

test("⚠ aucun écran ne redéfinit son espacement ni son padding racine", () => {
  /**
   * C'est CETTE assertion qui empêche le retour du défaut, pas la précédente :
   * une page peut porter `.page` et lui ajouter `space-y-6` juste après, ce qui
   * la fait diverger en silence tout en passant le contrôle du dessus.
   *
   * `p-4` racine est visé pour la même raison : le padding appartient à la
   * coquille (`app-shell`), et les deux écrans qui l'ajoutaient avaient un
   * cadre visiblement plus épais que les autres.
   */
  const fautes: string[] = [];
  for (const f of pagesApp()) {
    const src = readFileSync(join(R, f), "utf8");
    for (const m of src.matchAll(/className="page([^"]*)"/g)) {
      const reste = m[1];
      if (/\bspace-y-\d/.test(reste)) fautes.push(`${f} → « page${reste} » redéfinit l'espacement`);
      if (/\bp-\d/.test(reste)) fautes.push(`${f} → « page${reste} » ajoute un padding que la coquille pose déjà`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n  "));
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN `col-span` SANS GRILLE NE FAIT RIEN, ET NE SE VOIT PAS.
 *
 * ⚠ CONSTATÉ. `/settings` était une grille `lg:grid-cols-2` dont certaines
 * cartes s'échappaient en `lg:col-span-2`. Sur les six, DEUX étaient posés sur
 * une `<section>` enfermée dans un `<PanneauOperateur>` — donc jamais enfant
 * direct de la grille. Ils n'ont jamais élargi quoi que ce soit.
 *
 * C'est la forme visuelle du défaut récurrent du dépôt : un mécanisme correct,
 * écrit, et branché nulle part. Rien n'échoue — une carte plus étroite que
 * prévu ne ressemble pas à un bug, elle ressemble à une carte.
 *
 * ── CE QUE CE TEST NE PEUT PAS FAIRE, ET POURQUOI JE LE DIS ──
 *
 * J'ai d'abord écrit la règle générale : « un composant exporté dont la racine
 * porte un col-span doit être rendu par un appelant qui déclare une grille ».
 * Elle a l'air juste. Elle ne mord pas, et la mutation l'a prouvé — remettre
 * un col-span orphelin sur `pricing-editor` ne faisait tomber aucun test,
 * parce que `/settings` contient encore six `md:grid-cols-2` INTERNES, dans
 * ses cartes. Le fichier « a une grille » ; ce n'est simplement pas celle qui
 * rend ce composant. Répondre juste demanderait de remonter l'arbre JSX
 * jusqu'au parent réel — ce qu'une lecture de source ne fait pas honnêtement.
 *
 * Il reste donc ici la moitié DÉCIDABLE : un col-span sur un composant que
 * plus personne ne rend. Et le cas d'aujourd'hui est couvert par le test
 * suivant, qui est spécifique et, lui, mesuré : `/settings` n'a plus de
 * grille de sections, donc aucun de ses panneaux ne porte de col-span.
 *
 * Une règle étroite qui tombe vaut mieux qu'une règle large qui passe.
 * ─────────────────────────────────────────────────────────────────────
 */
test("aucun col-span ne pend dans le vide", () => {
  const fichiers = sourcesTsx();
  const contenus = new Map(fichiers.map((f) => [f, readFileSync(join(R, f), "utf8")]));

  const fautes: string[] = [];
  for (const [f, src] of contenus) {
    /**
     * ⚠ On ne regarde QUE le `col-span` posé sur l'élément RACINE d'un
     * `return (` — c'est le seul qui s'adresse à la grille de l'appelant.
     *
     * La première version se contentait de « ce fichier a-t-il une
     * `grid-cols-` quelque part ? » et passait son chemin si oui. Une
     * mutation l'a démontée : remettre un `lg:col-span-2` orphelin sur
     * `pricing-editor.tsx` ne faisait tomber aucun test, parce que ce
     * fichier a une grille INTERNE — pour ses propres enfants, qui n'a
     * rien à voir avec le span de sa racine.
     */
    const corps = sansCommentaires(src);

    /**
     * On découpe par composant EXPORTÉ. Un composant local à un fichier qui
     * pose lui-même sa grille n'est pas concerné : sa racine et sa grille
     * vivent ensemble et se lisent d'un coup d'œil (c'est le cas des dix
     * panneaux de la fiche prospect). Ce qui se perd de vue, et qui a
     * effectivement été perdu de vue ici, c'est le span d'un composant
     * exporté qui dépend d'une grille écrite dans un AUTRE fichier.
     */
    const exports = [...corps.matchAll(/export function (\w+)/g)];
    for (let i = 0; i < exports.length; i++) {
      const nom = exports[i][1];
      const bloc = corps.slice(exports[i].index!, exports[i + 1]?.index ?? corps.length);
      const racine = /return \(\s*\n\s*<\w+[^>]*?className="([^"]*)"/.exec(bloc)?.[1] ?? "";
      if (!/\bcol-span-/.test(racine)) continue;

      const appelants = [...contenus].filter(([g, s]) => g !== f && s.includes(`<${nom}`));
      if (!appelants.length) {
        fautes.push(`${f} → <${nom}> n'est rendu nulle part : son col-span est mort avec lui`);
      }
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n  "));
});

test("l'écran de réglages se lit en UNE colonne, pleine largeur", () => {
  /**
   * Deux colonnes sur un écran de réglages, c'était trois défauts à la fois :
   * des hauteurs qui ne s'accordaient jamais (une carte de deux lignes à côté
   * d'une carte de trente, et le trou blanc entre les deux), des champs déjà
   * en `md:grid-cols-2` DANS les cartes qui tombaient donc à la moitié d'une
   * moitié (les URL n8n et Supabase se lisaient sur quinze caractères), et
   * les deux `col-span` inertes ci-dessus.
   *
   * On vérifie la CONDITION — pas de grille multi-colonnes sur le conteneur
   * de sections — et pas la présence d'un `space-y-*`, qu'un `grid-cols-2`
   * ajouté à côté laisserait passer.
   */
  const src = readFileSync(join(R, "app/(app)/settings/page.tsx"), "utf8");
  const corps = sansCommentaires(src);
  // `sansCommentaires` laisse un `{}` là où était chaque commentaire JSX :
  // le conteneur et le premier panneau ne sont donc pas collés.
  const conteneur = /<div className="([^"]*)">\s*(?:\{\}\s*)*<PanneauOperateur titre="Infrastructure"/.exec(corps);
  assert.ok(conteneur, "le conteneur de sections de /settings doit être identifiable");
  assert.doesNotMatch(
    conteneur[1],
    /grid-cols-/,
    `le conteneur est « ${conteneur[1]} » : les cartes doivent occuper toute la largeur`
  );

  /**
   * Et le corollaire, sans lequel le premier point ne suffit pas : les
   * panneaux de `/settings` sont rendus PAR cet écran et par personne d'autre
   * (vérifié : `<PricingEditor`, `<SystemStatus`, `<Deliverability`… n'ont
   * qu'un seul appelant). Un `col-span` sur l'un d'eux ne peut donc plus
   * s'adresser à aucune grille — c'est exactement la classe morte qu'on vient
   * de retirer de cinq d'entre eux.
   */
  const fautes: string[] = [];
  for (const f of sourcesTsx().filter((x) => x.startsWith("components/settings/"))) {
    const corpsPanneau = sansCommentaires(readFileSync(join(R, f), "utf8"));
    for (const m of corpsPanneau.matchAll(/className="([^"]*\bcol-span-[^"]*)"/g)) {
      fautes.push(`${f} → « ${m[1]} » : /settings n'a plus de grille de sections`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join("\n  "));
});

/* ═══════════════════════════════════════════════════════════════════
   2. UN SEUL EN-TÊTE
   ═══════════════════════════════════════════════════════════════════ */

/** La signature de classe d'un titre d'écran. Elle n'existe qu'à un endroit. */
const SIGNATURE_TITRE = "font-display text-2xl font-bold text-paper";

test("la classe de titre d'écran n'est écrite qu'une seule fois, dans PageHeader", () => {
  const porteurs = sourcesTsx().filter((f) => readFileSync(join(R, f), "utf8").includes(SIGNATURE_TITRE));
  assert.deepEqual(
    porteurs,
    ["components/ui/page-header.tsx"],
    `cette chaîne était recopiée dans 35 fichiers ; elle appartient à PageHeader. Porteurs : ${porteurs.join(", ")}`
  );
});

test("PageHeader tient l'ordre de lecture — cadre, titre, phrase — et sort la pastille du <h1>", () => {
  // ⚠ On lit le JSX, pas le fichier : la documentation du composant CITE
  // `<h1>` en prose bien avant de le rendre, et chercher dans tout le fichier
  // faisait tomber le contrôle sur un commentaire. Premier faux positif de ce
  // test, et il aurait pu se « réparer » en supprimant la doc.
  const fichier = readFileSync(join(R, "components/ui/page-header.tsx"), "utf8");
  const src = fichier.slice(fichier.indexOf("  return ("));
  assert.ok(src, "le corps rendu de PageHeader doit être trouvable");
  const iEyebrow = src.indexOf("{eyebrow}");
  const iH1 = src.indexOf("<h1");
  const iSub = src.indexOf("{subtitle}");
  assert.ok(iEyebrow > 0 && iH1 > 0 && iSub > 0, "les trois blocs doivent exister");
  assert.ok(iEyebrow < iH1, "le sur-titre se lit AVANT le titre : il dit dans quel monde on entre");
  assert.ok(iH1 < iSub, "la phrase explicative vient APRÈS le titre");

  /**
   * ⚠ La pastille d'état doit être HORS du `<h1>`. Dedans, un lecteur d'écran
   * annonce « titre : Menuiserie Charbonnier Négociation » d'un seul bloc et le
   * plan du document devient faux. On vérifie la CONDITION (l'index de
   * `{badge}` tombe après `</h1>`), pas la simple présence du mot.
   */
  const finH1 = src.indexOf("</h1>");
  const iBadge = src.indexOf("{badge}");
  assert.ok(iBadge > finH1, "la pastille doit être rendue après la fermeture du <h1>, jamais dedans");
});

/* ═══════════════════════════════════════════════════════════════════
   3. LE MATÉRIAU — LE VERRE
   ═══════════════════════════════════════════════════════════════════ */

test("le verre porte ses quatre propriétés simultanées", () => {
  const card = regle(".card");
  assert.ok(card, ".card doit être défini dans app/globals.css");

  // 1. transparence — pilotée par un jeton, pas par une valeur en dur
  assert.match(card, /background:\s*rgb\(var\(--card-bg\)\s*\/\s*var\(--glass-alpha\)\)/);
  /**
   * 2 + 3. Le flou ET la saturation, sur la MÊME déclaration et sur les DEUX
   * propriétés (préfixée et standard).
   *
   * ⚠ Ces quatre assertions étaient d'abord écrites séparément — « il y a un
   * `blur(` quelque part », « il y a un `saturate(` quelque part ». Une
   * mutation l'a montré : retirer `saturate` de la propriété standard en le
   * laissant sur la ligne `-webkit-` laissait le test VERT, alors que Chrome
   * et Firefox perdaient la saturation et rendaient gris. Une propriété qui
   * n'est vérifiée que par morceaux n'est pas vérifiée.
   */
  for (const prop of ["-webkit-backdrop-filter", "backdrop-filter"]) {
    const re = new RegExp(`(^|\\s)${prop}:\\s*blur\\(var\\(--glass-blur\\)\\)\\s+saturate\\(var\\(--glass-sat\\)\\)`);
    assert.match(card, re, `${prop} doit porter le flou ET la saturation ensemble`);
  }
  // 4. l'épaisseur : arête haute éclairée + arête basse dans l'ombre
  assert.match(card, /inset 0 1px 0 rgb\(var\(--glass-spec\)/);
  assert.match(card, /inset 0 -1px 0 rgb\(var\(--glass-base\)/);
});

test("⚠ le verre n'a qu'UNE définition : le clair reteinte des jetons, il ne redéfinit rien", () => {
  /**
   * Le défaut réel qu'on empêche : `html.light .card` existait et redéclarait
   * `box-shadow` + `border-color`. Le sombre a reçu le flou et la saturation,
   * le clair est resté sur l'ancienne recette — deux vérités, et personne ne
   * l'a vu parce que les deux « marchaient ».
   */
  const definitions = [...CSS.matchAll(/(^|\})\s*([^{}\n]*\.card)\s*\{/g)].map((m) => m[2].trim());
  const surcharges = definitions.filter((s) => s !== ".card" && !s.startsWith(".card .") && !s.includes(":hover"));
  assert.deepEqual(
    surcharges,
    [],
    `ces sélecteurs redéfinissent le matériau au lieu de reteinter les jetons --glass-* : ${surcharges.join(" · ")}`
  );

  // Les jetons doivent exister dans LES DEUX thèmes, sinon l'un des deux hérite
  // silencieusement des valeurs de l'autre.
  for (const jeton of ["--glass-alpha", "--glass-blur", "--glass-sat", "--glass-spec-a", "--glass-cast-a"]) {
    const n = [...CSS.matchAll(new RegExp(`\\s${jeton}:`, "g"))].length;
    assert.ok(n >= 2, `${jeton} n'est défini que ${n} fois — il en faut un par thème (sombre + clair)`);
  }
});

test("une carte reste LISIBLE quand le flou n'existe pas", () => {
  /**
   * Sans flou, une carte à 60 % d'opacité n'est pas « moins jolie » : son texte
   * se pose sur le dégradé et le grain de la page. Les deux cas sont réels —
   * un navigateur qui ne sait pas flouter, et un système où l'utilisateur a
   * demandé moins de transparence (réglage d'accessibilité).
   *
   * ⚠ On vérifie la CONDITION (le bloc rend le fond OPAQUE), pas la présence
   * de la requête : un `@media` vide passerait le contrôle et ne réparerait
   * rien.
   */
  const supports = CSS.slice(CSS.indexOf("@supports not ("));
  assert.ok(supports.startsWith("@supports not ("), "la sortie de secours @supports doit exister");
  const blocSupports = supports.slice(0, supports.indexOf("@media"));
  assert.match(blocSupports, /\.card/, "@supports doit couvrir .card");
  assert.match(blocSupports, /background:\s*rgb\(var\(--card-bg\)\)\s*;/, "le repli doit rendre le fond OPAQUE");

  const iReduced = CSS.indexOf("@media (prefers-reduced-transparency: reduce)");
  assert.ok(iReduced > 0, "le réglage d'accessibilité « réduire la transparence » doit être respecté");
  const blocReduced = CSS.slice(iReduced);
  assert.match(blocReduced, /background:\s*rgb\(var\(--card-bg\)\)\s*;/);
  assert.match(blocReduced, /backdrop-filter:\s*none/, "il faut aussi COUPER le flou, pas seulement opacifier");
});

test("pas de verre dans le verre", () => {
  /**
   * Un `backdrop-filter` imbriqué n'échantillonne pas la page : il échantillonne
   * le rendu DÉJÀ FLOUTÉ de son parent. Ça ne fait pas « plus de verre », ça
   * fait de la boue grise — et chaque niveau force une couche de composition.
   */
  const imbrique = regle(".card .card,\n  .card .panel") || regle(".card .card, .card .panel");
  assert.match(
    imbrique || CSS.slice(CSS.indexOf(".card .card"), CSS.indexOf(".card .card") + 200),
    /backdrop-filter:\s*none/,
    "une carte ou un panneau à l'intérieur d'une carte doit perdre son flou"
  );
});

/* ═══════════════════════════════════════════════════════════════════
   4. AUCUNE SURFACE BRICOLÉE
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Une surface « carte » écrite à la main : un arrondi + une bordure + un fond
 * d'encre en dur. Elle a l'air correcte et ne reçoit AUCUN des effets du verre
 * — c'est comme ça que 22 d'entre elles s'étaient accumulées.
 */
const SURFACE_BRICOLEE =
  /rounded-(?:xl|2xl|3xl)[^"]*\bborder\b[^"]*\bbg-ink-(?:800|850|900)\b|\bbg-ink-(?:800|850|900)\b[^"]*\bborder\b[^"]*rounded-(?:xl|2xl|3xl)/;

/** Les surfaces qui ont le droit de ne pas être `.card` ni `.panel`. */
const SURFACES_A_PART: Record<string, string> = {
  "components/training/sparring.tsx":
    "bulle de conversation : arrondi asymétrique (rounded-bl-md) qui porte le sens « c'est lui qui parle » — ce n'est pas un panneau",
  "components/campaigns/campaign-review.tsx":
    "barre collante DANS une modale : elle doit être opaque, le texte qui défile dessous ne doit pas transparaître à travers les compteurs",
  "app/(app)/overlay/page.tsx":
    "fenêtre Electron transparente : sa surface est la fenêtre elle-même, pas une carte de l'app",
};

/** Retire commentaires de bloc et de ligne — un commentaire qui CITE l'ancienne
 *  classe pour expliquer la correction n'est pas une régression. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("aucune surface n'est bricolée à la main hors des cas listés", () => {
  const fautes: string[] = [];
  for (const f of sourcesTsx()) {
    if (SURFACES_A_PART[f]) continue;
    const lignes = sansCommentaires(readFileSync(join(R, f), "utf8")).split("\n");
    for (const [i, ligne] of lignes.entries()) {
      /**
       * ⚠ On inspecte TOUTES les chaînes littérales, pas seulement
       * `className="…"`.
       *
       * La première version ne lisait que la forme `className="…"` et sautait
       * `className={cn("…", …)}`. Une mutation l'a prouvé : remettre la
       * surface bricolée d'origine dans le `cn()` du kanban laissait le test
       * VERT. Or `cn()` est justement la forme qu'utilisent les surfaces
       * conditionnelles — c'est-à-dire les plus susceptibles de diverger.
       *
       * Une liste de classes est la seule chaîne qui puisse contenir
       * « rounded-xl … border … bg-ink-900 » : le faux positif est théorique.
       */
      for (const m of ligne.matchAll(/"([^"]*)"/g)) {
        if (SURFACE_BRICOLEE.test(m[1])) fautes.push(`${f}:${i + 1} → « ${m[1].slice(0, 70)} »`);
      }
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "utilise `.card` (plaque de premier plan) ou `.panel` (sous-surface creusée) :\n  " + fautes.join("\n  ")
  );
});

test("aucune exception de surface ne survit au fichier qu'elle couvrait", () => {
  const morts = Object.keys(SURFACES_A_PART).filter((f) => !existsSync(join(R, f)));
  assert.deepEqual(morts, [], `exceptions orphelines : ${morts.join(", ")}`);
});

test("le chrome de la fenêtre a une seule recette, pas une par barre", () => {
  /**
   * Le rail, l'en-tête mobile et la barre du bas encadrent le même contenu.
   * Ils portaient trois opacités (60 / 90 / 95 %) et deux flous. On vérifie
   * qu'aucun d'eux ne remet un fond ou un flou à la main À CÔTÉ de
   * `glass-chrome` — sinon la classe est là pour la forme et la valeur en dur
   * gagne quand même.
   */
  const shell = readFileSync(join(R, "components/shell/app-shell.tsx"), "utf8");
  const fautes: string[] = [];
  for (const m of shell.matchAll(/"([^"]*glass-chrome[^"]*)"/g)) {
    if (/\bbg-(?:ink|paper)-/.test(m[1])) fautes.push(`fond en dur à côté de glass-chrome : « ${m[1]} »`);
    if (/\bbackdrop-blur/.test(m[1])) fautes.push(`flou en dur à côté de glass-chrome : « ${m[1]} »`);
  }
  assert.deepEqual(fautes, [], fautes.join("\n  "));

  const chrome = regle(".glass-chrome");
  assert.match(chrome, /backdrop-filter:\s*blur\(var\(--glass-blur\)\)/);
  assert.match(chrome, /saturate\(var\(--glass-sat\)\)/, "le chrome suit le même verre que les cartes");
});
