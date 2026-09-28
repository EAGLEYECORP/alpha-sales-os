import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parserPermis, COLONNES_PERMIS, trierPermis } from "../lib/permis-construire";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SOURCING DE NOTRE ICP — la partie qui TRANSFORME, éprouvée ici.
 *
 * `scripts/permis-lyon.mjs` télécharge les arrêtés de permis du Grand Lyon et
 * écrit un CSV que `parserPermis` sait lire. Il tourne chez Zakaria, jamais
 * dans le produit : « la collecte reste dehors, remplaçable, et sous la
 * responsabilité de celui qui la fait ».
 *
 * ══ ⚠⚠ CE QUI EST TESTÉ, ET CE QUI NE PEUT PAS L'ÊTRE ══
 *
 * Le proxy de la machine où ce script a été écrit REFUSE `data.grandlyon.com`
 * (mesuré : connexion refusée, pas un 404). La partie qui télécharge n'a donc
 * jamais tourné, et le dire vaut mieux que le laisser croire.
 *
 * Ce qui est éprouvé, c'est tout le reste — et c'est là qu'est la logique :
 * la transformation, le filtre de zone, l'échappement CSV, et surtout
 * **l'aller-retour complet jusqu'au module de ciblage réel**. Un CSV qui se
 * génère mais que `parserPermis` ne sait pas lire serait un succès apparent
 * et une file d'appels vide.
 * ─────────────────────────────────────────────────────────────────────
 */

const SCRIPT = join(process.cwd(), "scripts/permis-lyon.mjs");

/** Charge le script comme un module, sans déclencher son `main`. */
async function outils() {
  return (await import(SCRIPT)) as {
    champCsv: (v: unknown) => string;
    ligneVersColonnes: (b: Record<string, unknown>) => Record<string, string>;
    dansLaZone: (c: unknown) => boolean;
    versCsv: (l: Record<string, string>[]) => string;
    extraireLignes: (j: unknown) => unknown[] | null;
  };
}

test("⚠⚠ LE CSV PRODUIT EST RELU PAR LE VRAI MODULE DE CIBLAGE", async () => {
  /**
   * Le test qui compte. Il part d'une réponse comme la source en rend une, et
   * va jusqu'à `trierPermis` — le module qui décide qui on appelle. Casser
   * n'importe quel maillon (un nom de colonne, l'échappement, le filtre) le
   * fait tomber.
   *
   * ⚠ C'est la leçon déjà payée ici : « j'ai testé les maillons, pas la
   * chaîne ». Un CSV bien formé que `parserPermis` ignore en silence produit
   * une file vide, ce qui ressemble trait pour trait à « aucun permis actif ».
   */
  const { ligneVersColonnes, dansLaZone, versCsv } = await outils();

  const reponse = [
    {
      num_dossier: "PC 069 383 26 A0123",
      petitionnaire: "Promoteur Démo SAS",
      date_decision: "2026-04-15",
      nb_logements: "48",
      surface_plancher: "3200",
      commune: "Lyon 3e",
      adresse: "12 rue de la Démo",
    },
    {
      num_dossier: "PC 069 266 26 A0044",
      petitionnaire: "Bailleur Démo",
      date_decision: "2026-05-02",
      nb_logements: "30",
      commune: "Villeurbanne",
      adresse: "5 avenue Démo",
    },
    // ⚠ Hors zone : le piège du `includes("lyon")`, posé exprès.
    {
      num_dossier: "PC 069 202 26 A0007",
      petitionnaire: "Hors Zone Démo",
      date_decision: "2026-05-02",
      nb_logements: "80",
      commune: "Sainte-Foy-lès-Lyon",
      adresse: "1 rue Démo",
    },
  ];

  const retenues = reponse.map(ligneVersColonnes).filter((l) => dansLaZone(l.commune));
  assert.equal(retenues.length, 2, "Sainte-Foy-lès-Lyon ne doit pas passer pour Lyon");

  const csv = versCsv(retenues);
  const lu = parserPermis(csv);
  assert.equal(lu.permis.length, 2, "le CSV doit être relu par le vrai parseur");
  assert.equal(lu.permis[0].demandeur, "Promoteur Démo SAS");
  assert.equal(lu.permis[0].logements, 48, "les logements arrivent en NOMBRE, pas en chaîne");
  assert.equal(lu.permis[0].commune, "Lyon 3e");

  // Et jusqu'au tri, qui est ce dont la file d'appels se sert.
  const lot = trierPermis(lu.permis);
  assert.ok(lot, "le lot trié doit exister");
});

test("⚠⚠ CHAQUE COLONNE ÉCRITE EST UNE COLONNE QUE LE PARSEUR RECONNAÎT", async () => {
  /**
   * Une colonne inventée ici est ignorée EN SILENCE par l'import — la panne la
   * plus chère d'un import, parce qu'elle ressemble à un succès : le fichier
   * passe, les fiches se créent, et un champ manque partout.
   */
  const { versCsv } = await outils();
  const entete = versCsv([]).split("\n")[0].split(",");
  // ⚠ `COLONNES_PERMIS` est une CHAÎNE lisible (« numero, demandeur, … »),
  // pas un tableau : elle est faite pour être affichée à qui prépare un
  // fichier. On la découpe, on ne suppose pas sa forme.
  const reconnues = new Set(COLONNES_PERMIS.split(",").map((c) => c.trim().toLowerCase()));
  for (const col of entete) {
    assert.ok(reconnues.has(col.toLowerCase()), `« ${col} » n'est pas un alias connu de parserPermis`);
  }
});

test("⚠ UNE COLONNE ABSENTE RESTE VIDE — on ne devine pas un zéro", async () => {
  /**
   * `lib/permis-construire.ts` distingue `inconnue` de `faible` : une colonne
   * manquante ne dit PAS que l'opération est petite. Écrire `0` ici effacerait
   * cette distinction à la source, et amputerait la file sans que personne
   * sache pourquoi.
   */
  const { ligneVersColonnes } = await outils();
  const l = ligneVersColonnes({ commune: "Lyon 7e" });
  assert.equal(l.logements, "", "pas de zéro fabriqué");
  assert.equal(l.demandeur, "");
});

test("⚠ UN NOM AVEC UNE VIRGULE NE CASSE PAS LE CSV", async () => {
  /**
   * Une raison sociale porte très souvent une virgule ou des guillemets. Sans
   * échappement, la ligne se décale d'une colonne et le demandeur devient une
   * commune — silencieusement.
   */
  const { champCsv, versCsv } = await outils();
  assert.equal(champCsv('Démo "SAS", Lyon'), '"Démo ""SAS"", Lyon"');
  const csv = versCsv([{ numero: "A1", demandeur: 'Démo, "X"', commune: "Lyon 1er" } as Record<string, string>]);
  assert.equal(parserPermis(csv).permis[0].demandeur, 'Démo, "X"');
});

test("⚠⚠ UNE RÉPONSE ILLISIBLE REND `null`, JAMAIS UNE LISTE VIDE", async () => {
  /**
   * La distinction qui évite le pire scénario : un CSV vide généré sans
   * erreur, importé sans rien voir. Une liste vide se lit « aucun permis » ;
   * `null` se lit « je n'ai pas su lire », et le script s'arrête en MONTRANT
   * ce qu'il a reçu. Même famille que le moniteur qui affiche du calme quand
   * la base est morte.
   */
  const { extraireLignes } = await outils();
  assert.equal(extraireLignes({ erreur: "quota" }), null);
  assert.equal(extraireLignes("<html>"), null);
  assert.deepEqual(extraireLignes({ values: [{ a: 1 }] }), [{ a: 1 }]);
  // GeoJSON : les attributs vivent sous `properties`.
  assert.deepEqual(extraireLignes({ features: [{ properties: { a: 1 } }] }), [{ a: 1 }]);
  assert.deepEqual(extraireLignes([{ a: 1 }]), [{ a: 1 }]);
});

test("⚠ LE COLLECTEUR RESTE DEHORS — aucun code du produit ne l'importe", () => {
  /**
   * La règle qui justifie que ce script existe. Un collecteur importé par le
   * produit ferait de NOUS le responsable d'un traitement qu'on n'a pas
   * choisi, et casserait au premier changement de la source.
   *
   * ⚠ ON CHERCHE UN CHEMIN D'IMPORT, PAS LA CHAÎNE « permis-lyon ». Première
   * rédaction : elle a fait tomber `lib/seed.ts`, qui porte un identifiant de
   * démo nommé `c-permis-lyon-commercialisation` — une ligne parfaitement
   * juste. Un garde qui refuse une phrase vraie est un garde qu'on assouplit
   * au mauvais endroit la fois suivante ; resserré le jour même.
   */
  const coupables: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (
        /\.tsx?$/.test(e.name) &&
        /(?:from|import|require)\s*\(?\s*["'][^"']*permis-lyon(?:\.mjs)?["']/.test(
          readFileSync(join(process.cwd(), rel), "utf8"),
        )
      ) {
        coupables.push(rel);
      }
    }
  };
  for (const racine of ["app", "components", "lib"]) parcourir(racine);

  assert.deepEqual(coupables, [], "le script ne doit être importé par aucun code du produit");
});
