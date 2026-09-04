import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BRICKS, OUTBOUND_TIERS, OUTBOUND_UNIT_HT, OUTBOUND_UNIT_CALLS, PACK_SETUP_HT, PACK_MONTHLY_HT } from "../lib/bricks";
import { CAPACITES, PALIERS_LABELS, PRIX_PUBLICS } from "../lib/public-catalogue";

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

test("⚠ bundle app — aucun NOM de prospect réel, même recopié à la main", () => {
  /**
   * ⚠ MESURÉ DANS LE BUILD, ET C'EST LA MÊME LEÇON POUR LA TROISIÈME FOIS.
   *
   * Un chunk public contenait « ***NOM-RETIRE*** 3/08, Vauban 3/08, ***NOM-RETIRE*** 5/08 » :
   * trois vrais prospects et leurs dates de rendez-vous, lisibles sans mot de
   * passe. Ce n'était pas `lib/pipeline-juillet` qui avait fui — ce module est
   * gardé depuis son post-mortem. Les noms avaient été RETAPÉS à la main dans
   * une boîte de confirmation de `/settings`, et plus rien ne les surveillait.
   *
   * Un test qui nomme des fichiers protège des fichiers. Celui-ci part des
   * DONNÉES : il lit les entreprises réelles à leur source et vérifie qu'aucun
   * fichier atteignable par le navigateur ne les écrit. Il n'y a pas de
   * troisième endroit où les recopier sans qu'il le voie.
   */
  const source = readFileSync(join(process.cwd(), "lib/pipeline-juillet.ts"), "utf8");
  const entreprises = [...source.matchAll(/company:\s*"([^"]+)"/g)]
    /**
     * Ce qui est entre parenthèses QUALIFIE, ça n'identifie pas :
     * « ***NOM-RETIRE*** » — le nom est ***NOM-RETIRE***, Cordeliers
     * est un quartier de Lyon, et il sert de ville à une fiche de démonstration
     * parfaitement légitime. Même chose pour « (Point S) », « (traiteur) »,
     * « (agence immobilière) ». On les retire par la FORME plutôt que de les
     * énumérer : une parenthèse suivante sera traitée toute seule.
     */
    .map((m) => m[1].replace(/\([^)]*\)/g, " "))
    // On ne retient que le nom distinctif : « ***NOM-RETIRE*** » se recopie
    // souvent en « ***NOM-RETIRE*** » seul, et c'est cette forme-là qui avait fui.
    .flatMap((nom) => nom.split(/[\s—·]+/))
    .map((mot) => mot.replace(/[^\p{L}'-]/gu, ""))
    // Les mots de métier (« Carrosserie », « Avocats ») sont partout dans le
    // produit : les interdire rendrait le test ininterprétable. On garde les
    // noms propres rares, c'est-à-dire ceux qui n'apparaissent pas dans le
    // vocabulaire courant du dépôt.
    .filter((mot) => mot.length >= 5 && /^[A-ZÉÈ]/.test(mot))
    /**
     * ⚠ LE VOCABULAIRE DE MÉTIER N'EST PAS UN NOM DE PROSPECT, et le premier
     * jet de ce test l'a appris en signalant « Point » (de « Point S ») et
     * « Ambulance » (de « ***NOM-RETIRE*** ») dans des listes de secteurs
     * parfaitement légitimes.
     *
     * Cette liste ne recopie PAS la donnée protégée : elle recopie le
     * vocabulaire commun, qui est public et stable. La direction d'erreur est
     * la bonne — un mot de métier oublié fait un faux positif qu'on vient
     * ajouter ici en le justifiant, tandis qu'un nom propre inédit reste
     * attrapé. L'inverse (une liste de noms à chercher) serait une copie de
     * la donnée qu'on protège, et divergerait au premier prospect ajouté.
     */
    .filter(
      (mot) =>
        !/^(Carrosserie|Auto|École|Ecole|Agence|Garage|Avocats|Associés|Prestige|Ambulance|Point|Conduite|Chirurgie|Rénovation|Traiteur|Immobilier|Immobilière|Automobile|Lyon)$/.test(
          mot
        )
    );

  assert.ok(entreprises.length >= 5, `lecture des entreprises cassée : ${entreprises.join(", ")}`);

  const clients = sources(["app", "components"]).filter((f) =>
    /^\s*["']use client["']/.test(readFileSync(join(process.cwd(), f), "utf8"))
  );
  const atteints = new Set<string>();
  for (const f of clients) {
    atteints.add(f.replace(/\.tsx?$/, ""));
    for (const m of grapheImports(f.replace(/\.tsx?$/, ""))) atteints.add(m);
  }

  const fautes: string[] = [];
  for (const m of [...atteints].sort()) {
    let src = "";
    for (const ext of [".ts", ".tsx"]) {
      try {
        src = readFileSync(join(process.cwd(), m + ext), "utf8");
        break;
      } catch {
        /* extension suivante */
      }
    }
    if (!src) continue;
    // Le minifieur retire les commentaires : une explication ne part pas au
    // navigateur, et ne doit donc pas faire échouer le test (le piège s'est
    // refermé cinq fois dans ce dépôt).
    const code = sansCommentaires(src);
    for (const nom of new Set(entreprises)) {
      if (new RegExp(`\\b${nom}\\b`).test(code)) fautes.push(`${m} → « ${nom} »`);
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "des noms de prospects réels partent dans un fichier JavaScript téléchargeable :\n  " + fautes.join("\n  ")
  );
});

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
