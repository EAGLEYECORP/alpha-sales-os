/**
 * ─────────────────────────────────────────────────────────────────────
 * LES SIGNAUX PUBLICS D'UNE FICHE — les annonces légales (BODACC), lues.
 * La lecture est pure ; le transport (`lireAnnonces`) prend `fetch` en
 * paramètre et part DU NAVIGATEUR.
 *
 * ── ⚠⚠ POURQUOI DU NAVIGATEUR, ET PAS PAR NOTRE SERVEUR ──
 * La première version passait par une route à nous. Elle aurait reçu, à
 * chaque lecture, la liste des SIREN qu'un inscrit prospecte — c'est-à-dire
 * son pipe, que la promesse de souveraineté dit que notre serveur ne voit
 * pas. L'API de l'État répond `access-control-allow-origin: *` et la CSP de
 * l'app laisse sortir `https:` (vérifié le 22/10/2026) : la requête va
 * directement du navigateur à l'API publique, sans session, sans nous.
 *
 * ── POURQUOI ──
 * Le permis de construire était notre seul signal : public, daté,
 * vérifiable — il disait QUI et OÙ EN EST l'affaire. Depuis la bascule
 * horizontale (21/10/2026), un inscrit vend n'importe quoi à n'importe qui,
 * et il n'avait plus AUCUN signal : un pipe, un import, et rien pour dire
 * qui appeler maintenant ni qui ne pas appeler du tout.
 *
 * Le BODACC est la même chose, pour toutes les entreprises françaises : des
 * annonces OFFICIELLES, datées, consultables par n'importe qui, rattachées au
 * SIREN. Mesuré sur l'API réelle le 22/10/2026 : 8,6 M de modifications,
 * 6,7 M de créations, 3,4 M de procédures collectives, 0,9 M de ventes de
 * fonds, 4,3 M de radiations.
 *
 * ── CE QU'ON EN TIRE, ET DANS QUEL SENS ──
 * · Une EXCLUSION SÈCHE, nommée : procédure collective, radiation,
 *   dissolution. On ne vend pas à une société qui ne pourra pas payer — même
 *   règle que le particulier du module permis : par exclusion, jamais par un
 *   score qui pourrait la rattraper.
 * · Un MOMENT : nouvelle direction, déménagement, rachat de fonds, création,
 *   augmentation de capital, nouvelle activité. Une entreprise qui change est
 *   une entreprise qui achète.
 *
 * ── ⚠⚠ LE FAIT CHOISIT LE MOMENT, IL NE SE DIT PAS ──
 * Même interdit que citer son permis à froid : « j'ai vu votre annonce au
 * BODACC » est vrai, public, et sonne fliqué. Le signal ordonne la file et
 * nomme la raison À L'APPELANT ; il n'entre dans aucune phrase écrite pour le
 * prospect. `phraseDuMoment` le rappelle en toutes lettres.
 *
 * ── ⚠ RIEN N'EST DEVINÉ ──
 * · On lit par SIREN, jamais par nom : un faux rapprochement poserait la
 *   liquidation d'une société sur la fiche d'une autre.
 * · Une lecture ratée est `null` (« non lu »), jamais « rien à signaler ».
 *   Zéro annonce est un FAIT, et se dit comme tel.
 * · Chaque signal porte le lien officiel de son annonce : on peut le vérifier.
 * · Les fenêtres (24 mois, 180 jours, 60 jours) sont des DÉCISIONS, pas des
 *   mesures — aucune vente ne les a validées.
 * ─────────────────────────────────────────────────────────────────────
 */

import { normaliserSiren, sirenValide } from "./siren";

export type FamilleSignal = "nouvelle-direction" | "demenagement" | "rachat" | "creation" | "capital" | "activite" | "nouveau-nom";
export type MotifExclusion = "procedure-collective" | "radiation" | "dissolution";

export interface SignalPublic {
  type: FamilleSignal;
  /** Date de parution, AAAA-MM-JJ. */
  date: string;
  libelle: string;
  /** Lien officiel de l'annonce (bodacc.fr). */
  source: string;
}

export interface ExclusionPublique {
  motif: MotifExclusion;
  date: string;
  libelle: string;
  source: string;
}

export interface LectureSignaux {
  siren: string;
  /** Instant de la lecture (ISO). Une lecture vieillit : elle se refait. */
  luLe: string;
  /** Nombre d'annonces lues pour ce SIREN (toutes familles). */
  annonces: number;
  exclusion: ExclusionPublique | null;
  /** Les moments, du plus récent au plus ancien, un par famille. */
  signaux: SignalPublic[];
}

/** Une annonce telle que l'API BODACC la rend (champs utiles seulement). */
export interface AnnonceBodacc {
  id?: string;
  dateparution?: string;
  familleavis?: string | null;
  typeavis?: string | null;
  /** Chaîne JSON (ou objet) : `{ "descriptif": "transfert du siège social." }`. */
  modificationsgenerales?: unknown;
  /** Chaîne JSON (ou objet) : `{ "nature": …, "complementJugement": … }`. */
  jugement?: unknown;
  /** Chaîne JSON (ou objet) : `{ "descriptif": "immatriculation suite à transfert…" }`. */
  acte?: unknown;
  url_complete?: string | null;
  /**
   * Les SIREN cités, avec et sans espaces. Le PREMIER est la société dont
   * parle l'annonce ; sur une VENTE, les suivants sont les anciens
   * propriétaires du fonds — mesuré sur l'API réelle le 22/10/2026.
   */
  registre?: string[] | null;
  /** Chaîne JSON (ou objet) : le cédant d'une vente, la société absorbée d'une fusion. */
  listeprecedentproprietaire?: unknown;
}

/** Une procédure collective, une radiation, une dissolution comptent ce temps-là. Décision. */
export const FENETRE_EXCLUSION_MOIS = 24;
/** Un changement est un moment pendant ce temps-là. Décision. */
export const FENETRE_SIGNAL_JOURS = 180;
/** Une création est un moment plus longtemps : une jeune société s'équipe pendant un an. Décision. */
export const FENETRE_CREATION_JOURS = 365;
/** En deçà, le moment est FRAIS : la fiche remonte en tête de la file. Décision. */
export const FRAICHEUR_JOURS = 60;
/** Au-delà, une lecture est à refaire : une annonce paraît chaque jour. Décision. */
export const LECTURE_VALABLE_JOURS = 30;

const JOUR = 86_400_000;

const LIBELLES: Record<FamilleSignal, string> = {
  "nouvelle-direction": "Changement dans la direction",
  demenagement: "Déménagement (siège ou établissement)",
  rachat: "Rachat d'un fonds de commerce",
  creation: "Création de la société",
  capital: "Modification du capital",
  activite: "Changement ou mise en activité",
  "nouveau-nom": "Changement de nom ou d'enseigne",
};

/** Les champs JSON du BODACC arrivent en chaîne ; parfois déjà en objet. */
function objet(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  if (typeof v !== "string" || !v.trim() || v === "None") return null;
  try {
    const o = JSON.parse(v) as unknown;
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function ageJours(date: string, maintenant: Date): number {
  const t = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(t) ? (maintenant.getTime() - t) / JOUR : Number.POSITIVE_INFINITY;
}

const jjmmaaaa = (date: string) => date.split("-").reverse().join("/");

/**
 * Ce qu'une modification annonce — un descriptif peut en porter plusieurs.
 * Les tournures viennent des annonces RÉELLES (relevé du 22/10/2026 sur cent
 * descriptifs) : « Modification survenue sur l'administration », « Nouveau
 * siège », « Modification du capital » — qui ne dit presque jamais s'il
 * augmente. Une diminution n'est pas un moment : elle suit souvent des pertes.
 */
function famillesDeModification(descriptif: string): { signaux: FamilleSignal[]; dissolution: boolean } {
  const d = sansAccents(descriptif);
  const dissolution = /dissolution|cessation d.activite|mise en sommeil|transmission universelle/.test(d);
  const signaux: FamilleSignal[] = [];
  if (/administration|dirigeant|gerant|president|directeur general/.test(d)) signaux.push("nouvelle-direction");
  if (/transfert|nouveau siege|adresse du siege|adresse de l.etablissement/.test(d)) signaux.push("demenagement");
  if (/capital/.test(d) && !/diminution|reduction/.test(d)) signaux.push("capital");
  if (/activite/.test(d.replace(/cessation d.activite/g, ""))) signaux.push("activite");
  if (/denomination|nom commercial|enseigne/.test(d)) signaux.push("nouveau-nom");
  return { signaux, dissolution };
}

/** Les chiffres d'une entrée du registre (« 829 482 991 » → « 829482991 »). */
const chiffres = (v: string) => v.replace(/\D/g, "");

/** Le libellé d'une procédure collective, dit avec ses mots — jamais « problème financier ». */
function libelleProcedure(jugement: Record<string, unknown> | null): string {
  const t = sansAccents(`${texte(jugement?.nature)} ${texte(jugement?.complementJugement)}`);
  // La clôture d'abord : « clôture de la liquidation » n'est pas une ouverture.
  if (/cloture/.test(t)) return "Clôture de procédure collective";
  if (/liquidation/.test(t)) return "Liquidation judiciaire";
  if (/redressement/.test(t)) return "Redressement judiciaire";
  if (/sauvegarde/.test(t)) return "Procédure de sauvegarde";
  if (/conciliation/.test(t)) return "Accord de conciliation homologué";
  return "Procédure collective";
}

/**
 * Lit les annonces d'UN SIREN. Pur : `maintenant` est injecté.
 *
 * ⚠ Les annonces d'annulation ne comptent pas (elles annulent une annonce
 * précédente) ; un rectificatif compte comme l'annonce qu'il corrige.
 */
export function lireSignaux(siren: string, annonces: AnnonceBodacc[], maintenant: Date = new Date()): LectureSignaux {
  const valides = annonces.filter((a) => a.dateparution && !/annulation/i.test(texte(a.typeavis)));
  const recentes = [...valides].sort((a, b) => (b.dateparution ?? "").localeCompare(a.dateparution ?? ""));
  const fenetreExclusionJours = FENETRE_EXCLUSION_MOIS * 30.44;

  // Une radiation SUIVIE d'une création ou d'une immatriculation ne vaut plus :
  // le SIREN a repris vie (relevé réel : créée, radiée, recréée sous le même numéro).
  const derniereCreation = recentes.find((a) => a.familleavis === "creation" || a.familleavis === "immatriculation")?.dateparution ?? "";

  let exclusion: ExclusionPublique | null = null;
  const parType = new Map<FamilleSignal, SignalPublic>();

  for (const a of recentes) {
    const date = a.dateparution as string;
    const source = texte(a.url_complete);
    const age = ageJours(date, maintenant);
    const famille = a.familleavis ?? "";

    if (!exclusion) {
      if ((famille === "collective" || famille === "conciliation" || famille === "retablissement_professionnel") && age <= fenetreExclusionJours) {
        exclusion = { motif: "procedure-collective", date, libelle: `${libelleProcedure(objet(a.jugement))} (BODACC du ${jjmmaaaa(date)})`, source };
      } else if (famille === "radiation" && date >= derniereCreation) {
        exclusion = { motif: "radiation", date, libelle: `Radiée du registre (BODACC du ${jjmmaaaa(date)})`, source };
      }
    }

    if (famille === "modification") {
      const { signaux, dissolution } = famillesDeModification(texte(objet(a.modificationsgenerales)?.descriptif));
      if (dissolution && !exclusion && age <= fenetreExclusionJours) {
        exclusion = { motif: "dissolution", date, libelle: `Dissolution ou cessation d'activité (BODACC du ${jjmmaaaa(date)})`, source };
      }
      if (age <= FENETRE_SIGNAL_JOURS) {
        for (const type of signaux) if (!parType.has(type)) parType.set(type, { type, date, libelle: LIBELLES[type], source });
      }
    } else if (famille === "vente" && age <= FENETRE_SIGNAL_JOURS) {
      // ⚠⚠ Une vente cite l'acheteur ET le cédant. Si la fiche est le cédant —
      // ou la société ABSORBÉE d'une fusion, que cette famille contient aussi —
      // elle se retire, elle n'achète pas. Ce n'est pas un moment, ni une
      // exclusion (elle peut garder d'autres fonds) : on n'en dit rien.
      // Mesuré sur l'API réelle : l'ordre du registre ne suffit pas (l'absorbée
      // y figure parfois EN TÊTE) ; c'est la liste des anciens propriétaires
      // qui tranche, l'ordre ne sert qu'à défaut.
      const precedents = typeof a.listeprecedentproprietaire === "string" ? a.listeprecedentproprietaire : JSON.stringify(a.listeprecedentproprietaire ?? "");
      const espace = `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6)}`;
      if (precedents.includes(siren) || precedents.includes(espace)) continue;
      const sujet = chiffres(a.registre?.[0] ?? "");
      if (!precedents.replace(/"|null|None/g, "").trim() && sujet && sujet !== siren) continue;
      const fusion = /fusion|apport/.test(sansAccents(texte(objet(a.acte)?.descriptif)));
      if (!parType.has("rachat")) parType.set("rachat", { type: "rachat", date, libelle: fusion ? "Fusion ou apport d'actifs" : LIBELLES.rachat, source });
    } else if (famille === "creation" && age <= FENETRE_CREATION_JOURS) {
      if (!parType.has("creation")) parType.set("creation", { type: "creation", date, libelle: LIBELLES.creation, source });
    } else if (famille === "immatriculation" && age <= FENETRE_SIGNAL_JOURS) {
      // ⚠ Mesuré le 22/10/2026 : une « immatriculation » est presque toujours
      // « suite à transfert du siège hors ressort » — un DÉMÉNAGEMENT vers un
      // autre greffe, pas une création. La lire comme une création aurait
      // annoncé une jeune société à qui existe depuis 2015.
      if (/transfert/.test(sansAccents(texte(objet(a.acte)?.descriptif))) && !parType.has("demenagement")) {
        parType.set("demenagement", { type: "demenagement", date, libelle: LIBELLES.demenagement, source });
      }
    }
  }

  return {
    siren,
    luLe: maintenant.toISOString(),
    annonces: valides.length,
    exclusion,
    // Une société exclue n'a pas de moment : on ne la remonte pas, on l'écarte.
    signaux: exclusion ? [] : [...parType.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** L'exclusion portée par la fiche, ou `null` (aucune, ou jamais lue). */
export function exclusionPublique(p: { signauxPublics?: LectureSignaux }): ExclusionPublique | null {
  return p.signauxPublics?.exclusion ?? null;
}

/** Le moment le plus récent s'il est FRAIS, sinon `null`. */
export function momentFrais(p: { signauxPublics?: LectureSignaux }, maintenant: Date = new Date()): SignalPublic | null {
  const s = p.signauxPublics?.signaux?.[0];
  return s && ageJours(s.date, maintenant) <= FRAICHEUR_JOURS ? s : null;
}

/** Une lecture absente ou trop vieille se refait. */
export function lectureAFaire(p: { signauxPublics?: LectureSignaux }, maintenant: Date = new Date()): boolean {
  const lu = p.signauxPublics?.luLe;
  if (!lu) return true;
  const t = Date.parse(lu);
  return !Number.isFinite(t) || maintenant.getTime() - t > LECTURE_VALABLE_JOURS * JOUR;
}

/**
 * Ce que l'APPELANT lit — jamais le prospect. La consigne de ne pas citer le
 * fait est DANS la phrase : c'est elle que l'écran montre au moment d'appeler.
 */
export function phraseDuMoment(s: SignalPublic): string {
  return `Moment public : ${s.libelle.toLowerCase()} le ${jjmmaaaa(s.date)}. C'est pour ça que tu appelles MAINTENANT — ne le cite pas : ouvre par la permission, laisse-le en parler.`;
}

// ── LE TRANSPORT ─────────────────────────────────────────────────────────

const BODACC = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
/** Les dépôts de comptes (`dpc`) ne disent rien de ce qu'on cherche : on ne les rapatrie pas. */
const CHAMPS = "dateparution,familleavis,typeavis,modificationsgenerales,jugement,acte,url_complete,registre,listeprecedentproprietaire";
/** À la fois. Une file lue en série additionnerait les délais d'attente. Décision. */
export const LECTURES_SIMULTANEES = 5;

/**
 * Le résultat d'UN SIREN. ⚠ On ne conclut jamais sur une panne : un SIREN
 * qu'on n'a pas pu lire est `non-lu`, jamais une lecture vide — qui se lirait
 * « rien à signaler » et laisserait une société en liquidation dans la file.
 * Un SIREN à la clé fausse est `invalide` : l'API aurait répondu « zéro
 * annonce », ce qui est vrai d'un numéro qui n'existe pas, et se lit
 * exactement comme une société saine.
 */
export type ResultatLecture =
  | { siren: string; etat: "lu"; lecture: LectureSignaux }
  | { siren: string; etat: "non-lu"; raison: string }
  | { siren: string; etat: "invalide"; raison: string };

type Fetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** L'adresse exacte d'une lecture — exposée pour que le test vérifie ce qui part. */
export function urlDeLecture(siren: string): string {
  const url = new URL(BODACC);
  url.searchParams.set("where", `registre="${siren}" AND familleavis!="dpc"`);
  url.searchParams.set("order_by", "dateparution desc");
  url.searchParams.set("limit", "100");
  url.searchParams.set("select", CHAMPS);
  return url.toString();
}

/** Lit les annonces d'un SIREN. `brut` peut être un SIRET ou porter des espaces. */
export async function lireAnnonces(brut: string, f: Fetch, maintenant: Date = new Date()): Promise<ResultatLecture> {
  const siren = normaliserSiren(brut);
  if (!siren || !sirenValide(siren)) {
    return { siren: siren || brut.trim().slice(0, 20), etat: "invalide", raison: "ce n'est pas un SIREN valide (clé de contrôle fausse) — vérifie le numéro" };
  }
  try {
    const res = await f(urlDeLecture(siren), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      return { siren, etat: "non-lu", raison: res.status === 429 ? "quota de l'API publique atteint pour aujourd'hui" : `l'API publique a répondu ${res.status}` };
    }
    const json = (await res.json()) as { results?: unknown };
    if (!Array.isArray(json.results)) return { siren, etat: "non-lu", raison: "réponse illisible de l'API publique" };
    return { siren, etat: "lu", lecture: lireSignaux(siren, json.results as AnnonceBodacc[], maintenant) };
  } catch {
    return { siren, etat: "non-lu", raison: "l'API publique n'a pas répondu à temps" };
  }
}

/** Lit une liste, `LECTURES_SIMULTANEES` à la fois, dans l'ordre reçu. */
export async function lireLot(bruts: string[], f: Fetch, maintenant: Date = new Date()): Promise<ResultatLecture[]> {
  const out: ResultatLecture[] = [];
  for (let i = 0; i < bruts.length; i += LECTURES_SIMULTANEES) {
    out.push(...(await Promise.all(bruts.slice(i, i + LECTURES_SIMULTANEES).map((b) => lireAnnonces(b, f, maintenant)))));
  }
  return out;
}
