/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI PARLE — l'IA ou un humain. Et pourquoi les DEUX erreurs coûtent.
 *
 * Zakaria, 13/09/2026 : « si toutes les interactions IA sont signées Alpha, et
 * que le reste est géré par l'humain, ça prouve la force. »
 *
 * C'est juste, et c'est plus subtil que ça en a l'air. La règle naïve — « on
 * signe tout ce que l'IA a touché » — serait FAUSSE et nous coûterait cher.
 *
 * ══ LES DEUX ERREURS, ET ELLES SONT SYMÉTRIQUES ══
 *
 *  · **Ne pas divulguer une interaction AUTONOME** : l'article 50 du règlement
 *    européen sur l'IA est applicable depuis le 02/08/2026. Un système qui
 *    interagit directement avec une personne physique doit lui faire
 *    comprendre qu'elle parle à une IA. C'est l'erreur illégale.
 *
 *  · **Divulguer un message qu'un HUMAIN a relu et envoyé** : ce serait
 *    FAUX. La divulgation ne dit pas « une IA a aidé à écrire », elle dit
 *    « vous interagissez avec une IA ». Quand un humain relit, décide et
 *    envoie, l'interlocuteur interagit avec un humain qui s'est servi d'un
 *    outil — exactement comme un commercial qui utilise un traitement de
 *    texte. L'annoncer comme une IA est un mensonge qui, en prime, affaiblit
 *    le message pour rien.
 *
 * ⚠⚠ C'EST CETTE SECONDE ERREUR QUI REND LA PROMESSE DÉFENDABLE. « Toute
 * interaction menée par l'IA le dit, le reste est un humain » n'a de valeur
 * que si le second membre est vrai. Une app qui signe tout « IA » ne prouve
 * rien : elle dit seulement qu'elle n'a pas regardé.
 *
 * ══ CE QUI RESTE VRAI PARTOUT : LA MENTION DE PLATEFORME ══
 *
 * « Généré avec Alpha Sales OS® » nomme l'OUTIL, pas l'auteur. Elle est
 * légitime sur un message relu par un humain comme sur un message autonome —
 * et c'est elle, pas la divulgation, qui porte la marque. Ne jamais confondre
 * les deux : l'une est du marketing, l'autre est une obligation légale.
 *
 * ⚠ Ce module dit QUI PARLE. Il ne dit pas qui SIGNE — c'est `lib/signature.ts`
 * (le nom, la société, le repli d'usine) et les deux questions sont distinctes.
 * Un email autonome envoyé pour un revendeur porte SA raison sociale ET la
 * divulgation IA : la marque est à lui, l'aveu est le nôtre.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Comment ce message a été produit — c'est ÇA qui décide, pas le canal. */
export type ModeProduction =
  /** L'IA rédige ET envoie. Personne ne relit avant que ça parte. */
  | "autonome"
  /** L'IA propose, un humain relit, décide et envoie. */
  | "valide-par-humain"
  /** Écrit par un humain, de bout en bout. */
  | "ecrit-par-humain";

export type CanalSortant = "appel" | "email" | "sms" | "linkedin" | "chat-site";

/** Ce qu'on a le droit — et le devoir — d'écrire. */
export interface VerdictDivulgation {
  /** La divulgation IA doit apparaître. */
  obligatoire: boolean;
  /** L'écrire serait FAUX. Distinct de « pas obligatoire ». */
  interdite: boolean;
  /** Le texte exact, ou `null` quand il ne doit pas y en avoir. */
  mention: string | null;
  motif: string;
}

/**
 * La mention de plateforme — l'OUTIL, jamais l'auteur.
 *
 * Elle reste vraie partout : elle nomme l'éditeur du logiciel. C'est la seule
 * chose qui survit au white-label (`lib/signature.ts` : la marque, l'adresse
 * et le logo suivent le COMPTE ; celle-ci nomme l'éditeur).
 */
export const MENTION_PLATEFORME = "Généré avec Alpha Sales OS®";

/**
 * ⚠ La divulgation est ÉCRITE ICI et nulle part ailleurs pour l'écrit.
 *
 * Le script vocal a la sienne (`buildVoiceScript`, prononcée par le CODE avec
 * `allow_interruptions=False`) parce qu'elle doit tomber dans la première
 * phrase. Deux textes pour deux canaux, mais UNE seule règle qui décide s'ils
 * s'appliquent — c'est cette fonction.
 */
export const DIVULGATION_ECRITE =
  "Ce message est rédigé et envoyé par un assistant IA, pas par une personne. Répondez « STOP » pour ne plus en recevoir.";

/**
 * Faut-il divulguer, sur ce canal, dans ce mode de production ?
 *
 * ⚠ Le CANAL ne décide de rien tout seul — c'est le mode. Un email autonome
 * doit se déclarer ; un email relu par un humain ne le doit pas. Router sur le
 * canal aurait signé « IA » toute la boîte d'envoi, y compris les messages que
 * quelqu'un a réellement écrits.
 */
export function divulgation(canal: CanalSortant, mode: ModeProduction): VerdictDivulgation {
  if (mode === "autonome") {
    return {
      obligatoire: true,
      interdite: false,
      mention: canal === "appel" ? null : DIVULGATION_ECRITE,
      motif:
        canal === "appel"
          ? "Appel mené par l'agent : la divulgation est PRONONCÉE dès la première phrase par le code (art. 50), pas ajoutée en pied de message."
          : "Message rédigé ET envoyé sans relecture humaine : l'interlocuteur interagit avec une IA, et l'article 50 impose qu'il le sache.",
    };
  }

  if (mode === "valide-par-humain") {
    return {
      obligatoire: false,
      interdite: true,
      mention: null,
      motif:
        "Un humain a relu, décidé et envoyé : l'interlocuteur interagit avec un humain qui s'est servi d'un outil. " +
        "Écrire « vous parlez à une IA » serait FAUX — et affaiblirait le message pour rien. " +
        `La mention d'outil (« ${MENTION_PLATEFORME} ») reste légitime : elle nomme le logiciel, pas l'auteur.`,
    };
  }

  return {
    obligatoire: false,
    interdite: true,
    mention: null,
    motif: "Écrit par un humain de bout en bout : aucune IA dans la boucle, rien à divulguer.",
  };
}

/**
 * Le texte est-il conforme à ce que le mode exige ?
 *
 * Rend la liste des problèmes — vide si tout va bien. Deux familles, et elles
 * ne se confondent pas : une divulgation MANQUANTE (illégal) et une
 * divulgation EN TROP (mensonge).
 */
export function verifieDivulgation(
  texte: string,
  canal: CanalSortant,
  mode: ModeProduction,
): string[] {
  const v = divulgation(canal, mode);
  const problemes: string[] = [];

  /**
   * ⚠ On cherche la FORME de l'aveu, pas la phrase exacte. Un opérateur a le
   * droit de reformuler « je suis un assistant automatique » ; exiger le
   * texte au mot près ferait refuser des messages parfaitement conformes, et
   * on finirait par désarmer le garde. Ce qui compte est qu'une IA soit
   * nommée comme l'émetteur.
   */
  const avoue = /\b(assistant|agent|robot)\s+(ia|automatique|virtuel)|\bune?\s+ia\b|intelligence artificielle/i.test(texte);

  if (v.obligatoire && v.mention !== null && !avoue) {
    problemes.push(
      `Divulgation IA manquante. ${v.motif} Texte attendu (ou une reformulation équivalente) : « ${v.mention} »`,
    );
  }
  if (v.interdite && avoue) {
    problemes.push(
      `Divulgation IA présente alors qu'un humain est dans la boucle — c'est FAUX. ${v.motif}`,
    );
  }
  return problemes;
}
