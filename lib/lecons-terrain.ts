import { search, type KnowledgeNote } from "./knowledge";
import type { Prospect } from "./types";
import type { VerticalPlaybook } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'ON A APPRIS SUR CE MÉTIER — servi AVANT de composer.
 *
 * Le troisième maillon ouvert du flux. Un débrief, une objection traitée,
 * une perte : tout cela s'écrivait bien dans le Cerveau… et n'en ressortait
 * qu'à la recherche manuelle, ou dans les prompts d'email. La session
 * d'appels — l'endroit où ça vaut le plus cher — ne lisait rien.
 *
 * Résultat : la phrase qui a débloqué un garagiste mardi était invisible
 * quand on appelait le garage suivant mercredi.
 *
 * ⚠ DEUX FILTRES QUI NE SE NÉGOCIENT PAS.
 *
 *  1. `source: "terrain"` UNIQUEMENT. Les notes de `reference` (livres,
 *     vidéos) portent l'étiquette « SOURCE EXTERNE — non vérifiée chez nous »
 *     précisément pour ne PAS peser autant qu'un fait constaté. Les afficher
 *     ici, à trente secondes d'un appel réel, les mettrait au même rang qu'une
 *     leçon mesurée. La doctrine l'interdit, et c'est la bonne règle : au
 *     téléphone, on ne récite pas un livre.
 *  2. Ce sont des CAS, pas des règles. Une leçon tirée d'un rendez-vous reste
 *     un rendez-vous. L'écran le dit ; le module refuse d'en faire un script.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Une leçon prête à être lue en trente secondes, avant de décrocher. */
export interface LeconServie {
  id: string;
  titre: string;
  /** Le corps, débarrassé de l'en-tête d'ancrage et coupé court. */
  extrait: string;
  /** Le prospect d'où elle vient, s'il est identifiable par les tags. */
  origine: string | null;
  score: number;
}

/**
 * L'en-tête d'ancrage posé par `ancrage` (lib/apprentissage.ts).
 *
 * Il porte l'entreprise d'origine — utile en bas de carte, inutile au milieu
 * de la leçon. On l'extrait, puis on le retire du corps : l'écran d'appel doit
 * montrer ce qui a marché, pas le rappel de qui c'était.
 */
const ENTETE = /^[ \t]*Contexte\s*:\s*([^\n]*)\n?/im;

const EXTRAIT_MAX = 260;

/** « Garage Dupont — garage (segment : …). » → « Garage Dupont ». */
function origineDepuisEntete(body: string): string | null {
  const m = body.match(ENTETE);
  if (!m) return null;
  const nom = m[1].split(/\s+[—–-]\s+|\s*\(/)[0].replace(/\.$/, "").trim();
  return nom || null;
}

function extrait(note: KnowledgeNote): string {
  const corps = note.body
    .replace(ENTETE, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\n{2,}/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
  return corps.length > EXTRAIT_MAX ? `${corps.slice(0, EXTRAIT_MAX - 1).trimEnd()}…` : corps;
}

/**
 * La requête de recherche pour une file d'appels.
 *
 * Elle part de la VERTICALE, pas du prospect : au moment de composer, ce qui
 * se répète d'un appel à l'autre est le métier et son objection type, pas
 * l'entreprise. Les noms des cibles sont ajoutés en second rang — si l'un
 * d'eux a déjà une histoire chez nous, elle doit remonter.
 */
export function requeteVerticale(v: VerticalPlaybook | null, cibles: Prospect[] = []): string {
  const noms = cibles.slice(0, 12).map((p) => p.company).join(" ");
  if (!v) return noms.trim();
  return [v.label, v.criterion, v.id, noms].filter(Boolean).join(" ").trim();
}

/**
 * Les leçons de terrain pertinentes pour cette file d'appels.
 *
 * Rend un tableau VIDE quand il n'y a rien — pas un message d'attente
 * déguisé en contenu. Le panneau qui l'affiche s'occupe de dire pourquoi.
 *
 * ⚠ `notes` doit DÉJÀ être filtré par compte (`notesForAccount`). Une leçon
 * ScintIA remontée pendant un appel EAGLEYE n'est pas seulement hors sujet :
 * elle expose le portefeuille d'un compte à l'autre.
 */
export function leconsPourAppels(
  notes: KnowledgeNote[],
  v: VerticalPlaybook | null,
  cibles: Prospect[] = [],
  k = 4
): LeconServie[] {
  const terrain = notes.filter((n) => n.source === "terrain");
  if (terrain.length === 0) return [];

  const q = requeteVerticale(v, cibles);
  if (!q) return [];

  return search(q, terrain, k)
    .filter((s) => s.score > 0)
    .map(({ note, score }) => ({
      id: note.id,
      titre: note.title,
      extrait: extrait(note),
      origine: origineDepuisEntete(note.body),
      score,
    }))
    .filter((l) => l.extrait.length > 0);
}
