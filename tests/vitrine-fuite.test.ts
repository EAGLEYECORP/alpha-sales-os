import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("vitrine — la grille de prix ligne à ligne ne sort pas", () => {
  // L'ancrage par l'addition ne fonctionne QUE dans une conversation : sur une
  // page, le prospect fait l'addition seul et choisit la brique la moins
  // chère. La grille détaillée est aussi la carte du produit pour un
  // concurrent.
  assert.doesNotMatch(vitrine, /b\.setupHT|b\.monthlyHT/, "les montants par brique ne s'affichent plus");
  assert.doesNotMatch(vitrine, /quoteBricks|quote\.setupHT|quote\.monthlyHT/, "aucun total calculé publiquement");
  assert.doesNotMatch(vitrine, /BRICKS\b/, "le catalogue interne ne doit pas être importé ici");
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
    // `import type { … }` est effacé à la compilation : il ne met rien dans
    // le bundle, donc il ne compte pas comme une fuite.
    for (const m of src.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+"(@\/[^"]+)"/gm)) {
      if (m[1]) continue;
      marche(m[2].replace(/^@\//, ""));
    }
  };

  marche(entree);
  return vus;
}

test("bundle public — le graphe d'imports n'atteint AUCUN module à prix", () => {
  for (const entree of ["app/vitrine/page", "app/vitrine/layout", "app/gate/page"]) {
    const graphe = grapheImports(entree);
    for (const interdit of MODULES_A_PRIX) {
      assert.ok(
        !graphe.has(interdit),
        `${entree} atteint ${interdit} — la grille tarifaire repartirait dans le navigateur`
      );
    }
  }
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
