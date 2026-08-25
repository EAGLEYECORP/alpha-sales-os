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
 * que `buildLadder` va les chercher pour décider si la marche Callflow se
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

/**
 * Le métier lu sur la fiche, gardé en clair dans les notes.
 *
 * L'enum `Sector` ne compte que cinq valeurs : « carrosserie », « auto-école »
 * ou « régie immobilière » y tomberaient dans « autre » et la fiche perdrait
 * sa verticale. `verticalForProspect` lit les notes — c'est là que le mot doit
 * atterrir, exactement comme le fait déjà l'import CSV.
 */
function notesDepuisFiche(f: FicheTerrain, c: CiblageTerrain): string {
  const bouts: string[] = [];
  if (f.secteur) bouts.push(`Métier : ${f.secteur}.`);
  if (c.verticaleLabel) bouts.push(`Verticale : ${c.verticaleLabel}.`);
  for (const s of c.signaux) bouts.push(`${s.label} — ${s.fait}`);
  if (c.manque.length) bouts.push(`À vérifier : ${c.manque.join(" · ")}.`);
  return bouts.join(" ");
}

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
    sector: "autre" as Sector,
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
      currentProcess: c.signaux.find((s) => s.id === "trou-horaire")?.fait ?? "",
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
