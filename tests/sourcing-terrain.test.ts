import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { projeterImport } from "../lib/storage-health";
import {
  AVIS_DEMANDE_ELEVEE, ENTETE_TERRAIN, SCORE_MIN_TERRAIN, SOURCES_TERRAIN,
  planifierAppels, qualifierTerrain, trierTerrain, type FicheTerrain,
} from "../lib/sourcing-terrain";
import {
  CHAMPS_PLACES, COLONNES_TERRAIN, importerFiches, importerPlaces, parserFiches, placeVersFiche,
  ressembleAuTerrain,
} from "../lib/sourcing-terrain-import";
import { ICP_PAR_CANAL, evaluerSurface, recouvrement } from "../lib/icp-canal";
import { buildLadder } from "../lib/ladder";
import { verticalForProspect } from "../lib/playbook";
import { lireTableau, decouper, separateur } from "../lib/tabulaire";
import {
  BASCULE_NAF_2025, ECRIT_SANS_DEMANDER, apparier, metierDepuisNaf, nafPourVerticale,
  nomenclaturePerimee, normaliserNom,
} from "../lib/registre-entreprises";

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
 *  · le SIGNAL DE DEMANDE (c'est le déclencheur Alpha Voice, pas le métier) ;
 *  · le PLAFOND LÉGAL de sollicitations.
 * ─────────────────────────────────────────────────────────────────────
 */

const fiche = (over: Partial<FicheTerrain> = {}): FicheTerrain => ({
  entreprise: "Carrosserie des Lilas",
  secteur: "carrosserie",
  ville: "Lyon 3e",
  telephone: "04 65 71 34 56",
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
  assert.equal(qualifierTerrain(fiche({ telephone: "04 65 71 34 56" })).telephone, "+33465713456");
  assert.equal(qualifierTerrain(fiche({ telephone: "+33465713456" })).telephone, "+33465713456");
  assert.equal(qualifierTerrain(fiche({ telephone: "0035301123456" })).telephone, null, "on ne devine pas un préfixe international mal formé");
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
  const nu: FicheTerrain = { entreprise: "X", telephone: "0465710000" };
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
  // métier. C'est le déclencheur de la marche Alpha Voice, pas le secteur.
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
    fiche({ entreprise: "Plomberie Durand", telephone: "06 39 98 56 78", avis: "12", extraitsAvis: "" }),
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
  const r = parserFiches("name;category;phone;reviews;rating\nGarage X;garage;0465710000;120;4,5");
  assert.equal(r.fiches.length, 1);
  assert.equal(r.fiches[0].entreprise, "Garage X");
  assert.equal(r.fiches[0].telephone, "0465710000");
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
  const r = importerFiches(`${ENTETE_TERRAIN}\nCarrosserie des Lilas;carrosserie;Lyon 3e;0465713456;;142;4,6;;"impossible de les joindre"`);
  assert.equal(r.retenus.length, 1);
  const p = r.retenus[0].prospect;
  assert.equal(p.deepAudit.googleReviews, 142);
  assert.ok((p.deepAudit.missedCallsPerWeek ?? 0) > 0, "une plainte doit alimenter le déclencheur de l'escalier");

  const escalier = buildLadder(p);
  assert.ok(escalier.rungs.some((x) => x.id === "alpha-voice"), "l'escalier doit déclencher Alpha Voice sur cette fiche");
});

test("import terrain — sans plainte, AUCUN nombre d'appels manqués n'est inventé", () => {
  /**
   * Doctrine : tout chiffre € est diagnostique, jamais audité. Un nombre
   * d'appels manqués inventé gonflerait la Taxe d'Ignorance affichée, et le
   * premier prospect qui demande d'où il sort n'aurait pas de réponse.
   */
  const r = importerFiches(`${ENTETE_TERRAIN}\nGarage Y;garage;Lyon 8e;0465710002;;120;4,5;;`);
  assert.equal(r.retenus.length, 1);
  assert.equal(r.retenus[0].prospect.deepAudit.missedCallsPerWeek, undefined);
});

test("import terrain — l'identifiant est le NUMÉRO : réimporter n'appelle pas deux fois", () => {
  // Deux fiches au même numéro sont le même standard, donc le même appel.
  const ligne = `${ENTETE_TERRAIN}\nCarrosserie;carrosserie;Lyon;04 65 71 34 56;;142;4,6;;"injoignable"`;
  const a = importerFiches(ligne).retenus[0].prospect.id;
  const b = importerFiches(ligne.replace("Carrosserie;", "Carrosserie SARL;")).retenus[0].prospect.id;
  assert.equal(a, b, "le même numéro doit donner la même fiche, même sous un autre nom");
  assert.ok(a.startsWith("tr-"), "l'origine doit rester lisible dans l'identifiant");
});

test("import terrain — une fiche entrée par ce canal reste au DÉBUT du pipeline", () => {
  const r = importerFiches(`${ENTETE_TERRAIN}\nX;garage;Lyon;0465710003;;120;4,5;;"injoignable"`);
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
   * ⚠ La cadence imposée par le revendeur disparu était de CINQ rappels sur
   * deux jours — hors des clous dès qu'une cible bascule en B2C. Descendue à
   * 3 le 02/09/2026, elle tient désormais dans les quatre. Ce test garde le
   * SEUIL, pas la cadence : il doit continuer d'alerter à 5.
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
    nationalPhoneNumber: "04 65 71 34 56",
    rating: 4.6,
    userRatingCount: 142,
    regularOpeningHours: { weekdayDescriptions: ["lundi: 08:00–12:00, 14:00–18:00"] },
    reviews: [{ text: { text: "Travail nickel." } }],
  });
  assert.equal(f.entreprise, "Carrosserie des Lilas");
  assert.equal(f.ville, "Lyon", "la ville se lit après le code postal");
  assert.equal(f.telephone, "04 65 71 34 56");
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
    nationalPhoneNumber: "0465710000",
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
  const place = { displayName: { text: "X" }, nationalPhoneNumber: "0465710000", userRatingCount: 100, reviews: [{ text: { text: "injoignable" } }] };
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
  const sansAvis = importerPlaces(JSON.stringify({ places: [{ displayName: { text: "X" }, nationalPhoneNumber: "0465710000", userRatingCount: 200 }] }));
  assert.ok(sansAvis.resume.some((r) => /masque de champs/.test(r)));
  assert.match(CHAMPS_PLACES, /places\.reviews/, "le masque fourni doit demander les avis");
});

test("places — aucun appel réseau : l'adaptateur reçoit du texte", () => {
  // Même doctrine que partout : la collecte reste dehors, remplaçable. Ici
  // c'est aussi ce qui garantit qu'aucune clé Google ne transite par l'app.
  const src = readFileSync(join(process.cwd(), "lib/sourcing-terrain-import.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /\bfetch\s*\(|places\.googleapis\.com|X-Goog-Api-Key/i);
});

test("modules — aucun module de cette passe n'est du code MORT", () => {
  /**
   * `lib/icp-canal.ts` a existé un jour entier importé UNIQUEMENT par ses
   * propres tests : 100 % couvert, et inatteignable depuis l'app. Des tests
   * verts sur du code que personne n'appelle donnent la sensation d'avoir
   * livré sans avoir livré — c'est le pire des deux mondes, parce que le
   * tableau de bord est au vert.
   *
   * Ce test balaie les modules livrés récemment et exige qu'au moins un
   * fichier NON-test les importe.
   */
  const modules = [
    "icp-canal", "sourcing-terrain", "sourcing-terrain-import",
    "tabulaire", "sync-prospects", "references", "linkedin-plan", "linkedin-ciblage",
  ];
  const racine = process.cwd();
  const sources: string[] = [];
  const visiter = (rel: string) => {
    for (const e of readdirSync(join(racine, rel), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const chemin = join(rel, e.name);
      if (e.isDirectory()) visiter(chemin);
      else if (/\.(ts|tsx)$/.test(e.name)) sources.push(chemin);
    }
  };
  for (const d of ["lib", "app", "components"]) visiter(d);

  for (const m of modules) {
    const importeurs = sources.filter(
      (f) => f !== join("lib", `${m}.ts`) && new RegExp(`from "(@/lib|\\.)/${m}"`).test(readFileSync(join(racine, f), "utf8"))
    );
    assert.ok(importeurs.length > 0, `lib/${m}.ts n'est importé par aucun fichier de l'app — c'est du code mort`);
  }
});

// ── LE CROISEMENT AVEC LE REGISTRE ─────────────────────────────────────

test("registre — le code APE PRIME sur l'enseigne", () => {
  /**
   * `verticalForText` devine à partir des mots : « Carrosserie des Lilas » →
   * garage. Ça marche souvent et ça se trompe EN SILENCE sur une enseigne
   * opaque. Le code APE, lui, est attribué : il ne se devine pas, il se lit.
   */
  const opaque: FicheTerrain = {
    entreprise: "Les Ateliers du Rhône",
    telephone: "0465710000",
    avis: "120",
    adresse: "69003 Lyon",
    extraitsAvis: "injoignable",
  };
  assert.equal(qualifierTerrain(opaque).verticaleId, null, "l'enseigne seule ne dit rien du métier");

  const avecNaf = qualifierTerrain({ ...opaque, naf: "4391B" }); // travaux de couverture
  assert.equal(avecNaf.verticaleId, "artisan-batiment");
  assert.ok(avecNaf.score > qualifierTerrain(opaque).score, "un métier confirmé vaut plus qu'un métier deviné");
  const s = avecNaf.signaux.find((x) => x.id === "verticale");
  assert.equal(s?.force, "fort");
  assert.match(s?.label ?? "", /confirmée au registre/);
});

test("registre — un code hors de nos verticales le DIT au lieu de se taire", () => {
  // Ce n'est pas un échec de lecture, c'est un métier qu'on ne sait pas
  // servir. Le dire évite de recroiser la même fiche le mois prochain.
  const q = qualifierTerrain({ entreprise: "X", telephone: "0465710000", naf: "6201Z" }); // programmation
  assert.ok(q.manque.some((m) => /hors de nos verticales/.test(m)));
  assert.equal(q.verticaleId, null);
});

test("registre — le code se normalise quelle que soit sa forme", () => {
  for (const brut of ["4520A", "45.20A", "45.20 a", "45-20-A"]) {
    assert.equal(metierDepuisNaf(brut).naf, "45.20A", `mal normalisé : « ${brut} »`);
  }
  assert.equal(metierDepuisNaf("").naf, "");
  assert.equal(metierDepuisNaf("45").naf, "", "un code tronqué ne se complète pas au hasard");
});

test("registre — 86.90A est l'ambulance, pas « autres activités de santé »", () => {
  /**
   * 86.90 couvre les ambulances ET les laboratoires ET les infirmiers.
   * Élargir le préfixe enverrait le script « ambulance » à un laboratoire
   * d'analyses — un contresens dit avec assurance.
   */
  assert.equal(metierDepuisNaf("8690A").verticale, "ambulance");
  assert.equal(metierDepuisNaf("8690B").verticale, "sante-cabinet");
});

test("registre — la normalisation d'un nom retire la forme juridique", () => {
  // Une carte affiche « Carrosserie des Lilas », le registre
  // « CARROSSERIE DES LILAS SARL ». Comparer brut fait échouer un appariement
  // évident, et renvoie la fiche à la qualification manuelle.
  assert.equal(normaliserNom("CARROSSERIE DES LILAS SARL"), normaliserNom("Carrosserie des Lilas"));
  assert.equal(normaliserNom("Ets Bernard & Fils SAS"), "bernard fils");
});

test("registre — un appariement net est SÛR, et il est motivé", () => {
  const a = apparier(
    { entreprise: "Carrosserie des Lilas", adresse: "12 rue Baraban, 69003 Lyon" },
    [{ nom: "CARROSSERIE DES LILAS SARL", siren: "123456789", naf: "45.20A", codePostal: "69003" }]
  );
  assert.equal(a.confiance, "sure");
  assert.equal(a.candidat?.siren, "123456789");
  assert.ok(a.pourquoi.length >= 2, "un appariement doit dire CE QUI l'a fait pencher");
  assert.deepEqual(a.reserves, []);
});

test("registre — deux candidats plausibles : on NE TRANCHE PAS", () => {
  /**
   * Le risque de cet appariement n'est pas de rater, c'est de SE TROMPER.
   * Rater coûte une minute de qualification manuelle. Se tromper colle un
   * SIREN et un métier officiel FAUX sur une fiche — avec l'autorité de
   * l'officiel, donc plus personne ne le remet en cause.
   */
  const a = apparier(
    { entreprise: "Garage Martin", adresse: "69003 Lyon" },
    [
      { nom: "GARAGE MARTIN", siren: "111111111", codePostal: "69003" },
      { nom: "GARAGE MARTIN", siren: "222222222", codePostal: "69003" },
    ]
  );
  assert.equal(a.candidat, null, "aucun SIREN ne doit être choisi au hasard");
  assert.equal(a.confiance, "douteuse");
  assert.ok(a.reserves.some((r) => /également plausibles/.test(r)));
});

test("registre — sans code postal, rien n'est jamais « sûr »", () => {
  const a = apparier({ entreprise: "Carrosserie des Lilas" }, [
    { nom: "CARROSSERIE DES LILAS", siren: "1", codePostal: "75001" },
  ]);
  assert.notEqual(a.confiance, "sure");
  assert.ok(a.reserves.some((r) => /code postal/.test(r)));
  assert.deepEqual(ECRIT_SANS_DEMANDER, ["sure"], "seul un appariement sûr écrit sans demander");
});

test("registre — un candidat sans rapport n'est pas apparié de force", () => {
  const a = apparier({ entreprise: "Carrosserie des Lilas", adresse: "69003 Lyon" }, [
    { nom: "BOULANGERIE DUPONT", siren: "9", codePostal: "13001" },
  ]);
  assert.equal(a.candidat, null);
  assert.equal(a.confiance, "aucune");
});

test("registre — la table NAF a une DATE DE PÉREMPTION, et elle est connue", () => {
  /**
   * La NAF 2025 (décret n° 2025-736) devient la référence au 1er janvier 2027 :
   * ~3 % des entreprises changent de code. Sans cette alerte, la table se
   * mettrait à rendre « métier inconnu » sur une partie du fichier — et un
   * métier non reconnu est un cas NORMAL du tri, donc rien ne le signalerait.
   */
  assert.equal(BASCULE_NAF_2025, "2027-01-01");
  assert.equal(nomenclaturePerimee(new Date("2026-12-31")), false);
  assert.equal(nomenclaturePerimee(new Date("2027-01-01")), true);

  const lot = trierTerrain([{ entreprise: "X", telephone: "0465710000", avis: "120", naf: "4520A", extraitsAvis: "injoignable" }]);
  assert.ok(!lot.resume.some((r) => /NAF 2025/.test(r)), "avant la bascule, aucune alerte");
});

test("registre — cibler un métier ENTIER, pas une enseigne", () => {
  // C'est l'intérêt du croisement : viser tous les couvreurs d'un
  // département au lieu d'espérer que l'enseigne dise le métier.
  const codes = nafPourVerticale("garage-carrosserie");
  assert.ok(codes.includes("45.20"));
  assert.ok(codes.length >= 3);
  assert.deepEqual(nafPourVerticale("metier-inexistant"), []);
});

test("registre — le module ne collecte RIEN, comme le reste du sourcing", () => {
  // Un import de 1 000 fiches ne doit pas déclencher 1 000 requêtes depuis le
  // navigateur de l'opérateur.
  const src = readFileSync(join(process.cwd(), "lib/registre-entreprises.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /\bfetch\s*\(/);
});

// ── LE FLUX RÉEL : CARTE → GOOGLE SHEET → ALPHA ────────────────────────

test("feuille — un relevé terrain est reconnu comme tel", () => {
  /**
   * Le flux réel est : relevé sur une carte → Google Sheet → import. Or
   * l'import de feuille passait par `csvToProspects`, générique, qui IGNORE
   * les colonnes portant tout le tri. Les fiches entraient et la plainte
   * d'injoignabilité, la verticale confirmée et le plan d'appels ne sortaient
   * jamais — pendant que l'écran annonçait « ✓ 200 nouveaux ».
   */
  assert.equal(ressembleAuTerrain(ENTETE_TERRAIN), true);
  assert.equal(ressembleAuTerrain("name;phone;reviews;rating;hours"), true, "un export d'outil doit passer aussi");
  assert.equal(ressembleAuTerrain("entreprise;telephone;naf;avis"), true);
});

test("feuille — un import CRM ordinaire n'est PAS routé vers le tri terrain", () => {
  /**
   * Le seuil est DEUX marqueurs, pas un. Router à tort un import CRM vers le
   * terrain ferait EXCLURE toutes les fiches sans téléphone — c'est-à-dire
   * l'inverse du service rendu, et sur le chemin d'import le plus utilisé.
   */
  assert.equal(ressembleAuTerrain("company;name;email;stage;monthlyValue"), false);
  assert.equal(ressembleAuTerrain("company;name;note"), false, "« note » seul ne suffit pas");
  assert.equal(ressembleAuTerrain(""), false);
  assert.equal(ressembleAuTerrain('{"places":[]}'), false, "du JSON n'est pas une feuille");
});

test("feuille — le tri terrain survit au passage par le Sheet", () => {
  // Bout en bout : ce qu'un relevé Maps collé dans une feuille produit
  // réellement une fois importé.
  const csv =
    `${ENTETE_TERRAIN}\n` +
    `Les Ateliers du Rhône;;Lyon 3e;04 65 71 00 01;;140;4,6;fermé samedi dimanche;"impossible de les joindre";4391B;123456789`;
  assert.equal(ressembleAuTerrain(csv), true);
  const r = importerFiches(csv);
  assert.equal(r.retenus.length, 1);
  assert.equal(r.retenus[0].ciblage.verticaleId, "artisan-batiment", "le code APE doit survivre à l'import");
  assert.ok(r.retenus[0].ciblage.signaux.some((s) => s.id === "plainte-injoignable"));
});

// ── LE FLUX DE BOUT EN BOUT ────────────────────────────────────────────

test("flux — une fiche terrain arrive dans SA file d'appels, pas dans « generique »", () => {
  /**
   * ⚠ LE MAILLON QUI MANQUAIT, ET QUI CASSAIT LE FLUX EN SILENCE.
   *
   * L'import forçait `sector: "autre"` pour tout le monde. Or la file d'appels
   * relit la verticale via `verticalForProspect`, qui cherche des MOTS-CLÉS
   * dans les notes puis retombe sur le secteur — et `VERTICAL_KEYWORDS` ne
   * contient rien pour la restauration, les bars ni les ambulances. Ces trois
   * verticales ne se reconnaissent QUE par le secteur.
   *
   * Mesuré avant correction : un restaurant était correctement classé
   * « restauration » par le tri, puis tombait dans « generique » dans la file
   * — donc sans son script, sans son miroir, sans ses questions de diagnostic.
   */
  const cas: [string, string, string][] = [
    ["restauration", "Le Bouchon;restaurant;Lyon 1er;0465710001;;140;4,6;;\"injoignable\";5610A;1", "restauration"],
    ["bar-pub", "Le Comptoir;bar;Lyon 2e;0465710002;;140;4,6;;\"injoignable\";5630Z;2", "bar-pub"],
    ["ambulance", "Ambulances du Rhône;ambulance;Lyon 8e;0465710003;;140;4,6;;\"injoignable\";8690A;3", "ambulance"],
    ["garage", "Les Ateliers du Rhône;;Lyon 3e;0465710004;;140;4,6;;\"injoignable\";4520A;4", "garage-carrosserie"],
    ["couvreur", "Toiture Roux;;Lyon 7e;0465710005;;140;4,6;;\"injoignable\";4391B;5", "artisan-batiment"],
  ];
  for (const [nom, ligne, attendu] of cas) {
    const p = importerFiches(`${ENTETE_TERRAIN}\n${ligne}`).retenus[0]?.prospect;
    assert.ok(p, `${nom} : fiche non retenue`);
    assert.equal(
      verticalForProspect(p!)?.id,
      attendu,
      `${nom} : la file d'appels le range dans « ${verticalForProspect(p!)?.id} » au lieu de « ${attendu} »`
    );
  }
});

test("flux — la fiche terrain déclenche bien la marche Alpha Voice de l'ESCALIER", () => {
  // Le tri, l'import et l'escalier doivent parler de la même chose : sans ça,
  // la fiche remonte en tête de file d'appels et l'escalier reste muet.
  const p = importerFiches(
    `${ENTETE_TERRAIN}\nToiture Roux;;Lyon 7e;0465710006;;140;4,6;;"impossible de les joindre";4391B;6`
  ).retenus[0].prospect;
  const escalier = buildLadder(p);
  assert.ok(escalier.rungs.some((r) => r.id === "alpha-voice"), "la marche Alpha Voice doit se déclencher");
  assert.equal(escalier.entry?.accountId, "eagleye", "et elle revient à EAGLEYE : l'offre est à nous");
});

// ─────────── LE POIDS D'UNE FICHE, ET LE MUR DE STOCKAGE ───────────

test("terrain — les notes gardent la PHRASE DU CLIENT, pas la doctrine", () => {
  /**
   * L'ancienne version écrivait `s.fait` pour chaque signal, c'est-à-dire le
   * paragraphe d'explication du playbook — recopié dans chaque fiche. Et la
   * seule chose qui serve au téléphone, l'avis brut, était jetée.
   */
  const r = importerFiches(
    `${ENTETE_TERRAIN}\nCarrosserie X;carrosserie;Lyon 3e;04 65 71 34 56;;142;4,6;09:00–12:00, 14:00–18:00;"impossible de les joindre, j'ai appelé trois fois";45.20A;123456789`
  );
  const notes = r.retenus[0].prospect.notes;
  assert.match(notes, /impossible de les joindre/, "l'avis du client doit être conservé");
  assert.doesNotMatch(notes, /utilisable en question, jamais en reproche/, "la doctrine ne se recopie pas par fiche");
  assert.doesNotMatch(notes, /perdus par construction/, "idem pour l'explication du trou horaire");
  // Les faits qui ne se recalculent pas restent.
  assert.match(notes, /SIREN : 123456789/);
  assert.match(notes, /Métier : carrosserie/);
});

test("terrain — une fiche reste sous le poids qui rend 1 000 numéros tenables", () => {
  const r = importerFiches(
    `${ENTETE_TERRAIN}\nCarrosserie X;carrosserie automobile;Lyon 3e;04 65 71 34 56;;142;4,6;09:00–12:00, 14:00–18:00;"impossible de les joindre, j'ai appelé trois fois et personne ne répond jamais au téléphone";45.20A;123456789`
  );
  const octets = JSON.stringify(r.retenus[0].prospect).length;
  // 1 500 octets × 2 (UTF-16) × 1 000 fiches = 3 Mo, sur un quota de 5 Mo.
  // Au-delà, l'objectif de 1 000 numéros ne tient plus dans le navigateur.
  assert.ok(octets < 1500, `${octets} octets par fiche — le mur localStorage se rapproche`);
});

test("terrain — un avis très long est coupé, pas stocké en entier", () => {
  const pave = "impossible de les joindre. ".repeat(40);
  const r = importerFiches(
    `${ENTETE_TERRAIN}\nCarrosserie X;carrosserie;Lyon;04 65 71 34 56;;142;4,6;;"${pave}";45.20A;123456789`
  );
  const notes = r.retenus[0].prospect.notes;
  assert.ok(notes.length < 700, `${notes.length} caractères de notes`);
  assert.match(notes, /…/, "la coupure doit se voir");
});

test("stockage — la projection prévient AVANT de coller, et se tait quand tout va bien", () => {
  const sante = { usedBytes: 1_000_000, quotaBytes: 5 * 1024 * 1024, usedPct: 19, level: "ok" as const, message: "" };

  const petit = projeterImport(sante, { length: 50 }, 1300);
  assert.equal(petit.alerte, false);
  assert.match(petit.phrase, /Estimation/, "un chiffre estimé se présente comme tel");

  const gros = projeterImport(sante, { length: 1500 }, 1300);
  assert.equal(gros.alerte, true, `${gros.pctApres} % après import : il faut prévenir`);
  assert.match(gros.phrase, /Supabase/, "l'alerte doit dire QUOI faire, pas seulement s'alarmer");

  const enorme = projeterImport(sante, { length: 4000 }, 1300);
  assert.ok(enorme.pctApres >= 100);
  assert.match(enorme.phrase, /EN SILENCE/, "l'échec silencieux est le vrai danger, il doit être nommé");
});

test("stockage — sans mesure possible, on ne prétend pas connaître le quota", () => {
  const p = projeterImport(null, { length: 1000 }, 1300);
  assert.equal(p.alerte, false, "on n'alarme pas sur un chiffre qu'on n'a pas");
  assert.equal(p.pctApres, 0);
  assert.match(p.phrase, /Impossible de mesurer/);
});

test("stockage — le panneau projette avant l'import", () => {
  const src = readFileSync(join(process.cwd(), "components/appels/sourcing-terrain-panel.tsx"), "utf8");
  assert.ok(src.includes("projeterImport"), "le panneau doit annoncer le coût du lot avant le bouton");
});
