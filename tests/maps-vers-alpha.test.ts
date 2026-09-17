import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CSV_TEMPLATE_HEADER, csvToProspects } from "../lib/csv";
import { deepDive } from "../lib/deep-dive";
import { matchOffer } from "../lib/offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PONT MAPS → ALPHA, ÉPROUVÉ JUSQU'À LA FICHE.
 *
 * `scripts/maps-vers-alpha.mjs` convertit l'export de
 * `Mahanaicoach/google-maps-scraper-kit` en CSV d'import Alpha, et remplit le
 * téléphone des fiches de permis — « la troisième colonne », que la doctrine
 * décrit comme relevée À LA MAIN faute de mieux.
 *
 * ══ CE QUI N'A PAS ÉTÉ TESTÉ, ET IL FAUT LE DIRE ══
 *
 * Le kit exige **Docker** et tourne contre Google Maps depuis l'IP de celui
 * qui le lance. Rien de tout ça n'existe dans cette sandbox : **le scraper n'a
 * jamais été exécuté**. Ce qui est éprouvé ici est la TRANSFORMATION, à partir
 * d'un export tel que le kit le décrit — ses colonnes sont lues dans son
 * le script de pilotage du kit (sa constante `LEAD`), pas devinées.
 *
 * ══ POURQUOI LA CHAÎNE VA JUSQU'AU DEEP-DIVE ══
 *
 * Même leçon que le collecteur de permis : un CSV bien formé que l'import
 * ignore en silence produit une file vide, ce qui ressemble trait pour trait à
 * « aucun lead trouvé ». On va donc jusqu'à la fiche, et jusqu'à l'offre qui
 * lui sera proposée.
 * ─────────────────────────────────────────────────────────────────────
 */

const SCRIPT = join(process.cwd(), "scripts/maps-vers-alpha.mjs");

async function outils() {
  return (await import(SCRIPT)) as {
    ENTETE_ALPHA: string;
    COLONNES_MAPS: string[];
    parserCsv: (t: string, sep?: string) => Record<string, string>[];
    ligneMapsVersAlpha: (r: Record<string, string>, o?: { secteur?: string; ville?: string }) => Record<string, string>;
    versCsvAlpha: (l: Record<string, string>[]) => string;
    etatDuSite: (w?: string) => string;
    normaliserNom: (n?: string) => string;
    enrichirFiches: (
      f: Record<string, string>[],
      m: Record<string, string>[],
    ) => { fiches: Record<string, string>[]; rapport: { enrichies: number; ambigues: number; sansCorrespondance: number } };
  };
}

/** Un export tel que le kit en produit un — colonnes de son jeu « LEAD ». */
const EXPORT_MAPS =
  "title,phone,emails,website,category,address,review_rating,review_count\n" +
  '"Plomberie Démo","04 65 71 30 12","contact@example.com","https://example.com","Plombier","12 rue Démo, Lyon","4.2","37"\n' +
  '"Atelier Démo",,,,"Serrurier","3 rue Démo, Lyon","3.1","4"\n';

test("⚠⚠ L'EN-TÊTE PRODUIT EST CELUI QUE L'IMPORT SAIT RELIRE", async () => {
  /**
   * Le script tourne seul, donc il recopie l'en-tête. Cette recopie est
   * exactement ce que la doctrine refuse de laisser sans garde : une
   * divergence produirait un fichier bien formé et une file vide, sans erreur
   * nulle part. Un caractère d'écart fait tomber ce test.
   */
  const { ENTETE_ALPHA } = await outils();
  assert.equal(ENTETE_ALPHA, CSV_TEMPLATE_HEADER);
});

test("⚠⚠ DE L'EXPORT MAPS JUSQU'À LA FICHE — la chaîne, pas les maillons", async () => {
  const { parserCsv, ligneMapsVersAlpha, versCsvAlpha } = await outils();

  const csv = versCsvAlpha(
    parserCsv(EXPORT_MAPS).map((r) => ligneMapsVersAlpha(r, { secteur: "artisan", ville: "Lyon" })),
  );
  const { prospects, skipped } = csvToProspects(csv);

  assert.equal(skipped, 0, "aucune ligne ne doit être jetée par l'import");
  assert.equal(prospects.length, 2);

  const p = prospects[0];
  assert.equal(p.company, "Plomberie Démo");
  assert.equal(p.phone, "04 65 71 30 12");
  assert.equal(p.email, "contact@example.com");
  assert.equal(p.sector, "artisan", "le secteur DÉCLARÉ doit descendre sur la fiche");
  assert.equal(p.deepAudit?.googleRating, 4.2);
  assert.equal(p.deepAudit?.googleReviews, 37);
  assert.match(p.notes ?? "", /Catégorie Google : Plombier/, "la catégorie informe, sans router");
});

test("⚠⚠ UNE COLONNE `website` VIDE NE DEVIENT JAMAIS « AUCUN »", async () => {
  /**
   * ══ LE DÉFAUT QU'ON VIENT DE PAYER, ET QUI REVIENDRAIT PAR L'IMPORT ══
   *
   * `lib/offer-match.ts` traitait la chaîne vide comme « site absent ou
   * obsolète » : +3 sur l'offre Visibilité, sur 8 fiches ICP sur 8. C'est
   * réparé côté lecteur. Écrire « aucun » ici quand Maps ne renseigne pas de
   * site le réintroduirait **par la donnée**, et cette fois avec l'air d'une
   * mesure — puisqu'elle viendrait d'un relevé.
   *
   * Une fiche Maps sans site veut dire « rien n'est renseigné sur Google »,
   * pas « cette entreprise n'a pas de site ». La différence décide de ce
   * qu'on lui vend.
   */
  const { parserCsv, ligneMapsVersAlpha, etatDuSite } = await outils();

  assert.equal(etatDuSite(""), "", "vide reste vide");
  assert.equal(etatDuSite(undefined), "");
  assert.notEqual(etatDuSite(""), "aucun", "…et surtout pas « aucun », qui est un CONSTAT");
  assert.equal(etatDuSite("https://example.com"), "https://example.com");

  const sansSite = ligneMapsVersAlpha(parserCsv(EXPORT_MAPS)[1], { secteur: "artisan" });
  assert.equal(sansSite.website, "");

  // Et le routage d'offre ne doit rien en conclure.
  const m = matchOffer({ sector: "artisan", websiteState: sansSite.website });
  assert.deepEqual(
    m.reasons["visibilite-growth"],
    [],
    "une colonne non renseignée ne doit fabriquer aucune raison à dire au prospect",
  );
});

test("⚠⚠ LE SECTEUR SE DÉCLARE, IL NE SE DEVINE PAS SUR LA CATÉGORIE GOOGLE", async () => {
  /**
   * « Plombier » ressemble beaucoup à `artisan`. Le rapprocher automatiquement
   * serait la devinette que ce dépôt refuse : la file du matin a déjà servi le
   * script du moniteur d'auto-école à des directeurs de programmes parce qu'un
   * motif avait lu le mot « permis » dans une note.
   *
   * Sans `--secteur`, la fiche tombe dans `autre` — visible, corrigeable, et
   * honnête.
   */
  const { parserCsv, ligneMapsVersAlpha } = await outils();
  const sansDeclaration = ligneMapsVersAlpha(parserCsv(EXPORT_MAPS)[0]);
  assert.equal(sansDeclaration.sector, "autre");
  assert.match(sansDeclaration.notes, /Plombier/, "la catégorie n'est pas jetée : elle informe l'humain");

  const src = readFileSync(SCRIPT, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(
    !/(plomb|garage|restaurant|ambulance)/i.test(src),
    "aucune table de correspondance catégorie → secteur ne doit exister hors commentaire",
  );
});

test("⚠⚠ L'ENRICHISSEMENT NE FABRIQUE JAMAIS UN RAPPROCHEMENT", async () => {
  /**
   * C'est ici que se joue le vrai risque du pont. Un rapprochement approximatif
   * pose le numéro d'une entreprise sur la fiche d'une autre, et ce numéro part
   * dans une file d'appels : on appelle quelqu'un en lui parlant du programme
   * du voisin. Rater un rapprochement coûte un relevé à la main — ce qu'on
   * fait déjà aujourd'hui.
   */
  const { enrichirFiches, normaliserNom } = await outils();

  assert.equal(
    normaliserNom("SCCV LES TERRASSES DES CANUTS"),
    normaliserNom("Les Terrasses des Canuts"),
    "la forme juridique et la casse ne doivent pas séparer deux fois la même société",
  );
  assert.notEqual(
    normaliserNom("Les Terrasses des Canuts"),
    normaliserNom("Les Terrasses du Rhône"),
    "…mais deux noms différents restent différents",
  );

  const fiches = [
    { company: "SCCV Les Terrasses des Canuts", phone: "", website: "" },
    { company: "Société Introuvable", phone: "", website: "" },
    { company: "Doublon Démo", phone: "", website: "" },
    { company: "Déjà Relevé", phone: "04 65 71 30 99", website: "" },
  ];
  const maps = [
    { title: "Les Terrasses des Canuts", phone: "04 65 71 30 12", website: "https://example.com" },
    { title: "Doublon Démo", phone: "04 65 71 30 21", website: "" },
    { title: "DOUBLON DEMO", phone: "04 65 71 30 22", website: "" },
    { title: "Déjà Relevé", phone: "04 65 71 30 33", website: "" },
  ];

  const { fiches: sortie, rapport } = enrichirFiches(fiches, maps);

  assert.equal(sortie[0].phone, "04 65 71 30 12", "le rapprochement exact remplit le trou");
  assert.equal(sortie[0].website, "https://example.com");
  assert.equal(sortie[1].phone, "", "aucune correspondance ⇒ on ne remplit rien");
  assert.equal(sortie[2].phone, "", "deux établissements du même nom ⇒ on ÉCARTE, on ne tire pas au sort");
  assert.equal(sortie[3].phone, "04 65 71 30 99", "un relevé humain ne se fait jamais écraser par un scraper");

  assert.equal(rapport.enrichies, 1);
  assert.equal(rapport.ambigues, 1);
});

test("⚠⚠ LE COLLECTEUR RESTE DEHORS — aucun fichier du produit ne l'importe", async () => {
  /**
   * La même garde que pour `permis-lyon.mjs`, et pour la même raison : la
   * doctrine refuse d'embarquer un collecteur, en NOMMANT l'aspiration de
   * Maps. Le kit tourne en Docker, contre Google, depuis l'IP de celui qui le
   * lance — son propre README dit que c'est contraire aux CGU de Google et que
   * l'IP peut être bloquée. Ce risque ne descend pas chez nos clients.
   *
   * ⚠ On cherche un CHEMIN D'IMPORT, pas le nom du fichier : une fiche peut
   * légitimement porter un identifiant qui y ressemble. C'est le défaut exact
   * corrigé sur la garde du collecteur de permis.
   */
  const dossiers = ["lib", "components", "app"];
  const fautes: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.tsx?$/.test(e.name)) {
        const src = readFileSync(p, "utf8");
        if (/(from|import\()\s*["'][^"']*maps-vers-alpha/.test(src)) fautes.push(p);
      }
    }
  };
  for (const d of dossiers) parcourir(join(process.cwd(), d));
  assert.deepEqual(fautes, [], "le pont est un script, jamais un module du produit");
});

test("⚠ LES COLONNES ATTENDUES SONT CELLES QUE LE KIT PRODUIT", async () => {
  /**
   * Elles sont lues dans le script de pilotage du kit (sa constante `LEAD`), pas
   * devinées. Les figer ici fait tomber le test le jour où le kit change de
   * jeu de colonnes — plutôt qu'un import silencieusement vide.
   */
  const { COLONNES_MAPS, parserCsv } = await outils();
  const entete = Object.keys(parserCsv(EXPORT_MAPS)[0]);
  assert.deepEqual(entete, COLONNES_MAPS);
});

test("⚠ LA CONVERSION NE FABRIQUE AUCUN CHIFFRE", async () => {
  /**
   * Un import qui remplit `missedCallsPerWeek` ou `avgTicket` « pour avoir un
   * score » inventerait la douleur du prospect. `deepDive` doit voir une fiche
   * pauvre et le DIRE dans ses trous, au lieu de la faire passer pour auditée.
   */
  const { parserCsv, ligneMapsVersAlpha, versCsvAlpha } = await outils();
  const csv = versCsvAlpha(parserCsv(EXPORT_MAPS).map((r) => ligneMapsVersAlpha(r, { secteur: "artisan" })));
  const { prospects } = csvToProspects(csv);

  for (const p of prospects) {
    assert.equal(p.deepAudit?.missedCallsPerWeek, undefined, "rien n'a été relevé sur le volume d'appels");
    assert.equal(p.deepAudit?.avgTicket, undefined);
    assert.equal(p.setupValue ?? 0, 0, "aucun montant ne s'invente à l'import");
  }
  const d = deepDive(prospects[0]);
  assert.ok(
    d.gaps.some((g) => /appels manqués|constater/i.test(g)),
    "le deep-dive doit NOMMER ce qui manque, pas combler",
  );
});
