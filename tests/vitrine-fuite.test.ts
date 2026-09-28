import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { BRICKS, OUTBOUND_TIERS, OUTBOUND_UNIT_HT, OUTBOUND_UNIT_CALLS, PACK_SETUP_HT, PACK_MONTHLY_HT } from "../lib/bricks";
import { CAPACITES, PALIERS_LABELS, PRIX_PUBLICS } from "../lib/public-catalogue";
import { VERTICALS } from "../lib/playbook";

/**
 * La vitrine est PUBLIQUE : hors mot de passe, indexable, lisible par un
 * concurrent comme par un prospect. Ce qui y passe ne se reprend pas.
 *
 * Ces tests ne jugent pas le style — ils verrouillent ce qui ne doit PAS
 * s'y trouver. Une régression ici ne se voit pas en relisant la page : elle
 * se voit six mois plus tard, quand un concurrent se place juste sous nos
 * prix ligne à ligne.
 */
const vitrine = readFileSync(join(process.cwd(), "app/vitrine/page.tsx"), "utf8");
const mission = readFileSync(join(process.cwd(), "components/vitrine/mission-section.tsx"), "utf8");

/**
 * Les COMMENTAIRES sont retirés avant l'analyse du contenu.
 *
 * Sans ça, un commentaire qui explique « on a retiré la phrase X parce
 * qu'elle se sabotait » déclenche l'alerte sur X — et on finit par supprimer
 * l'explication pour faire taire le test, ce qui est exactement l'inverse du
 * but. Le test doit juger ce qui PART, pas ce que le code raconte.
 *
 * Les assertions structurelles (imports, appels de fonction) gardent la
 * source entière : là, un import commenté n'existe pas.
 */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const publique = sansCommentaires(vitrine) + sansCommentaires(mission);

/**
 * ⚠ CES TROIS ASSERTIONS LISAIENT LA SOURCE BRUTE, COMMENTAIRES COMPRIS —
 * et ça les mettait en guerre avec la doctrine du dépôt.
 *
 * Le repo demande d'expliquer le POURQUOI en commentaire. Or ici, expliquer
 * pourquoi on n'importe pas le catalogue oblige à ÉCRIRE son nom, ce que
 * l'assertion interdisait. Le test a mordu sur une phrase qui disait
 * précisément « il ne faut pas importer ça » : la seule issue était d'écrire
 * la consigne à mots couverts, donc de la rendre moins claire.
 *
 * C'est le cinquième cas de ce piège dans le dépôt, et il a toujours la même
 * résolution : un test de forme doit juger le CODE. Un `import` ne s'exécute
 * pas depuis un commentaire ; une prose qui nomme l'interdit ne fait rien
 * fuiter. La garde ne perd rien — la mutation ci-dessous le vérifie.
 */
const vitrineCode = sansCommentaires(vitrine);

test("vitrine — la grille de prix ligne à ligne ne sort pas", () => {
  // L'ancrage par l'addition ne fonctionne QUE dans une conversation : sur une
  // page, le prospect fait l'addition seul et choisit la brique la moins
  // chère. La grille détaillée est aussi la carte du produit pour un
  // concurrent.
  assert.doesNotMatch(vitrineCode, /b\.setupHT|b\.monthlyHT/, "les montants par brique ne s'affichent plus");
  assert.doesNotMatch(vitrineCode, /quoteBricks|quote\.setupHT|quote\.monthlyHT/, "aucun total calculé publiquement");
  assert.doesNotMatch(vitrineCode, /BRICKS\b/, "le catalogue interne ne doit pas être importé ici");
});

test("le retrait des commentaires n'ouvre aucune porte", () => {
  /**
   * La question qui compte après avoir assoupli une garde : est-ce qu'elle
   * attrape encore la vraie faute ? On lui présente le code exact qu'elle
   * existe pour refuser, et le commentaire exact qu'elle refusait à tort.
   */
  const codeFautif = `import { BRICKS } from "@/lib/bricks";\nconst x = b.setupHT;`;
  assert.match(sansCommentaires(codeFautif), /BRICKS\b/, "un vrai import doit toujours être vu");
  assert.match(sansCommentaires(codeFautif), /b\.setupHT/, "un vrai affichage de montant doit toujours être vu");

  const commentaireLegitime = `// ⚠ On n'importe pas BRICKS ici : le catalogue partirait au navigateur.`;
  assert.doesNotMatch(sansCommentaires(commentaireLegitime), /BRICKS\b/, "expliquer l'interdit ne doit plus être une faute");
});

test("vitrine — le modèle de commission reste interne", () => {
  // C'est l'économie du partenariat, pas un argument de vente.
  assert.doesNotMatch(publique, /\b30\s*%/, "le taux de commission ne s'affiche pas");
  assert.doesNotMatch(publique, /commission/i);
});

test("vitrine — le levier de négociation sur les paliers d'appels n'est pas donné", () => {
  // « Le 4e millier offert » annoncé publiquement, c'est le palier 3 qui ne se
  // vend plus jamais : personne ne paie 1 092 € pour 3 000 appels s'il sait
  // qu'il en a 4 000 au même prix.
  assert.doesNotMatch(publique, /millier offert|4ᵉ millier/);
  assert.doesNotMatch(vitrine, /OUTBOUND_TIERS/, "la table des paliers ne s'affiche pas");
  // Le prix d'ENTRÉE, lui, doit être là : sans lui, aucune qualification.
  // Il vient du module PUBLIC, pas du catalogue interne — importer ce dernier
  // rembarquerait tous les prix dans le bundle du navigateur.
  assert.match(vitrine, /PRIX_PUBLICS\.sortantMensuelHT/);
});

test("vitrine — aucun aveu qui se sabote", () => {
  // Le tableau de bord qui met la pression est dans l'app (/trajectoire).
  // Sur une page dont le seul travail est d'obtenir un cadrage, on ne demande
  // pas à un prospect d'assumer nos doutes.
  assert.doesNotMatch(publique, /pas encore prouvé/i);
  assert.doesNotMatch(publique, /0 vente|aucune vente/i);
  assert.doesNotMatch(publique, /ce n'est pas nous, aujourd'hui/i);
});

test("vitrine — et aucune preuve inventée non plus", () => {
  // L'autre bord du même fossé. On ne se sabote pas ; on ne ment pas.
  assert.doesNotMatch(publique, /\d+\s*(clients|entreprises)\s+(nous font confiance|accompagnés|satisfaits)/i);
  assert.doesNotMatch(publique, /leader|n°\s*1|numéro un/i);
  // Aucun pourcentage de résultat promis : on garantit le procédé, pas un
  // résultat qu'on ne maîtrise pas.
  assert.doesNotMatch(publique, /\+\s*\d+\s*%\s*de\s*(ventes|chiffre|conversion)/i);
});

test("⚠ vitrine — AUCUNE AFFILIATION INSTITUTIONNELLE REVENDIQUÉE", () => {
  /**
   * ─────────────────────────────────────────────────────────────────────
   * LA TROISIÈME FORME DE PREUVE FABRIQUÉE, ET LA PLUS DANGEREUSE.
   *
   * ⚠ TROUVÉE EN LIGNE, PAS PAR UN TEST. La page disait :
   *
   *     « C'est aussi ce qui nous vaut de candidater à French Tech 2030. »
   *
   * Vérifié le 3 septembre 2026 : le critère d'entrée du programme est 3 M€
   * de financements et/ou de CA cumulés depuis 2024. EAGLEYE CORP est à 0 €.
   * Le seuil est éliminatoire, et l'échéance de dépôt du 4 septembre est
   * passée sans dépôt. La page affirmait donc une candidature impossible qui
   * n'a pas eu lieu.
   *
   * Les deux gardes voisins ne pouvaient pas la voir : l'un cherche des
   * témoignages et des clients comptés, l'autre « leader » et les
   * pourcentages promis. Un LABEL, un PROGRAMME, un ACCÉLÉRATEUR sont une
   * famille à part — et la pire des trois, parce qu'un témoignage inventé se
   * démonte en conversation quand une affiliation se vérifie en un appel à
   * l'organisme, sans nous prévenir.
   *
   * ⚠ CE QUI RESTE PERMIS, et c'est le point : rien n'interdit de DIRE
   * l'argument de souveraineté. Il est vrai, il tient debout tout seul, et il
   * n'a jamais eu besoin d'un label pour convaincre. Ce qui est interdit,
   * c'est de s'adosser à une institution qui ne nous a rien accordé.
   *
   * Le jour où une candidature est réellement déposée et acceptée, ce test se
   * modifie — avec la preuve à la main, pas avant.
   * ─────────────────────────────────────────────────────────────────────
   */
  /**
   * ⚠ LES LIMITES DE MOT NE SONT PAS DÉCORATIVES — mesuré dès la première
   * réécriture de la page. `prim[ée]` sans `\b` attrape « sup**prime** », et
   * la phrase « ce qu'Alpha supprime, c'est le travail répétitif » a fait
   * tomber ce test. Un garde qui refuse une phrase parfaitement honnête est
   * un garde qu'on assouplit au mauvais endroit la fois suivante.
   */
  const AFFILIATIONS = [
    /french\s*tech/i,
    /bpifrance|bpi\b/i,
    /label(?:lis|lé)/i,
    /incubé|accéléré|accélérateur|incubateur/i,
    /\blauréats?\b|\bprim[ée]e?s?\b|\bsubventionn/i,
    /certifi[ée]s? (?:par|iso)|agréé/i,
  ];
  const fautes = AFFILIATIONS.map((m) => publique.match(m)).filter(Boolean);
  assert.deepEqual(
    fautes.map((m) => m![0]),
    [],
    "la page publique revendique une affiliation : elle se vérifie en un appel à l'organisme, et zéro nous a rien accordé"
  );

  // Et l'argument qui la remplaçait doit RESTER : le retirer aurait vidé la
  // section de son seul contenu vrai.
  assert.match(publique, /souverain|ne devrait pas dépendre|rester en France/i, "l'angle de souveraineté est vrai, il reste");
});

test("⚠ vitrine — l'argumentaire ne PRONONCE PAS un interdit du playbook", () => {
  /**
   * ─────────────────────────────────────────────────────────────────────
   * LA PAGE DISAIT CE QUE NOTRE PROPRE PLAYBOOK REFUSE.
   *
   * La section « le vrai coût » s'ouvrait sur : « Un client qui n'obtient pas
   * de réponse appelle le suivant dans les cinq minutes », et ses trois
   * colonnes parlaient de décrocher, de répondre 24/7, de concurrent équipé.
   *
   * C'est juste pour un garage. Ce n'est PAS la perte d'une organisation qui
   * vend sur plusieurs semaines — et `lib/playbook.ts` l'écrit comme un
   * INTERDIT sur les verticales « maîtrise d'ouvrage » et « équipe terrain » :
   * « Vous ratez des appels : faux ici, et ça prouve qu'on n'a pas compris le
   * métier. »
   *
   * La même contradiction vivait dans le catalogue d'offres, où
   * `tests/playbook-interdits` la refuse depuis le 10/09. La vitrine n'avait
   * pas suivi : elle servait l'argument interdit à TOUS les visiteurs, y
   * compris ceux qu'on prospecte.
   *
   * ⚠ Le motif est CELUI DU PLAYBOOK, importé, jamais recopié. Deux
   * définitions de « qu'est-ce qu'on n'a pas le droit de dire » finiraient par
   * diverger, et c'est la page publique — celle que personne ne relit — qui
   * garderait l'ancienne.
   * ─────────────────────────────────────────────────────────────────────
   */
  const moa = VERTICALS.find((v) => v.id === "maitrise-ouvrage")!;
  const interdits = moa.forbidden.filter((f) => f.motif);
  assert.ok(interdits.length > 0, "la verticale doit porter des interdits exécutables, sinon ce test ne garde rien");

  const fautes: string[] = [];
  for (const f of interdits) {
    const m = publique.match(f.motif!);
    if (m) fautes.push(`« ${m[0]} » — ${f.regle.slice(0, 70)}…`);
  }
  assert.deepEqual(
    fautes,
    [],
    "la page publique prononce un argument que le playbook interdit :\n  " + fautes.join("\n  ")
  );

  /**
   * ⚠ ET LA CONTREPARTIE : l'argument qui REMPLACE doit être là. Sans elle,
   * on satisferait ce test en vidant la section — c'est-à-dire en retirant la
   * seule page où le coût de l'inaction est expliqué.
   */
  assert.match(
    publique,
    /que vous aviez déjà|sans prochaine date|laissé refroidir/i,
    "le coût de l'inaction doit rester expliqué, sur l'angle qui est vrai partout"
  );
});

test("vitrine — la pile technique n'est pas détaillée", () => {
  // Nommer les fournisseurs, c'est donner la recette ET créer une dépendance
  // dans la tête du client à des marques qui ne sont pas la nôtre.
  for (const secret of ["Deepgram", "Fish Audio", "LiveKit", "NVIDIA", "Telnyx", "Supabase", "BM25"]) {
    assert.ok(!publique.includes(secret), `« ${secret} » n'a rien à faire sur la page publique`);
  }
});

test("catalogue public — synchronisé avec le vrai, sans jamais l'importer", () => {
  // Ce test EST le mécanisme de cohérence. La vue publique ne peut pas
  // importer le catalogue (ça rembarquerait les prix dans le navigateur), donc
  // c'est ici — côté serveur, où rien n'est exposé — qu'on vérifie qu'elle ne
  // dérive pas.
  assert.equal(CAPACITES.length, BRICKS.length, "une capacité a été ajoutée ou retirée d'un seul côté");

  for (const c of CAPACITES) {
    const source = BRICKS.find((b) => b.id === c.id);
    assert.ok(source, `« ${c.id} » n'existe pas au catalogue`);
    assert.equal(c.label, source!.label, `${c.id} : le nom a divergé`);
    assert.equal(c.what, source!.what, `${c.id} : la description a divergé`);

    // Le palier annoncé doit correspondre au prix réel : annoncer « Socle »
    // sur une brique à 3 500 € prépare une conversation difficile.
    const attendu = source!.setupHT >= 2500 ? "coeur" : source!.setupHT >= 1800 ? "moteur" : "socle";
    assert.equal(c.palier, attendu, `${c.id} : palier « ${c.palier} » incohérent avec ${source!.setupHT} €`);
    assert.ok(PALIERS_LABELS[c.palier]);
  }
});

test("catalogue public — aucun montant hors des deux qui sont assumés", () => {
  // Le pack (l'ancre) et le palier d'entrée du sortant (la qualification) sont
  // publics par décision. Tout le reste se dit au cadrage.
  assert.equal(PRIX_PUBLICS.packSetupHT, PACK_SETUP_HT);
  assert.equal(PRIX_PUBLICS.packMensuelHT, PACK_MONTHLY_HT);
  assert.equal(PRIX_PUBLICS.sortantMensuelHT, OUTBOUND_UNIT_HT);
  assert.equal(PRIX_PUBLICS.sortantAppels, OUTBOUND_UNIT_CALLS);

  // Aucune capacité ne porte de prix.
  assert.doesNotMatch(JSON.stringify(CAPACITES), /\d{3,}/);

  // Et le palier remisé n'existe nulle part dans le module public.
  const remise = OUTBOUND_TIERS.find((t) => t.perThousandHT < OUTBOUND_UNIT_HT)!;
  assert.doesNotMatch(JSON.stringify(PRIX_PUBLICS), new RegExp(String(remise.perThousandHT)));
});

test("Alpha Live est une brique vendable à part entière", () => {
  const live = BRICKS.find((b) => b.id === "alpha-live");
  assert.ok(live, "Alpha Live doit exister au catalogue");
  // C'est la seule brique qui agit PENDANT la vente : son argument doit le dire.
  assert.match(live!.why, /PENDANT/);
  assert.ok(live!.setupHT > 0 && live!.monthlyHT > 0);
  // Elle apparaît publiquement, sans son prix.
  assert.ok(CAPACITES.some((c) => c.id === "alpha-live"));
});

// ── LES AUTRES SURFACES PUBLIQUES ──────────────────────────────────────

/**
 * La vitrine n'est pas la seule chose joignable sans mot de passe. Tout ce
 * qui figure dans PUBLIC_PREFIXES l'est aussi, et une fuite y est aussi
 * définitive — elle est juste moins visible, donc plus durable.
 */
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const SURFACES_PUBLIQUES = [
  "app/gate/page.tsx",
  "app/api/health/route.ts",
  "public/sw.js",
  "public/manifest.webmanifest",
];

test("surfaces publiques — aucun prix nulle part ailleurs", () => {
  for (const f of SURFACES_PUBLIQUES) {
    const src = sansCommentaires(lire(f));
    assert.doesNotMatch(src, /setupHT|monthlyHT|PACK_SETUP|PACK_MONTHLY|OUTBOUND_/, `${f} : un prix a fui`);
    // Un montant en euros écrit en dur — le format français comme l'anglais.
    assert.doesNotMatch(src, /\d[\d\s  ]*€/, `${f} : un montant en euros est écrit en dur`);
  }
});

test("sonde de santé — la carte de l'architecture n'est plus ouverte", () => {
  const src = lire("app/api/health/route.ts");
  // Aucun secret n'y fuitait — que des booléens. Mais mis bout à bout, ces
  // booléens dessinent toute la pile : c'est exactement ce qu'on a retiré de
  // la page de vente, et le laisser ici annulait l'effort.
  assert.match(src, /ACCESS_COOKIE/, "le détail doit exiger le cookie d'accès");
  assert.match(src, /safeEqual/, "comparaison à temps constant");
  // La sonde minimale reste publique : un moniteur externe doit pouvoir
  // vérifier que l'app répond sans détenir de secret.
  assert.match(src, /\{ ok: true, checkedAt: new Date\(\)\.toISOString\(\) \}/);
});

test("vitrine — indexable, et avec une description tournée vers le résultat", () => {
  // La racine porte noindex (c'est juste pour un CRM privé) et l'appliquait à
  // TOUT — y compris à la seule page dont le travail est d'être trouvée.
  // Comme plus haut : on juge ce qui PART, pas le commentaire qui explique
  // pourquoi une formulation a été retirée.
  const layout = sansCommentaires(lire("app/vitrine/layout.tsx"));
  assert.match(layout, /robots:\s*\{\s*index:\s*true/, "la page de vente doit être indexable");
  assert.match(layout, /openGraph/, "le premier canal est LinkedIn : un lien sans aperçu perd ses clics");

  // Et le vocabulaire interne de la méthode ne part pas dans les métadonnées.
  const racine = sansCommentaires(lire("app/layout.tsx"));
  for (const mot of ["Hormozi", "Taxe d'Ignorance", "3 Croyances", "Red Zone"]) {
    assert.ok(!racine.includes(mot), `« ${mot} » décrit le procédé — pas dans les métadonnées publiques`);
    assert.ok(!layout.includes(mot), `« ${mot} » n'a rien à faire dans la description publique`);
  }
});

// ── LE BUNDLE, PAS SEULEMENT L'AFFICHAGE ───────────────────────────────

/**
 * Le test qui aurait évité toute cette histoire.
 *
 * On avait retiré les prix de l'AFFICHAGE de la page publique, et ils
 * partaient toujours dans son JavaScript : la page importait une fonction
 * qui lisait le catalogue, donc le catalogue entier était compilé dans le
 * fichier téléchargé par le visiteur. Mesuré sur le build : `setupHT:3500`,
 * `perThousandHT:273` et « millier est offert », lisibles en trois secondes
 * de devtools.
 *
 * Ce test suit le graphe d'imports depuis la page publique, exactement comme
 * le fait le bundler, et vérifie qu'il n'atteint jamais un module qui porte
 * des prix. Les imports `import type` sont ignorés : ils sont effacés à la
 * compilation et ne pèsent rien dans le navigateur.
 */
const MODULES_A_PRIX = ["lib/bricks", "lib/pricing", "lib/accounts", "lib/deck", "lib/voice-costs"];

function grapheImports(entree: string): Set<string> {
  const vus = new Set<string>();
  const file = (chemin: string): string | null => {
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      const f = join(process.cwd(), chemin + ext);
      try {
        readFileSync(f, "utf8");
        return f;
      } catch {
        /* essai suivant */
      }
    }
    return null;
  };

  const marche = (chemin: string) => {
    if (vus.has(chemin)) return;
    vus.add(chemin);
    const f = file(chemin);
    if (!f) return;
    const src = sansCommentaires(readFileSync(f, "utf8"));
    const dossier = chemin.split("/").slice(0, -1).join("/");
    // `import type { … }` est effacé à la compilation : il ne met rien dans
    // le bundle, donc il ne compte pas comme une fuite.
    //
    // ⚠ Les imports RELATIFS comptent autant que les alias `@/`. Ce walker ne
    // suivait que `@/…` — or à l'intérieur de `lib/`, tout est relatif
    // (`lib/store.ts` fait `import { applyAccount } from "./accounts"`). Un
    // module à prix atteint par ce chemin-là passait donc inaperçu.
    for (const m of src.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+"((?:@\/|\.\.?\/)[^"]+)"/gm)) {
      if (m[1]) continue;
      const spec = m[2];
      if (spec.startsWith("@/")) {
        marche(spec.slice(2));
        continue;
      }
      // Résolution relative à la main : pas de dépendance, et on reste dans
      // le repo (les segments `..` qui sortent du dossier sont normalisés).
      const parts = dossier ? dossier.split("/") : [];
      for (const seg of spec.split("/")) {
        if (seg === "." || seg === "") continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
      }
      marche(parts.join("/"));
    }
  };

  marche(entree);
  return vus;
}

/** Tous les fichiers `.ts`/`.tsx` sous ces dossiers, récursivement. */
function sources(dossiers: string[]): string[] {
  const out: string[] = [];
  const visite = (rel: string) => {
    for (const e of readdirSync(join(process.cwd(), rel), { withFileTypes: true })) {
      const chemin = `${rel}/${e.name}`;
      if (e.isDirectory()) visite(chemin);
      else if (/\.tsx?$/.test(e.name)) out.push(chemin);
    }
  };
  for (const d of dossiers) visite(d);
  return out;
}

test("bundle public — le graphe d'imports n'atteint AUCUN module à prix", () => {
  // `/souscrire` est publique elle aussi depuis qu'on peut y acheter : elle
  // doit subir exactement le même contrôle que la vitrine.
  for (const entree of ["app/vitrine/page", "app/vitrine/layout", "app/gate/page", "app/souscrire/page", "app/souscrire/layout"]) {
    const graphe = grapheImports(entree);
    for (const interdit of MODULES_A_PRIX) {
      assert.ok(
        !graphe.has(interdit),
        `${entree} atteint ${interdit} — la grille tarifaire repartirait dans le navigateur`
      );
    }
  }
});

/**
 * ── LE TEST QUI GÉNÉRALISE LA LEÇON ──
 *
 * La vitrine n'était que le cas le plus visible. La règle réelle est plus
 * large : `_next/static/**` est exclu du middleware, et `_buildManifest.js`
 * (dont le chemin se déduit du buildId présent dans le HTML public) liste TOUS
 * les chunks de TOUTES les pages. Donc tout ce qu'un composant client importe
 * est public — y compris sur une page derrière SITE_PASSWORD.
 *
 * Mesuré sur le build avant ce test : `z.tazi@scintia.ai`,
 * `sales.scintiacallflow.ai`, `Christophe`, `setupHT: 10000`, et les tarifs
 * fournisseurs à la minute (`usdPerMin`) étaient tous dans des chunks
 * téléchargeables. Aucune page ne les affichait publiquement — c'est bien le
 * problème : l'affichage ne dit rien du bundle.
 *
 * On part donc de CHAQUE fichier `"use client"` du dépôt, pas seulement des
 * pages publiques.
 */
/**
 * ⚠ LES TROIS DERNIERS ONT ÉTÉ AJOUTÉS APRÈS UNE MESURE, PAS PAR PRINCIPE.
 *
 * Un balayage des URL tierces du dépôt a montré que cinq hôtes sont appelés
 * automatiquement : Google Fonts (depuis `app/layout.tsx`, donc le NAVIGATEUR
 * — c'est l'exposition RGPD déjà documentée), et Stripe, Notion et json2video
 * depuis `lib/`.
 *
 * Vérifié : aucun composant client n'importe ces trois-là aujourd'hui. Leurs
 * appels partent donc du serveur, et le visiteur ne contacte personne.
 *
 * Mais RIEN ne l'empêchait : ils n'étaient dans aucune liste. Un import
 * distrait depuis un `.tsx` déplacerait l'appel dans le navigateur — donc
 * l'adresse IP du visiteur chez Stripe et Notion, et la grille `PLANS` dans
 * le bundle. C'est exactement le motif de ce fichier : la garde existait, elle
 * ne couvrait pas les voisins.
 */
const MODULES_SERVEUR = ["lib/bricks", "lib/accounts-commercial", "lib/voice-costs", "lib/knowledge-seed", "lib/business-rules", "lib/pipeline-juillet", "lib/prospects-icp", "lib/references-seed", "lib/stripe", "lib/notion", "lib/video-gen"];

/**
 * `lib/pricing` n'est PAS dans cette liste, et c'est un choix, pas un oubli.
 *
 * Il est atteint par `/offre`, `/kpis` et `/settings` (calculateur, rollup,
 * éditeur de tarifs). Ce qu'il contient : le setup à 10 000 € et le palier
 * d'entrée à 1 000 €/mois — déjà publiés sur la vitrine (`PRIX_PUBLICS`) —,
 * la part de 30 % — le même taux que `Account.commissionPct`, qui reste côté
 * client pour la même raison —, et les paliers Growth/Scale, qui sont la
 * grille qu'on MONTRE au prospect sur ce calculateur.
 *
 * Autrement dit : rien qui ne soit destiné à être vu par un client. Le sortir
 * coûterait un état de chargement sur deux outils que l'opérateur manipule au
 * clavier, pour protéger des chiffres qu'on affiche nous-mêmes en rendez-vous.
 *
 * Si un jour on y met un coût de revient ou une marge, la ligne du dessus
 * doit changer.
 */

test("bundle app — aucun composant client n'atteint un module serveur", () => {
  const clients = sources(["app", "components"]).filter((f) =>
    /^\s*["']use client["']/.test(readFileSync(join(process.cwd(), f), "utf8"))
  );
  assert.ok(clients.length > 20, `on n'a trouvé que ${clients.length} fichiers client — le balayage est cassé`);

  const fautes: string[] = [];
  for (const f of clients) {
    const graphe = grapheImports(f.replace(/\.tsx?$/, ""));
    for (const interdit of MODULES_SERVEUR) {
      if (graphe.has(interdit)) fautes.push(`${f} → ${interdit}`);
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "ces modules repartiraient dans un fichier JavaScript téléchargeable par n'importe qui :\n" + fautes.join("\n")
  );
});

/**
 * ── LA LEÇON GÉNÉRALISÉE UNE FOIS DE PLUS : GARDER LA DONNÉE, PAS LE FICHIER ──
 *
 * `MODULES_SERVEUR` nomme des MODULES. C'est efficace tant que la donnée
 * sensible reste dans le module qu'on a listé — et ça ne tient pas quand elle
 * est recopiée à côté.
 *
 * ⚠ MESURÉ SUR LE BUILD, PAS SUPPOSÉ. `lib/ladder.ts` n'est dans aucune liste
 * et descend dans le navigateur (via `argumentaire` →
 * `components/prospects/master-panel`). Il portait `commissionPct: 30` +
 * `recurringPct: 10` à côté du revendeur, et `commissionPct: 15` à côté de
 * « Nuwacom ». `_next/static/**` est exclu du middleware : ces chunks
 * répondent 200 sans cookie et sans mot de passe. Notre part chez chaque
 * partenaire, téléchargeable par ce partenaire — alors que le taux Nuwacom
 * est justement ce qui se négocie APRÈS le cadrage.
 *
 * Aggravant : aucun écran ne lisait ces champs. Seuls des tests les
 * touchaient. Ils voyageaient jusqu'au navigateur pour personne.
 *
 * Le test du dessus n'a rien vu parce qu'il cherchait des NOMS DE FICHIERS.
 * Celui-ci cherche la donnée : un taux de partenariat écrit en dur dans un
 * module que le navigateur atteint.
 */
/**
 * ⚠ 100 % N'EST PAS UN TAUX DE PARTENARIAT, ET LA NUANCE N'EST PAS UN
 * ASSOUPLISSEMENT DE COMPLAISANCE.
 *
 * La première version de ce détecteur refusait tout `commissionPct: <n>`. Elle
 * a immédiatement signalé `lib/store.ts`, où le défaut d'un store neuf est
 * `commissionPct: 100` — le taux d'EAGLEYE, c'est-à-dire NOUS. « On garde
 * tout » ne dit rien de personne : il n'y a aucun tiers à protéger.
 *
 * Ce qui fuit, c'est exactement l'inverse : un taux SOUS 100 nomme un
 * partenaire et chiffre ce qu'on lui prend. C'est ce cas-là qu'on refuse.
 */
const TAUX_PARTENARIAT = /\b(?:commissionPct|recurringPct)\s*:\s*(\d+)/g;

/** Un module met-il en dur la part qu'on prend à quelqu'un d'autre ? */
function tauxDePartenariat(src: string): number[] {
  return [...src.matchAll(TAUX_PARTENARIAT)].map((m) => Number(m[1])).filter((n) => n < 100);
}

/**
 * ⚠ CETTE LISTE A ÉTÉ VIDÉE, ET C'EST LE POINT — ELLE NE DOIT PAS SE REMPLIR.
 *
 * Elle a existé le temps d'un commit, avec `lib/accounts` dedans : ce module
 * portait encore le taux des trois comptes, son propre commentaire disait que
 * c'était délibéré (« chaque partenaire connaît déjà son propre taux »), et le
 * sortir n'était pas gratuit — `applyAccount` écrivait `settings.commissionPct`
 * à chaque bascule, donc l'enlever sans plus faisait calculer à `/payouts` la
 * part d'un deal revendeur à 100 %. Un chiffre FAUX en silence est pire qu'un
 * chiffre exposé.
 *
 * La sortie était ailleurs : le taux vient du serveur (`tauxVitrinePct` dérivé
 * des offres, servi au maître seulement), c'est le sélecteur qui l'écrit dans
 * les Réglages, et il est désactivé tant qu'il ne l'a pas reçu. Un bouton qui
 * attend une demi-seconde a réglé les deux problèmes à la fois.
 *
 * On garde la liste vide plutôt que de supprimer le mécanisme : le jour où
 * quelqu'un voudra y remettre un module, il devra écrire pourquoi ici, et
 * cette note-là sera le premier contre-argument.
 */
const EXPOSITION_ASSUMEE = new Set<string>();

test("bundle app — aucun TAUX de partenariat en dur dans un module que le navigateur atteint", () => {
  const clients = sources(["app", "components"]).filter((f) =>
    /^\s*["']use client["']/.test(readFileSync(join(process.cwd(), f), "utf8"))
  );
  assert.ok(clients.length > 20, `on n'a trouvé que ${clients.length} fichiers client — le balayage est cassé`);

  const atteints = new Set<string>();
  for (const f of clients) for (const m of grapheImports(f.replace(/\.tsx?$/, ""))) atteints.add(m);

  const fautes: string[] = [];
  for (const m of [...atteints].sort()) {
    if (!m.startsWith("lib/") || EXPOSITION_ASSUMEE.has(m)) continue;
    let src: string;
    try {
      src = readFileSync(join(process.cwd(), m + ".ts"), "utf8");
    } catch {
      continue;
    }
    // Sans cette découpe, le commentaire qui EXPLIQUE la fuite déclenche le
    // test qui l'interdit — c'est arrivé cinq fois dans ce dépôt. Le
    // minifieur retire les commentaires : ils ne partent pas au navigateur.
    const taux = tauxDePartenariat(sansCommentaires(src));
    if (taux.length) fautes.push(`${m} (${taux.join(" %, ")} %)`);
  }

  assert.deepEqual(
    fautes,
    [],
    "ces modules mettent notre part chez un partenaire dans un chunk public :\n  " + fautes.join("\n  ")
  );
});

test("le détecteur de taux voit la vraie forme, et pas la prose", () => {
  // Une garde qu'on n'a jamais vue mordre ne garde rien. Les deux fuites
  // réelles, telles qu'elles étaient écrites dans `lib/ladder.ts`.
  assert.deepEqual(tauxDePartenariat("      commissionPct: 15,"), [15]);
  assert.deepEqual(tauxDePartenariat("recurringPct:10,"), [10]);

  // Notre propre taux : rien à protéger, personne à nommer.
  assert.deepEqual(tauxDePartenariat("commissionPct: 100,"), []);

  // Un champ d'interface, une valeur venue d'ailleurs : ce n'est pas un taux
  // écrit en dur, et l'interdire condamnerait tout usage légitime.
  assert.deepEqual(tauxDePartenariat("  commissionPct: number;"), []);
  assert.deepEqual(tauxDePartenariat("commissionPct: a.commissionPct,"), []);

  // Et la prose qui EXPLIQUE la fuite ne doit pas la déclencher — c'est le
  // piège qui s'est refermé cinq fois dans ce dépôt.
  assert.deepEqual(tauxDePartenariat(sansCommentaires("// commissionPct: 30 était ici")), []);
});

/**
 * ⚠ LE TEST « aucun NOM de prospect réel dans le bundle » A ÉTÉ RETIRÉ D'ICI,
 * ET C'EST UN RENFORCEMENT, PAS UN ABANDON.
 *
 * Il cherchait les raisons sociales réelles dans les seuls fichiers atteints
 * par le graphe d'imports client. Sa portée était donc « ce qui arrive au
 * NAVIGATEUR » — exactement le modèle de menace dont `tests/donnees-reelles`
 * explique en tête qu'il est insuffisant depuis que le dépôt est public : un
 * dépôt ne se visite pas, il se clone.
 *
 * Mesuré le 10/09/2026 : dix-huit fichiers de `lib/`, `tests/`, `docs/` et
 * `voice/` portaient des noms réels HORS bundle, donc hors de sa portée.
 *
 * La question se pose maintenant à UN endroit, sur TOUS les fichiers commités :
 * `tests/donnees-reelles.test.ts` → « ⚠ AUCUN NOM DE PROSPECT RÉEL DANS LE
 * DÉPÔT », alimenté par `tests/noms-reels.ts`. Son ensemble de fichiers est un
 * SUR-ensemble strict de celui-ci : le rétablir ici ne couvrirait rien de plus
 * et créerait la deuxième définition que ce dépôt s'interdit — c'est toujours
 * celle qu'on ne relit pas qui cesse de mordre.
 */

test("bundle app — aucune coordonnée de prospect réel ne peut partir dans un chunk", () => {
  // La fuite la plus grave trouvée dans cette passe n'était pas commerciale.
  // `lib/store.ts` faisait `require("./pipeline-juillet")` et
  // `require("./prospects-icp")` dans deux actions : un require de chemin
  // statique n'est pas paresseux pour le bundler, et le nom, l'adresse et le
  // NUMÉRO DE TÉLÉPHONE de seize entreprises réelles se retrouvaient dans un
  // fichier JavaScript téléchargeable sans mot de passe.
  //
  // Le test du graphe couvre déjà ces modules ; celui-ci verrouille le motif
  // qui les y avait fait entrer, parce qu'un `require()` ressemble à du
  // chargement paresseux et ne l'est pas.
  const src = sansCommentaires(lire("lib/store.ts"));
  assert.doesNotMatch(src, /require\(/, "un require() de chemin statique embarque le module — utilise une route serveur");
});

test("bundle app — le registre client des comptes ne porte plus l'économie", () => {
  // Garde de dernier recours, sur le TEXTE du module qui descend vraiment dans
  // le navigateur. Un test sur les données (tests/accounts.test.ts) ne verrait
  // pas une constante posée à côté du registre.
  const src = sansCommentaires(lire("lib/accounts.ts"));
  assert.doesNotMatch(src, /sales\.scintiacallflow|z\.tazi@|Christophe/i);
  assert.doesNotMatch(src, /setupHT|targetPerProject|recurringPct/);
});

test("bundle public — la coquille de l'app n'est pas imposée aux pages publiques", () => {
  // L'AppShell se retirait pour /vitrine par un test d'EXÉCUTION
  // (`if (pathname === "/vitrine") return children`). Ça ne retire rien du
  // bundle : la page publique téléchargeait tout le code client de l'app.
  const racine = sansCommentaires(lire("app/layout.tsx"));
  assert.doesNotMatch(racine, /AppShell/, "la coquille appartient au groupe (app), pas à la racine");

  // Et elle est bien montée pour l'app.
  const groupe = lire("app/(app)/layout.tsx");
  assert.match(groupe, /AppShell/);

  // Les pages publiques vivent HORS du groupe.
  for (const f of ["app/vitrine/page.tsx", "app/gate/page.tsx"]) {
    assert.doesNotMatch(f, /\(app\)/, `${f} ne doit pas être dans le groupe (app)`);
  }
});

test("routes — celle qui sert un module serveur est forcément INTERNE", () => {
  /**
   * Les modules qu'on vient de sortir du navigateur ne valent que par la porte
   * qui les remplace. Une route qui les sert sans être dans `INTERNAL` n'a que
   * SITE_PASSWORD devant elle : pas de garde même-origine, et surtout aucune
   * relecture de sa sensibilité au moment où on l'ajoute.
   *
   * J'ai créé exactement ce trou en ajoutant `/api/pipeline` (noms, adresses et
   * téléphones d'entreprises réelles) sans l'inscrire. Ce test le dérive du
   * code au lieu de compter sur la mémoire.
   */
  const middleware = lire("middleware.ts");
  const bloc = middleware.slice(middleware.indexOf("const INTERNAL"), middleware.indexOf("const PUBLIC_PREFIXES"));
  const internes = [...bloc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  const routes = sources(["app/api"]).filter((f) => /\/route\.tsx?$/.test(f));
  const fautes: string[] = [];

  for (const f of routes) {
    const graphe = grapheImports(f.replace(/\.tsx?$/, ""));
    const sert = MODULES_SERVEUR.filter((m) => graphe.has(m));
    if (!sert.length) continue;
    // Le chemin d'URL de la route : app/api/x/y/route.ts → /api/x/y
    const url = "/" + f.replace(/^app\//, "").replace(/\/route\.tsx?$/, "");
    if (internes.some((p) => url === p || url.startsWith(p + "/"))) continue;

    /**
     * ⚠ UNE ROUTE PEUT ÊTRE PUBLIQUE ET SÛRE — mais elle doit le PROUVER.
     *
     * En ajoutant `lib/stripe` aux modules serveur, ce test a signalé
     * `/api/webhooks/stripe`. Or cette route est publique EXPRÈS : c'est
     * Stripe qui l'appelle, sans navigateur, donc sans cookie. Elle porte sa
     * propre authentification — une signature HMAC vérifiée avant tout
     * traitement. C'est le raisonnement déjà écrit dans `middleware.ts` :
     * « ce n'est pas un trou, c'est une porte différente ».
     *
     * L'exemption ne se DÉCLARE donc pas dans une liste — elle se GAGNE en
     * vérifiant réellement quelque chose. Une liste se remplit par commodité ;
     * une preuve lue dans le code de la route, non. Si quelqu'un retire la
     * vérification de signature, la route reperd son exemption et ce test
     * échoue — ce qui est exactement le moment où on veut être prévenu.
     */
    const src = sansCommentaires(lire(f));
    const porteSaPropreSerrure =
      // Signature vérifiée — sur place, ou déléguée à un module dédié. Ce qui
      // compte est que le RÉSULTAT gate la suite, pas où le HMAC est calculé.
      /verify\w*Signature\(|createHmac|timingSafeEqual|constructEvent/.test(src) ||
      // Clé d'API ou secret de cron, avec le refus qui va avec.
      /autoriserApi\(|CRON_SECRET|ALPHA_API_KEYS|CALENDAR_TOKEN/.test(src);
    if (porteSaPropreSerrure) continue;

    fautes.push(`${url} sert ${sert.join(", ")} sans être dans INTERNAL ni vérifier de signature`);
  }
  assert.deepEqual(fautes, [], fautes.join("\n"));
});

/* ────────────────────────────────────────────────────────────────────
   LE SOCLE GRATUIT, RECOPIÉ À LA MAIN — DONC VÉRIFIÉ.
   `lib/public-catalogue.ts` ne peut importer ni `lib/bricks` (les prix) ni
   `lib/entitlements` (l'environnement serveur) : tout ce qu'une page
   publique importe part dans le navigateur. La copie est sûre parce qu'un
   test la compare, pas parce qu'on fait attention.
   ──────────────────────────────────────────────────────────────────── */

test("vitrine — le socle annoncé gratuit EST le socle gratuit du serveur", async () => {
  const { SOCLE_GRATUIT, FRONTIERE_PAYANT } = await import("../lib/public-catalogue");
  const { BRIQUES_GRATUITES } = await import("../lib/entitlements");

  assert.deepEqual(
    SOCLE_GRATUIT.map((b) => b.id).sort(),
    [...BRIQUES_GRATUITES].sort(),
    "la page publique promet un socle différent de celui que le serveur ouvre — c'est la promesse qui sera opposée"
  );
  assert.ok(FRONTIERE_PAYANT.length > 40, "la frontière payant/gratuit doit être dite, pas sous-entendue");
});

test("vitrine — la page PARLE du gratuit : le socle existait sans être annoncé nulle part", () => {
  /**
   * ⚠ Le défaut trouvé : les inscriptions sont ouvertes, le serveur applique
   * le socle, des tests le gardent — et la vitrine ne proposait qu'une seule
   * porte, « demander un cadrage ». C'est-à-dire un rendez-vous avec un
   * inconnu, à quelqu'un qui n'a encore rien vu du produit.
   *
   * On teste la CONDITION (la section existe et mène quelque part), pas la
   * présence d'un mot : une page qui dirait « gratuit » sans porte ne vaudrait
   * rien de plus qu'avant.
   */
  assert.match(publique, /gratuit/i, "le socle gratuit doit être annoncé");
  assert.match(vitrine, /SOCLE_GRATUIT/, "la liste vient du catalogue public, pas d'un texte recopié à l'écran");
  assert.match(vitrine, /href="\/souscrire"/, "annoncer le gratuit sans porte pour y entrer ne sert à rien");
});

test("vitrine — les prix Alpha Voice affichés sont ceux qui sont décidés", async () => {
  const { ALPHA_VOICE_PUBLIC } = await import("../lib/public-catalogue");
  const { ALPHA_VOICE_SETUP_HT, ALPHA_VOICE_MINUTE_SUP_HT, ALPHA_VOICE_PALIERS } = await import(
    "../lib/offres-publiques"
  );

  assert.equal(ALPHA_VOICE_PUBLIC.setupHT, ALPHA_VOICE_SETUP_HT, "le setup public a divergé de la grille décidée");
  assert.equal(ALPHA_VOICE_PUBLIC.minuteSupHT, ALPHA_VOICE_MINUTE_SUP_HT, "le prix à la minute a divergé");
  assert.deepEqual(
    ALPHA_VOICE_PUBLIC.paliers.map((t) => [t.nom, t.prixHT]),
    ALPHA_VOICE_PALIERS.map((t) => [t.nom, t.prixHT]),
    "les paliers publics ont divergé de la grille — c'est le prix affiché qui engage"
  );
});

test("vitrine — la garantie porte ses TROIS bords, sinon elle s'active toute seule", async () => {
  const { GARANTIE } = await import("../lib/public-catalogue");
  /**
   * Une durée, un périmètre, un critère. Sans eux, « le setup ne se paie qu'au
   * premier RDV » s'active au bout de trois jours de ligne coupée, et la
   * discussion se tient après coup — c'est-à-dire trop tard.
   */
  assert.ok(GARANTIE.bords.length >= 3, "les trois bords font partie de la garantie, pas des petits caractères");
  const texte = GARANTIE.bords.join(" ");
  assert.match(texte, /30 jours/i, "la DURÉE doit être écrite");
  assert.match(texte, /installation|setup/i, "le PÉRIMÈTRE doit être écrit");
  assert.match(texte, /PRIS/, "le CRITÈRE doit être écrit : un rendez-vous pris, pas honoré");
  /**
   * ⚠ Première version de cette assertion : chercher la PHRASE dans la source
   * de la page. Elle échouait — et elle avait tort. La page rend
   * `{GARANTIE.promesse}`, donc la phrase littérale n'y est pas, et c'est
   * exactement le comportement voulu : une source unique, pas une copie.
   * On vérifie donc le RENDU de la constante, ce qui est plus fort.
   */
  assert.match(vitrine, /GARANTIE\.promesse/, "la garantie doit être rendue depuis le catalogue public");
  assert.match(vitrine, /GARANTIE\.bords/, "les bords se rendent aussi : une promesse sans ses bords est un litige");
});

test("vitrine — l'article 50 est servi comme argument, et sans nommer la pile", () => {
  /**
   * C'est le seul fait de cette page qui ne demande aucune confiance : la
   * divulgation est prononcée par le code, pas par le modèle. Le taire pour
   * « ne pas faire peur » revient à laisser un concurrent en faire un reproche.
   */
  assert.match(publique, /article 50/i, "la divulgation IA doit être annoncée");
  assert.match(publique, /intelligence artificielle/i);
  // Et le test de pile technique plus haut continue de s'appliquer : on dit
  // CE QU'ON FAIT, jamais avec quel fournisseur on le fait.
});

test("vitrine — Business et Lifetime affichés = ceux qui sont décidés", async () => {
  /**
   * Recopiés à la main dans `public-catalogue` (ce module ne doit importer ni
   * `bricks` ni `offres-publiques`, qui portent nos coûts). La copie est sûre
   * parce qu'elle est comparée, pas parce qu'on fait attention.
   */
  const { BUSINESS_PUBLIC, LIFETIME_PUBLIC } = await import("../lib/public-catalogue");
  const {
    PACK_SETUP_HT, PACK_ACOMPTE_HT, PACK_MENSUALITES, PACK_MENSUALITE_HT, PACK_MONTHLY_HT,
    SOCLE_PLATEFORME_HT, PRIX_SIEGE_HT, SIEGES_REFERENCE,
    LIFETIME_PALIERS, LIFETIME_PLACES_TOTAL, LIFETIME_APPELS_INCLUS,
  } = await import("../lib/offres-publiques");

  /**
   * ⚠⚠ LES DEUX TERMES DE LA GRILLE AU SIÈGE. La vitrine annonçait le mensuel
   * comme un FORFAIT : vrai mais INCOMPLET, et c'est le pire état pour un
   * prix. Un prospect à vingt commerciaux lisait « 1 000 €/mois » et
   * découvrait 2 200 € au devis — l'écart exact qui tue une signature au
   * dernier mètre. Depuis qu'elle affiche `socle + n × siège`, ces nombres
   * doivent suivre la formule : sinon le visiteur fait un calcul FAUX avec
   * NOS chiffres, ce qui est pire que de ne rien afficher.
   */
  assert.equal(PRIX_PUBLICS.packSocleHT, SOCLE_PLATEFORME_HT);
  assert.equal(PRIX_PUBLICS.packSiegeHT, PRIX_SIEGE_HT);
  assert.equal(PRIX_PUBLICS.packSiegesReference, SIEGES_REFERENCE);
  assert.equal(
    PRIX_PUBLICS.packSocleHT + PRIX_PUBLICS.packSiegeHT * PRIX_PUBLICS.packSiegesReference,
    PRIX_PUBLICS.packMensuelHT,
    "le prix affiché doit être calculable depuis les deux termes affichés",
  );

  assert.equal(BUSINESS_PUBLIC.prixHT, PACK_SETUP_HT);
  assert.equal(BUSINESS_PUBLIC.acompteHT, PACK_ACOMPTE_HT);
  assert.equal(BUSINESS_PUBLIC.mensualites, PACK_MENSUALITES);
  assert.equal(BUSINESS_PUBLIC.mensualiteHT, PACK_MENSUALITE_HT);
  assert.equal(BUSINESS_PUBLIC.abonnementHT, PACK_MONTHLY_HT);

  assert.deepEqual(
    LIFETIME_PUBLIC.paliers.map((t) => [t.rang, t.prixHT, t.places]),
    LIFETIME_PALIERS.map((t) => [t.rang, t.prixHT, t.places]),
    "les paliers publics ont divergé — c'est le prix affiché qui engage"
  );
  assert.equal(LIFETIME_PUBLIC.placesTotal, LIFETIME_PLACES_TOTAL);
  assert.equal(LIFETIME_PUBLIC.appelsInclus, LIFETIME_APPELS_INCLUS);
});

test("vitrine — « à vie » dit AUSSI ce qui ne l'est pas", () => {
  /**
   * Une offre « à vie » dont le périmètre n'est pas écrit se discute au
   * premier dépassement — et on a alors tort, quel que soit le contrat, parce
   * que c'est nous qui avons employé le mot.
   */
  assert.match(publique, /logiciel à vie/i, "ce qui est à vie doit être nommé");
  assert.match(publique, /reste factur[ée]/i, "…et ce qui reste facturé aussi");
  assert.match(vitrine, /LIFETIME_PUBLIC\.appelsInclus/, "le crédit d'appels vient du catalogue, pas d'un nombre retapé");
});

test("vitrine — l'étalement est sous le prix, pas en note de bas de page", () => {
  // Le blocage n'a jamais été le montant, c'est de le signer d'un trait. Le
  // cacher jusqu'au devis fait perdre la conversation avant qu'elle commence.
  assert.match(vitrine, /BUSINESS_PUBLIC\.acompteHT/);
  assert.match(vitrine, /BUSINESS_PUBLIC\.mensualiteHT/);
  assert.match(publique, /Ou étalé/i);
});

test("vitrine — elle MONTRE le produit, et seulement les écrans gratuits", () => {
  /**
   * La page décrivait un logiciel sans jamais l'afficher. Sur un produit,
   * c'est la première question qu'on se pose et la dernière à laquelle un
   * paragraphe répond.
   *
   * ⚠ Ce test garde surtout la CONTRAINTE : on ne montre que les écrans du
   * socle gratuit. Afficher une capture d'un écran payant sur la page qui
   * annonce le gratuit promettrait autre chose que ce qu'on ouvre — et
   * personne ne s'en apercevrait avant l'inscription.
   */
  assert.match(vitrine, /\/produit\/[a-z-]+\.jpg/, "la vitrine doit afficher des captures");

  const captures = [...vitrine.matchAll(/\/produit\/([a-z-]+)\.jpg/g)].map((m) => m[1]);
  assert.ok(captures.length >= 3, `trop peu de captures : ${captures.length}`);

  // Les écrans payants, nommés par leur chemin métier — aucun ne doit
  // apparaître dans la galerie.
  for (const payant of ["campaigns", "outbox", "voice", "agent", "audits", "activity", "overlay"]) {
    assert.ok(
      !captures.includes(payant),
      `« ${payant} » est une brique PAYANTE : sa capture n'a rien à faire dans la galerie du socle gratuit`
    );
  }
});

test("vitrine — le nom de la société ramène en haut, et une sortie mène à eagleyecorp.fr", () => {
  /**
   * ⚠ « EAGLEYE CORP » était un <span>, donc inerte. C'est l'élément qu'on
   * clique par réflexe sur n'importe quel site, et sur mobile — où toute la
   * navigation est masquée — c'était le SEUL retour possible : il n'y en avait
   * aucun.
   *
   * ⚠⚠ Et le lien vers la société n'existait pas non plus. Depuis que
   * eagleyecorp.fr présente EAGLEYE CORP et que cette page présente le
   * produit, la liaison devait aller dans les DEUX sens : quelqu'un qui arrive
   * ici par un post ne pouvait pas savoir qui est derrière. Sur une page qui
   * demande une adresse email, c'est exactement la question qu'on se pose
   * avant de la donner.
   */
  assert.match(vitrine, /id="top"/, "il faut une ancre de tête pour revenir en haut");
  assert.match(
    vitrine,
    /href="#top"[\s\S]{0,200}EAGLEYE CORP/,
    "le nom de la société doit être un lien vers le haut de page"
  );
  assert.match(vitrine, /https:\/\/eagleyecorp\.fr/, "une sortie doit mener au site de la société");
});

/* ────────────────────────────────────────────────────────────────────
   LA CARTE D'ESSAI — la porte la moins chère, en haut de page.
   ──────────────────────────────────────────────────────────────────── */

test("vitrine — la carte d'essai est AVANT le premier séparateur de section", () => {
  /**
   * « En haut » n'est pas un détail de goût. La page n'offrait, dans son
   * premier écran, que « Demander un cadrage » : un rendez-vous avec un
   * inconnu, proposé à quelqu'un qui vient d'arriver. Entre un rendez-vous et
   * un champ email il y a un ordre de grandeur d'engagement, et c'est le moins
   * engageant qui doit être le plus visible.
   *
   * On mesure la POSITION, pas la présence : une carte d'essai reléguée en bas
   * de page passerait un test qui se contente de la trouver.
   */
  const carte = vitrine.indexOf("Essayer maintenant");
  assert.ok(carte > 0, "le bouton d'essai doit exister");
  const premierRule = vitrine.indexOf("<Rule />");
  assert.ok(premierRule > 0, "lecture de la page cassée : aucun séparateur trouvé");
  assert.ok(
    carte < premierRule,
    "la carte d'essai est passée sous la première section : ce n'est plus la première porte"
  );
});

test("⚠ l'email saisi VOYAGE jusqu'au formulaire — sinon le champ est décoratif", () => {
  /**
   * Le défaut que ce test empêche : la vitrine demande l'adresse, puis envoie
   * vers un formulaire VIDE. La personne la retape, et comprend toute seule
   * qu'elle doit d'abord créer un compte. C'est exactement le moment où l'on
   * abandonne — le champ n'aurait servi qu'à faire joli.
   *
   * On vérifie les DEUX bouts : la vitrine émet, l'écran de connexion lit.
   */
  assert.match(vitrine, /encodeURIComponent\(email/, "l'adresse doit être encodée, pas concaténée");
  assert.match(vitrine, /\/\?email=/, "…et passée à l'application");

  const gate = readFileSync(join(process.cwd(), "components/security/auth-gate.tsx"), "utf8");
  assert.match(gate, /URLSearchParams\(window\.location\.search\)\.get\("email"\)/, "l'écran doit LIRE le paramètre");
  assert.match(gate, /setMode\("up"\)/, "…et basculer en création de compte : qui arrive par là n'en a pas");
  /**
   * ⚠ Et il ne SOUMET rien. Un paramètre d'URL vient de l'extérieur : il
   * pré-remplit un champ visible et corrigible, il ne déclenche aucune action.
   */
  const effet = gate.slice(gate.indexOf('get("email")'), gate.indexOf('fetch("/api/gate")'));
  assert.doesNotMatch(effet, /submit\(\)|signUp\(/, "un lien forgé ne doit jamais déclencher une inscription");
});

test("vitrine — la carte dit ce qu'elle fait de l'adresse, sous le champ", () => {
  /**
   * Elle n'enregistre rien : l'adresse sert à pré-remplir l'inscription, et
   * c'est tout. Le dire SOUS le champ, pas dans une politique qu'il faut aller
   * chercher — c'est la question qu'on se pose au moment exact où l'on tape.
   *
   * ⚠ Ce test garde aussi la promesse elle-même : le jour où quelqu'un branche
   * une vraie collecte derrière ce champ, cette phrase devient un mensonge et
   * il faudra la retirer — donc le voir.
   */
  assert.match(publique, /ne part nulle part|Aucune\s+liste/i, "ce qu'on fait de l'adresse doit être écrit");
  assert.doesNotMatch(vitrine, /fetch\((["'`])\/api\//, "la carte d'essai ne doit appeler AUCUNE API : elle ne collecte pas");
});

test("⚠ le bloc vidéo MÈNE quelque part — et sans trahir le clic", () => {
  /**
   * Le bloc se terminait sur la carte de marque et s'arrêtait là : un
   * cul-de-sac au moment exact où la personne vient de regarder dix secondes
   * de produit et n'a plus rien à faire de cet écran.
   *
   * ⚠ Et ce qu'on n'a PAS fait, délibérément : rendre la surface vidéo
   * cliquable vers une page. On clique une vidéo pour la lire ou la mettre en
   * pause ; une surface qui quitte la page à la place fait exactement ce que
   * l'utilisateur n'a pas demandé. Le lien vit à côté de la légende et sur le
   * voile de fin, jamais sur la vidéo elle-même.
   */
  const video = readFileSync(join(process.cwd(), "components/vitrine/hero-video.tsx"), "utf8");

  assert.match(video, /href: string;/, "la destination doit être un paramètre");
  assert.match(vitrine, /<HeroVideo[\s\S]{0,400}href="#/, "…et la PAGE doit la fournir, pas le composant la décider");

  // La balise <video> ne porte aucun gestionnaire de navigation.
  const balise = video.slice(video.indexOf("<video"), video.indexOf("</video>"));
  assert.doesNotMatch(balise, /href|location\.|onClick=\{\(\) => \{?\s*(window|router)/, "la vidéo ne doit pas naviguer au clic");

  /**
   * Et la sortie doit exister AUSSI en mouvement réduit : là, la vidéo ne se
   * lance pas, donc le voile de fin n'apparaît jamais. Sans le lien de
   * légende, ces personnes-là n'auraient aucune issue depuis ce bloc — c'est
   * un réglage d'accessibilité, pas une préférence de confort.
   */
  const legende = video.slice(video.indexOf("<figcaption"), video.indexOf("</figcaption>"));
  assert.match(legende, /href=\{href\}/, "la légende doit porter le lien : c'est la seule sortie en mouvement réduit");
});

test("vitrine — on peut revenir à la société depuis le HAUT de page, pas seulement du pied", () => {
  /**
   * Le lien n'existait qu'en pied de page : à trois écrans de défilement de
   * l'endroit où la question se pose vraiment — « qui me demande mon adresse
   * email ? ». Depuis que la société et le produit ont chacun leur site, la
   * liaison doit être atteignable d'en haut.
   */
  const nav = vitrine.slice(vitrine.indexOf("<nav"), vitrine.indexOf("</nav>"));
  assert.match(nav, /https:\/\/eagleyecorp\.fr/, "la navigation doit porter le retour vers la société");

  // Et il reste en pied de page : sur mobile, la navigation est masquée.
  const pied = vitrine.slice(vitrine.indexOf("<footer"));
  assert.match(pied, /https:\/\/eagleyecorp\.fr/, "…et le pied de page le garde pour le mobile");
});
