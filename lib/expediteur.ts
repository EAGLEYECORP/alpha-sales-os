/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE TOUT ENVOI DOIT DIRE DE SON EXPÉDITEUR — UNE SEULE FOIS.
 *
 * ⚠ POURQUOI CE MODULE EXISTE, ET POURQUOI IL EST SI PETIT.
 *
 * `/api/send` sait maintenant refuser un message dont l'identité manque, et
 * signer avec la marque du COMPTE plutôt qu'avec la nôtre. Mais il ne sait
 * de qui il s'agit que si l'appelant le lui dit — et il y a quatre appelants
 * (barre d'envoi, revue de campagne, newsletter, recette). C'est le défaut le
 * plus fréquent de ce dépôt : une garde juste, câblée à un seul endroit.
 *
 * Trois d'entre eux annonçaient déjà `accountId`, le quatrième non. Écrire
 * quatre fois le même triplet garantit qu'un cinquième écran, demain, en
 * oubliera un — et personne ne le verra, parce que rien n'échoue : le message
 * part, simplement signé de travers.
 *
 * Le CLIENT n'arbitre rien : il transmet ce que l'opérateur a saisi. C'est le
 * serveur qui tranche (`signataire`, puis `verifieMentions`). Un seul arbitre,
 * du côté qui envoie vraiment.
 * ─────────────────────────────────────────────────────────────────────
 */

import { ACCOUNTS, getAccount } from "./accounts";
import { signataire } from "./signature";

/** Le triplet que toute requête vers `/api/send` doit porter. */
export interface IdentiteEnvoi {
  accountId: string;
  closerName: string;
  agencyName: string;
}

/**
 * Extrait l'identité d'envoi des réglages.
 *
 * On ne substitue RIEN ici — pas même le libellé d'usine. Un réglage vide
 * part vide, et le serveur le refuse en le disant. Le remplacer en douce
 * côté client rendrait le trou invisible des deux côtés.
 */
export function identiteEnvoi(settings: {
  accountId?: string;
  closerName?: string;
  agencyName?: string;
}): IdentiteEnvoi {
  return {
    accountId: settings.accountId ?? "eagleye",
    closerName: settings.closerName ?? "",
    agencyName: settings.agencyName ?? "",
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'HABILLAGE D'UN EMAIL — RÉSOLU UNE FOIS, POUR L'APERÇU COMME POUR L'ENVOI.
 *
 * ⚠ `/api/email/preview` et `/api/send` rendaient le MÊME email avec deux
 * identités différentes. L'aperçu lisait une variable d'environnement ; l'envoi
 * résolvait depuis le compte. Un aperçu qui ment est pire qu'une absence
 * d'aperçu : l'opérateur relit un message, en envoie un autre, et croit avoir
 * vérifié.
 *
 * Les deux routes passent donc par ici. Le jour où l'habillage change, il
 * change des deux côtés ou d'aucun.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface HabillageEnvoi {
  /** Le nom qui signe, arbitré par `signataire()`. */
  closerName: string;
  /**
   * L'identité d'expéditeur du pied — et la source du papier à en-tête.
   *
   * ⚠ CE N'EST PAS UNE ADRESSE POSTALE, ET IL NE FAUT PAS FAIRE SEMBLANT.
   * Une première version composait `${marque} — ${compte.city}, France`. Mais
   * `Account.city` désigne le MARCHÉ qu'un compte travaille, pas son siège :
   * Nuwacom y porte « Lyon » alors qu'ils opèrent depuis le Benelux. Le pied
   * annonçait donc une adresse inventée — précisément la faute que ce module
   * existe pour empêcher.
   *
   * On retombe donc sur la marque seule, qui est vraie. L'appelant peut
   * fournir une vraie adresse (`addressLine`) le jour où le produit a un
   * champ pour ça — il n'en a pas encore, et c'est un manque réel pour un
   * email commercial, pas un détail de rendu.
   */
  addressLine: string;
  /**
   * Notre aigle, UNIQUEMENT sur le compte maître. Sur un compte revendeur il
   * vaut `undefined` : le rendu retombe alors sur le monogramme de
   * l'expéditeur plutôt que d'afficher notre logo au-dessus de sa signature.
   */
  logoUrl?: string;
  /** La marque retenue — c'est elle que `verifieMentions` doit retrouver. */
  marque: string;
  /** Vrai si personne n'est identifié : l'envoi doit être refusé. */
  usine: boolean;
  /**
   * Pourquoi la SOCIÉTÉ ne peut pas signer — `null` si elle le peut.
   * `absente` : rien n'est saisi. `portefeuille` : le nom saisi est celui d'un
   * compte de NOTRE portefeuille. Hors compte maître, l'un ou l'autre REFUSE
   * l'envoi (voir `habillageEnvoi`).
   */
  marqueRefusee: "absente" | "portefeuille" | null;
}

/** Les raisons sociales du portefeuille, normalisées pour la comparaison. */
const MARQUES_DU_PORTEFEUILLE = new Set(ACCOUNTS.map((a) => a.name.trim().toLowerCase()));

export function habillageEnvoi(opts: {
  /**
   * L'expéditeur est-il le compte MAÎTRE ? Prouvé par le SERVEUR
   * (`resoudreDroits`), jamais annoncé par le navigateur.
   *
   * ⚠⚠ MESURÉ LE 21/10/2026 : un store neuf porte `agencyName: "EAGLEYE CORP"`
   * et `accountId: "eagleye"`. Un inscrit qui saisissait son prénom et rien
   * d'autre envoyait donc, depuis SA boîte, un email signé de notre raison
   * sociale, avec notre adresse en pied et notre aigle — et `usine: false`,
   * parce que la société « identifiait » quelqu'un. Le compte annoncé par le
   * client décidait de la marque. Obligatoire, sans défaut : chaque appelant
   * doit dire de quel côté il envoie.
   */
  maitre: boolean;
  accountId?: string;
  closerName?: string;
  agencyName?: string;
  /** Vraie adresse légale, si l'opérateur en a saisi une. Jamais devinée. */
  addressLine?: string;
  /** Origine publique, pour l'URL du logo. Absente = aucun logo. */
  base?: string;
}): HabillageEnvoi {
  const compte = getAccount(opts.accountId);

  /**
   * HORS COMPTE MAÎTRE : la société est celle que l'expéditeur a SAISIE, et
   * elle ne peut être aucune des nôtres. Pas de repli sur le nom du compte
   * (c'est le client qui l'annonce), pas de logo. Une société absente ou
   * empruntée ne se corrige pas en douce : elle se refuse, et `/api/send` dit
   * quoi faire.
   */
  if (!opts.maitre) {
    const saisie = opts.agencyName?.trim() ?? "";
    const marqueRefusee = !saisie ? "absente" : MARQUES_DU_PORTEFEUILLE.has(saisie.toLowerCase()) ? "portefeuille" : null;
    const marque = marqueRefusee ? "" : saisie;
    const qui = signataire(opts.closerName, marque);
    return {
      closerName: qui.nom,
      addressLine: opts.addressLine?.trim() || marque,
      logoUrl: undefined,
      marque,
      usine: qui.usine,
      marqueRefusee,
    };
  }

  const marque = opts.agencyName?.trim() || compte.name;
  const qui = signataire(opts.closerName, marque);
  return {
    closerName: qui.nom,
    addressLine: opts.addressLine?.trim() || marque,
    logoUrl: compte.kind === "master" && opts.base ? `${opts.base}/email-eagle.png` : undefined,
    marque,
    usine: qui.usine,
    marqueRefusee: null,
  };
}

/** Ce que l'écran dit quand la société ne peut pas signer. */
export const QUOI_FAIRE_SOCIETE: Record<"absente" | "portefeuille", string> = {
  absente: "Renseigne le nom de TA société dans Réglages → Identité : un message commercial dit qui l'envoie.",
  portefeuille:
    "Le nom de société enregistré est celui d'un compte Alpha, pas le tien (réglage d'usine). Remplace-le par le nom de TA société dans Réglages → Identité.",
};
