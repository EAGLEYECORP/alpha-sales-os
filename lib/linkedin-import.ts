import { prospectDefaults } from "./seed";
import type { Prospect, Sector } from "./types";
import { qualifier, trierLot, type Ciblage, type ProfilLinkedin } from "./linkedin-ciblage";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ENTRÉE DES PROFILS SOURCÉS — du texte brut vers des fiches triées.
 *
 * ── LE CHAÎNON QUI MANQUAIT ──
 *
 * `linkedin-ciblage.ts` sait dire si un profil mérite une invitation.
 * `linkedin-sequence.ts` sait quoi écrire à une fiche du CRM. Entre les deux,
 * rien : aucun moyen de faire ENTRER 200 profils relevés dehors.
 *
 * ── D'OÙ VIENT LE TEXTE ──
 *
 * De ce que l'opérateur a sous la main : un export de Sales Navigator, un
 * tableur monté à la main, ou un relevé de pages publiques par un outil
 * externe (voir `docs/SOURCING-LINKEDIN.md`). Ce module ne va RIEN chercher :
 * il ne fait pas de requête, ne détient aucun identifiant et n'ouvre aucun
 * navigateur. Il reçoit du texte, il en fait des fiches.
 *
 * Cette séparation n'est pas de la propreté d'architecture. Elle fait que la
 * partie qui touche à LinkedIn reste hors de l'app, remplaçable, et qu'aucune
 * dépendance de collecte n'entre dans le produit vendu.
 *
 * ── LA DOCTRINE D'INGESTION, REPRISE DE `api-ingest` ──
 *
 * On rend ce qui est ENTRÉ, ce qui est REFUSÉ avec l'index et la raison, et
 * les AVERTISSEMENTS par ligne. Importer 200 lignes ne veut rien dire ; savoir
 * que 38 méritent une invitation, si.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que les sources appellent chaque colonne. Tout finit sur `ProfilLinkedin`. */
const ALIAS: Record<string, keyof ProfilLinkedin> = {
  nom: "nom", name: "nom", fullname: "nom", prenomnom: "nom", personne: "nom", contact: "nom",
  titre: "titre", title: "titre", headline: "titre", poste: "titre", position: "titre", jobtitle: "titre", fonction: "titre",
  entreprise: "entreprise", company: "entreprise", companyname: "entreprise", organisation: "entreprise", organization: "entreprise", societe: "entreprise",
  ville: "ville", city: "ville", location: "ville", localisation: "ville", lieu: "ville",
  url: "url", lien: "url", link: "url", profile: "url", profileurl: "url", linkedin: "url", linkedinurl: "url",
  secteur: "secteur", industry: "secteur", sector: "secteur", industrie: "secteur",
  taille: "taille", size: "taille", companysize: "taille", effectif: "taille", employees: "taille", headcount: "taille",
};

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

export interface Rejet {
  /** Index dans la source (1 = première ligne de données). */
  ligne: number;
  raison: string;
  /** Ce qui a été lu, tronqué — pour retrouver la ligne dans le fichier. */
  extrait: string;
}

export interface ParseProfils {
  profils: ProfilLinkedin[];
  rejets: Rejet[];
  /** Ce que l'intégrateur doit apprendre à la première tentative. */
  avertissements: string[];
  /** Le format détecté, dit à l'écran : deviner en silence trompe. */
  format: "json" | "csv" | "aucun";
}

/**
 * Détecte le format et rend des profils.
 *
 * Trois formats acceptés parce que ce sont les trois qui arrivent réellement :
 * un tableau JSON (sortie d'outil), du JSONL (une ligne = un objet), et du
 * CSV/TSV avec en-tête (export de tableur, copier-coller de Sales Navigator).
 */
export function parserProfils(texte: string): ParseProfils {
  const brut = (texte ?? "").trim();
  if (!brut) return { profils: [], rejets: [], avertissements: [], format: "aucun" };

  if (brut.startsWith("[") || brut.startsWith("{")) return parserJson(brut);
  return parserTableau(brut);
}

function depuisEnregistrement(rec: Record<string, unknown>): { profil: ProfilLinkedin; inconnus: string[] } {
  const profil: ProfilLinkedin = {};
  const inconnus: string[] = [];
  for (const [cle, valeur] of Object.entries(rec)) {
    const champ = ALIAS[norm(cle)];
    if (!champ) {
      if (String(valeur ?? "").trim()) inconnus.push(cle);
      continue;
    }
    const v = String(valeur ?? "").trim();
    if (v) profil[champ] = v;
  }
  return { profil, inconnus };
}

function parserJson(brut: string): ParseProfils {
  const rejets: Rejet[] = [];
  const avertissements: string[] = [];
  let lignes: unknown[];

  try {
    const parsed = JSON.parse(brut) as unknown;
    lignes = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // JSONL : une ligne = un objet. C'est ce que crache la plupart des outils
    // en flux, et un JSON.parse global échoue dessus.
    lignes = [];
    brut.split("\n").forEach((l, i) => {
      const t = l.trim();
      if (!t) return;
      try {
        lignes.push(JSON.parse(t));
      } catch {
        rejets.push({ ligne: i + 1, raison: "ni JSON ni JSONL valide", extrait: t.slice(0, 60) });
      }
    });
  }

  const profils: ProfilLinkedin[] = [];
  const inconnusVus = new Set<string>();

  lignes.forEach((l, i) => {
    if (!l || typeof l !== "object" || Array.isArray(l)) {
      rejets.push({ ligne: i + 1, raison: "entrée qui n'est pas un objet", extrait: JSON.stringify(l).slice(0, 60) });
      return;
    }
    const { profil, inconnus } = depuisEnregistrement(l as Record<string, unknown>);
    inconnus.forEach((c) => inconnusVus.add(c));
    if (!Object.keys(profil).length) {
      rejets.push({ ligne: i + 1, raison: "aucun champ reconnu", extrait: JSON.stringify(l).slice(0, 60) });
      return;
    }
    profils.push(profil);
  });

  if (inconnusVus.size) {
    avertissements.push(
      `Champs ignorés : ${[...inconnusVus].slice(0, 8).join(", ")}. Les noms reconnus sont : ${[...new Set(Object.values(ALIAS))].join(", ")}.`
    );
  }
  return { profils, rejets, avertissements, format: "json" };
}

/** Découpe une ligne CSV en respectant les guillemets. */
function decouper(ligne: string, sep: string): string[] {
  const out: string[] = [];
  let courant = "";
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      // Un guillemet doublé à l'intérieur est un guillemet littéral.
      if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else dansGuillemets = !dansGuillemets;
    } else if (c === sep && !dansGuillemets) {
      out.push(courant);
      courant = "";
    } else courant += c;
  }
  out.push(courant);
  return out.map((c) => c.trim());
}

function parserTableau(brut: string): ParseProfils {
  const lignes = brut.split(/\r?\n/).filter((l) => l.trim());
  const rejets: Rejet[] = [];
  const avertissements: string[] = [];

  // Le séparateur se déduit de l'en-tête : un copier-coller de tableur arrive
  // en tabulations, un export en points-virgules ou en virgules.
  const entete = lignes[0] ?? "";
  const sep = [["\t", (entete.match(/\t/g) ?? []).length], [";", (entete.match(/;/g) ?? []).length], [",", (entete.match(/,/g) ?? []).length]]
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0][0] as string;

  const colonnes = decouper(entete, sep).map((c) => ALIAS[norm(c)] ?? null);
  const reconnues = colonnes.filter(Boolean).length;

  if (reconnues === 0) {
    return {
      profils: [],
      rejets: [{ ligne: 1, raison: "aucune colonne reconnue dans l'en-tête", extrait: entete.slice(0, 80) }],
      avertissements: [
        `Première ligne attendue : un en-tête. Noms reconnus : ${[...new Set(Object.values(ALIAS))].join(", ")}.`,
      ],
      format: "csv",
    };
  }

  const inconnues = decouper(entete, sep).filter((c) => c && !ALIAS[norm(c)]);
  if (inconnues.length) avertissements.push(`Colonnes ignorées : ${inconnues.slice(0, 8).join(", ")}.`);

  const profils: ProfilLinkedin[] = [];
  lignes.slice(1).forEach((ligne, i) => {
    const cellules = decouper(ligne, sep);
    const profil: ProfilLinkedin = {};
    colonnes.forEach((champ, j) => {
      const v = (cellules[j] ?? "").trim();
      if (champ && v) profil[champ] = v;
    });
    if (!Object.keys(profil).length) {
      rejets.push({ ligne: i + 1, raison: "ligne vide après lecture des colonnes", extrait: ligne.slice(0, 60) });
      return;
    }
    profils.push(profil);
  });

  return { profils, rejets, avertissements, format: "csv" };
}

/**
 * Le métier lu sur le profil, gardé en clair dans les notes.
 *
 * Il ne rentre pas dans l'enum `Sector` (cinq valeurs) : un « gérant de régie
 * immobilière » tomberait dans « autre » et la fiche perdrait sa verticale.
 * `verticalForProspect` lit les notes — c'est là que le mot doit atterrir,
 * exactement comme le fait déjà l'import CSV.
 */
function notesDepuisProfil(p: ProfilLinkedin, c: Ciblage): string {
  const bouts: string[] = [];
  if (p.titre) bouts.push(`Poste LinkedIn : ${p.titre}.`);
  if (p.secteur) bouts.push(`Métier : ${p.secteur}.`);
  if (p.taille) bouts.push(`Effectif affiché : ${p.taille}.`);
  if (c.verticaleLabel) bouts.push(`Verticale : ${c.verticaleLabel}.`);
  // Les réserves suivent la fiche : sans elles, personne ne se souvient dans
  // trois semaines pourquoi ce profil était limite.
  if (c.risques.length) bouts.push(`Réserves au ciblage : ${c.risques.join(" · ")}.`);
  if (c.manque.length) bouts.push(`À vérifier : ${c.manque.join(" · ")}.`);
  return bouts.join(" ");
}

/** URL normalisée : on n'invente pas de profil, on complète un protocole. */
function urlProfil(p: ProfilLinkedin): string | undefined {
  const u = (p.url ?? "").trim();
  if (!u) return undefined;
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`;
}

/**
 * Un profil retenu devient une fiche.
 *
 * ⚠ `stage` est toujours « prospect ». Un profil relevé sur une page publique
 * n'a rien demandé : le faire entrer plus loin dans le pipeline ferait mentir
 * toutes les prévisions qui s'appuient dessus.
 */
export function profilVersProspect(p: ProfilLinkedin, c: Ciblage, now = new Date()): Prospect {
  const iso = now.toISOString();
  const entreprise = (p.entreprise ?? "").trim() || (p.nom ?? "").trim() || "Profil LinkedIn";

  // Identifiant stable sur l'URL : réimporter le même lot met à jour au lieu
  // de créer des doublons — et un doublon sur ce canal, c'est une deuxième
  // invitation à la même personne.
  const graine = (urlProfil(p) ?? entreprise).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    ...prospectDefaults,
    id: `li-${graine}`.slice(0, 60),
    company: entreprise,
    name: (p.nom ?? "").trim(),
    sector: "autre" as Sector,
    city: (p.ville ?? "").trim(),
    linkedin: urlProfil(p),
    stage: "prospect",
    preferredChannel: "linkedin",
    notes: notesDepuisProfil(p, c),
    tags: ["linkedin", ...(c.verticaleId ? [c.verticaleId] : [])],
    createdAt: iso,
    updatedAt: iso,
  } as Prospect;
}

export interface ImportLinkedin {
  parse: ParseProfils;
  retenus: { profil: ProfilLinkedin; ciblage: Ciblage; prospect: Prospect }[];
  ecartes: { profil: ProfilLinkedin; ciblage: Ciblage }[];
  /** Le verdict sur le lot, à lire AVANT de cliquer « ajouter ». */
  resume: string[];
}

/**
 * Le parcours complet : texte → profils → tri → fiches prêtes à entrer.
 *
 * Les écartés ne sont PAS jetés : ils remontent avec leur raison. Un tri dont
 * on ne voit pas les refus ne se corrige jamais — et c'est là qu'on découvre
 * que la colonne « titre » était mal nommée dans l'export.
 */
export function importerProfils(texte: string, now = new Date()): ImportLinkedin {
  const parse = parserProfils(texte);
  const lot = trierLot(parse.profils);

  const retenus = lot.retenus.map(({ profil, ciblage }) => ({
    profil,
    ciblage,
    prospect: profilVersProspect(profil, ciblage, now),
  }));

  const resume = [...lot.resume];
  if (parse.rejets.length) {
    resume.push(`${parse.rejets.length} ligne(s) illisibles — voir le détail avant de conclure que le lot est mauvais.`);
  }
  // Un doublon d'identifiant dans un même lot = la même personne deux fois.
  const ids = retenus.map((r) => r.prospect.id);
  const doublons = ids.length - new Set(ids).size;
  if (doublons > 0) {
    resume.push(`${doublons} doublon(s) dans le lot : la fusion se fera sur l'URL du profil, pas deux invitations.`);
  }

  return { parse, retenus, ecartes: lot.ecartes, resume };
}

/** Le gabarit à copier dans un tableur — la première ligne, rien de plus. */
export const ENTETE_MODELE = "nom;titre;entreprise;ville;url;secteur;taille";

/** Qualification d'un profil unique, pour la saisie à la main. */
export const qualifierProfil = qualifier;
