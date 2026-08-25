import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVIS_DEMANDE_ELEVEE, ENTETE_TERRAIN, SCORE_MIN_TERRAIN, SOURCES_TERRAIN,
  planifierAppels, qualifierTerrain, trierTerrain, type FicheTerrain,
} from "../lib/sourcing-terrain";
import {
  CHAMPS_PLACES, COLONNES_TERRAIN, importerFiches, importerPlaces, parserFiches, placeVersFiche,
} from "../lib/sourcing-terrain-import";
import { ICP_PAR_CANAL, evaluerSurface, recouvrement } from "../lib/icp-canal";
import { buildLadder } from "../lib/ladder";
import { lireTableau, decouper, separateur } from "../lib/tabulaire";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SOURCING TERRAIN — la liste qu'on va COMPOSER.
 *
 * Différence de fond avec le sourcing LinkedIn : ce qui sort d'ici sera
 * décroché par un humain, sur son lieu de travail, pendant sa journée. Une
 * erreur de tri ne coûte pas une invitation — elle coûte un appel importun.
 *
 * Trois choses protégées :
 *  · le NUMÉRO (une fiche sans numéro composable n'a rien à faire dans une
 *    liste d'appels) ;
 *  · le SIGNAL DE DEMANDE (c'est le déclencheur Callflow, pas le métier) ;
 *  · le PLAFOND LÉGAL de sollicitations.
 * ─────────────────────────────────────────────────────────────────────
 */

const fiche = (over: Partial<FicheTerrain> = {}): FicheTerrain => ({
  entreprise: "Carrosserie des Lilas",
  secteur: "carrosserie",
  ville: "Lyon 3e",
  telephone: "04 78 12 34 56",
  avis: "142",
  note: "4,6",
  horaires: "Lun-Ven 8h-18h, fermé samedi dimanche",
  extraitsAvis: "Impossible de les joindre, j'ai appelé trois fois.",
  ...over,
});

// ── LE NUMÉRO ──────────────────────────────────────────────────────────

test("terrain — une fiche sans numéro composable est EXCLUE, pas mal notée", () => {
  /**
   * C'est une liste d'APPELS. Une fiche sans numéro n'est pas un prospect
   * faible : elle est hors sujet. La laisser passer avec un bon score la
   * ferait remonter en tête de file et perdre le temps de l'appelant.
   */
  const sans = qualifierTerrain(fiche({ telephone: "" }));
  assert.equal(sans.retenu, false);
  assert.equal(sans.telephone, null);
  assert.ok(sans.exclusions.some((e) => /liste d'APPELS/.test(e)));
  assert.ok(sans.score >= SCORE_MIN_TERRAIN, "le score reste bon — c'est l'exclusion qui tranche, pas la note");

  const casse = qualifierTerrain(fiche({ telephone: "12" }));
  assert.equal(casse.retenu, false);
  assert.ok(casse.exclusions.some((e) => /inexploitable/.test(e)));
});

test("terrain — le numéro est normalisé en E.164, prêt à composer", () => {
  assert.equal(qualifierTerrain(fiche({ telephone: "04 78 12 34 56" })).telephone, "+33478123456");
  assert.equal(qualifierTerrain(fiche({ telephone: "+33478123456" })).telephone, "+33478123456");
  assert.equal(qualifierTerrain(fiche({ telephone: "0033478123456" })).telephone, null, "on ne devine pas un préfixe international mal formé");
});

// ── LE SIGNAL DE DEMANDE ───────────────────────────────────────────────

test("terrain — la plainte publique d'injoignabilité est le signal le plus fort", () => {
  /**
   * C'est le prospect qui décrit lui-même notre douleur, publiquement, avant
   * qu'on l'appelle. Aucun autre signal n'est aussi direct — et il est gratuit.
   */
  const avec = qualifierTerrain(fiche());
  assert.equal(avec.signaux[0].id, "plainte-injoignable");
  assert.equal(avec.signaux[0].force, "fort");

  /**
   * On mesure le POIDS de chaque signal en le retirant un par un, plutôt que
   * de comparer deux scores bruts : le score est borné à 100, et une fiche qui
   * coche tout y est écrêtée — l'écart y devient plus petit que le poids réel.
   */
  const nu: FicheTerrain = { entreprise: "X", telephone: "0478000000" };
  const poids = (f: Partial<FicheTerrain>) => qualifierTerrain({ ...nu, ...f }).score - qualifierTerrain(nu).score;

  const plainte = poids({ extraitsAvis: "impossible de les joindre" });
  for (const [nom, autre] of [
    ["volume", poids({ avis: "200" })],
    ["verticale", poids({ secteur: "carrosserie" })],
    ["horaires", poids({ horaires: "fermé samedi dimanche" })],
  ] as [string, number][]) {
    assert.ok(plainte > autre, `la plainte (${plainte}) doit peser plus que « ${nom} » (${autre})`);
  }
});

test("terrain — les formulations réelles d'un avis français sont reconnues", () => {
  const cas = [
    "Personne ne décroche jamais.",
    "Toujours sur répondeur.",
    "Injoignable depuis deux semaines.",
    "J'ai appelé plusieurs fois, aucun retour d'appel.",
    "Pas moyen de les avoir au téléphone.",
  ];
  for (const c of cas) {
    const q = qualifierTerrain(fiche({ extraitsAvis: c }));
    assert.ok(q.signaux.some((s) => s.id === "plainte-injoignable"), `non reconnu : « ${c} »`);
  }
});

test("terrain — le mécontentement GÉNÉRAL n'est pas une plainte d'injoignabilité", () => {
  /**
   * La liste est large côté formulations et étroite côté SENS. L'élargir au
   * mécontentement ferait remonter des prospects dont le problème n'est pas le
   * nôtre — et le premier appel se casserait sur un argument hors sujet.
   */
  for (const c of ["Accueil désagréable.", "Trop cher pour ce que c'est.", "Travail bâclé, je déconseille."]) {
    const q = qualifierTerrain(fiche({ extraitsAvis: c }));
    assert.ok(!q.signaux.some((s) => s.id === "plainte-injoignable"), `faux positif sur « ${c} »`);
  }
});

test("terrain — le VOLUME de demande compte, pas la qualité du métier", () => {
  // Une entreprise sans demandes n'a pas notre douleur, quel que soit son
  // métier. C'est le déclencheur de la marche Callflow, pas le secteur.
  const grosse = qualifierTerrain(fiche({ avis: String(AVIS_DEMANDE_ELEVEE + 20), extraitsAvis: "" }));
  const petite = qualifierTerrain(fiche({ avis: "3", extraitsAvis: "" }));
  assert.ok(grosse.score > petite.score);
  assert.ok(grosse.signaux.some((s) => s.id === "volume-eleve"));
  assert.ok(petite.manque.some((m) => /trop petite ou trop récente/.test(m)));
});

test("terrain — une excellente note ne disqualifie pas, elle CADRE l'angle", () => {
  /**
   * Doctrine terrain : « votre 5,0 c'est de l'or — mais il ne parle que des
   * clients qui vous ont EUS au téléphone ». Le cadrage fonctionne surtout
   * chez les excellents ; les écarter serait perdre les meilleurs prospects.
   */
  const q = qualifierTerrain(fiche({ note: "4,9", extraitsAvis: "" }));
  assert.equal(q.retenu, true);
  const s = q.signaux.find((x) => x.id === "bonne-note");
  assert.ok(s, "une bonne note doit produire un signal exploitable");
  assert.match(s!.fait, /qui les ont EUS au téléphone/);
});

test("terrain — un trou horaire est une perte PAR CONSTRUCTION", () => {
  const weekend = qualifierTerrain(fiche({ horaires: "Lun-Ven 9h-18h, fermé samedi dimanche" }));
  assert.ok(weekend.signaux.some((s) => s.id === "trou-horaire"));
  const midi = qualifierTerrain(fiche({ horaires: "9h00-12h00 14h00-18h00" }));
  assert.ok(midi.signaux.some((s) => s.id === "trou-horaire"));
  assert.ok(qualifierTerrain(fiche({ horaires: "" })).manque.some((m) => /horaires/.test(m)));
});

// ── LES EXCLUSIONS SÈCHES ──────────────────────────────────────────────

test("terrain — une enseigne nationale est écartée même parfaitement qualifiée", () => {
  /**
   * On ne vend pas un accueil téléphonique à une succursale : la décision ne
   * s'y prend pas et le téléphone est déjà mutualisé. L'appel est perdu
   * d'avance, quel que soit le score.
   */
  const q = qualifierTerrain(fiche({ entreprise: "Norauto Vaise", avis: "900" }));
  assert.equal(q.retenu, false);
  assert.ok(q.exclusions.some((e) => /enseigne nationale/.test(e)));
});

test("terrain — qui a déjà un standard n'a plus notre problème", () => {
  const q = qualifierTerrain(fiche({ extraitsAvis: "Leur secrétariat externalisé répond très bien." }));
  assert.equal(q.retenu, false);
  assert.ok(q.exclusions.some((e) => /standard|secr[ée]tariat/.test(e)));
});

// ── LE LOT ─────────────────────────────────────────────────────────────

test("terrain — le lot dit combien sont appelables ET par quoi commencer", () => {
  /**
   * Importer 1 000 lignes ne veut rien dire. Savoir que 2 portent une plainte
   * publique, si : celles-là se traitent en premier, parce que l'ouverture est
   * déjà écrite par leur propre client.
   */
  const lot = trierTerrain([
    fiche(),
    fiche({ entreprise: "Plomberie Durand", telephone: "06 12 34 56 78", avis: "12", extraitsAvis: "" }),
    fiche({ entreprise: "Norauto", avis: "900" }),
  ]);
  assert.equal(lot.retenus.length + lot.ecartes.length, 3);
  assert.ok(lot.resume.some((r) => /À APPELER EN PREMIER/.test(r)));
  for (let i = 1; i < lot.retenus.length; i++) {
    assert.ok(lot.retenus[i - 1].ciblage.score >= lot.retenus[i].ciblage.score, "la file doit être ordonnée");
  }
});

test("terrain — le compteur « sans numéro » ne lit pas de la prose", () => {
  /**
   * Première version : le résumé cherchait « téléphone » dans le TEXTE des
   * exclusions, et attrapait au passage « enseigne nationale : le téléphone
   * est mutualisé ». Il annonçait deux numéros manquants pour un seul.
   * Compter des faits en lisant des phrases finit toujours comme ça.
   */
  const lot = trierTerrain([
    fiche({ entreprise: "Norauto", avis: "900" }), // exclue, mais numéro VALIDE
    fiche({ entreprise: "Sans Tel", telephone: "" }), // seule vraie manquante
  ]);
  const ligne = lot.resume.find((r) => /sans num[ée]ro exploitable/.test(r));
  assert.ok(ligne, "le résumé doit signaler les numéros manquants");
  assert.match(ligne!, /^1 /, `compté faux : « ${ligne} »`);
});

// ── L'IMPORT ───────────────────────────────────────────────────────────

test("import terrain — le lecteur de tableaux est MUTUALISÉ, pas recopié", () => {
  /**
   * Deux lecteurs recopiés divergent au premier bug corrigé d'un seul côté —
   * et les guillemets, les séparateurs et le JSONL sont précisément les
   * endroits où on se trompe.
   */
  const src = readFileSync(join(process.cwd(), "lib/sourcing-terrain-import.ts"), "utf8");
  assert.match(src, /from "\.\/tabulaire"/);
  assert.doesNotMatch(src, /function decouper|dansGuillemets/, "le découpage a été recopié au lieu d'être importé");

  const li = readFileSync(join(process.cwd(), "lib/linkedin-import.ts"), "utf8");
  assert.match(li, /from "\.\/tabulaire"/, "le sourcing LinkedIn doit utiliser le même lecteur");
});

test("import terrain — les colonnes d'annuaire courantes sont reconnues", () => {
  // Chaque source nomme ses colonnes autrement. Une colonne non reconnue est
  // SIGNALÉE, jamais rattachée au champ qui lui ressemble le plus.
  const r = parserFiches("name;category;phone;reviews;rating\nGarage X;garage;0478000000;120;4,5");
  assert.equal(r.fiches.length, 1);
  assert.equal(r.fiches[0].entreprise, "Garage X");
  assert.equal(r.fiches[0].telephone, "0478000000");
  assert.equal(r.fiches[0].avis, "120");

  const inconnue = parserFiches("entreprise;lubie\nX;z");
  assert.ok(inconnue.avertissements.some((a) => /lubie/.test(a)));
});

test("import terrain — les signaux atterrissent dans deepAudit, pas dans les notes", () => {
  /**
   * C'est là que `buildLadder` va les chercher pour déclencher la marche
   * Callflow. Les ranger ailleurs reviendrait à faire le travail deux fois —
   * et l'escalier resterait muet sur une fiche qui coche tout.
   */
  const r = importerFiches(`${ENTETE_TERRAIN}\nCarrosserie des Lilas;carrosserie;Lyon 3e;0478123456;;142;4,6;;"impossible de les joindre"`);
  assert.equal(r.retenus.length, 1);
  const p = r.retenus[0].prospect;
  assert.equal(p.deepAudit.googleReviews, 142);
  assert.ok((p.deepAudit.missedCallsPerWeek ?? 0) > 0, "une plainte doit alimenter le déclencheur de l'escalier");

  const escalier = buildLadder(p);
  assert.ok(escalier.rungs.some((x) => x.id === "callflow"), "l'escalier doit déclencher Callflow sur cette fiche");
});

test("import terrain — sans plainte, AUCUN nombre d'appels manqués n'est inventé", () => {
  /**
   * Doctrine : tout chiffre € est diagnostique, jamais audité. Un nombre
   * d'appels manqués inventé gonflerait la Taxe d'Ignorance affichée, et le
   * premier prospect qui demande d'où il sort n'aurait pas de réponse.
   */
  const r = importerFiches(`${ENTETE_TERRAIN}\nGarage Y;garage;Lyon 8e;0478000002;;120;4,5;;`);
  assert.equal(r.retenus.length, 1);
  assert.equal(r.retenus[0].prospect.deepAudit.missedCallsPerWeek, undefined);
});

test("import terrain — l'identifiant est le NUMÉRO : réimporter n'appelle pas deux fois", () => {
  // Deux fiches au même numéro sont le même standard, donc le même appel.
  const ligne = `${ENTETE_TERRAIN}\nCarrosserie;carrosserie;Lyon;04 78 12 34 56;;142;4,6;;"injoignable"`;
  const a = importerFiches(ligne).retenus[0].prospect.id;
  const b = importerFiches(ligne.replace("Carrosserie;", "Carrosserie SARL;")).retenus[0].prospect.id;
  assert.equal(a, b, "le même numéro doit donner la même fiche, même sous un autre nom");
  assert.ok(a.startsWith("tr-"), "l'origine doit rester lisible dans l'identifiant");
});

test("import terrain — une fiche entrée par ce canal reste au DÉBUT du pipeline", () => {
  const r = importerFiches(`${ENTETE_TERRAIN}\nX;garage;Lyon;0478000003;;120;4,5;;"injoignable"`);
  assert.equal(r.retenus[0].prospect.stage, "prospect");
  assert.equal(r.retenus[0].prospect.preferredChannel, "tel");
  assert.ok(r.retenus[0].prospect.tags.includes("terrain"));
});

test("import terrain — le module ne collecte RIEN", () => {
  for (const f of ["lib/sourcing-terrain.ts", "lib/sourcing-terrain-import.ts"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const re of [/\bfetch\s*\(/, /puppeteer|playwright/, /axios|got\(/]) {
      assert.doesNotMatch(src, re, `${f} effectue une collecte (${re})`);
    }
  }
});

// ── LE PLAN D'APPELS ───────────────────────────────────────────────────

test("plan d'appels — au-delà de 4 sollicitations, l'alerte juridique tombe", () => {
  /**
   * Le décret n° 2022-1313 plafonne le démarchage à 4 sollicitations par
   * consommateur sur 30 jours glissants. Il vise le B2C — mais un artisan en
   * nom propre sur sa ligne perso est exactement la zone grise, et c'est nous
   * qui portons le risque sur une liste mêlée.
   *
   * ⚠ La cadence Callflow exigée par ScintIA est de CINQ rappels sur deux
   * jours. Sur une cible qui bascule en B2C, elle est hors des clous.
   */
  assert.ok(planifierAppels(1000, 5).alertes.some((a) => /4 sollicitations/.test(a)));
  assert.deepEqual(planifierAppels(1000, 4).alertes, [], "4 tentatives ne déclenche aucune alerte");
});

test("plan d'appels — on arrête d'appeler ceux qui ont décroché", () => {
  const p = planifierAppels(1000, 4, 0.2);
  assert.equal(p.tours[0].composes, 1000);
  for (let i = 1; i < p.tours.length; i++) {
    assert.ok(p.tours[i].composes < p.tours[i - 1].composes, "le tour suivant doit être plus court");
  }
  assert.equal(p.joints + p.jamaisJoints, 1000);
  assert.ok(p.tentatives > 1000 && p.tentatives < 4000);
});

test("plan d'appels — un taux absurde ne produit pas un plan absurde", () => {
  assert.equal(planifierAppels(100, 4, 5).joints, 100);
  assert.equal(planifierAppels(100, 4, -1).joints, 0);
  assert.deepEqual(planifierAppels(0, 4).tours, []);
});

test("sources terrain — seule Google Maps donne le signal fort, et c'est dit", () => {
  // Le tri repose sur les extraits d'avis. Une source qui n'en fournit pas
  // produit des fiches qu'on ne saura pas prioriser.
  const avecAvis = SOURCES_TERRAIN.filter((s) => s.avisDisponibles);
  assert.equal(avecAvis.length, 1, "si une deuxième source donne les avis, mettre à jour la doctrine");
  assert.match(avecAvis[0].nom, /Google/);
});

// ── LES DEUX ICP ───────────────────────────────────────────────────────

test("ICP — ceux qu'on appelle ne sont PAS ceux qui lisent", () => {
  /**
   * La confusion coûte deux fois : on écrit pour des artisans sur LinkedIn où
   * ils ne sont pas, et on croit que le contenu a « réchauffé » des gens qu'il
   * n'a jamais touchés.
   */
  const [contenu, appel] = ICP_PAR_CANAL;
  assert.match(contenu.hors, /artisans|garagistes/i, "l'ICP contenu doit dire qui il n'atteint pas");
  assert.ok(appel.verticales.some((v) => /Artisans/.test(v)), "l'ICP appel doit couvrir les artisans");
  assert.ok(!contenu.verticales.some((v) => /Artisans/.test(v)), "l'ICP contenu ne doit PAS les couvrir");

  const r = recouvrement();
  assert.ok(r.communes.length < Math.min(contenu.verticales.length, appel.verticales.length), "un recouvrement total voudrait dire qu'on s'est trompé quelque part");
});

test("surface de preuve — un site absent est BLOQUANT, pas « à améliorer »", () => {
  /**
   * Le gérant appelé mardi tape notre nom mercredi matin. S'il ne trouve rien,
   * il ne rappelle pas — et personne chez nous ne saura jamais pourquoi.
   */
  const s = evaluerSurface({ siteEnLigne: false, legalPublie: true });
  assert.match(s.verdict, /BLOQUANT/);
  assert.equal(s.manquants[0].priorite, "bloquant");

  const ok = evaluerSurface({
    siteEnLigne: true, legalPublie: true, visageVisible: true, pageLinkedin: true,
    publications30j: 6, ficheGoogle: true, etudesDeCas: 1,
  });
  assert.deepEqual(ok.manquants, []);
  assert.match(ok.verdict, /complète/);
});

test("surface de preuve — l'étude de cas manque, et c'est la seule qui ne se fabrique pas", () => {
  // Zéro client signé = zéro étude de cas disponible. En inventer une
  // fabriquerait une preuve fausse : c'est le même interdit que la vitrine.
  const s = evaluerSurface({ siteEnLigne: true, legalPublie: true, etudesDeCas: 0 });
  const cas = s.manquants.find((m) => m.id === "cas");
  assert.ok(cas);
  assert.match(cas!.pourquoi, /ne se fabrique pas/);
});

// ── LE LECTEUR MUTUALISÉ ───────────────────────────────────────────────

test("tabulaire — les guillemets protègent le séparateur", () => {
  const r = lireTableau<{ a?: string; b?: string }>('a;b\n"x; y";z', { a: "a", b: "b" });
  assert.equal(r.entrees[0].a, "x; y");
  assert.equal(r.entrees[0].b, "z");
  assert.deepEqual(decouper('"il a dit ""non""";suite', ";"), ['il a dit "non"', "suite"]);
});

test("tabulaire — le séparateur se déduit de l'en-tête", () => {
  assert.equal(separateur("a\tb\tc"), "\t");
  assert.equal(separateur("a;b;c"), ";");
  assert.equal(separateur("a,b,c"), ",");
});

test("tabulaire — le JSONL passe là où JSON.parse échoue", () => {
  const r = lireTableau<{ a?: string }>('{"a":"1"}\n{"a":"2"}', { a: "a" });
  assert.equal(r.entrees.length, 2);
  assert.equal(r.format, "json");
});

test("tabulaire — un en-tête illisible le DIT au lieu de rendre un lot vide", () => {
  // « 0 fiche importée » sans raison fait conclure que la source est mauvaise,
  // alors que c'est le nom d'une colonne qui ne correspond pas.
  const r = parserFiches("colonne1;colonne2\na;b");
  assert.deepEqual(r.fiches, []);
  assert.match(r.rejets[0].raison, /aucune colonne reconnue/);
  assert.ok(COLONNES_TERRAIN.includes("telephone"));
});

// ── L'API PLACES ───────────────────────────────────────────────────────

test("places — la réponse imbriquée de l'API devient une fiche exploitable", () => {
  /**
   * Le lecteur générique mappe des colonnes PLATES. Places est imbriqué
   * (`displayName.text`, `reviews[].text.text`) : il lui faut son propre
   * adaptateur, sinon on bricole des chemins pointés dans un lecteur partagé
   * par tous les autres usages.
   */
  const f = placeVersFiche({
    displayName: { text: "Carrosserie des Lilas" },
    primaryTypeDisplayName: { text: "Atelier de carrosserie" },
    shortFormattedAddress: "12 rue Baraban, 69003 Lyon",
    nationalPhoneNumber: "04 78 12 34 56",
    rating: 4.6,
    userRatingCount: 142,
    regularOpeningHours: { weekdayDescriptions: ["lundi: 08:00–12:00, 14:00–18:00"] },
    reviews: [{ text: { text: "Travail nickel." } }],
  });
  assert.equal(f.entreprise, "Carrosserie des Lilas");
  assert.equal(f.ville, "Lyon", "la ville se lit après le code postal");
  assert.equal(f.telephone, "04 78 12 34 56");
  assert.equal(f.avis, "142");
  assert.equal(f.note, "4.6");
});

test("places — TOUS les avis sont lus, pas seulement le premier", () => {
  /**
   * L'API en rend jusqu'à cinq. La plainte d'injoignabilité peut être dans le
   * quatrième — n'en garder qu'un ferait manquer le signal le plus fort sur
   * une bonne partie du lot, silencieusement.
   */
  const f = placeVersFiche({
    displayName: { text: "X" },
    nationalPhoneNumber: "0478000000",
    reviews: [
      { text: { text: "Très bon accueil." } },
      { text: { text: "Prix corrects." } },
      { text: { text: "Impossible de les joindre au téléphone." } },
    ],
  });
  assert.match(f.extraitsAvis ?? "", /Impossible de les joindre/);
  assert.ok(qualifierTerrain(f).signaux.some((s) => s.id === "plainte-injoignable"));
});

test("places — « pas de site » et « champ non demandé » ne sont pas la même chose", () => {
  // Le premier est un signal (marche visibilité de l'escalier), le second est
  // une lacune de la requête. Les confondre inventerait un signal.
  assert.equal(placeVersFiche({ displayName: { text: "X" }, websiteUri: "" }).siteWeb, "");
  assert.equal(placeVersFiche({ displayName: { text: "X" } }).siteWeb, undefined);
});

test("places — la réponse complète comme le tableau nu sont acceptés", () => {
  const place = { displayName: { text: "X" }, nationalPhoneNumber: "0478000000", userRatingCount: 100, reviews: [{ text: { text: "injoignable" } }] };
  assert.equal(importerPlaces(JSON.stringify({ places: [place] })).retenus.length, 1);
  assert.equal(importerPlaces(JSON.stringify([place])).retenus.length, 1, "concaténer plusieurs pages à la main donne un tableau nu");
  assert.equal(importerPlaces("pas du json").resume[0].includes("JSON invalide"), true);
});

test("places — un masque sans « reviews » est SIGNALÉ, pas subi", () => {
  /**
   * Places facture au champ demandé. Oublier `reviews` fait économiser
   * quelques euros et perd le seul signal qui pèse plus que tous les autres —
   * et rien ne le dirait sans ce message.
   */
  const sansAvis = importerPlaces(JSON.stringify({ places: [{ displayName: { text: "X" }, nationalPhoneNumber: "0478000000", userRatingCount: 200 }] }));
  assert.ok(sansAvis.resume.some((r) => /masque de champs/.test(r)));
  assert.match(CHAMPS_PLACES, /places\.reviews/, "le masque fourni doit demander les avis");
});

test("places — aucun appel réseau : l'adaptateur reçoit du texte", () => {
  // Même doctrine que partout : la collecte reste dehors, remplaçable. Ici
  // c'est aussi ce qui garantit qu'aucune clé Google ne transite par l'app.
  const src = readFileSync(join(process.cwd(), "lib/sourcing-terrain-import.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /\bfetch\s*\(|places\.googleapis\.com|X-Goog-Api-Key/i);
});
