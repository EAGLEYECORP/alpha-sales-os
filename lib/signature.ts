/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI SIGNE CET EMAIL ? QUATRE FICHIERS RÉPONDAIENT QUATRE CHOSES.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * En ouvrant `/templates` en tant qu'opérateur, l'email de premier contact se
 * terminait par « Le Closer — EAGLEYE CORP ». C'est le réglage d'usine
 * (`defaultSettings.closerName`) : un libellé de démonstration, pas un nom.
 * Un opérateur qui n'ouvre pas Réglages écrit donc à un vrai prospect en
 * signant « Le Closer », et lui remet un PDF d'audit « préparé par Le Closer ».
 *
 * En cherchant d'où venait ce nom, quatre réponses différentes :
 *   · `lib/store.ts`         → « Le Closer »   (le réglage d'usine)
 *   · `lib/mail-compose.ts`  → « Zakaria »     (repli en dur)
 *   · `lib/gmail-draft.ts`   → « Zakaria »     (repli en dur)
 *   · `lib/email-html.ts`, `lib/audit-doc.ts` → « EAGLEYE »
 *
 * Les deux « Zakaria » sont le pire des quatre : le produit est WHITE-LABEL.
 * Un revendeur qui vide le champ signe ses emails du prénom du propriétaire de
 * l'outil. Ce n'est pas un défaut cosmétique — c'est une usurpation d'identité
 * dans un message commercial.
 *
 * ── POURQUOI CE N'EST PAS QU'UNE QUESTION DE POLITESSE ──
 *
 * `MENTIONS_OBLIGATOIRES` (lib/conformite.ts) impose « Identité de
 * l'expéditeur (nom + société) ». `verifieMentions` la validait dès que le
 * corps CONTENAIT la chaîne — donc « Le Closer » passait le contrôle de
 * conformité. Un contrôle qu'un nom d'usine satisfait ne contrôle rien.
 *
 * ── LA RÈGLE ──
 *
 * On ne devine JAMAIS l'identité d'un humain. L'ordre de repli est :
 *   1. le nom saisi par l'opérateur ;
 *   2. à défaut, la SOCIÉTÉ — une raison sociale est une identité légale
 *      valable, et elle appartient bien à celui qui envoie ;
 *   3. à défaut de tout, le nom d'usine, RENVOYÉ AVEC `usine: true` pour que
 *      l'écran puisse le dire au lieu de l'envoyer en silence.
 *
 * On ne substitue pas le nom d'usine en douce par autre chose : masquer le
 * trou le rend indétectable. On le laisse visible ET on le signale.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Le nom d'usine. `defaultSettings.closerName` DOIT s'y référer plutôt que de
 * recopier la chaîne : deux copies dérivent, et le jour où elles dérivent le
 * détecteur ci-dessous ne reconnaît plus le placeholder qu'il doit attraper.
 */
export const CLOSER_USINE = "Le Closer";

export interface Signataire {
  /** Le nom à écrire dans le message. */
  nom: string;
  /** Vrai si c'est encore le libellé d'usine : personne n'est identifié. */
  usine: boolean;
}

/**
 * Qui signe. Unique réponse pour tous les chemins d'écriture (texte brut,
 * HTML, brouillon Gmail, PDF d'audit).
 */
export function signataire(closerName?: string, agencyName?: string): Signataire {
  const nom = closerName?.trim() ?? "";
  if (nom && nom !== CLOSER_USINE) return { nom, usine: false };

  // Pas de nom saisi : la société identifie légalement l'expéditeur, et elle
  // est à lui. C'est le seul repli honnête — inventer un prénom ne l'est pas.
  const agence = agencyName?.trim() ?? "";
  if (!nom && agence) return { nom: agence, usine: false };

  return { nom: CLOSER_USINE, usine: true };
}

/**
 * L'identité d'envoi est-elle encore celle sortie d'usine ? Sert aux écrans
 * qui envoient (boîte d'envoi) pour prévenir AVANT le premier message, pas
 * après.
 */
export const identiteDUsine = (closerName?: string, agencyName?: string): boolean =>
  signataire(closerName, agencyName).usine;

/**
 * ─────────────────────────────────────────────────────────────────────
 * COMMENT ON SE PRÉSENTE À VOIX HAUTE — « je suis … ».
 *
 * ⚠⚠ DEUX DÉFAUTS QUE CETTE FONCTION EXISTE POUR EMPÊCHER, et les deux ont
 * été vus sur le rendu réel, jamais déduits.
 *
 * 1. LA RÉPÉTITION. `signataire` rend la RAISON SOCIALE quand aucun nom n'est
 *    saisi — c'est le repli documenté. Une phrase écrite « je suis {nom}, de
 *    {société} » produit alors « je suis EAGLEYE CORP, de EAGLEYE CORP ».
 *    Le défaut n'existait pas tant qu'un prénom était codé en dur : le
 *    corriger l'a créé. Quand le signataire EST la société, on ne la dit
 *    qu'une fois.
 *
 * 2. L'ÉLISION. « d'EAGLEYE CORP » mais « de Nuwacom ». Les textes en dur
 *    portaient l'apostrophe, donc tout compte à consonne initiale aurait
 *    produit « d'Nuwacom ». On n'élide PAS devant un h : « de Hxxx » est
 *    toujours correct, « d'Hxxx » dépend du h aspiré, qu'aucune règle
 *    mécanique ne tranche.
 *
 * ⚠ Elle vit ICI parce que `linkedin-sequence` et `argumentaire` posaient la
 * même question. Deux copies de la règle d'élision divergeraient, et c'est
 * celle qu'on ne relit pas qui se mettrait à dire « d'Nuwacom ».
 * ─────────────────────────────────────────────────────────────────────
 */
export function presentation(closerName?: string, agencyName?: string, city?: string): string {
  const qui = signataire(closerName, agencyName);
  const agence = agencyName?.trim() ?? "";
  const ou = city?.trim() ? `, à ${city.trim()}` : "";

  // Le signataire EST la société : la nommer deux fois sonne comme un bug,
  // parce que c'en est un.
  if (!agence || qui.nom === agence) return `je suis ${qui.nom}${ou}`;

  const de = /^[aeiouyàâéèêëîïôöûü]/i.test(agence) ? `d'${agence}` : `de ${agence}`;
  return `je suis ${qui.nom}, ${de}${ou}`;
}
