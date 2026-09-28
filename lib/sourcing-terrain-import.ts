import { prospectDefaults } from "./seed";
import { champsReconnus, lireTableau, type Lecture } from "./tabulaire";
import type { Prospect, Sector } from "./types";
import {
  qualifierTerrain, trierTerrain, type CiblageTerrain, type FicheTerrain,
} from "./sourcing-terrain";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ENTRÉE DES FICHES TERRAIN — d'un relevé d'annuaire vers une file d'appels.
 *
 * Même chaîne que le sourcing LinkedIn, même lecteur mutualisé
 * (`lib/tabulaire.ts`), mais une DIFFÉRENCE de fond dans ce qui est produit :
 * ici, ce qui sort est destiné à être COMPOSÉ. Une fiche sans numéro
 * exploitable n'est pas une fiche faible, c'est une fiche hors sujet.
 *
 * Les signaux de demande relevés (volume d'avis, plainte d'injoignabilité,
 * trou horaire) atterrissent dans `deepAudit` — pas dans les notes. C'est là
 * que `buildLadder` va les chercher pour décider si la marche Alpha Voice se
 * déclenche. Les ranger ailleurs reviendrait à faire le travail deux fois.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que les annuaires et les cartes appellent chaque colonne. */
const ALIAS: Record<string, keyof FicheTerrain> = {
  entreprise: "entreprise", nom: "entreprise", name: "entreprise", raisonsociale: "entreprise",
  etablissement: "entreprise", company: "entreprise", title: "entreprise",
  secteur: "secteur", activite: "secteur", metier: "secteur", categorie: "secteur",
  category: "secteur", type: "secteur", industry: "secteur",
  ville: "ville", city: "ville", commune: "ville", localite: "ville",
  adresse: "adresse", address: "adresse", rue: "adresse",
  telephone: "telephone", tel: "telephone", phone: "telephone", phonenumber: "telephone",
  numero: "telephone", mobile: "telephone",
  siteweb: "siteWeb", site: "siteWeb", website: "siteWeb", web: "siteWeb", url: "siteWeb",
  avis: "avis", nombreavis: "avis", reviews: "avis", reviewcount: "avis", usertotal: "avis",
  note: "note", rating: "note", etoiles: "note", stars: "note", score: "note",
  horaires: "horaires", hours: "horaires", openinghours: "horaires", ouverture: "horaires",
  extraitsavis: "extraitsAvis", avistexte: "extraitsAvis", commentaires: "extraitsAvis",
  reviewtext: "extraitsAvis", extraits: "extraitsAvis", verbatim: "extraitsAvis",
  taille: "taille", effectif: "taille", employees: "taille", size: "taille",
  // Croisement avec le registre des entreprises : le code APE prime sur
  // l'enseigne dans le tri, donc ces deux colonnes valent d'être lues.
  naf: "naf", ape: "naf", codenaf: "naf", codeape: "naf", activiteprincipale: "naf",
  siren: "siren", siret: "siren",
};

export const COLONNES_TERRAIN = champsReconnus(ALIAS);

export interface ParseTerrain extends Lecture<FicheTerrain> {
  fiches: FicheTerrain[];
}

export function parserFiches(texte: string): ParseTerrain {
  const lu = lireTableau<FicheTerrain>(texte, ALIAS);
  const fiches = lu.entrees as FicheTerrain[];
  return { ...lu, entrees: fiches, fiches };
}

/** Un extrait d'avis plus long que ça n'apporte plus rien au téléphone. */
const CITATION_MAX = 220;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES NOTES D'UNE FICHE TERRAIN — des FAITS, pas de la doctrine recopiée.
 *
 * La version d'avant écrivait `s.fait` pour chaque signal, c'est-à-dire la
 * PHRASE D'EXPLICATION du signal (« C'est LEUR phrase, pas notre estimation —
 * utilisable en question, jamais en reproche »). Deux conséquences mesurées :
 *
 *  · 825 octets par fiche, soit 47 % du poids d'un prospect, pour recopier
 *    mille fois le même paragraphe de doctrine. À 1 744 octets la fiche,
 *    1 000 numéros pèsent ~3,3 Mo en UTF-16 : les deux tiers du quota
 *    localStorage, avant le Cerveau et les campagnes. Le mur était à ~1 500.
 *  · Et pendant ce temps, LA PHRASE DU CLIENT — le seul texte qui serve
 *    vraiment au téléphone, celui qu'on relit avant de composer — n'était
 *    PAS conservée. On gardait le commentaire du code et on jetait la preuve.
 *
 * Ici on ne garde que ce qui ne se recalcule pas : le métier, le SIREN, la
 * verticale, et la citation brute. Le MÉTIER reste en clair et ce n'est pas
 * décoratif : l'enum `Sector` ne compte que cinq valeurs, « carrosserie » ou
 * « régie immobilière » y tomberaient dans « autre », et `verticalForProspect`
 * lit les notes pour retrouver la verticale. Les explications de signaux se
 * régénèrent à tout moment par `qualifierTerrain` — elles vivent dans le
 * code, pas dans mille copies.
 * ─────────────────────────────────────────────────────────────────────
 */
function notesDepuisFiche(f: FicheTerrain, c: CiblageTerrain): string {
  const bouts: string[] = [];
  if (f.secteur) bouts.push(`Métier : ${f.secteur}.`);
  /**
   * Le SIREN est écrit EN CLAIR dans les notes, et ce n'est pas cosmétique :
   * c'est lui que `campaign-runner` relit pour savoir si la cible est une
   * entreprise inscrite au registre — donc si la cadence complète
   * peut s'appliquer, ou si le plafond légal B2C s'impose.
   */
  if (f.siren) bouts.push(`SIREN : ${(f.siren ?? "").replace(/\D/g, "").slice(0, 9)}.`);
  if (c.verticaleLabel) bouts.push(`Verticale : ${c.verticaleLabel}.`);

  // LA CITATION. C'est elle qu'on lit trente secondes avant de composer, et
  // c'est la seule chose ici qui soit irremplaçable : elle ne se recalcule pas.
  const avis = (f.extraitsAvis ?? "").replace(/\s+/g, " ").trim();
  if (avis) {
    const court = avis.length > CITATION_MAX ? `${avis.slice(0, CITATION_MAX - 1).trimEnd()}…` : avis;
    bouts.push(`Avis client : « ${court.replace(/^["«\s]+|["»\s]+$/g, "")} »`);
  }

  // Les LABELS des signaux, jamais leurs explications : « Volume de demandes
  // élevé » suffit à savoir pourquoi la fiche est là ; le paragraphe qui va
  // avec est dans le playbook.
  if (c.signaux.length) bouts.push(`Signaux : ${c.signaux.map((s) => s.label).join(" · ")}.`);
  if (c.manque.length) bouts.push(`À vérifier : ${c.manque.join(" · ")}.`);
  return bouts.join(" ");
}

/**
 * Verticale détectée → valeur de l'enum `Sector`, quand elle existe.
 *
 * ⚠ CE MAILLON MANQUAIT, ET IL CASSAIT LA FILE D'APPELS.
 *
 * L'import forçait `sector: "autre"` pour tout le monde. Or la file d'appels
 * (`buildCallSession`) relit la verticale via `verticalForProspect`, qui
 * cherche d'abord des MOTS-CLÉS dans les notes, puis retombe sur le secteur.
 *
 * Et `VERTICAL_KEYWORDS` ne contient aucune entrée pour la restauration, les
 * bars ni les ambulances : ces trois verticales-là ne se reconnaissent QUE par
 * le secteur. Résultat mesuré : un restaurant sourcé sur le terrain était
 * correctement classé « restauration » par le tri, puis tombait dans
 * « generique » dans la file d'appels — donc sans son script, sans son miroir,
 * sans ses questions de diagnostic. Silencieusement.
 *
 * L'enum compte cinq valeurs et trois n'étaient jamais utilisées. Les voilà.
 */
const VERTICALE_SECTEUR: Record<string, Sector> = {
  restauration: "restaurant",
  "bar-pub": "pub",
  ambulance: "ambulance",
  "artisan-batiment": "artisan",
};

/**
 * Traduit la plainte d'injoignabilité en un nombre d'appels manqués.
 *
 * ⚠ C'est une ESTIMATION DE DÉCLENCHEMENT, pas une mesure — et elle est
 * volontairement calée juste au-dessus du seuil de l'escalier
 * (`HIGH_DEMAND_PER_WEEK`), rien de plus. Mettre un chiffre flatteur ici
 * gonflerait la Taxe d'Ignorance affichée sur la fiche, et le premier prospect
 * qui demande d'où il sort n'aurait pas de réponse.
 *
 * La doctrine est explicite : tout chiffre € est diagnostique, jamais audité,
 * et on le dit. Ce champ sert à faire remonter la fiche, pas à argumenter.
 */
const MANQUES_ESTIMES_SI_PLAINTE = 6;

/**
 * Une fiche retenue devient un prospect appelable.
 *
 * ⚠ `stage` est toujours « prospect » : une entreprise relevée dans un annuaire
 * n'a rien demandé. L'avancer ferait mentir toutes les prévisions.
 */
export function ficheVersProspect(f: FicheTerrain, c: CiblageTerrain, now = new Date()): Prospect {
  const iso = now.toISOString();
  const entreprise = (f.entreprise ?? "").trim() || "Établissement sans nom";
  const plainte = c.signaux.some((s) => s.id === "plainte-injoignable");

  // Identifiant stable sur le NUMÉRO : c'est lui qui définit l'unicité d'une
  // cible d'appel. Deux fiches au même numéro sont le même standard, donc le
  // même appel — et un doublon ici, c'est appeler deux fois la même personne.
  const graine = (c.telephone ?? entreprise).toLowerCase().replace(/[^a-z0-9+]+/g, "-").replace(/^-|-$/g, "");

  const nAvis = Number((f.avis ?? "").replace(/[^\d]/g, "")) || undefined;
  const note = Number((f.note ?? "").replace(",", ".").replace(/[^\d.]/g, "")) || undefined;

  return {
    ...prospectDefaults,
    id: `tr-${graine}`.slice(0, 60),
    company: entreprise,
    name: "",
    sector: (c.verticaleId && VERTICALE_SECTEUR[c.verticaleId]) ?? ("autre" as Sector),
    city: (f.ville ?? "").trim(),
    phone: c.telephone ?? undefined,
    stage: "prospect",
    preferredChannel: "tel",
    notes: notesDepuisFiche(f, c),
    tags: ["terrain", ...(c.verticaleId ? [c.verticaleId] : []), ...(plainte ? ["injoignable"] : [])],
    deepAudit: {
      ...prospectDefaults.deepAudit,
      googleReviews: nAvis,
      googleRating: note,
      websiteState: (f.siteWeb ?? "").trim() || (f.siteWeb === undefined ? "" : "aucun"),
      // Ne se renseigne QUE sur une plainte constatée. Sans plainte, on ne sait
      // rien du volume manqué et inventer un chiffre serait pire que le vide.
      missedCallsPerWeek: plainte ? MANQUES_ESTIMES_SI_PLAINTE : undefined,
      // Le FAIT seul (« fermé sur la pause déjeuner »), pas le paragraphe qui
      // l'explique : celui-là se régénère, et recopié mille fois il pèse.
      currentProcess: (c.signaux.find((s) => s.id === "trou-horaire")?.fait ?? "").split(" — ")[0],
      updatedAt: nAvis || plainte ? iso : undefined,
    },
    createdAt: iso,
    updatedAt: iso,
  } as Prospect;
}

export interface ImportTerrain {
  parse: ParseTerrain;
  retenus: { fiche: FicheTerrain; ciblage: CiblageTerrain; prospect: Prospect }[];
  ecartes: { fiche: FicheTerrain; ciblage: CiblageTerrain }[];
  resume: string[];
}

/** Le parcours complet : texte → fiches → tri → prospects appelables. */
export function importerFiches(texte: string, now = new Date()): ImportTerrain {
  const parse = parserFiches(texte);
  const lot = trierTerrain(parse.fiches);

  const retenus = lot.retenus.map(({ fiche, ciblage }) => ({
    fiche,
    ciblage,
    prospect: ficheVersProspect(fiche, ciblage, now),
  }));

  const resume = [...lot.resume];
  if (parse.rejets.length) {
    resume.push(`${parse.rejets.length} ligne(s) illisibles — voir le détail avant de conclure que le lot est mauvais.`);
  }

  return { parse, retenus, ecartes: lot.ecartes, resume };
}

/** Qualification d'une fiche unique, pour la saisie à la main. */
export const qualifierFiche = qualifierTerrain;

/**
 * Ce tableau est-il un relevé TERRAIN, ou un import CRM ordinaire ?
 *
 * ── POURQUOI CETTE DÉTECTION EXISTE ──
 *
 * Le flux réel est : relevé sur une carte → Google Sheet → Alpha. Or l'import
 * de feuille passait par `csvToProspects`, l'import CRM générique. Les
 * colonnes qui portent tout le tri — nombre d'avis, extraits d'avis, code
 * APE — y étaient simplement IGNORÉES. Les fiches entraient, et la plainte
 * d'injoignabilité, la verticale confirmée et le plan d'appels ne sortaient
 * jamais. Rien ne le disait : l'import annonçait « ✓ 200 nouveaux ».
 *
 * ── POURQUOI ON DÉTECTE AU LIEU DE DEMANDER ──
 *
 * Une case « c'est un relevé terrain » de plus, au moment exact où on colle
 * 200 lignes, est une case qu'on oublie de cocher. Les colonnes disent déjà
 * ce que le fichier est.
 *
 * Le seuil est DEUX marqueurs, pas un : « note » seul apparaît dans des
 * exports CRM ordinaires, et router à tort un import CRM vers le tri terrain
 * ferait exclure toutes les fiches sans téléphone — c'est-à-dire l'inverse du
 * service rendu.
 */
export function ressembleAuTerrain(texte: string): boolean {
  const entete = (texte ?? "").split(/\r?\n/)[0] ?? "";
  if (!entete.trim() || entete.trimStart().startsWith("{") || entete.trimStart().startsWith("[")) return false;

  const marqueurs = [
    /\b(avis|reviews|reviewcount|nombreavis|usertotal)\b/i,
    /\b(extraitsavis|reviewtext|avistexte|verbatim|commentaires)\b/i,
    /\b(naf|ape|codenaf|codeape|activiteprincipale)\b/i,
    /\b(horaires|hours|openinghours|ouverture)\b/i,
    /\b(note|rating|etoiles|stars)\b/i,
  ];
  return marqueurs.filter((re) => re.test(entete)).length >= 2;
}

// ── L'API PLACES DE GOOGLE ─────────────────────────────────────────────

/**
 * ─────────────────────────────────────────────────────────────────────
 * ADAPTATEUR PLACES — la seule source qui rend le signal fort, légalement.
 *
 * ── POURQUOI UN ADAPTATEUR DÉDIÉ ──
 *
 * Le lecteur générique (`lib/tabulaire.ts`) mappe des colonnes PLATES. La
 * réponse de l'API Places est imbriquée : `displayName.text`,
 * `reviews[].text.text`, `regularOpeningHours.weekdayDescriptions[]`. Aucune
 * table d'alias ne descend là-dedans, et bricoler des chemins pointés dans le
 * lecteur générique le rendrait illisible pour tous les autres usages.
 *
 * ── ET POURQUOI PLACES PLUTÔT QUE DU SCRAPING ──
 *
 * Aspirer les pages Google Maps viole les conditions d'utilisation de Google.
 * C'est exactement la même catégorie que le backend LinkedIn à session qu'on a
 * refusé — refuser l'un et faire l'autre serait une doctrine à géométrie
 * variable.
 *
 * L'API rend précisément ce dont le tri a besoin, y compris **le texte des
 * avis** : c'est le signal qui pèse plus que tous les autres, et c'est la
 * seule voie propre pour l'obtenir en volume.
 *
 * ⚠ Elle est PAYANTE et plafonne à 5 avis par établissement. Le tarif et les
 * quotas gratuits changent régulièrement — à vérifier sur la grille Google
 * avant de lancer 1 000 requêtes. Je n'ai pas pu la joindre d'ici.
 * ─────────────────────────────────────────────────────────────────────
 */

/** La forme (partielle) d'un `Place` de l'API v1. Tout est optionnel côté Google. */
interface PlaceV1 {
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  shortFormattedAddress?: string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: { text?: { text?: string }; originalText?: { text?: string } }[];
}

/** La ville se lit dans l'adresse courte : « 12 rue X, 69003 Lyon » → « Lyon ». */
function villeDepuisAdresse(adresse?: string): string {
  const a = (adresse ?? "").trim();
  const m = a.match(/\b\d{5}\s+(.+)$/);
  return m ? m[1].trim() : "";
}

/** Une place de l'API → une fiche terrain, sans rien inventer. */
export function placeVersFiche(p: PlaceV1): FicheTerrain {
  const adresse = p.shortFormattedAddress ?? p.formattedAddress ?? "";

  /**
   * Tous les avis sont concaténés, pas seulement le premier.
   *
   * L'API en rend jusqu'à cinq. La plainte d'injoignabilité peut être dans le
   * quatrième — n'en garder qu'un ferait manquer le signal le plus fort sur
   * une bonne partie du lot, silencieusement.
   */
  const avisTexte = (p.reviews ?? [])
    .map((r) => r.text?.text ?? r.originalText?.text ?? "")
    .filter(Boolean)
    .join(" · ");

  return {
    entreprise: p.displayName?.text ?? "",
    // Le type affiché est en langue lisible (« Atelier de carrosserie ») ; les
    // `types` bruts sont en anglais technique (« car_repair ») et servent de
    // repli. Les deux nourrissent la détection de verticale.
    secteur: [p.primaryTypeDisplayName?.text, ...(p.types ?? [])].filter(Boolean).join(" "),
    ville: villeDepuisAdresse(adresse),
    adresse,
    telephone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? "",
    // ⚠ Distinguer « pas de site » de « champ absent » : le premier est un
    // signal (marche visibilité), le second est une lacune de la requête.
    siteWeb: p.websiteUri ?? (Object.prototype.hasOwnProperty.call(p, "websiteUri") ? "" : undefined),
    avis: p.userRatingCount !== undefined ? String(p.userRatingCount) : undefined,
    note: p.rating !== undefined ? String(p.rating) : undefined,
    horaires: (p.regularOpeningHours?.weekdayDescriptions ?? []).join(" · ") || undefined,
    extraitsAvis: avisTexte || undefined,
  };
}

/**
 * Lit une réponse brute de l'API Places (ou un tableau de `Place`).
 *
 * Accepte `{ places: [...] }` — la forme de `searchText` et `searchNearby` —
 * comme un tableau nu, parce que c'est ce qu'on obtient en concaténant
 * plusieurs pages de résultats à la main.
 */
export function importerPlaces(json: string, now = new Date()): ImportTerrain {
  let places: PlaceV1[];
  try {
    const brut = JSON.parse(json) as unknown;
    const src = Array.isArray(brut)
      ? brut
      : ((brut as { places?: unknown[] })?.places ?? []);
    places = (Array.isArray(src) ? src : []) as PlaceV1[];
  } catch {
    return {
      parse: { entrees: [], fiches: [], rejets: [{ ligne: 1, raison: "JSON invalide", extrait: json.slice(0, 60) }], avertissements: [], format: "aucun" },
      retenus: [],
      ecartes: [],
      resume: ["JSON invalide — colle la réponse complète de l'API, accolades comprises."],
    };
  }

  const fiches = places.map(placeVersFiche);
  const lot = trierTerrain(fiches);
  const retenus = lot.retenus.map(({ fiche, ciblage }) => ({
    fiche,
    ciblage,
    prospect: ficheVersProspect(fiche, ciblage, now),
  }));

  const resume = [...lot.resume];
  const sansAvisTexte = fiches.filter((f) => !f.extraitsAvis).length;
  if (sansAvisTexte) {
    resume.push(
      `${sansAvisTexte} fiche(s) sans texte d'avis : vérifie que le champ « reviews » est bien demandé dans le masque de champs, sinon le signal le plus fort est perdu.`
    );
  }

  return {
    parse: { entrees: fiches, fiches, rejets: [], avertissements: [], format: "json" },
    retenus,
    ecartes: lot.ecartes,
    resume,
  };
}

/**
 * Le masque de champs à demander à l'API.
 *
 * Places facture au champ demandé : réclamer tout coûte plus cher pour rien.
 * `reviews` est le seul champ non négociable — c'est lui qui porte le signal.
 */
export const CHAMPS_PLACES =
  "places.displayName,places.primaryTypeDisplayName,places.shortFormattedAddress," +
  "places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount," +
  "places.regularOpeningHours.weekdayDescriptions,places.reviews";
