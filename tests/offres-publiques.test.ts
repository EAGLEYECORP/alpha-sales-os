import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  OFFRES,
  PRIX_PUBLICS,
  PACK_SETUP_HT,
  PACK_MONTHLY_HT,
  PRO_APPELS_INCLUS,
  offreParId,
  validerOffres,
  type OffrePublique,
} from "../lib/offres-publiques";
import { margeOffre } from "../lib/offres-marge";
import { PLANS } from "../lib/stripe";
import { BRICKS, OUTBOUND_TIERS, OUTBOUND_UNIT_HT } from "../lib/bricks";
import {
  ALPHA_VOICE_MINUTE_SUP_HT, ALPHA_VOICE_SETUP_HT, OUTBOUND_SETUP_HT, OUTBOUND_UNIT_CALLS,
} from "../lib/offres-publiques";
import { SEGMENTS } from "../lib/segments";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE SEULE GRILLE DE PRIX. C'est tout ce que ce fichier protège.
 *
 * Il y en avait TROIS : la vitrine (79 / 149 €), Stripe (79 / 149 €) et le
 * catalogue commercial (Alpha Voice à 364 €/mois). Le site vendait donc à
 * 149 € ce que le catalogue facturait 364 €, et l'offre Pro annonçait
 * « Alpha Voice inclus » sans aucun plafond d'appels — une perte sèche dès
 * 2 200 appels dans le mois.
 *
 * Trois grilles ne divergent pas par négligence : elles divergent parce que
 * rien ne les compare. Voilà la comparaison.
 * ─────────────────────────────────────────────────────────────────────
 */

const SITE = readFileSync(join(process.cwd(), "site/index.html"), "utf8");

/**
 * Un test qui cherche une faute dans du code doit lire le CODE, pas les
 * commentaires. Le commentaire qui explique « ne jamais écrire paiement
 * confirmé » contient forcément la phrase interdite — et faisait échouer le
 * test qu'il documente.
 */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ─────────── 1. LA RÈGLE QUI A COÛTÉ LE PLUS CHER ───────────

test("la grille publique est valide — aucune offre bancale", () => {
  const erreurs = validerOffres();
  assert.deepEqual(
    erreurs,
    [],
    `grille invalide :\n${erreurs.map((e) => `  ${e.offreId}.${e.champ} — ${e.probleme}`).join("\n")}`
  );
});

test("une offre qui inclut la voix SANS plafond est refusée", () => {
  // Le cas exact qui était en ligne. Le validateur doit le rejeter.
  const perte: OffrePublique = {
    ...offreParId("omnicanal")!,
    id: "pro-sans-plafond",
    appelsInclus: null,
    auDela: null,
  };
  const erreurs = validerOffres([perte]);
  assert.ok(
    erreurs.some((e) => e.champ === "appelsInclus"),
    "la voix sans plafond doit être une erreur, pas un choix"
  );
  assert.ok(erreurs.some((e) => /perte sèche/.test(e.probleme)), "et le motif doit être dit");
});

test("un plafond sans « au-delà » écrit est refusé aussi", () => {
  const piege: OffrePublique = { ...offreParId("omnicanal")!, id: "pro-piege", auDela: "" };
  const erreurs = validerOffres([piege]);
  assert.ok(erreurs.some((e) => e.champ === "auDela"));
});

test("un prix affiché sans moyen d'encaisser est refusé", () => {
  // Le visiteur clique « payer » et tombe dans le vide, au moment exact où il
  // voulait payer. C'est arrivé une fois avec des liens Stripe de gabarit.
  const orphelin: OffrePublique = { ...offreParId("omnicanal")!, id: "omni-orphelin", priceEnv: null };
  const erreurs = validerOffres([orphelin]);
  assert.ok(erreurs.some((e) => e.champ === "priceEnv"));
});

test("l'offre Pro est rentable AU PLAFOND, et son seuil de perte est connu", () => {
  const m = margeOffre(offreParId("voix-essentiel")!);
  assert.ok((m.margeMarginalePct ?? 0) > 60, `marge marginale ${m.margeMarginalePct} %`);
  assert.ok(m.seuilPerteAppels !== null, "on doit SAVOIR à partir de combien d'appels ça bascule");
  assert.ok(
    (m.seuilPerteAppels ?? 0) > PRO_APPELS_INCLUS * 5,
    "le seuil de perte doit rester loin du plafond annoncé, sinon la marge est illusoire"
  );
});

test("une offre sans appels n'invente pas de coût marginal", () => {
  /**
   * ⚠ CE TEST PRENAIT `os-complet` COMME SUJET, ET IL AVAIT CESSÉ D'EN ÊTRE UN.
   * Depuis que TOUTE offre de la grille inclut la voix (le 04/09/2026), plus
   * aucune n'emprunte la branche « coût marginal nul » — le test mesurait donc
   * la mauvaise branche et réclamait 0 là où le calcul rend 52,13 € à juste
   * titre. On construit le sujet à la main : la branche existe, elle se
   * réveillera dès qu'on vendra une brique logicielle seule, et elle doit
   * être juste ce jour-là, pas ce jour-là seulement.
   */
  const logicielSeul: OffrePublique = {
    ...offreParId("os-complet")!,
    id: "logiciel-seul",
    voixIncluse: false,
    appelsInclus: null,
    prixHT: 500,
  };
  const m = margeOffre(logicielSeul);
  assert.equal(m.coutMarginalEur, 0, "l'hébergement est mutualisé : le client de plus ne coûte rien");
  assert.equal(m.margeMarginalePct, 100, "sans coût marginal, tout le prix est de la marge marginale");
  assert.equal(m.seuilPerteAppels, null, "sans appels, il n'existe aucun seuil de bascule");
  assert.match(m.phrase, /vient de la valeur/, "et il faut dire d'où vient le prix à la place");

  // Et le contre-test, sans lequel le précédent passerait sur n'importe quoi :
  // une offre AVEC voix doit, elle, porter un coût marginal non nul.
  assert.ok(margeOffre(offreParId("os-complet")!).coutMarginalEur > 0, "la voix coûte, et ça doit se voir");
});

// ─────────── 2. LA VITRINE NE PEUT PLUS DIVERGER ───────────

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LE SITE SOCIÉTÉ NE PORTE PLUS AUCUN PRIX — ET C'EST L'INVARIANT.
 *
 * Ces trois tests vérifiaient que les prix de `site/index.html` étaient les
 * bons. Ils ont fait leur travail deux fois : ils ont attrapé « Solo 79 € »
 * qui vendait ce qui était devenu gratuit, puis un palier voix annoncé sans
 * son installation. Mais ils gardaient le mauvais invariant.
 *
 * Le défaut n'était pas que les prix soient faux : c'est que DEUX surfaces
 * portaient les mêmes prix. Tant que c'est le cas, l'une des deux finit
 * périmée, et c'est toujours celle qu'on oublie de rouvrir. Un test qui
 * compare deux copies rend la dérive détectable ; supprimer la copie la rend
 * IMPOSSIBLE.
 *
 * Le découpage est donc : eagleyecorp.fr = la société (aucun prix produit),
 * alphasalesos.eagleyecorp.fr = le produit (les offres, les prix, la
 * souscription). Ce qui suit garde ce découpage.
 * ─────────────────────────────────────────────────────────────────────
 */
test("le site société n'affiche AUCUN prix produit", () => {
  /**
   * Les commentaires sont retirés d'abord : celui qui explique pourquoi les
   * prix ont disparu cite les anciens montants, et sans ce nettoyage il
   * déclencherait le test qu'il documente. La correction naturelle serait
   * alors d'effacer l'explication — l'inverse du but.
   */
  const html = SITE.replace(/<!--[\s\S]*?-->/g, "");
  const montants = [...html.matchAll(/(\d[\d\s  ]*)\s*€/g)].map((m) => m[1].replace(/[\s ]/g, ""));
  assert.deepEqual(
    montants,
    [],
    `le site société porte à nouveau des prix (${montants.join(", ")} €) : c'est la deuxième source qui a déjà dérivé deux fois. Les prix vivent sur le site produit.`
  );
});

test("…et il RENVOIE vers le produit, sinon il ne vend plus rien", () => {
  /**
   * L'autre bord du même fossé. Retirer les prix sans donner de porte
   * transformerait la page en plaquette : le visiteur qui veut acheter n'a
   * plus où aller, et on aurait échangé une dérive contre une impasse.
   */
  const html = SITE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(html, /alphasalesos\.eagleyecorp\.fr/, "le site société doit mener au produit");
  assert.match(html, /alphasalesos\.eagleyecorp\.fr\/souscrire/, "…y compris directement à l'inscription");
});

test("le site société ne cite plus le produit comme son sujet principal", () => {
  /**
   * Le titre et la description annonçaient ALPHA SALES OS : deux pages de
   * vente pour un seul produit, c'est ce découpage-là qu'on corrige. La page
   * peut parler du produit — elle DOIT même — mais elle n'est plus sa page.
   */
  const titre = SITE.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  assert.match(titre, /EAGLEYE/i, "le titre doit annoncer la société");
});

test("⚠ une offre PAYANTE ne peut pas être faite uniquement de briques gratuites", async () => {
  /**
   * Le socle est devenu gratuit le 02/09/2026. Trois des quatre capacités de
   * l'offre « Solo » (crm, closer, pilotage) sont depuis ce jour-là ouvertes à
   * tout compte — et l'offre continuait de les vendre 79 €/mois sous le titre
   * « tout le cœur du système ».
   *
   * Ce test ne tranche PAS le sujet commercial : il refuse seulement le cas
   * indéfendable — facturer un abonnement qui n'ouvre rien de plus que la
   * gratuité. C'est le genre de divergence qu'aucune relecture ne voit et que
   * le premier client découvre en s'inscrivant.
   */
  const { BRIQUES_GRATUITES } = await import("../lib/entitlements");
  const gratuites = new Set<string>(BRIQUES_GRATUITES);
  for (const o of OFFRES) {
    if (o.prixHT === null || o.prixHT === 0) continue;
    if (!o.capacites?.length) continue;
    const payantes = o.capacites.filter((c) => !gratuites.has(c));
    assert.ok(
      payantes.length > 0,
      `« ${o.nom} » se facture ${o.prixHT} € et n'ouvre que des briques gratuites (${o.capacites.join(", ")})`
    );
  }
});

// ─────────── 3. STRIPE SUIT LA GRILLE, PAS L'INVERSE ───────────

test("chaque plan Stripe correspond à une offre publique au MÊME prix", () => {
  for (const plan of Object.values(PLANS)) {
    const offre = offreParId(plan.id);
    assert.ok(offre, `le plan Stripe « ${plan.id} » n'existe pas dans la grille publique`);
    assert.equal(
      offre!.prixHT,
      plan.monthly,
      `${plan.id} : Stripe encaisse ${plan.monthly} € mais la grille annonce ${offre!.prixHT} €`
    );
  }
});

test("toute offre encaissable nomme une variable d'environnement de prix", () => {
  for (const o of OFFRES) {
    if (o.cadence === "devis") continue;
    assert.ok(o.priceEnv, `${o.id} affiche un prix sans variable de prix Stripe`);
    assert.match(o.priceEnv!, /^STRIPE_PRICE_/, `${o.id} : ${o.priceEnv} ne suit pas la convention`);
  }
});

test("les offres nouvelles sont déclarées dans .env.example, sinon elles ne s'encaissent jamais", () => {
  // Une variable qu'on oublie de documenter est une variable qu'on oublie de
  // renseigner — et le bouton « payer » tombe dans le vide en production.
  const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  for (const o of OFFRES) {
    if (!o.priceEnv) continue;
    assert.ok(env.includes(o.priceEnv), `${o.priceEnv} manque dans .env.example (offre « ${o.id} »)`);
  }
});

// ─────────── 4. COHÉRENCE AVEC LE CATALOGUE INTERNE ───────────

test("le palier voix public est au même prix que la grille de volume", () => {
  assert.equal(offreParId("voix-1000")!.prixHT, OUTBOUND_UNIT_HT);
});

test("l'offre sur devis n'affiche aucun prix", () => {
  const devis = OFFRES.filter((o) => o.cadence === "devis");
  assert.ok(devis.length > 0, "il faut au moins une porte « on en parle »");
  for (const o of devis) assert.equal(o.prixHT, null);
});

// ─────────── 5. LA GRILLE PUBLIQUE RESTE ATTEIGNABLE PAR LE NAVIGATEUR ───────────

test("lib/offres-publiques n'atteint AUCUN module de coûts", () => {
  /**
   * Ce fichier s'affiche dans le navigateur : c'est lui qui porte les prix.
   * S'il importe `voice-costs` ou `bricks`, la structure de coûts et les
   * marges partent dans le bundle, lisibles dans les devtools par n'importe
   * quel prospect. Le test de fuite l'a attrapé une fois ; celui-ci le dit
   * à l'endroit où la faute se commettrait.
   */
  const src = readFileSync(join(process.cwd(), "lib/offres-publiques.ts"), "utf8");
  for (const interdit of ["voice-costs", "./bricks", "pricing-briques"]) {
    assert.doesNotMatch(
      src,
      new RegExp(`from ["']\\.?/?${interdit.replace(".", "\\.")}["']`),
      `offres-publiques importe ${interdit} — la grille de coûts partirait au navigateur`
    );
  }
});

test("le catalogue interne réimporte les prix publics au lieu de les recopier", () => {
  const bricks = readFileSync(join(process.cwd(), "lib/bricks.ts"), "utf8");
  assert.match(
    bricks,
    /from "\.\/offres-publiques"/,
    "bricks doit tirer les prix publics de la grille, sinon les deux redivergent"
  );
  // Et surtout : il ne doit PAS les redéclarer.
  assert.doesNotMatch(bricks, /^export const OUTBOUND_UNIT_HT = \d+;/m);
  assert.doesNotMatch(bricks, /^export const PACK_SETUP_HT = \d+;/m);
});

test("⚠ AUCUN prix public ne se redéclare ailleurs — la garde s'arrêtait avant le pack", () => {
  /**
   * ⚠ CE TEST EXISTAIT À MOITIÉ, ET LA MOITIÉ MANQUANTE PORTAIT L'ANCRE.
   *
   * Celui du dessus interdisait de redéclarer `OUTBOUND_UNIT_HT` et
   * `ESSAI_HT`. Pendant ce temps `bricks` redéclarait `PACK_SETUP_HT` et
   * `PACK_MONTHLY_HT` — 10 000 € et 1 000 €/mois, les deux plus gros nombres
   * du catalogue, ceux sur lesquels toute négociation s'ancre. Les valeurs
   * coïncidaient, donc rien ne se voyait ; mais `tests/marche.test.ts` lisait
   * la version `offres-publiques` et tout le produit l'autre. Bouger l'ancre
   * d'un côté laissait l'autre annoncer l'ancien prix, sans un seul échec.
   *
   * On ne liste plus les constantes une par une : on interdit la REDÉCLARATION
   * de tout ce que `offres-publiques` exporte comme nombre. Ajouter un prix
   * public demain le protège tout seul — c'est la seule forme de garde qui ne
   * se laisse pas distancer par le fichier qu'elle surveille.
   */
  const grille = readFileSync(join(process.cwd(), "lib/offres-publiques.ts"), "utf8");
  const nomsPrix = [...grille.matchAll(/^export const ([A-Z_]+)(?::\s*number)?\s*=\s*[\d_]+;/gm)].map((m) => m[1]);
  assert.ok(nomsPrix.length >= 6, `on doit trouver les prix publics (trouvé : ${nomsPrix.join(", ")})`);

  // Tout module qui n'est PAS la grille elle-même doit les importer, jamais
  // les réécrire. On balaie `lib/` entier : le doublon d'hier était dans
  // `bricks`, celui de demain sera ailleurs.
  for (const fichier of readdirSync(join(process.cwd(), "lib")).filter((f) => f.endsWith(".ts") && f !== "offres-publiques.ts")) {
    const src = readFileSync(join(process.cwd(), "lib", fichier), "utf8");
    for (const nom of nomsPrix) {
      assert.doesNotMatch(
        src,
        new RegExp(`^export const ${nom}\\s*(?::[^=]+)?=\\s*[\\d_]+;`, "m"),
        `lib/${fichier} redéclare ${nom} — deux saisies du même prix public, aucune ne préviendra quand l'autre bougera`
      );
    }
  }
});

test("le pack dit le même prix des deux côtés, et par-dessus le nom métier", async () => {
  /**
   * La garde ci-dessus lit le SOURCE. Celle-ci lit les VALEURS : si un jour
   * quelqu'un contourne la forme (calcul, indirection), les nombres doivent
   * encore coïncider. `SETUP_FEE` est le même montant sous son nom de modèle
   * économique — légitime, à condition qu'il n'y ait qu'une saisie.
   */
  const bricks = await import("../lib/bricks");
  const { SETUP_FEE } = await import("../lib/pricing");
  assert.equal(bricks.PACK_SETUP_HT, PACK_SETUP_HT, "le pack de bricks doit être celui de la grille");
  assert.equal(bricks.PACK_MONTHLY_HT, PACK_MONTHLY_HT);
  assert.equal(SETUP_FEE, PACK_SETUP_HT, "« frais de setup » et « pack » sont le même montant");
});

test("chaque offre débloque des capacités réelles — sinon l'onboarding est vide", () => {
  for (const o of OFFRES) {
    assert.ok(o.capacites.length > 0, `${o.id} ne débloque rien : le client paie et n'a aucun parcours`);
    if (o.voixIncluse) {
      assert.ok(
        o.capacites.includes("alpha-voice"),
        `${o.id} vend la voix sans débloquer l'écran — le client paie pour une porte fermée`
      );
    }
  }
});

test("le retour de paiement mène à un onboarding, pas à un écran identique", () => {
  // `/compte` ne lisait AUCUN paramètre d'URL : après avoir payé, le client
  // revenait sur la même page qu'avant et devait deviner la suite.
  const page = readFileSync(join(process.cwd(), "app/(app)/compte/page.tsx"), "utf8");
  assert.ok(page.includes("ApresAchat"), "la page compte doit accueillir le retour de Stripe");

  const panneau = sansCommentaires(readFileSync(join(process.cwd(), "components/billing/apres-achat.tsx"), "utf8"));
  assert.ok(panneau.includes("parcours("), "le retour doit lancer le parcours d'onboarding");
  // Une redirection navigateur n'est PAS une preuve d'encaissement.
  assert.doesNotMatch(
    panneau,
    /[Pp]aiement (confirmé|validé|encaissé)/,
    "l'URL de retour ne prouve rien : seul le webhook confirme"
  );
});

test("⚠ le client qui vient de PAYER n'atterrit pas derrière le mot de passe", () => {
  /**
   * LE PIRE DES DÉFAUTS DE CETTE SÉRIE, parce qu'il coûte après l'argent.
   *
   * `successUrl` et `cancelUrl` visaient `/compte`, une route de `(app)`.
   * Vérifié en démarrant le serveur avec `SITE_PASSWORD` — le seul cas où le
   * mur s'active, donc invisible en local : le client payait, Stripe le
   * renvoyait, et il tombait sur `307 → /gate`. On prenait son argent pour
   * lui montrer une porte fermée, dont le mot de passe est celui de NOTRE
   * outil interne — qu'il n'aura jamais.
   */
  const route = readFileSync(join(process.cwd(), "app/api/billing/checkout/route.ts"), "utf8");
  for (const champ of ["successUrl", "cancelUrl"]) {
    const ligne = route.slice(route.indexOf(champ), route.indexOf(champ) + 140);
    assert.doesNotMatch(ligne, /\/compte/, `${champ} ne doit pas viser une route gardée`);
    assert.match(ligne, /\/souscrire/, `${champ} doit revenir sur la page publique`);
    assert.match(ligne, /offre=\$\{encodeURIComponent/, `${champ} doit porter l'offre, sinon le parcours est générique`);
  }
});

test("la page publique de retour lance le parcours, sans prétendre être payée", () => {
  const page = sansCommentaires(readFileSync(join(process.cwd(), "app/souscrire/page.tsx"), "utf8"));
  assert.ok(page.includes("parcours("), "le retour public doit lancer l'onboarding, pas dire merci");
  assert.match(page, /achat=ok|q\.get\("achat"\)/, "la page doit lire l'état du retour");
  // Même règle que sur le panneau interne : une redirection ne prouve rien.
  assert.doesNotMatch(
    page,
    /[Pp]aiement (confirmé|validé|encaissé)/,
    "seul le webhook Stripe confirme un encaissement"
  );
  // Et le formulaire d'achat ne doit pas rester affiché sous le remerciement :
  // proposer de repayer à quelqu'un qui vient de payer est un appel au support.
  assert.match(page, /!achat && choisie/, "l'écran d'achat doit s'effacer au retour");
  // Un paiement ANNULÉ ne se remercie pas. Constaté au navigateur : le titre
  // « Merci — on prend la suite » s'affichait au-dessus de « Paiement
  // interrompu ». Le titre doit distinguer les deux retours.
  assert.match(page, /achat === "ok" \?/, "le titre doit distinguer le succès de l'annulation");
});

test("la route de paiement accepte toutes les offres payables, et refuse le devis", () => {
  const route = readFileSync(join(process.cwd(), "app/api/billing/checkout/route.ts"), "utf8");
  assert.ok(route.includes("offreParId"), "la route doit résoudre l'offre dans la grille");
  assert.match(route, /cadence === "devis"/, "une offre sur devis ne doit pas avoir de bouton payer");
  assert.match(
    route,
    /abonnement: offre\.cadence === "mensuel"/,
    "le mode Stripe doit se DÉDUIRE de la cadence : l'essai est un paiement unique"
  );
});

/* ═══════════════════════════════════════════════════════════════════
   LE PRIX DU SORTANT NE SE RECOPIE PLUS DANS UNE PHRASE DE VENTE
   ═══════════════════════════════════════════════════════════════════ */

test("segments — la fourchette du centre d'appels est CALCULÉE, pas écrite", () => {
  /**
   * ⚠ CE QUI ÉTAIT CASSÉ.
   *
   * `lib/segments.ts` portait la chaîne « 3 500 € installation + 364 €/mois par
   * tranche de 1 000 appels », tapée à la main. C'est une phrase que lit un
   * PROSPECT, et c'était la dernière deuxième-source de prix du dépôt : le jour
   * où le setup bouge, `bricks` suit et cette phrase continue d'annoncer
   * l'ancien montant, sans un seul échec de test.
   *
   * On vérifie la CONDITION — la chaîne se déforme quand la constante bouge —
   * et pas la présence d'un `import`, qu'un littéral laissé à côté rendrait
   * muet.
   */
  const seg = SEGMENTS.find((s) => s.id === "centre-appels");
  assert.ok(seg, "le segment centre d'appels doit exister");
  assert.ok(
    seg.dealRange.includes(String(OUTBOUND_UNIT_HT)),
    `le palier (${OUTBOUND_UNIT_HT}) doit venir de la grille : « ${seg.dealRange} »`
  );
  // 3500 s'affiche « 3 500 » : on cherche le nombre séparateur compris.
  const setupAffiche = String(OUTBOUND_SETUP_HT).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  assert.ok(
    seg.dealRange.includes(setupAffiche),
    `le setup (${setupAffiche}) doit venir de la grille : « ${seg.dealRange} »`
  );
  assert.ok(
    seg.dealRange.includes(String(OUTBOUND_UNIT_CALLS).replace(/\B(?=(\d{3})+(?!\d))/g, " ")),
    "la taille de la tranche aussi"
  );
});

test("segments — et le montant ne réapparaît pas en clair à côté", () => {
  /**
   * Le pendant du test précédent, et il est nécessaire : `dealRange` peut être
   * calculé correctement pendant qu'une AUTRE phrase du même fichier réécrit
   * le montant à la main. C'est exactement ainsi que le doublon est né.
   */
  const src = readFileSync(join(process.cwd(), "lib/segments.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const setupAffiche = String(OUTBOUND_SETUP_HT).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  for (const interdit of [`${setupAffiche} €`, `${OUTBOUND_UNIT_HT} €`]) {
    assert.ok(
      !src.includes(interdit),
      `« ${interdit} » est écrit en clair dans lib/segments.ts — il doit venir de lib/offres-publiques.ts`
    );
  }
});

test("bricks — le setup du sortant est TIRÉ de la grille, pas retapé", () => {
  /**
   * ⚠ Une mutation a montré le trou : remettre `setupHT: 3500` en dur dans
   * `bricks` ne faisait tomber aucun test. L'égalité de VALEUR ne suffit pas —
   * tant que le nombre en dur vaut le même, elle passe. Il faut donc les deux :
   * la valeur (qui attrape un déplacement de la grille) ET le câblage (qui
   * attrape la resaisie).
   */
  const alphaVoice = BRICKS.find((b) => b.id === "alpha-voice");
  assert.ok(alphaVoice, "la brique Alpha Voice doit exister");
  assert.equal(alphaVoice.setupHT, OUTBOUND_SETUP_HT, "le setup doit valoir celui de la grille publique");

  const src = readFileSync(join(process.cwd(), "lib/bricks.ts"), "utf8");
  assert.match(
    src,
    /setupHT: OUTBOUND_SETUP_HT,/,
    "le setup doit être IMPORTÉ de lib/offres-publiques.ts, pas écrit en chiffres"
  );

  /**
   * Les paliers de volume sont des MULTIPLES de l'unité, pas des nombres
   * choisis. « Le 4e millier est offert » veut dire : le prix de trois. Écrit
   * en clair (1 092 €), la promesse devient invérifiable et survit au jour où
   * l'unité change.
   */
  for (const [i, t] of OUTBOUND_TIERS.slice(0, 3).entries()) {
    assert.equal(t.calls, (i + 1) * OUTBOUND_UNIT_CALLS);
    assert.equal(t.monthlyHT, (i + 1) * OUTBOUND_UNIT_HT, "les trois premiers paliers sont linéaires");
    assert.equal(t.perThousandHT, OUTBOUND_UNIT_HT);
  }
  const quatre = OUTBOUND_TIERS.find((t) => t.calls === 4 * OUTBOUND_UNIT_CALLS);
  assert.ok(quatre, "le palier de montée en charge doit exister");
  assert.equal(quatre.monthlyHT, 3 * OUTBOUND_UNIT_HT, "le 4e millier est offert = on paie trois milliers");
});

/* ────────────────────────────────────────────────────────────────────
   BUSINESS ET LIFETIME — les deux modèles qui n'existaient pas.
   L'un étale une installation livrée d'avance ; l'autre échange tout le
   revenu futur d'un client contre de l'argent maintenant. Les deux se
   trompent en silence si personne ne compte.
   ──────────────────────────────────────────────────────────────────── */

test("business — le plan encaisse au MOINS le prix affiché", async () => {
  const { PACK_ACOMPTE_HT, PACK_MENSUALITES, PACK_MENSUALITE_HT, PACK_SETUP_HT } = await import(
    "../lib/offres-publiques"
  );
  const o = offreParId("business")!;
  assert.ok(o, "l'offre Business doit exister");
  assert.equal(o.cadence, "echelonne");
  assert.ok(o.plan, "une cadence échelonnée sans plan est un prix sans échéancier");

  const total = o.plan!.acompteHT + o.plan!.mensualites * o.plan!.mensualiteHT;
  assert.ok(
    total >= o.prixHT!,
    `le plan encaisse ${total} € pour un prix affiché de ${o.prixHT} € — c'est une remise déguisée en étalement`
  );
  assert.equal(o.prixHT, PACK_SETUP_HT, "le prix AFFICHÉ reste l'installation, pas la mensualité");
  assert.equal(o.plan!.acompteHT, PACK_ACOMPTE_HT);
  assert.equal(o.plan!.mensualites, PACK_MENSUALITES);
  assert.equal(o.plan!.mensualiteHT, PACK_MENSUALITE_HT);
  assert.ok(o.plan!.abonnementHT > 0, "l'abonnement doit prendre le relais, sinon l'an 2 rapporte zéro");
});

test("⚠ un acompte nul est REFUSÉ : l'installation est livrée avant d'être payée", () => {
  /**
   * On mute la condition au lieu d'asserter la présence du refus. L'exposition
   * est réelle : le paramétrage part en production à la signature, et un
   * client qui s'arrête au quatrième mois laisse une demi-journée de travail
   * contre une fraction du prix.
   */
  const base = offreParId("business")!;
  const sansAcompte = { ...base, plan: { ...base.plan!, acompteHT: 0 } };
  const erreurs = validerOffres([sansAcompte]);
  assert.ok(
    erreurs.some((e) => e.champ === "plan" && /acompte/i.test(e.probleme)),
    "un acompte nul doit être refusé"
  );

  // Et le pendant : l'offre réelle passe. Sans ça, le test dirait juste que
  // « validerOffres refuse quelque chose ».
  assert.deepEqual(validerOffres([base]), [], "l'offre Business telle qu'elle est écrite doit être valide");
});

test("⚠ un plan qui encaisse moins que le prix est REFUSÉ", () => {
  const base = offreParId("business")!;
  const remise = { ...base, plan: { ...base.plan!, mensualites: 2 } };
  const erreurs = validerOffres([remise]);
  assert.ok(
    erreurs.some((e) => e.champ === "plan" && /remise/i.test(e.probleme)),
    "2 500 + 2 × 800 = 4 100 € pour un prix de 10 000 € : ce n'est pas un étalement"
  );
});

test("lifetime — le crédit d'appels est BORNÉ, sinon c'est une dette à vie", async () => {
  const { LIFETIME_APPELS_INCLUS, ALPHA_VOICE_MINUTE_SUP_HT } = await import("../lib/offres-publiques");
  const o = offreParId("lifetime")!;
  assert.equal(o.cadence, "unique", "« payé une fois » doit être un paiement unique, pas un abonnement");
  assert.equal(o.voixIncluse, true);
  assert.equal(o.appelsInclus, LIFETIME_APPELS_INCLUS);
  assert.ok((o.appelsInclus ?? 0) > 0, "un lifetime sans plafond d'appels est une dette ouverte sans terme");
  assert.ok(o.auDela?.includes(ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")), "le dépassement suit la grille");
  /**
   * Le logiciel est à vie parce que son coût marginal est nul ; la
   * consommation ne l'est pas. Si l'un des deux disparaît de la phrase, le
   * client entend « tout est à vie ».
   */
  assert.match(o.auDela!, /à vie/i, "il faut dire ce qui reste à vie ET ce qui ne l'est pas");
});

test("lifetime — les paliers montent, et l'offre FERME", async () => {
  const { LIFETIME_PALIERS, LIFETIME_PLACES_TOTAL, palierLifetime } = await import("../lib/offres-publiques");

  // Les prix montent strictement : un palier qui ne monte pas n'est pas un
  // palier, c'est une remise permanente.
  for (let i = 1; i < LIFETIME_PALIERS.length; i++) {
    assert.ok(
      LIFETIME_PALIERS[i].prixHT > LIFETIME_PALIERS[i - 1].prixHT,
      `palier ${i + 1} : le prix doit monter avec la demande`
    );
  }

  /**
   * ⚠ CES DEUX ASSERTIONS ÉCRIVAIENT « 9 » ET « 10 » EN DUR. Elles sont
   * tombées au repricing du 04/09/2026 (60 places → 20), alors que la règle
   * qu'elles gardent — « la dernière place d'un palier reste à ce palier, la
   * suivante bascule » — n'avait pas bougé d'un pouce. On dérive donc la
   * frontière du tableau : le prochain repricing ne fera plus tomber un test
   * qui n'a rien à dire dessus.
   */
  const derniereDuPremier = LIFETIME_PALIERS[0].places - 1;
  assert.equal(palierLifetime(0)!.prixHT, LIFETIME_PALIERS[0].prixHT, "aucune vente : premier palier");
  assert.equal(palierLifetime(derniereDuPremier)!.rang, 1, "la dernière place du palier 1 est encore au palier 1");
  assert.equal(palierLifetime(derniereDuPremier + 1)!.rang, 2, "la place suivante bascule");
  assert.equal(
    palierLifetime(LIFETIME_PLACES_TOTAL),
    null,
    "tout vendu : il n'y a PLUS de lifetime. Rendre le dernier palier « pour dépanner » ferait mentir la rareté annoncée"
  );

  /**
   * ⚠ Le nombre total existe pour une raison qui n'est pas la rareté :
   * chaque lifetime vendu est un client qui ne paiera plus jamais
   * d'abonnement. Sans plafond, « basé sur la demande » veut dire « jusqu'à
   * ce qu'il n'y ait plus de revenu récurrent à faire ».
   */
  assert.ok(LIFETIME_PLACES_TOTAL > 0 && LIFETIME_PLACES_TOTAL <= 200, "le total doit être borné et réaliste");
});

test("⚠ AUCUNE offre « à vie » ne porte une brique qui nous coûte à chaque usage", async () => {
  /**
   * ⚠ LE TROU TROUVÉ EN REPRIÇANT, ET IL NE RESSEMBLAIT PAS À UN TROU.
   *
   * On avait écrit, au-dessus de `appelsInclus` : « un lifetime sans plafond
   * d'appels est une dette ouverte sans terme ». C'est exact — et pendant ce
   * temps le même lifetime vendait à vie, SANS AUCUN PLAFOND, trois briques
   * qui dépensent notre argent à chaque usage : `campagnes` (notre SMTP,
   * notre domaine, notre réputation), `agent-alpha` et `alpha-live` (nos
   * jetons IA). On avait bordé le compteur visible et laissé courir les trois
   * autres.
   *
   * Rien ne l'aurait signalé : la facture arrive un mois plus tard, et elle
   * n'arrive jamais avec le nom du client qui l'a causée.
   */
  const { BRIQUES_CONSOMMATRICES } = await import("../lib/offres-publiques");
  const aVie = OFFRES.filter((o) => o.cadence === "unique");
  assert.ok(aVie.length >= 1, "sans offre à vie, ce test n'a plus de sujet");
  for (const o of aVie) {
    for (const c of o.capacites) {
      assert.ok(
        !BRIQUES_CONSOMMATRICES.includes(c),
        `« ${o.nom} » vend « ${c} » à vie : cette brique dépense à chaque usage, et le paiement s'arrête au premier jour`
      );
    }
  }
});

test("⚠ le lifetime ne CANNIBALISE pas Business — deux offres, deux périmètres", async () => {
  /**
   * Elles portaient EXACTEMENT les mêmes dix briques : 4 900 € une fois d'un
   * côté, 10 000 € puis 1 000 €/mois de l'autre. Aucun acheteur rationnel ne
   * prend le second, et aucun test ne le voyait — chaque offre était valide
   * séparément, et `validerOffres` ne compare pas les offres entre elles.
   *
   * La règle : si une offre à vie coûte moins cher qu'une offre récurrente,
   * elle doit ouvrir STRICTEMENT MOINS. Sinon la récurrente est morte le jour
   * de sa mise en ligne.
   */
  const lifetime = offreParId("lifetime")!;
  const business = offreParId("business")!;
  assert.ok(lifetime.prixHT! < business.prixHT!, "prémisse : le lifetime est le moins cher des deux");

  const enPlus = lifetime.capacites.filter((c) => !business.capacites.includes(c));
  assert.deepEqual(enPlus, [], "le lifetime ne doit rien ouvrir que Business n'ouvre pas");
  assert.ok(
    lifetime.capacites.length < business.capacites.length,
    `le lifetime ouvre ${lifetime.capacites.length} briques et Business ${business.capacites.length} : ` +
      "à périmètre égal et prix inférieur, Business ne se vend plus jamais"
  );
});

test("⚠ le lifetime coûte moins cher qu'un an et demi d'abonnement — et ça se sait", async () => {
  /**
   * Ce test ne juge pas le prix : il refuse qu'on OUBLIE l'arbitrage. Un
   * lifetime au premier palier doit rester inférieur à ce que le même client
   * paierait en abonnement sur une durée raisonnable — sinon ce n'est pas une
   * offre de lancement, c'est un abonnement payé d'avance, et personne ne le
   * prendra. À l'inverse, s'il descend trop bas, on brade le revenu de
   * plusieurs années.
   */
  const { LIFETIME_PALIERS, OMNICANAL_MENSUEL_HT } = await import("../lib/offres-publiques");
  /**
   * ⚠ L'ANCRE ÉTAIT `ALPHA_VOICE_PALIERS[0]` (149 €/mois), ET ELLE MENTAIT.
   * Le lifetime n'ouvre pas Alpha Voice seul : il ouvre le CRM, le closer, le
   * Cerveau, le pilotage, le suivi, les audits ET la voix. Ce que ce client
   * paierait en abonnement, c'est l'offre omnicanale — 590 €/mois. Mesuré à
   * 149 €, le premier palier valait 33 mois et le test hurlait « ce n'est plus
   * une offre de lancement » ; mesuré à ce qu'il remplace vraiment, il en vaut
   * 8. Le prix n'était pas le problème : le dénominateur l'était.
   */
  const mensuel = OMNICANAL_MENSUEL_HT;
  const moisEquivalents = LIFETIME_PALIERS[0].prixHT / mensuel;
  assert.ok(
    moisEquivalents >= 6,
    `premier palier à ${LIFETIME_PALIERS[0].prixHT} € = ${moisEquivalents.toFixed(1)} mois d'abonnement : on brade`
  );
  assert.ok(
    moisEquivalents <= 24,
    `premier palier = ${moisEquivalents.toFixed(1)} mois d'abonnement : ce n'est plus une offre de lancement`
  );
});
