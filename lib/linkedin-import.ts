import { prospectDefaults } from "./seed";
import { champsReconnus, lireTableau, type Lecture, type Rejet } from "./tabulaire";
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
 * externe (voir `docs/SOURCING.md`). Ce module ne va RIEN chercher :
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

export type { Rejet };

/**
 * Le résultat de lecture, vu du LinkedIn.
 *
 * `profils` double `entrees` : le reste du module et l'écran parlent de
 * profils, pas d'entrées de tableau. Le champ générique reste exposé pour ne
 * pas avoir deux vérités à maintenir.
 */
export interface ParseProfils extends Lecture<ProfilLinkedin> {
  profils: ProfilLinkedin[];
}

/**
 * Détecte le format et rend des profils.
 *
 * Le lecteur lui-même est mutualisé dans `lib/tabulaire.ts` : le sourcing
 * terrain a le même besoin sur d'autres colonnes, et deux lecteurs recopiés
 * divergent au premier bug corrigé d'un seul côté.
 */
export function parserProfils(texte: string): ParseProfils {
  const lu = lireTableau<ProfilLinkedin>(texte, ALIAS);
  const profils = lu.entrees as ProfilLinkedin[];
  return { ...lu, entrees: profils, profils };
}

/** Les noms de colonnes acceptés, pour un message d'aide. */
export const COLONNES_RECONNUES = champsReconnus(ALIAS);

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
