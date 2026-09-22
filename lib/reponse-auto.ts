/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CERVEAU DE LA RÉPONSE AUTOMATIQUE — « le modèle CLASSE, le code DISPOSE ».
 *
 * Décidé le 22/09/2026. Le propriétaire veut MOINS d'humain dans la boucle
 * email : aujourd'hui chaque réponse entrante lui demande d'ouvrir l'inbox,
 * cliquer « Réponse IA », lire, envoyer. Ce module porte la DÉCISION qui rend
 * l'automatisation SÛRE : quelles réponses un cron a le droit de traiter tout
 * seul, et lesquelles doivent REMONTER à l'humain.
 *
 * ⚠⚠ POURQUOI CE MODULE EXISTE AVANT L'AUTO-ENVOI. Auto-envoyer une réponse
 * rédigée par le modèle à un vrai prospect est la chose la plus lourde du
 * produit (`/api/send` part de NOTRE domaine, de vraies personnes lisent). La
 * doctrine est constante : « jamais de closing sur un vital au rouge », « le
 * close, la poignée de main, c'est le CLIENT ». Donc une réponse qui touche
 * l'ARGENT (le prix, la signature) ou le DOUTE (une objection) ne s'automatise
 * JAMAIS : elle est la façon exacte de perdre le deal au dernier mètre. Seul le
 * MILIEU de tunnel — « oui parlons-nous », « c'est quoi au juste » — s'auto-
 * traite, parce que sa réponse doctrinale est fixe (proposer un créneau /
 * expliquer sans prix) et qu'un humain la taperait à l'identique.
 *
 * ⚠ Même forme que `lib/telegram.ts` : le MODÈLE classe (un motif sur du texte
 * libre exige un contexte, jamais une liste de mots — la doctrine le répète),
 * le CODE route de façon DÉTERMINISTE. La sortie du modèle est validée ; un
 * modèle qui rend n'importe quoi ne casse rien et retombe sur le cas le plus
 * PRUDENT : escalade vers l'humain. On n'auto-agit jamais sur un doute.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les intentions qu'une réponse entrante peut porter. Chacune mène à UNE
 * disposition (voir `routerReponse`) — c'est la carte qui décide, pas un score.
 */
export type IntentionReponse =
  | "veut-rdv" // « oui », donne des créneaux, veut se parler → réponse sûre
  | "renseignement" // question factuelle, curieux, pas encore engagé → réponse sûre
  | "prix" // demande le tarif / un devis → l'ARGENT, ça remonte
  | "veut-signer" // prêt à avancer / signer → le CLOSE, ça remonte
  | "objection" // doute, « pas le temps », « déjà un outil », « trop cher » → ça remonte
  | "refus" // « stop », « pas intéressé » → on CLÔT, aucun envoi
  | "hors-sujet"; // absent, auto-répondeur, spam, illisible → un humain regarde

export const INTENTIONS: readonly IntentionReponse[] = [
  "veut-rdv",
  "renseignement",
  "prix",
  "veut-signer",
  "objection",
  "refus",
  "hors-sujet",
] as const;

/**
 * Ce que le CODE fait d'une intention. Trois issues, mutuellement exclusives :
 * · `auto`     — le cron peut rédiger + envoyer la réponse (via les gardes de
 *                `/api/send` : palier, mentions, divulgation IA). Milieu de
 *                tunnel uniquement.
 * · `escalade` — on NE répond pas tout seul ; on prévient l'humain (ping
 *                Telegram / badge inbox). Tout ce qui touche l'argent, la
 *                signature, une objection, ou un doute de classement.
 * · `clore`    — refus explicite : on marque « ne plus recontacter », aucun
 *                envoi. Un « stop » auquel on répond quand même est un « stop »
 *                qu'on n'a pas entendu.
 */
export type Disposition = "auto" | "escalade" | "clore";

export interface RoutageReponse {
  disposition: Disposition;
  /** La raison lisible — sert au badge inbox et au ping Telegram, jamais décorative. */
  motif: string;
}

/**
 * ⚠⚠ LA TABLE EST L'INVARIANT. Seules `veut-rdv` et `renseignement`
 * s'automatisent. Tout ce qui touche l'ARGENT (`prix`, `veut-signer`), le DOUTE
 * (`objection`) ou l'INCERTITUDE (`hors-sujet`, et tout classement inconnu par
 * le repli plus bas) remonte à l'humain. `refus` clôt sans un mot. Un test
 * rejoue chaque intention : déplacer une seule ligne vers `auto` se voit au
 * diff, parce que c'est exactement là que se perd un deal.
 */
const TABLE_ROUTAGE: Record<IntentionReponse, RoutageReponse> = {
  "veut-rdv": {
    disposition: "auto",
    motif: "Il veut se parler — on verrouille un créneau daté.",
  },
  renseignement: {
    disposition: "auto",
    motif: "Question factuelle — on répond sans prix et on propose la démo.",
  },
  prix: {
    disposition: "escalade",
    motif: "Il demande le tarif. L'argent, c'est toi — et jamais de prix par écrit avant la démo.",
  },
  "veut-signer": {
    disposition: "escalade",
    motif: "Il est prêt à avancer. Le close et la signature, c'est toi (poignée de main).",
  },
  objection: {
    disposition: "escalade",
    motif: "Objection / doute — il faut isoler la croyance cassée, pas répondre à la va-vite.",
  },
  refus: {
    disposition: "clore",
    motif: "Refus explicite — on marque « ne plus recontacter », on n'envoie rien.",
  },
  "hors-sujet": {
    disposition: "escalade",
    motif: "Pas clair (absence, auto-répondeur, illisible) — un humain regarde avant tout envoi.",
  },
};

/** La carte, en lecture seule, pour la disposition et le motif d'une intention. */
export function routerReponse(intention: IntentionReponse): RoutageReponse {
  return TABLE_ROUTAGE[intention];
}

/** Raccourci : cette intention s'auto-traite-t-elle ? (le seul feu vert du cron) */
export function estAutomatisable(intention: IntentionReponse): boolean {
  return TABLE_ROUTAGE[intention].disposition === "auto";
}

/**
 * Le prompt système — une seule source, testable. Il fait CLASSER, rien d'autre :
 * pas de rédaction ici (le brouillon vient de la tâche `reply` de `/api/ai`,
 * source unique de « comment on répond »). Il interdit d'inventer une intention
 * pour « faire avancer » : dans le doute, `hors-sujet`, qui remonte à l'humain.
 */
export const PROMPT_CLASSER_REPONSE = [
  "Tu es le trieur de réponses entrantes d'un OS de vente (maître d'ouvrage, promoteurs Lyon).",
  "On te donne LE message qu'un prospect vient de renvoyer. Tu le CLASSES, tu ne rédiges rien.",
  "Réponds UNIQUEMENT par un JSON strict : {\"intention\": \"...\", \"raison\": \"...\"}.",
  "Les intentions possibles, une seule :",
  "- veut-rdv : il accepte de se parler, propose/valide un créneau, veut une démo.",
  "- renseignement : il pose une question factuelle ou veut en savoir plus, sans s'engager ni parler d'argent.",
  "- prix : il demande le tarif, le coût, un devis, un ordre de grandeur de prix.",
  "- veut-signer : il est prêt à avancer, signer, recevoir le contrat.",
  "- objection : il doute, refuse mollement, dit « pas le temps », « déjà un outil », « trop cher », « pas convaincu ».",
  "- refus : il refuse nettement, dit stop, « ne me recontactez plus », se désinscrit.",
  "- hors-sujet : absence/auto-répondeur, spam, message illisible, ou tu n'es pas sûr.",
  "Règle d'or : dans le DOUTE, choisis hors-sujet. Ne force jamais une intention pour faire avancer la vente.",
].join("\n");

/**
 * Valide la sortie du modèle en une intention SÛRE. Toute forme inattendue —
 * JSON cassé, intention inconnue, champ absent — retombe sur `hors-sujet`,
 * c'est-à-dire l'ESCALADE. Le repli n'est jamais `auto` : un modèle qui déraille
 * ne doit pas pouvoir faire partir un email tout seul.
 */
export function interpreterClassement(data: unknown): IntentionReponse {
  if (!data || typeof data !== "object") return "hors-sujet";
  const brut = (data as Record<string, unknown>).intention;
  if (typeof brut !== "string") return "hors-sujet";
  const i = brut.trim() as IntentionReponse;
  return (INTENTIONS as readonly string[]).includes(i) ? i : "hors-sujet";
}
