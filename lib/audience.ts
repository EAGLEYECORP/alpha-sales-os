import { accountICP } from "./accounts";
import { SEGMENTS, guessSegmentForProspect, type Segment } from "./segments";
import { OFFER_LABELS, type EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * À QUI ON PARLE — le profil client visé, pour TOUT texte généré.
 *
 * ── LE PROBLÈME ──
 *
 * Le rédacteur de posts (`/api/social/draft`) recevait un sujet et un nom
 * d'agence. Rien d'autre. Il produisait donc du « leadership tech » qui
 * pourrait être signé par n'importe quelle agence de n'importe quel pays :
 * pas de métier, pas de douleur nommée, pas de vocabulaire du terrain.
 *
 * Un post qui ne nomme personne ne convertit personne. Le lecteur qui se
 * reconnaît est le seul qui répond — et il ne se reconnaît qu'à des détails
 * qu'il croyait propres à son métier : « le devis qu'on refait le dimanche »,
 * « l'appel manqué pendant qu'on est sous un capot ».
 *
 * ── CE QUE FAIT CE MODULE ──
 *
 * Il fabrique un BRIEF D'AUDIENCE déterministe (aucune IA, aucune clé) à
 * partir de ce qu'on sait déjà : l'ICP du compte actif, le segment de marché
 * visé, l'offre, et — quand le texte cible quelqu'un en particulier — la
 * fiche du prospect. Ce brief est injecté dans le prompt de chaque
 * générateur, et sert aussi de garniture au gabarit hors-ligne : sans IA, le
 * texte reste ciblé, il est juste moins bien écrit.
 *
 * Il ne remplace pas le sujet. Il répond à la question que le sujet ne pose
 * jamais : « pour QUI est-ce que j'écris ça ? »
 * ─────────────────────────────────────────────────────────────────────
 */

export interface AudienceBrief {
  /** Le client idéal en une ligne — sert de titre au bloc. */
  label: string;
  /** Qui c'est, dit comme lui le dirait. */
  who: string;
  /** Qui SIGNE (ce n'est pas toujours qui lit). */
  buyer: string;
  /** Le métier / secteur visé. */
  sector: string;
  /** Les douleurs à nommer — les siennes, pas les nôtres. */
  pains: string[];
  /** Mots et situations concrètes de son quotidien, à réutiliser tels quels. */
  vocabulaire: string[];
  /** Ce qui doit disparaître du texte pour qu'il se reconnaisse. */
  aEviter: string[];
  /** L'offre dont on parle, nommée comme au catalogue. */
  offre: string;
  /** L'angle d'ouverture qui accroche cette audience. */
  angle: string;
}

/** Les mots qu'un métier reconnaît — tirés du segment, jamais inventés. */
function vocabulaireDuSegment(seg: Segment | null | undefined): string[] {
  if (!seg) return [];
  // Les EXEMPLES de métiers et la douleur centrale sont ce qu'il y a de plus
  // concret dans nos données : c'est ça qui fait dire « c'est écrit pour moi ».
  return [...seg.examples.slice(0, 4), seg.corePain].filter(Boolean);
}

/**
 * Ce qu'un texte ciblé ne doit PAS contenir.
 *
 * Liste volontairement courte et fixe : elle décrit le défaut réel des textes
 * générés sans audience, pas une police du style. Un générateur à qui on
 * interdit trop de choses écrit du vide poli.
 */
const A_EVITER_TOUJOURS = [
  "le jargon d'agence (« synergies », « disruption », « solution 360 »)",
  "les promesses chiffrées qu'on ne peut pas prouver",
  "le « nous » qui parle de nous plutôt que de lui",
];

export interface AudienceInput {
  /** Compte actif : détermine l'ICP et donc le secteur visé. */
  accountId?: string;
  /** Segment de marché explicite (sinon déduit du prospect, sinon aucun). */
  segmentId?: string;
  /** L'offre dont parle le texte. */
  offer?: EagleyeOffer;
  /** Un prospect précis, quand le texte lui est destiné. */
  prospect?: { sector?: string; company?: string; notes?: string; problems?: string[] };
}

/**
 * Le brief d'audience. Toujours renseigné : à défaut de segment ou de
 * prospect, il retombe sur l'ICP du compte — jamais sur du vide, parce qu'un
 * générateur sans audience réinvente une audience générique.
 */
export function audienceBrief(input: AudienceInput = {}): AudienceBrief {
  const icp = accountICP(input.accountId ?? "eagleye");

  const seg =
    (input.segmentId ? SEGMENTS.find((s) => s.id === input.segmentId) : undefined) ??
    (input.prospect
      ? guessSegmentForProspect({
          sector: input.prospect.sector,
          company: input.prospect.company,
          notes: input.prospect.notes,
          problems: input.prospect.problems,
        })
      : undefined);

  // Les douleurs du SEGMENT priment sur celles de l'ICP : elles sont plus
  // concrètes (« le devis refait le dimanche » vs « manque de process »).
  // Celles du prospect priment sur tout : ce sont ses mots à lui.
  const douleurs = [
    ...(input.prospect?.problems ?? []),
    ...(seg ? [seg.corePain, ...seg.pains] : []),
    ...icp.pains,
  ]
    .map((p) => p.trim())
    .filter(Boolean);

  const offre = input.offer ? OFFER_LABELS[input.offer] : (seg ? OFFER_LABELS[seg.offer] : "");

  return {
    label: seg?.label ?? icp.label,
    who: seg?.who ?? icp.label,
    buyer: icp.buyer,
    sector: input.prospect?.sector?.trim() || seg?.label || icp.sector,
    pains: Array.from(new Set(douleurs)).slice(0, 5),
    vocabulaire: vocabulaireDuSegment(seg),
    aEviter: [...A_EVITER_TOUJOURS, ...icp.disqualifiers.slice(0, 2).map((d) => `ne parle pas à : ${d}`)],
    offre,
    angle: icp.angle,
  };
}

/**
 * Le brief en texte, prêt à coller dans un prompt.
 *
 * Format bloc titré plutôt que phrase : les modèles suivent mieux une consigne
 * structurée, et un bloc se repère dans un prompt long — donc se débogue.
 */
export function audienceText(a: AudienceBrief): string {
  const lignes = [
    `## À QUI CE TEXTE S'ADRESSE (obligatoire, ne pas élargir)`,
    `Client visé : ${a.label}`,
    `Qui c'est : ${a.who}`,
    `Qui signe : ${a.buyer}`,
    `Secteur : ${a.sector}`,
  ];
  if (a.offre) lignes.push(`Offre concernée : ${a.offre}`);
  if (a.pains.length) lignes.push(`Ses douleurs, à NOMMER avec ses mots :\n${a.pains.map((p) => `- ${p}`).join("\n")}`);
  if (a.vocabulaire.length) lignes.push(`Situations concrètes de son quotidien, à réutiliser :\n${a.vocabulaire.map((v) => `- ${v}`).join("\n")}`);
  lignes.push(`Angle d'ouverture qui marche sur lui : ${a.angle}`);
  lignes.push(`À bannir :\n${a.aEviter.map((e) => `- ${e}`).join("\n")}`);
  lignes.push(
    `Test avant de rendre : si ce texte pouvait être publié tel quel par une agence qui vend autre chose à quelqu'un d'autre, il est raté — recommence en nommant SON métier.`
  );
  return lignes.join("\n");
}

/** Raccourci : le bloc prompt directement depuis les entrées. */
export const audiencePrompt = (input: AudienceInput = {}): string => audienceText(audienceBrief(input));
