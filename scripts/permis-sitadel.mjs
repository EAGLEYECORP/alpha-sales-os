#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * SOURCER NOTRE ICP DEPUIS SITADEL — la base nationale des permis.
 *
 * ══ POURQUOI UN DEUXIÈME PONT ══
 *
 * `scripts/permis-lyon.mjs` visait le jeu du Grand Lyon, et une session l'a
 * mesuré : ce jeu ne couvre PAS Lyon ni Villeurbanne. La source qui les couvre
 * est Sitadel (SDES, ministère), « Liste des autorisations d'urbanisme créant
 * des logements » — mise à jour chaque mois, depuis 2013.
 *
 * Même doctrine que l'autre pont : la collecte reste DEHORS. Ce script n'est
 * importé par aucun code du produit ; il écrit un CSV que `parserPermis` sait
 * lire, et c'est `lib/permis-construire.ts` qui trie. Il ne trie RIEN lui-même,
 * sauf ce que la source rend inexploitable par construction (ci-dessous).
 *
 * ══ ⚠ CE QU'IL ÉCARTE, ET POURQUOI ICI PLUTÔT QUE DANS LE TRI ══
 *
 * · Les lignes SANS DÉNOMINATION : Sitadel anonymise les personnes physiques
 *   (nom et SIREN vides). Il n'y a personne à contacter derrière — et c'est
 *   le particulier, exactement ce que l'ICP exclut.
 * · Les autorisations ANNULÉES (`ETAT_DAU = 4`) : il n'y a plus d'opération.
 * · Les sociétés en diffusion restreinte (« [ND] ») : pas de nom à qui écrire.
 * Les trois se COMPTENT sur la sortie d'erreur : un CSV de 60 lignes tiré d'un
 * fichier de 2 000 ne doit pas ressembler à une panne.
 *
 * ══ ⚠⚠ LA ZONE SE FILTRE CHEZ LA SOURCE ══
 *
 * Le fichier national fait près de deux millions de lignes. L'API DiDo filtre
 * côté serveur (`COMM=in:…`) : on ne télécharge que Lyon et Villeurbanne.
 * Lyon y figure sous son code de commune ENTIÈRE (69123), pas par
 * arrondissement — l'arrondissement se relit sur le code postal du terrain.
 *
 * ══ L'OPTION `--departements` (30/09/2026) ══
 *
 * Le défaut RESTE Lyon + Villeurbanne : c'est la zone que `communeDansLaZone`
 * applique, et ce script ne la redéfinit pas. `--departements` sert une
 * extraction plus large (ex. la région entière), filtrée côté serveur sur
 * `DEP_CODE`. ⚠ Le tri du produit exclura alors tout ce qui est hors zone :
 * cette extraction se lit HORS du produit, tant que la zone n'est pas
 * rediscutée dans la doctrine — l'élargir se décide, ça ne se fait pas par un
 * paramètre de collecteur.
 * Hors Lyon, la commune se relit sur la localité du terrain.
 *
 * Usage :  node scripts/permis-sitadel.mjs > donnees-privees/permis-sitadel.csv
 *          node scripts/permis-sitadel.mjs --departements aura
 *          node scripts/permis-sitadel.mjs --departements 69,38,74
 *          node scripts/permis-sitadel.mjs --mois 36
 *          node scripts/permis-sitadel.mjs --fichier export-sitadel.csv   (hors ligne)
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "node:fs";

/** Le fichier, nommé en UN seul endroit. `millesime` absent = le plus récent. */
const DATAFILE = "8b35affb-55fc-4c1f-915b-7750f974446a";
const API = `https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles/${DATAFILE}`;

/**
 * Les codes de commune de l'ICP. ⚠ Les arrondissements (69381-69389) sont
 * listés même si le millésime mesuré n'en porte aucun : un changement de
 * convention à la source ne doit pas vider le fichier en silence.
 */
/** Auvergne-Rhône-Alpes, pour `--departements aura`. */
export const DEPARTEMENTS_AURA = ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"];

/**
 * `"aura"` ou `"69,38"` → codes de département. ⚠ Un code mal formé JETTE :
 * filtré côté serveur, il rendrait un fichier vide qui ressemble à « aucun
 * permis » (la Corse — 2A/2B — est acceptée).
 */
export function lireDepartements(arg) {
  if (arg === undefined) return undefined;
  const brut = String(arg).trim().toLowerCase();
  if (brut === "aura") return [...DEPARTEMENTS_AURA];
  const codes = brut.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  const faux = codes.filter((c) => !/^(?:\d{2,3}|2[AB])$/.test(c));
  if (!codes.length || faux.length) throw new Error(`--departements invalide : « ${arg} »`);
  return codes;
}

export const COMMUNES_INSEE = ["69123", "69381", "69382", "69383", "69384", "69385", "69386", "69387", "69388", "69389", "69266"];

/** Les colonnes que `parserPermis` sait lire — mêmes alias que `lib/permis-construire.ts`. */
export const COLONNES = [
  "numero",
  "demandeur",
  "siren",
  "categorieJuridique",
  "codeApe",
  "dateDecision",
  "dateOuvertureChantier",
  "dateAchevement",
  "logements",
  "surfacePlancher",
  "commune",
  "adresse",
];

export const ETAT_ANNULE = "4";

export function champCsv(v) {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Lecteur CSV minimal (séparateur `;`, guillemets doublés) — celui que rend DiDo. */
export function lireCsvSitadel(texte) {
  const lignes = [];
  let champ = "";
  let ligne = [];
  let cite = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (cite) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') cite = false;
      else champ += c;
    } else if (c === '"') cite = true;
    else if (c === ";") { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); champ = "";
      if (ligne.some((x) => x !== "")) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); if (ligne.some((x) => x !== "")) lignes.push(ligne); }
  if (!lignes.length) return [];
  const [entete, ...corps] = lignes;
  return corps.map((l) => Object.fromEntries(entete.map((k, j) => [k, l[j] ?? ""])));
}

/**
 * « Lyon 3e » depuis le code postal du terrain ; la commune seule sinon. Hors
 * Lyon/Villeurbanne, la localité du terrain telle que la source l'écrit.
 */
export function communeLisible(comm, codePostal, localite = "") {
  if (comm === "69266") return "Villeurbanne";
  const cp = String(codePostal ?? "").trim();
  const arr = /^6900([1-9])$/.exec(cp)?.[1] ?? (/^6938([1-9])$/.exec(String(comm))?.[1]);
  if (arr) return `Lyon ${arr}${arr === "1" ? "er" : "e"}`;
  return comm === "69123" ? "Lyon" : String(localite ?? "").trim();
}

/**
 * Une ligne Sitadel → une ligne pour `parserPermis`. `null` = écartée, avec
 * son motif, pour être COMPTÉE.
 *
 * ⚠ Aucune colonne ne se devine : un nombre de logements absent reste vide,
 * parce que le module de tri distingue « inconnue » de « faible ».
 */
export function ligneSitadel(b) {
  if (String(b.ETAT_DAU).trim() === ETAT_ANNULE) return { motif: "annule" };
  const demandeur = String(b.DENOM_DEM ?? "").trim();
  if (!demandeur) return { motif: "personne-physique" };
  // « [ND] » : société qui a demandé la non-diffusion de son identité. Ce n'est
  // pas un nom — le passer au tri ferait une fiche adressée à « [ND] ».
  if (/^\[?nd\]?$/i.test(demandeur)) return { motif: "non-diffusible" };
  const adresse = [b.ADR_NUM_TER, b.ADR_LIBVOIE_TER, b.ADR_LIEUDIT_TER, b.ADR_CODPOST_TER]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    ligne: {
      numero: String(b.NUM_DAU ?? "").trim(),
      demandeur,
      siren: String(b.SIREN_DEM ?? "").trim(),
      categorieJuridique: String(b.CJ_DEM ?? "").trim(),
      codeApe: String(b.APE_DEM ?? "").trim(),
      dateDecision: String(b.DATE_REELLE_AUTORISATION ?? "").trim(),
      dateOuvertureChantier: String(b.DATE_REELLE_DOC ?? "").trim(),
      dateAchevement: String(b.DATE_REELLE_DAACT ?? "").trim(),
      logements: String(b.NB_LGT_TOT_CREES ?? "").trim(),
      surfacePlancher: String(b.SURF_HAB_CREEE ?? "").trim(),
      commune: communeLisible(String(b.COMM ?? "").trim(), b.ADR_CODPOST_TER, b.ADR_LOCALITE_TER),
      adresse,
    },
  };
}

/** Garde les autorisations des `mois` derniers mois (date d'arrêté ISO). */
export function depuisMois(dateIso, mois, now = new Date()) {
  const t = Date.parse(String(dateIso ?? ""));
  if (!Number.isFinite(t)) return false;
  const borne = new Date(now);
  borne.setMonth(borne.getMonth() - mois);
  return t >= borne.getTime();
}

export function transformer(brutes, { mois = 24, now = new Date() } = {}) {
  const compte = { bruts: brutes.length, annule: 0, "personne-physique": 0, "non-diffusible": 0, "hors-periode": 0 };
  const lignes = [];
  for (const b of brutes) {
    if (!depuisMois(b.DATE_REELLE_AUTORISATION, mois, now)) { compte["hors-periode"]++; continue; }
    const r = ligneSitadel(b);
    if (r.motif) { compte[r.motif]++; continue; }
    lignes.push(r.ligne);
  }
  return { lignes, compte };
}

export function versCsv(lignes) {
  return [COLONNES.join(","), ...lignes.map((l) => COLONNES.map((c) => champCsv(l[c])).join(","))].join("\n");
}

export function urlSitadel({ departements } = {}) {
  const zone = departements?.length ? { DEP_CODE: `in:${departements.join(",")}` } : { COMM: `in:${COMMUNES_INSEE.join(",")}` };
  const q = new URLSearchParams({
    withColumnName: "true",
    withColumnDescription: "false",
    withColumnUnit: "false",
    ...zone,
    TYPE_DAU: "eq:PC",
  });
  return `${API}/csv?${q}`;
}

async function principal() {
  const arg = (nom) => { const i = process.argv.indexOf(nom); return i > -1 ? process.argv[i + 1] : undefined; };
  const mois = Number(arg("--mois") ?? 24);
  const fichier = arg("--fichier");
  const departements = lireDepartements(arg("--departements"));

  let texte;
  if (fichier) texte = readFileSync(fichier, "utf8");
  else {
    const r = await fetch(urlSitadel({ departements }));
    if (!r.ok) { console.error(`Sitadel injoignable : HTTP ${r.status}`); process.exit(2); }
    texte = await r.text();
  }
  const brutes = lireCsvSitadel(texte);
  if (!brutes.length || !("DENOM_DEM" in brutes[0])) {
    // ⚠ On MONTRE ce qu'on a reçu : un CSV vide importé ressemble à « aucun permis ».
    console.error("Réponse d'une forme inattendue. Extrait :", texte.slice(0, 400));
    process.exit(3);
  }
  const { lignes, compte } = transformer(brutes, { mois });
  console.error(
    `${compte.bruts} PC reçus · ${compte["hors-periode"]} hors des ${mois} derniers mois · ` +
      `${compte["personne-physique"]} personnes physiques anonymisées · ${compte["non-diffusible"]} non diffusibles · ${compte.annule} annulés · ${lignes.length} écrits`,
  );
  process.stdout.write(versCsv(lignes) + "\n");
}

if (process.argv[1] && process.argv[1].endsWith("permis-sitadel.mjs")) {
  principal().catch((e) => { console.error("Échec :", e?.message ?? e); process.exit(1); });
}
