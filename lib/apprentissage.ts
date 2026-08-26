import type { Prospect } from "./types";
import type { KnowledgeNote } from "./knowledge";
import { guessSegmentForProspect } from "./segments";
import { verticalForProspect } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE LE SYSTÈME APPREND — et ce qu'il n'apprend PAS.
 *
 * ── DISONS-LE NET ──
 *
 * Il n'y a aucun entraînement de modèle ici. Rien n'est « fine-tuné », aucun
 * poids ne bouge, et prétendre le contraire serait mentir : on n'a ni les
 * données, ni l'infra, ni le budget pour ça — et ce ne serait pas la bonne
 * solution pour quinze prospects.
 *
 * Ce qui existe, et qui produit le même effet là où ça compte, c'est une
 * MÉMOIRE QUI S'ÉCRIT TOUTE SEULE. Jusqu'ici le Cerveau était en lecture
 * seule pour la machine : l'humain écrivait des notes, l'IA les relisait. Ce
 * qui se passait en rendez-vous — l'objection réelle, la phrase qui a
 * débloqué, la raison d'un refus — n'y entrait jamais. À la centième fiche,
 * l'IA en savait exactement autant qu'à la première.
 *
 * Ce module transforme les ÉVÉNEMENTS RÉELS en notes du Cerveau. Elles sont
 * ensuite retrouvées par la recherche lexicale au moment de préparer le
 * prospect suivant — et comme elles portent le secteur et le segment, elles
 * ressortent pour les prospects SIMILAIRES, pas seulement pour celui d'où
 * elles viennent. C'est là que le système devient « le commercial qui connaît
 * déjà ce métier ».
 *
 * ── LES TROIS RÈGLES QUI ÉVITENT LA POUBELLE ──
 *
 * Une mémoire qui absorbe tout devient du bruit, et une recherche lexicale
 * noyée dans le bruit ressort n'importe quoi. Donc :
 *
 *  1. IDENTIFIANT STABLE. Une leçon = un id déterministe. Rejouer le même
 *     débrief met la note à JOUR, il n'en crée pas une deuxième. Sans ça, un
 *     bouton cliqué deux fois double la mémoire.
 *  2. RIEN SANS SUBSTANCE. Une note vide de fait vérifiable n'est pas écrite.
 *     « Le rendez-vous s'est bien passé » n'apprend rien à personne.
 *  3. LA SOURCE EST MARQUÉE. `source: "terrain"` distingue ce qui vient du
 *     réel de la doctrine (`playbook`) et des notes écrites à la main. Une
 *     leçon tirée d'UN cas ne pèse pas comme une règle de la maison, et
 *     l'opérateur doit pouvoir faire le tri d'un coup d'œil.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le contexte de rattachement — c'est lui qui rend la leçon RETROUVABLE. */
function ancrage(p: Prospect): { tags: string[]; entete: string } {
  const seg = guessSegmentForProspect({ sector: p.sector, company: p.company, notes: p.notes, problems: p.problems });
  /**
   * ⚠ LA VERTICALE EST UN TAG, PAS UNE COÏNCIDENCE DE MOTS.
   *
   * Sans elle, retrouver une leçon « garage » depuis la file d'appels garage
   * reposait uniquement sur la recherche lexicale. Or nos playbooks parlent
   * tous d'appels manqués, du midi et du week-end : une leçon de garage
   * remontait sur la file restauration parce que les deux textes partagent
   * le même vocabulaire de douleur. Mesuré, pas supposé — c'est un test de
   * bout en bout qui l'a montré.
   *
   * Le tag rend le métier ADRESSABLE. `p.sector` ne suffit pas : il vaut
   * « autre » pour un garage comme pour un cabinet dentaire.
   */
  const verticale = verticalForProspect(p);
  const tags = ["terrain", p.sector, seg?.id, verticale?.id].filter((t): t is string => Boolean(t && t.trim()));
  // Le secteur et le segment sont écrits DANS le corps, pas seulement en tags :
  // la recherche est lexicale et pèse le texte, pas les métadonnées. Une leçon
  // qui ne contient pas le mot « garage » ne ressortira jamais sur un garage.
  const entete = [
    `Contexte : ${p.company}${p.sector ? ` — ${p.sector}` : ""}${seg ? ` (segment : ${seg.label})` : ""}.`,
  ].join("\n");
  return { tags, entete };
}

const propre = (s: string | undefined | null): string => (s ?? "").trim();

/** Une note d'apprentissage, prête à être fusionnée dans le Cerveau. */
export type Lecon = Omit<KnowledgeNote, "createdAt" | "updatedAt">;

export interface LeconInput {
  prospect: Prospect;
  /**
   * Compte propriétaire de la leçon. Absent = le store retombe sur le compte
   * ACTIF — une leçon ScintIA ne doit pas polluer le contexte d'un appel
   * Nuwacom, et vice versa.
   */
  accountId?: string;
  now?: Date;
}

/**
 * Ce qu'on retient d'un DÉBRIEF de rendez-vous.
 *
 * Le débrief est le seul moment où l'on sait ce qui s'est vraiment dit. S'il
 * ne laisse pas de trace exploitable, l'information meurt dans la journée —
 * et se repaie au rendez-vous suivant du même métier.
 */
export function leconDeDebrief(
  input: LeconInput & { resume: string; cequiAMarche?: string; cequiACoute?: string }
): Lecon | null {
  const { prospect: p } = input;
  const faits = [propre(input.cequiAMarche), propre(input.cequiACoute), propre(input.resume)].filter(Boolean);
  // Règle 2 : sans fait, pas de note. Un débrief vide ne doit pas polluer.
  if (!faits.length) return null;

  const { tags, entete } = ancrage(p);
  const corps = [
    entete,
    ``,
    input.cequiAMarche ? `**Ce qui a marché** : ${propre(input.cequiAMarche)}` : "",
    input.cequiACoute ? `**Ce qui a coûté** : ${propre(input.cequiACoute)}` : "",
    propre(input.resume) ? `\n${propre(input.resume)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    // Règle 1 : un débrief par prospect et par jour. Recliquer met à jour.
    id: `terrain-debrief-${p.id}-${(input.now ?? new Date()).toISOString().slice(0, 10)}`,
    title: `Terrain — ${p.company}${p.sector ? ` (${p.sector})` : ""}`,
    body: corps,
    tags,
    accountId: input.accountId,
    source: "terrain",
  };
}

/**
 * Ce qu'on retient d'une OBJECTION traitée.
 *
 * C'est la mémoire la plus rentable du système : les objections se répètent
 * par métier, presque mot pour mot. Une réponse qui a débloqué un garagiste
 * débloquera le suivant — à condition qu'on l'ait écrite.
 */
export function leconDObjection(
  input: LeconInput & { objection: string; reponse: string; aDebloque: boolean }
): Lecon | null {
  const objection = propre(input.objection);
  const reponse = propre(input.reponse);
  if (!objection || !reponse) return null;

  const { prospect: p } = input;
  const { tags, entete } = ancrage(p);

  return {
    // L'id porte l'objection, pas la date : la même objection chez le même
    // prospect est UNE leçon qu'on affine, pas une collection.
    id: `terrain-objection-${p.id}-${empreinte(objection)}`,
    title: `Objection — « ${objection.slice(0, 60)} »${p.sector ? ` (${p.sector})` : ""}`,
    body: [
      entete,
      ``,
      `**Objection entendue** : ${objection}`,
      `**Réponse donnée** : ${reponse}`,
      ``,
      input.aDebloque
        ? `➜ A DÉBLOQUÉ. À réutiliser sur ce métier.`
        : `➜ N'a PAS débloqué. Ne pas la resservir telle quelle — chercher la croyance cassée derrière.`,
    ].join("\n"),
    tags: [...tags, "objection", input.aDebloque ? "marche" : "rate"],
    accountId: input.accountId,
    source: "terrain",
  };
}

/**
 * Ce qu'on retient d'une PERTE.
 *
 * La raison d'un refus est l'information la plus chère du pipe et la plus vite
 * oubliée — parce qu'on n'a pas envie de la relire. Elle est donc écrite
 * automatiquement, sans demander.
 */
export function leconDePerte(input: LeconInput & { raison: string; concurrent?: string }): Lecon | null {
  const raison = propre(input.raison);
  if (!raison) return null;

  const { prospect: p } = input;
  const { tags, entete } = ancrage(p);

  return {
    id: `terrain-perdu-${p.id}`,
    title: `Perdu — ${p.company}${p.sector ? ` (${p.sector})` : ""}`,
    body: [
      entete,
      ``,
      `**Raison du refus** : ${raison}`,
      input.concurrent ? `**Parti chez** : ${propre(input.concurrent)}` : "",
      ``,
      `À relire avant le prochain rendez-vous de ce métier : c'est le piège qui a déjà coûté un deal.`,
    ]
      .filter(Boolean)
      .join("\n"),
    tags: [...tags, "perdu"],
    accountId: input.accountId,
    source: "terrain",
  };
}

/**
 * Empreinte courte et stable d'un texte — pour construire un identifiant.
 *
 * Somme pondérée par position (à la Java `hashCode`) : ce n'est PAS de la
 * cryptographie et ça n'a pas à l'être. On veut seulement que la même
 * objection produise le même id, et deux objections différentes deux ids
 * différents dans l'immense majorité des cas. Une collision n'expose rien :
 * elle fusionne deux leçons du même prospect.
 */
export function empreinte(texte: string): string {
  const t = texte.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉLAGAGE — parce qu'une mémoire sans plafond est une fuite.
 *
 * Chaque objection traitée, chaque perte, chaque débrief écrit une note. Rien
 * n'en supprime jamais. MESURÉ : 0,5 Ko par leçon, et `search()` coûte 62 ms
 * sur 5 000 notes — or Alpha Live appelle `search()` à CHAQUE bribe entendue,
 * sur le fil principal, PENDANT un appel réel. Le souffleur se serait mis à
 * laguer précisément quand on parle à un client.
 *
 * Deux garde-fous, et un principe : on n'élague QUE ce que la machine a écrit.
 *
 *  · Les notes écrites par l'humain (manuel, playbook, intel) ne sont JAMAIS
 *    touchées. Une mémoire automatique qui supprime le travail de quelqu'un
 *    est pire que pas de mémoire du tout.
 *  · À plafond atteint, on retire les PLUS ANCIENNES. Une leçon récente vaut
 *    mieux qu'une leçon de l'an dernier sur un prospect déjà classé.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Nombre maximal de leçons de terrain conservées.
 *
 * 400 × 0,5 Ko ≈ 200 Ko, et `search()` reste sous 5 ms — donc invisible même
 * pendant un appel. Au-delà, on gagne de la mémoire qu'on ne relit jamais et
 * on paie une latence qu'on sent.
 */
export const MAX_LECONS_TERRAIN = 400;

/**
 * Retourne les notes à conserver. Pure : elle ne mute rien, l'appelant décide.
 * L'ordre d'entrée est préservé pour tout ce qui n'est pas élagué.
 */
export function elaguer(notes: KnowledgeNote[], max = MAX_LECONS_TERRAIN): KnowledgeNote[] {
  const terrain = notes.filter((n) => n.source === "terrain");
  if (terrain.length <= max) return notes;

  // Les plus RÉCENTES d'abord, puis on garde les `max` premières. `updatedAt`
  // et non `createdAt` : une leçon rouverte et complétée est vivante.
  const gardees = new Set(
    [...terrain]
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, max)
      .map((n) => n.id)
  );

  return notes.filter((n) => n.source !== "terrain" || gardees.has(n.id));
}
