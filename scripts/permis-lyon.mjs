#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * SOURCER NOTRE ICP — les permis de construire de Lyon / Villeurbanne.
 *
 * ══ POURQUOI UN SCRIPT, ET PAS UNE BRIQUE DU PRODUIT ══
 *
 * La doctrine refuse d'embarquer un collecteur dans Alpha — scraping
 * d'annuaire, session LinkedIn, aspiration de Maps — et la raison n'est pas
 * esthétique : un collecteur intégré fait de NOUS le responsable du traitement
 * de données qu'on n'a pas choisies, il casse au premier changement de la
 * source, et il transforme un produit vendable en outil de contournement.
 *
 * « La collecte reste dehors, remplaçable, et sous la responsabilité de celui
 * qui la fait. » Ce fichier EST ce dehors : un script, hors du bundle, que
 * personne n'importe. Il écrit un CSV ; `/api/import/sheet` et l'écran de
 * sourcing font le reste.
 *
 * ══ ⚠⚠ ET POURQUOI CETTE SOURCE PLUTÔT QU'UN SCRAPER ══
 *
 * Un scraper de Maps rend des commerces : ce n'est plus notre ICP depuis le
 * 09/09, et il moissonne des données personnelles sans base légale claire,
 * contre les conditions d'un tiers. Un arrêté de permis de construire est un
 * acte ADMINISTRATIF PUBLIÉ, réutilisable, daté et vérifiable — et c'est
 * exactement le déclencheur que `lib/permis-construire.ts` sait lire.
 *
 * Même effort, une source légale au lieu d'une source grise.
 *
 * ══ ⚠⚠ CE QUI N'A PAS ÉTÉ VÉRIFIÉ, ET IL FAUT LE SAVOIR ══
 *
 * **Ce script n'a jamais atteint l'API.** Le proxy de la machine où il a été
 * écrit refuse `data.grandlyon.com` (mesuré : connexion refusée, pas un 404).
 * Donc :
 *
 * · la PARTIE QUI TRANSFORME est testée ici, sur une réponse figée
 *   (`tests/permis-lyon-script.test.ts`) — c'est elle qui contient la logique ;
 * · la PARTIE QUI TÉLÉCHARGE ne l'est pas. Elle ne devine donc rien : sur une
 *   réponse d'une autre forme, elle AFFICHE ce qu'elle a reçu et s'arrête, au
 *   lieu d'écrire un CSV vide qui aurait l'air d'un résultat.
 *
 * Usage :  node scripts/permis-lyon.mjs > donnees-privees/permis.csv
 *          node scripts/permis-lyon.mjs --limite 500
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠ Les communes sont celles de l'ICP, pas « la métropole » : la zone est une
 * EXCLUSION dans `lib/permis-construire.ts`, et élargir ici ne ferait que
 * fabriquer des lignes que le tri jettera plus loin. Autant ne pas les
 * télécharger.
 */
const COMMUNES = ["Lyon", "Villeurbanne"];

/**
 * Le jeu de données du Grand Lyon. ⚠ Il est nommé ICI, en un seul endroit :
 * une URL recopiée dans un README se périme sans que le script bouge.
 */
const SOURCE =
  "https://data.grandlyon.com/fr/datapusher/ws/rdata/urba_fonc.urba_permis_construire/all.json?maxfeatures=__MAX__&start=1";

/**
 * Les colonnes que `parserPermis` sait lire. ⚠ Elles ne sont PAS inventées :
 * ce sont les alias déclarés dans `lib/permis-construire.ts`. En changer une
 * ici sans l'ajouter là-bas produit une colonne que l'import ignore en
 * silence — la panne la plus coûteuse d'un import, parce qu'elle ressemble à
 * un succès.
 */
const COLONNES = [
  "numero",
  "demandeur",
  "dateDecision",
  "dateOuvertureChantier",
  "dateAchevement",
  "logements",
  "surfacePlancher",
  "commune",
  "adresse",
];

/** Les noms de champs plausibles côté source, par colonne de sortie. */
const CANDIDATS = {
  numero: ["numero", "num_dossier", "numdossier", "dossier", "reference", "id"],
  demandeur: ["demandeur", "petitionnaire", "nom_demandeur", "raison_sociale", "titulaire"],
  dateDecision: ["date_decision", "datedecision", "date_arrete", "date_autorisation", "date_octroi"],
  dateOuvertureChantier: ["date_doc", "date_ouverture_chantier", "doc"],
  dateAchevement: ["date_daact", "date_achevement", "daact"],
  logements: ["nb_logements", "nb_lgt_crees", "logements", "nombre_logements"],
  surfacePlancher: ["surface_plancher", "sdp", "shon", "surface"],
  commune: ["commune", "nom_commune", "ville"],
  adresse: ["adresse", "adresse_complete", "localisation", "rue"],
};

/** Une valeur CSV : guillemets doublés, champ cité dès qu'il porte un séparateur. */
export function champCsv(v) {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Transforme une ligne de la source en ligne de sortie.
 *
 * ⚠ CHAQUE COLONNE ABSENTE RESTE VIDE, elle ne se devine pas. Un import de
 * permis sans `logements` doit dire « inconnue » — `lib/permis-construire.ts`
 * distingue explicitement `inconnue` de `faible`, et remplir un zéro ici
 * effacerait cette distinction à la source.
 */
export function ligneVersColonnes(brut) {
  const sortie = {};
  for (const col of COLONNES) {
    const trouve = CANDIDATS[col].find((k) => brut[k] !== undefined && brut[k] !== null && brut[k] !== "");
    sortie[col] = trouve ? brut[trouve] : "";
  }
  return sortie;
}

/** Ne garde que les communes de l'ICP. La comparaison est ancrée en DÉBUT. */
export function dansLaZone(commune) {
  const c = String(commune ?? "").trim().toLowerCase();
  // ⚠ Jamais un `includes("lyon")` : « Sainte-Foy-lès-Lyon » et « Métropole de
  // Lyon » le contiennent tous les deux. Même règle que `communeDansLaZone`.
  return COMMUNES.some((v) => c.startsWith(v.toLowerCase()));
}

export function versCsv(lignes) {
  const entete = COLONNES.join(",");
  const corps = lignes.map((l) => COLONNES.map((c) => champCsv(l[c])).join(","));
  return [entete, ...corps].join("\n");
}

/**
 * Extrait le tableau de lignes d'une réponse dont on ne connaît pas la forme
 * exacte. Rend `null` plutôt que `[]` quand il ne reconnaît rien : une liste
 * vide se lit comme « aucun permis », `null` comme « je n'ai pas su lire ».
 */
export function extraireLignes(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const cle of ["values", "features", "records", "results", "data"]) {
      const v = json[cle];
      if (Array.isArray(v)) return v.map((e) => (e && e.properties ? e.properties : e));
    }
  }
  return null;
}

async function principal() {
  const arg = process.argv.indexOf("--limite");
  const max = arg > -1 ? Number(process.argv[arg + 1]) : 2000;
  const url = SOURCE.replace("__MAX__", String(max));

  const reponse = await fetch(url, { headers: { accept: "application/json" } });
  if (!reponse.ok) {
    console.error(`Source injoignable : HTTP ${reponse.status} sur ${url}`);
    process.exit(2);
  }
  const json = await reponse.json();
  const lignes = extraireLignes(json);

  if (!lignes) {
    // ⚠ On MONTRE ce qu'on a reçu. Un script qui échoue en silence sur un
    // format inattendu fait écrire un CSV vide, qu'on importe sans rien voir.
    console.error("Réponse d'une forme inattendue. Clés reçues :", Object.keys(json ?? {}).join(", ") || "(aucune)");
    console.error("Extrait :", JSON.stringify(json).slice(0, 400));
    process.exit(3);
  }

  const retenues = lignes.map(ligneVersColonnes).filter((l) => dansLaZone(l.commune));
  console.error(`${lignes.length} lignes reçues · ${retenues.length} dans la zone (${COMMUNES.join(", ")})`);
  if (!retenues.length) {
    console.error("Aucune ligne dans la zone — vérifie le nom du champ commune avant d'importer.");
    process.exit(4);
  }
  process.stdout.write(versCsv(retenues) + "\n");
}

if (process.argv[1] && process.argv[1].endsWith("permis-lyon.mjs")) {
  principal().catch((e) => {
    console.error("Échec :", e?.message ?? e);
    process.exit(1);
  });
}
