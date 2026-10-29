/**
 * ─────────────────────────────────────────────────────────────────────
 * « TROUVE-MOI DES CLIENTS » — le registre officiel des entreprises, lu par
 * métier et par zone (29/10/2026).
 *
 * ── POURQUOI ──
 * La promesse d'Alpha est qu'un vendeur se concentre sur ce qu'il vend
 * pendant qu'ALPHA trouve ses clients. Jusqu'ici, ALPHA ne trouvait rien : il
 * triait ce qu'on lui donnait (un CSV, un export, une feuille). Un inscrit
 * sans fichier arrivait devant un CRM vide, et c'était la fin du parcours.
 *
 * L'État publie le registre des entreprises en API ouverte
 * (recherche-entreprises.api.gouv.fr) : sans clé, sans compte, gratuite,
 * faite pour être réutilisée. Une recherche « plombiers du 69 » rend des
 * entreprises RÉELLES, actives, avec leur SIREN — la clé qui ouvre déjà leurs
 * annonces légales (`lib/signaux-publics.ts`).
 *
 * ── ⚠⚠ CE N'EST PAS UN COLLECTEUR, ET LA DIFFÉRENCE EST ÉCRITE ──
 * La doctrine refuse d'embarquer un collecteur (aspiration d'annuaire, de
 * Maps, de LinkedIn — `docs/COLLECTEURS-EXTERIEURS.md`). Ceci n'en est pas un :
 * une requête, à la demande de l'utilisateur, vers un service public conçu
 * pour ça, qui répond `access-control-allow-origin: *`. Rien n'est aspiré,
 * rien ne tourne en tâche de fond, rien ne contourne une protection.
 *
 * ⚠ `lib/registre-entreprises.ts` (l'appariement d'une fiche Maps au registre)
 * a fait le choix INVERSE, et il reste juste pour son cas : rapprocher un
 * import de 1 000 fiches déclencherait 1 000 requêtes depuis le navigateur.
 * Ici, une recherche = UNE requête, une page de 25, au clic. Les deux modules
 * ne se mélangent pas, et un test garde l'autre sans `fetch`.
 *
 * ── ⚠⚠ DU NAVIGATEUR, JAMAIS PAR NOTRE SERVEUR ──
 * Même règle que le BODACC : une route à nous recevrait le métier et la zone
 * que vise chaque inscrit — sa stratégie commerciale. La requête part du
 * navigateur (CORS `*` et CSP `connect-src https:`, vérifiés le 29/10/2026) et
 * un test refuse toute mention de ce registre sous `app/api/`.
 *
 * ── CE QUE LE REGISTRE DONNE, ET CE QU'IL NE DONNE PAS ──
 * · Il donne : la raison sociale, le SIREN, l'adresse de l'établissement dans
 *   la zone, l'activité, la tranche d'effectif, la date de création, les
 *   dirigeants déclarés.
 * · Il NE donne NI téléphone, NI email, NI site. L'écran le dit avant le
 *   premier résultat : une fiche importée d'ici est une entreprise à JOINDRE,
 *   pas un contact. Prétendre l'inverse ferait croire que la file d'appels
 *   est prête alors qu'elle est muette.
 *
 * ── ⚠⚠ LE REGISTRE IGNORE EN SILENCE UN FILTRE QU'IL NE CONNAÎT PAS ──
 * Mesuré le 29/10/2026 : un paramètre au nom inconnu ne rend pas d'erreur, il
 * est OUBLIÉ — et la recherche rend les 10 000 premières entreprises du
 * département, tous métiers confondus. Un garde qui échoue en s'ouvrant : le
 * jour où l'API renomme un filtre, on importerait n'importe qui sous
 * l'étiquette « plombiers ». La lecture revérifie donc, sur CHAQUE résultat,
 * l'activité, la zone et la taille demandées ; ce qui ne correspond pas est
 * écarté et compté (`autre-activite`, `hors-zone`, `hors-taille`), et une page
 * entièrement écartée se voit au premier coup d'œil.
 *
 * ── ⚠ LA NAF 2025 AU 1ᵉʳ JANVIER 2027 ──
 * Le filtre lit la NAF rév. 2 ; le registre porte déjà le code NAF 2025 de
 * chaque entreprise, mais aucun filtre ne le lit (mesuré : le paramètre
 * `activite_principale_naf25` est ignoré, donc sans effet). La date vient de
 * `BASCULE_NAF_2025` — une seule définition. Après elle, l'écran prévient ; si
 * le registre bascule, la recherche répondra 400 et l'écran le dira.
 *
 * ── ⚠ RIEN N'EST DEVINÉ ──
 * · La zone se lit sur un CODE (postal ou département), jamais sur un nom :
 *   « Saint-Priest » existe dans trois départements.
 * · Une panne est `non-lu`, jamais une liste vide — qui se lirait « personne
 *   ne fait ce métier ici ».
 * · `total_results` plafonne à 10 000 (mesuré) : « 10 000 » veut dire « au
 *   moins 10 000 », et l'écran l'écrit ainsi.
 * · Ce qui est écarté est COMPTÉ et NOMMÉ (déjà dans le CRM, non diffusible,
 *   fermé, hors zone), jamais tu.
 * · Des dirigeants, on garde le nom et la qualité. Jamais la date de
 *   naissance ni la nationalité, que l'API rend aussi : elles ne servent pas
 *   à vendre et n'ont rien à faire dans un CRM.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { Prospect } from "./types";
import { prospectDefaults } from "./seed";
import { daysAhead } from "./utils";
import { sirenValide } from "./siren";
import { codeNafValide, libelleNaf } from "./naf";
import { exclusionPublique, momentFrais, type ExclusionPublique, type LectureSignaux, type ResultatLecture, type SignalPublic } from "./signaux-publics";

export const REGISTRE = "https://recherche-entreprises.api.gouv.fr/search";
/** Le maximum que l'API accepte (mesuré : 26 → 400). */
export const PAR_PAGE = 25;
/** `page × per_page` ne peut dépasser ce nombre, et `total_results` s'y arrête (mesuré). */
export const PLAFOND_RESULTATS = 10_000;
/** Bornes de saisie : au-delà, l'adresse devient illisible et la cible floue. Décisions. */
export const MAX_CODES_ACTIVITE = 20;
export const MAX_CODES_ZONE = 20;

// ══════════ LA ZONE ══════════

export type ChampZone = "code_postal" | "departement";
export interface Zone {
  champ: ChampZone;
  codes: string[];
}

/** 01–95 sauf 20 (la Corse est 2A / 2B), et l'outre-mer 971–976. */
const DEPARTEMENT = /^(?:0[1-9]|1\d|2[1-9]|[3-8]\d|9[0-5]|2A|2B|97[1-6])$/;
const CODE_POSTAL = /^(?:0[1-9]|[1-8]\d|9[0-8])\d{3}$/;

/**
 * « 69003, 69006 » · « 69 » · « 2A » · « 974 ». Une recherche porte sur des
 * codes postaux OU sur des départements : le registre combine les deux par
 * un ET, et « 69 et 69003 » ne voudrait rien dire de plus que « 69003 ».
 */
export function lireZone(saisie: string): { ok: true; zone: Zone } | { ok: false; raison: string } {
  const jetons = saisie
    .toUpperCase()
    .split(/[\s,;/]+/)
    .map((j) => j.trim())
    .filter(Boolean);
  if (!jetons.length) return { ok: false, raison: "indique un code postal (69003) ou un département (69)" };
  const postaux: string[] = [];
  const departements: string[] = [];
  for (const j of jetons) {
    if (CODE_POSTAL.test(j)) postaux.push(j);
    else if (DEPARTEMENT.test(j)) departements.push(j);
    else if (/[A-Z]{3,}/.test(j)) {
      return {
        ok: false,
        raison: `« ${j.slice(0, 30)} » est un nom : la zone se donne par son CODE (code postal 69003, ou département 69) — un même nom de commune existe parfois dans plusieurs départements`,
      };
    } else return { ok: false, raison: `« ${j.slice(0, 12)} » n'est ni un code postal ni un département` };
  }
  if (postaux.length && departements.length) {
    return { ok: false, raison: "une recherche porte sur des codes postaux OU sur des départements, pas les deux à la fois" };
  }
  const codes = Array.from(new Set(postaux.length ? postaux : departements));
  if (codes.length > MAX_CODES_ZONE) return { ok: false, raison: `${MAX_CODES_ZONE} codes au plus par recherche` };
  return { ok: true, zone: { champ: postaux.length ? "code_postal" : "departement", codes } };
}

/** Le département d'un code postal — par le CODE, jamais par le nom de commune. */
function departementDuCodePostal(cp: string): string {
  if (cp.startsWith("97") || cp.startsWith("98")) return cp.slice(0, 3);
  if (cp.startsWith("20")) return Number(cp) < 20200 ? "2A" : "2B";
  return cp.slice(0, 2);
}

function dansLaZone(z: Zone, cp: string | undefined, dep: string | undefined): boolean {
  if (z.champ === "code_postal") return Boolean(cp && z.codes.includes(cp));
  const d = (dep ?? (cp ? departementDuCodePostal(cp) : "")).toUpperCase();
  return z.codes.includes(d);
}

// ══════════ LA TAILLE ══════════

/**
 * La tranche d'effectif, telle que l'INSEE la code. ⚠ « NN » n'est PAS
 * « zéro salarié » : c'est « non employeuse, OU effectif non déclaré » —
 * mesuré sur une société à 34 établissements codée NN. Le dire « sans
 * salarié » ferait sortir des listes des entreprises qui en ont.
 */
export const TRANCHES: Readonly<Record<string, string>> = {
  NN: "effectif non déclaré",
  "00": "aucun salarié en fin d'année",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

export type TailleCible = "toutes" | "employeur" | "10-plus" | "50-plus";

const ORDRE_TRANCHES = ["01", "02", "03", "11", "12", "21", "22", "31", "32", "41", "42", "51", "52", "53"];

/** Les tranches à demander. `toutes` n'en demande aucune : NN et 00 restent dedans. */
export function tranchesPour(t: TailleCible): string[] {
  if (t === "employeur") return ORDRE_TRANCHES;
  if (t === "10-plus") return ORDRE_TRANCHES.slice(ORDRE_TRANCHES.indexOf("11"));
  if (t === "50-plus") return ORDRE_TRANCHES.slice(ORDRE_TRANCHES.indexOf("21"));
  return [];
}

// ══════════ LA REQUÊTE ══════════

export interface CriteresRecherche {
  activites: string[];
  zone: string;
  taille: TailleCible;
}

export type CriteresValides = { activites: string[]; zone: Zone; taille: TailleCible };

export function validerCriteres(c: CriteresRecherche): { ok: true; criteres: CriteresValides } | { ok: false; raison: string } {
  const activites = Array.from(new Set(c.activites));
  if (!activites.length) return { ok: false, raison: "choisis au moins une activité" };
  const inconnu = activites.find((a) => !codeNafValide(a));
  if (inconnu) return { ok: false, raison: `« ${inconnu.slice(0, 12)} » n'est pas un code d'activité de la nomenclature` };
  if (activites.length > MAX_CODES_ACTIVITE) return { ok: false, raison: `${MAX_CODES_ACTIVITE} activités au plus par recherche` };
  const z = lireZone(c.zone);
  if (!z.ok) return z;
  return { ok: true, criteres: { activites, zone: z.zone, taille: c.taille } };
}

/** L'adresse exacte de la requête — exposée pour que le test vérifie ce qui part. */
export function urlDeRecherche(c: CriteresValides, page: number): string {
  const url = new URL(REGISTRE);
  url.searchParams.set("activite_principale", c.activites.join(","));
  url.searchParams.set(c.zone.champ, c.zone.codes.join(","));
  url.searchParams.set("etat_administratif", "A");
  const tranches = tranchesPour(c.taille);
  if (tranches.length) url.searchParams.set("tranche_effectif_salarie", tranches.join(","));
  url.searchParams.set("per_page", String(PAR_PAGE));
  url.searchParams.set("page", String(page));
  return url.toString();
}

// ══════════ LA LECTURE ══════════

/** Ce que le registre rend — seulement les champs qu'on lit (mesurés le 29/10/2026). */
interface EtablissementBrut {
  siret?: string;
  adresse?: string | null;
  code_postal?: string | null;
  departement?: string | null;
  libelle_commune?: string | null;
  activite_principale?: string | null;
  etat_administratif?: string | null;
  statut_diffusion_etablissement?: string | null;
  liste_enseignes?: string[] | null;
  tranche_effectif_salarie?: string | null;
}

interface DirigeantBrut {
  type_dirigeant?: string;
  nom?: string | null;
  prenoms?: string | null;
  denomination?: string | null;
  qualite?: string | null;
}

export interface EntrepriseBrute {
  siren?: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  activite_principale?: string | null;
  etat_administratif?: string | null;
  statut_diffusion?: string | null;
  tranche_effectif_salarie?: string | null;
  date_creation?: string | null;
  siege?: EtablissementBrut | null;
  matching_etablissements?: EtablissementBrut[] | null;
  dirigeants?: DirigeantBrut[] | null;
  complements?: { est_entrepreneur_individuel?: boolean | null } | null;
}

export interface EntrepriseTrouvee {
  siren: string;
  nom: string;
  /** L'enseigne de l'établissement de la zone, si elle est déclarée — c'est le nom sur la vitrine. */
  enseigne?: string;
  activite: { code: string; libelle: string };
  adresse: string;
  codePostal: string;
  commune: string;
  taille: { code: string; libelle: string };
  creeLe?: string;
  entrepreneurIndividuel: boolean;
  /** Combien de ses établissements sont dans la zone — plusieurs = un réseau, pas une boutique. */
  etablissementsDansLaZone: number;
  /** « Prénoms NOM — qualité ». Ni date de naissance, ni nationalité. */
  dirigeants: string[];
  /**
   * Le représentant, structuré — seulement s'il est l'UNIQUE dirigeant personne
   * physique. Plusieurs : on ne choisit pas (ce serait deviner), et Dropcontact
   * cherche lui-même le représentant légal à partir du SIREN.
   */
  representant?: { prenom: string; nom: string };
}

export type MotifEcart = "deja-dans-le-crm" | "non-diffusible" | "fermee" | "hors-zone" | "autre-activite" | "hors-taille" | "siren-invalide";

export const LIBELLE_ECART: Readonly<Record<MotifEcart, string>> = {
  "deja-dans-le-crm": "déjà dans ton CRM",
  "non-diffusible": "non diffusible (l'entreprise a refusé la diffusion de ses données)",
  fermee: "fermée",
  "hors-zone": "aucun établissement dans ta zone",
  "autre-activite": "aucun établissement de la zone n'exerce l'activité demandée",
  "hors-taille": "hors de la taille demandée",
  "siren-invalide": "SIREN illisible",
};

export interface Ecartee {
  motif: MotifEcart;
  /** `null` quand le nom ne doit PAS s'afficher : une entreprise non diffusible ne se nomme pas. */
  nom: string | null;
}

export interface LectureRegistre {
  total: number;
  /** `total` a touché le plafond de l'API : il y en a AU MOINS autant. */
  totalPlafonne: boolean;
  page: number;
  pages: number;
  entreprises: EntrepriseTrouvee[];
  ecartees: Ecartee[];
}

/**
 * « VAULX-EN-VELIN » → « Vaulx-en-Velin ». Le registre écrit les communes en
 * capitales et sans accent ; on ne rajoute PAS les accents (on les devinerait),
 * on rend seulement la casse lisible.
 */
export function casseCommune(s: string): string {
  const petits = new Set(["en", "sur", "sous", "le", "la", "les", "de", "des", "du", "aux", "au", "et", "les", "lez", "l", "d"]);
  return s
    .toLowerCase()
    .split(/([\s'-]+)/)
    .map((m, i) => (/^[\s'-]+$/.test(m) || (i > 0 && petits.has(m)) ? m : m.charAt(0).toUpperCase() + m.slice(1)))
    .join("");
}

/**
 * « JEAN PIERRE » / « DUPONT (MARTIN) » → { prenom: « JEAN », nom: « DUPONT » }.
 * Le premier prénom est celui qu'on passe à un annuaire pour CHERCHER, pas un
 * nom qu'on affiche : le registre ne dit pas lequel est l'usuel.
 */
function representantUnique(ds: DirigeantBrut[] | null | undefined): { prenom: string; nom: string } | undefined {
  const personnes = (ds ?? []).filter((d) => d.type_dirigeant !== "personne morale" && (d.nom ?? "").trim());
  if (personnes.length !== 1) return undefined;
  const nom = (personnes[0].nom ?? "").replace(/\(.*?\)/g, "").trim();
  const prenom = (personnes[0].prenoms ?? "").trim().split(/\s+/)[0] ?? "";
  return nom ? { prenom, nom } : undefined;
}

function dirigeantsLisibles(ds: DirigeantBrut[] | null | undefined): string[] {
  return (ds ?? [])
    .map((d) => {
      const qui = d.type_dirigeant === "personne morale" ? (d.denomination ?? "").trim() : `${(d.prenoms ?? "").trim()} ${(d.nom ?? "").trim()}`.trim();
      if (!qui) return "";
      return d.qualite ? `${qui} — ${d.qualite}` : qui;
    })
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Lit une page du registre. Pure : la même réponse donne la même lecture.
 * `dejaConnus` = les SIREN déjà présents dans le CRM du navigateur.
 */
export function lireReponse(json: unknown, c: CriteresValides, dejaConnus: ReadonlySet<string>): LectureRegistre | null {
  if (!json || typeof json !== "object") return null;
  const r = json as { results?: unknown; total_results?: unknown; page?: unknown; total_pages?: unknown };
  if (!Array.isArray(r.results)) return null;
  const total = typeof r.total_results === "number" ? r.total_results : r.results.length;
  const entreprises: EntrepriseTrouvee[] = [];
  const ecartees: Ecartee[] = [];
  const activites = new Set(c.activites);
  const tranches = new Set(tranchesPour(c.taille));

  for (const brut of r.results as EntrepriseBrute[]) {
    const siren = (brut.siren ?? "").trim();
    const nom = (brut.nom_raison_sociale || brut.nom_complet || "").trim();
    // ⚠ La diffusion d'abord : une entreprise qui l'a refusée ne se nomme pas,
    // même dans la liste de ce qu'on écarte.
    if ((brut.statut_diffusion ?? "O") !== "O" || /NON[- ]DIFFUSIBLE/i.test(nom)) {
      ecartees.push({ motif: "non-diffusible", nom: null });
      continue;
    }
    if (!sirenValide(siren)) {
      ecartees.push({ motif: "siren-invalide", nom: nom || null });
      continue;
    }
    if ((brut.etat_administratif ?? "A") !== "A") {
      ecartees.push({ motif: "fermee", nom });
      continue;
    }
    if (dejaConnus.has(siren)) {
      ecartees.push({ motif: "deja-dans-le-crm", nom });
      continue;
    }
    const tranche = (brut.tranche_effectif_salarie ?? "NN").trim() || "NN";
    if (tranches.size && !tranches.has(tranche)) {
      ecartees.push({ motif: "hors-taille", nom });
      continue;
    }
    // L'établissement qu'on montre est celui de la ZONE, ouvert et diffusible —
    // pas le siège, qui peut être à l'autre bout du pays (mesuré : siège à
    // Lyon 7e en 70.10Z, établissement qui correspond à Lyon 3e en 43.22A).
    const ouverts = [...(brut.matching_etablissements ?? []), ...(brut.siege ? [brut.siege] : [])].filter(
      (e) => (e.etat_administratif ?? "A") === "A" && (e.statut_diffusion_etablissement ?? "O") === "O"
    );
    const dansZone = ouverts.filter((e) => dansLaZone(c.zone, e.code_postal ?? undefined, e.departement ?? undefined));
    if (!dansZone.length) {
      ecartees.push({ motif: "hors-zone", nom });
      continue;
    }
    // Et qui EXERCE l'activité demandée : le filtre du registre ne se croit
    // pas sur parole (voir l'en-tête).
    const candidats = dansZone.filter((e) => activites.has((e.activite_principale ?? "").trim()));
    const etab = candidats[0];
    if (!etab) {
      ecartees.push({ motif: "autre-activite", nom });
      continue;
    }
    const sirets = new Set(candidats.map((e) => e.siret ?? e.adresse ?? ""));
    const code = (etab.activite_principale ?? "").trim();
    entreprises.push({
      siren,
      nom: nom || siren,
      enseigne: etab.liste_enseignes?.find((e) => e && e.trim())?.trim(),
      activite: { code, libelle: libelleNaf(code) ?? code },
      adresse: (etab.adresse ?? "").trim(),
      codePostal: (etab.code_postal ?? "").trim(),
      commune: casseCommune((etab.libelle_commune ?? "").trim()),
      taille: { code: tranche, libelle: TRANCHES[tranche] ?? "effectif inconnu" },
      creeLe: brut.date_creation ?? undefined,
      entrepreneurIndividuel: brut.complements?.est_entrepreneur_individuel === true,
      etablissementsDansLaZone: sirets.size,
      dirigeants: dirigeantsLisibles(brut.dirigeants),
      representant: representantUnique(brut.dirigeants),
    });
  }

  const page = typeof r.page === "number" ? r.page : 1;
  const pagesApi = typeof r.total_pages === "number" ? r.total_pages : 1;
  return {
    total,
    totalPlafonne: total >= PLAFOND_RESULTATS,
    page,
    // Au-delà de 10 000 résultats, l'API refuse la page : on ne la propose pas.
    pages: Math.min(pagesApi, Math.floor(PLAFOND_RESULTATS / PAR_PAGE)),
    entreprises,
    ecartees,
  };
}

// ══════════ LE TRANSPORT ══════════

export type ResultatRecherche =
  | { etat: "lu"; lecture: LectureRegistre }
  | { etat: "non-lu"; raison: string }
  | { etat: "invalide"; raison: string };

type Fetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Cherche, depuis le navigateur. `f` est injecté : le test vérifie ce qui part
 * et ce qu'on conclut d'une panne, sans réseau.
 */
export async function chercherEntreprises(
  c: CriteresRecherche,
  page: number,
  f: Fetch,
  dejaConnus: ReadonlySet<string> = new Set()
): Promise<ResultatRecherche> {
  const v = validerCriteres(c);
  if (!v.ok) return { etat: "invalide", raison: v.raison };
  if (!Number.isInteger(page) || page < 1 || page * PAR_PAGE > PLAFOND_RESULTATS) {
    return { etat: "invalide", raison: "le registre ne sert pas au-delà de 10 000 résultats : resserre la zone ou l'activité" };
  }
  try {
    const res = await f(urlDeRecherche(v.criteres, page), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      if (res.status === 429) return { etat: "non-lu", raison: "le registre limite le nombre de recherches par seconde : réessaie dans un instant" };
      if (res.status === 400) {
        // L'API dit pourquoi en clair (« … n'est pas valide ») : on le montre.
        const corps = (await res.json().catch(() => null)) as { erreur?: unknown } | null;
        const pourquoi = typeof corps?.erreur === "string" ? corps.erreur.slice(0, 200) : "requête refusée";
        return { etat: "non-lu", raison: `le registre a refusé la recherche : ${pourquoi}` };
      }
      return { etat: "non-lu", raison: `le registre a répondu ${res.status}` };
    }
    const lecture = lireReponse(await res.json(), v.criteres, dejaConnus);
    return lecture ? { etat: "lu", lecture } : { etat: "non-lu", raison: "réponse illisible du registre" };
  } catch {
    return { etat: "non-lu", raison: "le registre n'a pas répondu à temps" };
  }
}

// ══════════ VERS LE CRM ══════════

/**
 * Une entreprise trouvée devient une fiche.
 *
 * · `stage: "prospect"` : elle n'a rien demandé.
 * · Pas de `name` : le dirigeant déclaré est un FAIT, mais ce n'est pas
 *   forcément la personne à joindre, et choisir parmi plusieurs serait
 *   deviner. Il va dans les notes, où l'humain le lit.
 * · Pas de `preferredChannel` : on ne sait pas encore par où la joindre. Le
 *   tag `a-joindre` le dit, et la prochaine étape aussi.
 * · Les notes portent des FAITS datés, jamais de la doctrine recopiée.
 */
export function entrepriseVersProspect(e: EntrepriseTrouvee, maintenant: Date = new Date(), annonces?: LectureSignaux): Prospect {
  const iso = maintenant.toISOString();
  const notes = [
    `SIREN : ${e.siren}`,
    `Activité : ${e.activite.code} — ${e.activite.libelle}`,
    e.enseigne ? `Enseigne : ${e.enseigne}` : "",
    e.adresse ? `Adresse : ${e.adresse}` : "",
    `Effectif : ${e.taille.libelle}`,
    e.creeLe ? `Créée le : ${e.creeLe}` : "",
    e.etablissementsDansLaZone > 1 ? `Établissements dans la zone : ${e.etablissementsDansLaZone}` : "",
    ...e.dirigeants.map((d) => `Dirigeant déclaré : ${d}`),
    `Source : registre officiel des entreprises, lu le ${iso.slice(0, 10)}`,
  ].filter(Boolean);
  return {
    ...prospectDefaults,
    id: `reg-${e.siren}`,
    name: "",
    company: e.enseigne && e.enseigne.toUpperCase() !== e.nom.toUpperCase() ? `${e.enseigne} (${e.nom})` : e.nom,
    sector: "autre",
    city: e.commune,
    stage: "prospect",
    siren: e.siren,
    ...(e.representant ? { representant: e.representant } : {}),
    // Les annonces lues avant l'import voyagent avec la fiche : la file
    // d'appels ne les relira qu'à leur péremption (`lectureAFaire`).
    ...(annonces ? { signauxPublics: annonces } : {}),
    likeness: 50,
    croyances: { produit: 5, soutien: 5, pourLui: 3 },
    nextStep: { date: daysAhead(1), action: "Trouver le bon interlocuteur et son numéro" },
    notes: notes.join("\n"),
    tags: ["registre", "a-joindre", `naf-${e.activite.code}`],
    createdAt: iso,
    updatedAt: iso,
  } as Prospect;
}

// ══════════ LE CROISEMENT AVEC LES ANNONCES LÉGALES ══════════

export interface Croisement {
  /** Importables, les MOMENTS frais d'abord (quand appeler), puis l'ordre du registre. */
  retenues: { entreprise: EntrepriseTrouvee; annonces?: LectureSignaux; moment: SignalPublic | null }[];
  /** Exclusion SÈCHE, nommée : procédure collective, radiation, dissolution. Jamais importées. */
  exclues: { entreprise: EntrepriseTrouvee; exclusion: ExclusionPublique }[];
  /**
   * Annonces qu'on n'a pas pu lire. ⚠ « Non lu » n'est pas « sain » : ces
   * entreprises restent importables (le registre les dit actives), et la file
   * d'appels relira leurs annonces avant de les servir.
   */
  nonLues: number;
}

/**
 * Croise une page du registre avec les annonces légales de chaque SIREN.
 * Pure : les lectures arrivent de `lireLot` (`lib/signaux-publics.ts`), qui
 * part du navigateur. Une entreprise en liquidation ne s'importe pas — même
 * règle que la file d'appels (`dansLaFile`), appliquée AVANT qu'elle entre au
 * CRM plutôt qu'après.
 */
export function croiserAnnonces(entreprises: EntrepriseTrouvee[], lectures: ResultatLecture[], maintenant: Date = new Date()): Croisement {
  const parSiren = new Map(lectures.map((l) => [l.siren, l]));
  const retenues: Croisement["retenues"] = [];
  const exclues: Croisement["exclues"] = [];
  let nonLues = 0;
  for (const e of entreprises) {
    const l = parSiren.get(e.siren);
    if (!l || l.etat !== "lu") {
      nonLues++;
      retenues.push({ entreprise: e, moment: null });
      continue;
    }
    const exclusion = exclusionPublique({ signauxPublics: l.lecture });
    if (exclusion) {
      exclues.push({ entreprise: e, exclusion });
      continue;
    }
    retenues.push({ entreprise: e, annonces: l.lecture, moment: momentFrais({ signauxPublics: l.lecture }, maintenant) });
  }
  // Tri STABLE : à égalité, l'ordre du registre est gardé.
  const rang = (x: Croisement["retenues"][number]) => (x.moment ? 0 : 1);
  return { retenues: retenues.map((x, i) => ({ x, i })).sort((a, b) => rang(a.x) - rang(b.x) || a.i - b.i).map(({ x }) => x), exclues, nonLues };
}
