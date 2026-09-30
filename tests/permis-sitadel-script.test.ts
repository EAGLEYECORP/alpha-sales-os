import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parserPermis, trierPermis, typeDeMaitreOuvrage, lirePermis } from "../lib/permis-construire";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PONT SITADEL — éprouvé de la réponse brute jusqu'au tri réel.
 *
 * `scripts/permis-sitadel.mjs` a atteint l'API DiDo le 30/09/2026 (mesuré :
 * 2 102 PC Lyon + Villeurbanne, filtrés côté serveur). Ce test ne rejoue pas
 * le réseau : il part d'une réponse de la MÊME FORME (en-têtes Sitadel réels,
 * valeurs fictives) et va jusqu'à `trierPermis`. « J'ai testé les maillons,
 * pas la chaîne » — un CSV que `parserPermis` ignore en silence produit une
 * file vide qui ressemble à « aucun permis actif ».
 * ─────────────────────────────────────────────────────────────────────
 */

const SCRIPT = join(process.cwd(), "scripts/permis-sitadel.mjs");

type Brute = Record<string, string>;
async function outils() {
  return (await import(SCRIPT)) as {
    lireCsvSitadel: (t: string) => Brute[];
    transformer: (b: Brute[], o?: { mois?: number; now?: Date }) => { lignes: Record<string, string>[]; compte: Record<string, number> };
    versCsv: (l: Record<string, string>[]) => string;
    communeLisible: (comm: string, cp: string) => string;
  };
}

const NOW = new Date("2026-09-30T12:00:00Z");
const ENTETE = ["COMM", "TYPE_DAU", "NUM_DAU", "ETAT_DAU", "DATE_REELLE_AUTORISATION", "DATE_REELLE_DOC", "DATE_REELLE_DAACT", "CJ_DEM", "APE_DEM", "DENOM_DEM", "SIREN_DEM", "ADR_NUM_TER", "ADR_LIBVOIE_TER", "ADR_LIEUDIT_TER", "ADR_CODPOST_TER", "NB_LGT_TOT_CREES", "SURF_HAB_CREEE"];
const ligne = (v: Partial<Record<string, string>>) => ENTETE.map((k) => `"${(v[k] ?? "").replace(/"/g, '""')}"`).join(";");

const REPONSE = [
  ENTETE.map((k) => `"${k}"`).join(";"),
  // Promoteur déclaré (SCI de construction-vente), pré-commercialisation, 48 lots.
  ligne({ COMM: "69123", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-A1", ETAT_DAU: "2", DATE_REELLE_AUTORISATION: "2026-05-10", CJ_DEM: "6541", DENOM_DEM: "OPERATION DEMO; LOT A", SIREN_DEM: "000000001", ADR_LIBVOIE_TER: "RUE DE LA DEMO", ADR_CODPOST_TER: "69003", NB_LGT_TOT_CREES: "48" }),
  // Office public de l'habitat au nom muet : seule la catégorie juridique le trahit.
  ligne({ COMM: "69266", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-B2", ETAT_DAU: "2", DATE_REELLE_AUTORISATION: "2026-04-01", CJ_DEM: "4140", DENOM_DEM: "RESIDENCES DEMO", SIREN_DEM: "000000002", ADR_CODPOST_TER: "69100", NB_LGT_TOT_CREES: "60" }),
  // Promoteur au nom muet : seul le code APE le déclare.
  ligne({ COMM: "69123", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-F6", ETAT_DAU: "2", DATE_REELLE_AUTORISATION: "2026-06-01", CJ_DEM: "5710", APE_DEM: "41.10A", DENOM_DEM: "FILIALE DEMO", ADR_CODPOST_TER: "69007", NB_LGT_TOT_CREES: "35" }),
  // Diffusion restreinte.
  ligne({ COMM: "69123", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-G7", ETAT_DAU: "2", DATE_REELLE_AUTORISATION: "2026-06-01", CJ_DEM: "2320", DENOM_DEM: "[ND]", ADR_CODPOST_TER: "69004", NB_LGT_TOT_CREES: "17" }),
  // Personne physique : Sitadel l'anonymise.
  ligne({ COMM: "69123", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-C3", ETAT_DAU: "2", DATE_REELLE_AUTORISATION: "2026-03-01", ADR_CODPOST_TER: "69005", NB_LGT_TOT_CREES: "1" }),
  // Annulé.
  ligne({ COMM: "69123", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-D4", ETAT_DAU: "4", DATE_REELLE_AUTORISATION: "2026-02-01", CJ_DEM: "5710", DENOM_DEM: "DEMO ANNULEE", ADR_CODPOST_TER: "69007", NB_LGT_TOT_CREES: "30" }),
  // Trop ancien.
  ligne({ COMM: "69123", TYPE_DAU: "PC", NUM_DAU: "PC-DEMO-E5", ETAT_DAU: "5", DATE_REELLE_AUTORISATION: "2020-02-01", CJ_DEM: "5710", DENOM_DEM: "DEMO ANCIENNE", ADR_CODPOST_TER: "69008", NB_LGT_TOT_CREES: "30" }),
].join("\n");

test("⚠⚠ DE LA RÉPONSE SITADEL JUSQU'AU TRI RÉEL", async () => {
  const { lireCsvSitadel, transformer, versCsv } = await outils();
  const { lignes, compte } = transformer(lireCsvSitadel(REPONSE), { mois: 24, now: NOW });
  assert.deepEqual(compte, { bruts: 7, annule: 1, "personne-physique": 1, "non-diffusible": 1, "hors-periode": 1 });

  const lu = parserPermis(versCsv(lignes));
  assert.equal(lu.permis.length, 3);
  const lot = trierPermis(lu.permis, NOW);
  assert.deepEqual(lot.retenus.map((r) => r.permis.numero).sort(), ["PC-DEMO-A1", "PC-DEMO-F6"]);
  const r = lot.retenus.find((x) => x.permis.numero === "PC-DEMO-A1")!;
  const f = lot.retenus.find((x) => x.permis.numero === "PC-DEMO-F6")!;
  assert.equal(f.ciblage.typeMoa, "promoteur", "le code APE a traversé le CSV");
  assert.equal(r.permis.demandeur, "OPERATION DEMO; LOT A", "le point-virgule survit à l'échappement");
  assert.equal(r.permis.siren, "000000001");
  assert.equal(r.permis.commune, "Lyon 3e");
  assert.equal(r.ciblage.typeMoa, "promoteur");
  assert.equal(r.ciblage.phase, "commercialisation");
  assert.equal(r.ciblage.demande, "saturee");

  const [e] = lot.ecartes;
  assert.equal(e.ciblage.typeMoa, "bailleur-social", "la catégorie juridique a traversé le CSV");
});

test("⚠⚠ LA CATÉGORIE JURIDIQUE PASSE AVANT LA DEVINETTE SUR LE NOM", () => {
  // Noms muets : sans la CJ, les cinq sortiraient « entreprise », donc vendeurs.
  assert.equal(typeDeMaitreOuvrage("RESIDENCES DEMO", "4140"), "bailleur-social");
  assert.equal(typeDeMaitreOuvrage("RESIDENCES DEMO", "5546"), "bailleur-social");
  assert.equal(typeDeMaitreOuvrage("RESIDENCES DEMO", "5547"), "bailleur-social");
  assert.equal(typeDeMaitreOuvrage("ETABLISSEMENT DEMO", "7385"), "public");
  assert.equal(typeDeMaitreOuvrage("FOYER DEMO", "9220"), "non-lucratif");
  assert.equal(typeDeMaitreOuvrage("INDIVISION DEMO", "2110"), "particulier");
  assert.equal(typeDeMaitreOuvrage("LOT DEMO", "6541"), "promoteur");
  // La CJ ne tranche pas une SAS, ni une SCI : le nom décide, comme avant.
  assert.equal(typeDeMaitreOuvrage("DEMO SAS", "5710"), "entreprise");
  assert.equal(typeDeMaitreOuvrage("SCCV DEMO", "5710"), "promoteur");
  assert.equal(typeDeMaitreOuvrage("SCI DEMO", "6540"), "entreprise");
  // APE 41.10 = promotion immobilière déclarée — mais une CJ d'HLM l'emporte.
  assert.equal(typeDeMaitreOuvrage("FILIALE DEMO", "5710", "41.10A"), "promoteur");
  assert.equal(typeDeMaitreOuvrage("RESIDENCES DEMO", "5547", "41.10A"), "bailleur-social");
  assert.equal(typeDeMaitreOuvrage("DEMO SAS", "5710", "68.20A"), "entreprise");
  // Sans CJ, rien ne change.
  assert.equal(typeDeMaitreOuvrage("RESIDENCES DEMO"), "inconnu");

  const l = lirePermis({ demandeur: "FOYER DEMO", categorieJuridique: "9300", dateDecision: "2026-05-01", logements: 90, commune: "Lyon 7e" }, NOW);
  assert.equal(l.retenu, false);
  assert.equal(l.problemeDeVente, false);
});

test("l'arrondissement se relit sur le code postal du terrain", async () => {
  const { communeLisible } = await outils();
  assert.equal(communeLisible("69123", "69001"), "Lyon 1er");
  assert.equal(communeLisible("69123", "69009"), "Lyon 9e");
  assert.equal(communeLisible("69385", ""), "Lyon 5e");
  assert.equal(communeLisible("69123", ""), "Lyon");
  assert.equal(communeLisible("69266", "69100"), "Villeurbanne");
});

test("⚠ LE COLLECTEUR RESTE DEHORS — aucun code du produit n'importe le pont Sitadel", () => {
  const coupables: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (
        /\.tsx?$/.test(e.name) &&
        /(?:from|import|require)\s*\(?\s*["'][^"']*permis-sitadel(?:\.mjs)?["']/.test(readFileSync(join(process.cwd(), rel), "utf8"))
      ) coupables.push(rel);
    }
  };
  for (const racine of ["app", "components", "lib"]) parcourir(racine);
  assert.deepEqual(coupables, []);
});
