import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES NOMS DE PROSPECTS RÉELS — UNE SEULE EXTRACTION, POUR TOUT LE DÉPÔT.
 *
 * ⚠⚠ CE QUI A RENDU CE FICHIER NÉCESSAIRE, ET C'EST LA LEÇON QUE `CLAUDE.md`
 * PORTE DÉJÀ SANS L'AVOIR APPLIQUÉE ICI.
 *
 * Le dépôt avait DEUX gardes sur la donnée réelle, et elles n'avaient pas la
 * même portée :
 *  · les TÉLÉPHONES étaient cherchés par leur FORME dans **tout fichier
 *    commité** (`donnees-reelles.test.ts`) — parce qu'« un dépôt public ne se
 *    visite pas, il se clone » ;
 *  · les NOMS n'étaient cherchés que dans le **bundle client**
 *    (`vitrine-fuite.test.ts`) — le modèle de menace « atteindre un
 *    navigateur », précisément celui dont le dépôt a écrit qu'il était
 *    insuffisant.
 *
 * Résultat mesuré le 10/09/2026 : une vingtaine de raisons sociales réelles
 * dormaient dans `lib/`, `tests/`, `docs/` et `voice/`, hors bundle, donc
 * hors garde, donc publiées. Aucune n'a jamais fait tomber un test.
 *
 * La question « ce texte nomme-t-il un vrai prospect ? » se pose désormais à
 * UN endroit, sur l'ENSEMBLE des fichiers commités. Le garde du bundle a été
 * retiré : il posait la même question sur un sous-ensemble strict, et deux
 * définitions de la même règle finissent toujours par diverger.
 *
 * ⚠ LA DIRECTION DE L'ERREUR EST VOULUE. On extrait les noms DEPUIS la donnée
 * protégée, jamais depuis une liste écrite à la main : une liste de ce qu'il
 * faut cacher est une copie de ce qu'on cache, et elle serait périmée au
 * premier prospect ajouté. Corollaire assumé : sans le dossier privé, il n'y
 * a rien à comparer et le garde se DÉCLARE `skip`. On ne peut pas exiger la
 * donnée protégée pour pouvoir la protéger.
 * ─────────────────────────────────────────────────────────────────────
 */

export const RACINE = process.cwd();
const SEEDS = join(RACINE, "donnees-privees/pipeline-juillet.seeds.ts");
const CSV_ICP = join(RACINE, "donnees-privees/prospects-icp.csv");

/** Vrai quand au moins une source privée est là — sinon, `skip`. */
export const DONNEE_PRIVEE_PRESENTE = existsSync(SEEDS) || existsSync(CSV_ICP);

export const MOTIF_SKIP_NOMS =
  "donnees-privees/ absent (clone propre) : aucun nom réel à comparer. La garde structurelle, elle, tourne partout.";

/**
 * ⚠ LE VOCABULAIRE COMMUN N'EST PAS UN NOM DE PROSPECT.
 *
 * Cette liste-ci ne recopie PAS la donnée protégée : elle recopie les mots
 * publics et stables — métiers, formes juridiques, mots de process — qui
 * apparaissent dans les raisons sociales ET partout dans le produit. Les
 * interdire rendrait le test ininterprétable et on le désarmerait.
 *
 * La direction d'erreur est la bonne : un mot de métier oublié fait un faux
 * positif qu'on vient ajouter ICI en le justifiant, tandis qu'un nom propre
 * inédit reste attrapé. L'inverse — une liste de noms à chercher — serait la
 * copie qu'on veut éviter.
 *
 * ⚠ `Closing` y figure parce que les titres de rendez-vous en portent
 * (« Closing X — décision ») : sans lui, le garde signalait trente fichiers
 * du produit qui parlent légitimement de closing. Mesuré au premier passage.
 */
const VOCABULAIRE_COMMUN =
  /^(Carrosserie|Auto|Autos|Auto-école|Auto-ecole|École|Ecole|Agence|Garage|Avocats|Associés|Prestige|Ambulance|Ambulances|Point|Conduite|Chirurgie|Rénovation|Renovation|Traiteur|Immobilier|Immobilière|Automobile|Lyon|Villeurbanne|Cabinet|Centre|Clinique|Institut|Maison|Atelier|Ateliers|L'Atelier|Boulangerie|Restaurant|Pharmacie|Groupe|Société|Electricité|Électricité|Menuiserie|Plomberie|Coiffeur|Coiffure|Construction|Batiment|Bâtiment|Rhône|France|Régie|Regie|Laurent|Michel|Saint|Sainte|St-Michel|Transports|Services|Conseil|Consulting|Partenaire|Partenaires|Closing|CLOSING|Démo|Demo|Décision|Decision|Rappeler)$/i;

/**
 * ⚠⚠ LES TOPONYMES SONT TRAITÉS À PART, ET C'EST LA CALIBRATION QUI COMPTE.
 *
 * `Brotteaux`, `Vitton`, `Garibaldi`, `Vauban` sont des quartiers et des rues
 * de Lyon. Ils arrivent dans la liste parce que des enseignes réelles se
 * nomment d'après eux — mais le mot NU ne désigne personne : « Lyon 6e —
 * Brotteaux Foch Vitton » décrit un TERRITOIRE de prospection, et c'est une
 * phrase parfaitement honnête qu'on écrit partout dans le produit.
 *
 * Les interdire au mot ferait tomber une dizaine de fichiers justes. Or « un
 * garde qui refuse une phrase juste est un garde qu'on assouplira au mauvais
 * endroit la fois suivante » — le dépôt l'a déjà payé le jour où un motif
 * d'affiliation a mordu sur le verbe « supprime ».
 *
 * Ce qui identifie, c'est le toponyme ACCOLÉ À UN MOT DE MÉTIER :
 * « Carrosserie des Brotteaux » est une entreprise, « Brotteaux » est un
 * quartier. D'où les deux niveaux : le mot distinctif rare se cherche seul,
 * l'enseigne bâtie sur un toponyme se cherche ENTIÈRE.
 */
const TOPONYMES_LYONNAIS =
  /^(Brotteaux|Vitton|Garibaldi|Vauban|Foch|Cordeliers|Bellecour|Perrache|Gerland|Confluence|Vaise|Terreaux|Ainay|Charpennes|Monplaisir|Guillotière|Guillotiere|Croix-Rousse|Part-Dieu|Jean-Macé|Grange-Blanche|Montchat|Mermoz|Duchère|Duchere)$/i;

/** Les raisons sociales complètes, telles qu'elles s'écrivent. */
function enseignesBrutes(): string[] {
  const bruts: string[] = [];

  if (existsSync(SEEDS)) {
    const src = readFileSync(SEEDS, "utf8");
    for (const m of src.matchAll(/company:\s*"([^"]+)"/g)) bruts.push(m[1]);
    // Les titres de rendez-vous portent la raison sociale, eux aussi : c'est
    // par eux que la fuite du 10/09 est passée.
    for (const m of src.matchAll(/title:\s*"([^"]+)"/g)) bruts.push(m[1]);
  }

  if (existsSync(CSV_ICP)) {
    const lignes = readFileSync(CSV_ICP, "utf8").split("\n").slice(1);
    for (const l of lignes) {
      const societe = (l.split(";")[0] ?? "").replace(/"/g, "").trim();
      if (societe) bruts.push(societe);
    }
  }

  // Ce qui est entre parenthèses QUALIFIE et n'identifie pas (« (Point S) »,
  // « (traiteur) ») — retiré par la forme, pas énuméré.
  return [...new Set(bruts.map((n) => n.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean))];
}

/**
 * NIVEAU 1 — le nom distinctif, celui qui se recopie seul.
 *
 * « ***NOM-RETIRE*** » se raccourcit presque toujours en « ***NOM-RETIRE*** », et
 * c'est sous cette forme courte qu'elle avait fui dans un chunk public.
 */
export function nomsReels(): string[] {
  return [
    ...new Set(
      enseignesBrutes()
        .flatMap((n) => n.split(/[\s—·,:]+/))
        .map((mot) => mot.replace(/[^\p{L}'-]/gu, ""))
        .filter((mot) => mot.length >= 5 && /^[A-ZÉÈÀÂÎÔÛ]/.test(mot))
        .filter((mot) => !VOCABULAIRE_COMMUN.test(mot))
        .filter((mot) => !TOPONYMES_LYONNAIS.test(mot))
    ),
  ];
}

/**
 * NIVEAU 2 — l'enseigne entière bâtie sur un toponyme.
 *
 * Rendue en motif souple sur les espaces et les liaisons (« des », « de »,
 * « du ») : une recopie à la main ne respecte pas la ponctuation d'origine,
 * et c'est justement la recopie à la main qui a fui la dernière fois.
 */
export function enseignesToponymiques(): RegExp[] {
  return enseignesBrutes()
    .filter((n) => n.split(/\s+/).some((mot) => TOPONYMES_LYONNAIS.test(mot.replace(/[^\p{L}'-]/gu, ""))))
    .map((n) => {
      const mots = n
        .split(/\s+/)
        .map((m) => m.replace(/[^\p{L}'-]/gu, ""))
        .filter((m) => m.length > 1 && !/^(de|des|du|la|le|les|et)$/i.test(m));
      return new RegExp(mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-'’]*(?:de[s]?\\s+|du\\s+|la\\s+|le\\s+)?"), "i");
    });
}
