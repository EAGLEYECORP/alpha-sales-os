import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publicBricks, BRICKS, PALIERS_PUBLICS } from "../lib/bricks";

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
  assert.match(vitrine, /OUTBOUND_UNIT_HT/);
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

test("vue publique — dérivée du catalogue, jamais recopiée", () => {
  // Une seconde liste tenue à la main finirait par annoncer publiquement un
  // prix ou une capacité qui n'existe plus.
  const pub = publicBricks();
  assert.equal(pub.length, BRICKS.length);
  for (const b of pub) {
    const source = BRICKS.find((x) => x.id === b.id)!;
    assert.equal(b.label, source.label);
    assert.equal(b.what, source.what);
    // Le palier se déduit du prix réel : il ne peut pas diverger.
    assert.ok(PALIERS_PUBLICS[b.palier], `palier inconnu : ${b.palier}`);
  }
  // Et aucun montant ne fuit dans la vue publique.
  assert.doesNotMatch(JSON.stringify(pub), /setupHT|monthlyHT/);
});

test("Alpha Live est une brique vendable à part entière", () => {
  const live = BRICKS.find((b) => b.id === "alpha-live");
  assert.ok(live, "Alpha Live doit exister au catalogue");
  // C'est la seule brique qui agit PENDANT la vente : son argument doit le dire.
  assert.match(live!.why, /PENDANT/);
  assert.ok(live!.setupHT > 0 && live!.monthlyHT > 0);
  // Elle apparaît publiquement, sans son prix.
  assert.ok(publicBricks().some((b) => b.id === "alpha-live"));
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
