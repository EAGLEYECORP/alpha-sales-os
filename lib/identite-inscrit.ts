import { ACCOUNTS } from "./accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTRE IDENTITÉ NE SORT PAS PAR LA BOUCHE D'UN INSCRIT — pur, client + serveur.
 *
 * Jusqu'au 21/10/2026, un store neuf naissait sous NOTRE identité
 * (`agencyName: "EAGLEYE CORP"`, notre offre, notre ville). Les réglages
 * d'usine sont vides depuis, mais un navigateur d'inscrit déjà ouvert garde
 * l'ancien état — persisté, donc relu à chaque visite. Trois sorties le
 * reprenaient sans que rien ne le corrige :
 *
 *   · ses prompts IA (« Tu agis pour le compte d'EAGLEYE CORP… ce qu'elle
 *     vend : Alpha Sales OS ») — rattrapés ici, côté SERVEUR (`identiteServie`) ;
 *   · ses messages LinkedIn, copiés à la main : AUCUN serveur ne les relit.
 *     Ils ne se rattrapent qu'en corrigeant les réglages eux-mêmes
 *     (`reglagesSansNotreIdentite`), une fois que le serveur a PROUVÉ que le
 *     compte n'est pas le maître ;
 *   · ses emails — déjà refusés en 422 par `/api/send` (`habillageEnvoi`).
 *
 * Une seule définition de « c'est à nous » : les comptes du portefeuille
 * (`ACCOUNTS`) et les anciens réglages d'usine. `lib/expediteur.ts` lit la
 * même liste de marques.
 * ─────────────────────────────────────────────────────────────────────
 */

const norme = (s: string) => s.trim().toLowerCase();

/** Les raisons sociales du portefeuille, normalisées pour la comparaison. */
export const MARQUES_DU_PORTEFEUILLE: ReadonlySet<string> = new Set(ACCOUNTS.map((a) => norme(a.name)));

export const estMarqueDuPortefeuille = (nom: string | undefined): boolean =>
  MARQUES_DU_PORTEFEUILLE.has(norme(nom ?? ""));

/**
 * Les anciens réglages d'usine, RECOPIÉS ici — et c'est le seul endroit
 * légitime : ils n'existent plus nulle part ailleurs (même règle que les
 * montants périmés de `lib/grille-perimee.ts`). On ne peut reconnaître ce
 * qu'un navigateur a persisté qu'en sachant ce qu'on y avait écrit.
 */
const OFFRE_USINE_AVANT_21_10 = {
  whatYouSell: "Alpha Sales OS — l'OS de vente terrain",
  valueProp: "On outille les forces de vente avec l'automatisation IA : zéro lead perdu, la machine tourne 24/7.",
  city: "Lyon",
} as const;

/** Les textes d'offre qui sont à NOUS : ceux des comptes, et l'ancien réglage d'usine. */
const OFFRES_A_NOUS: ReadonlySet<string> = new Set(
  [
    OFFRE_USINE_AVANT_21_10.whatYouSell,
    OFFRE_USINE_AVANT_21_10.valueProp,
    ...ACCOUNTS.flatMap((a) => [a.whatYouSell, a.valueProp]),
  ].map(norme)
);

interface ReglagesIdentite {
  agencyName?: string;
  offer?: { city?: string; whatYouSell?: string; valueProp?: string };
}

/**
 * Ce qu'il faut effacer des réglages d'un NON-maître pour qu'ils ne parlent
 * plus en notre nom — `null` s'il n'y a rien à faire.
 *
 * ⚠ On EFFACE, on ne remplace pas : on ne connaît pas sa société, et un champ
 * vide se voit (bandeau d'identité d'usine, refus 422 avec la consigne) quand
 * une valeur devinée ne se relit jamais. La ville n'est effacée que si la
 * marque l'était aussi : « Lyon » seul peut très bien être la sienne.
 */
export function reglagesSansNotreIdentite(s: ReglagesIdentite): ReglagesIdentite | null {
  const marque = estMarqueDuPortefeuille(s.agencyName);
  const offre = s.offer ?? {};
  const vend = OFFRES_A_NOUS.has(norme(offre.whatYouSell ?? ""));
  const promet = OFFRES_A_NOUS.has(norme(offre.valueProp ?? ""));
  if (!marque && !vend && !promet) return null;
  return {
    ...(marque ? { agencyName: "" } : {}),
    offer: {
      city: marque && offre.city === OFFRE_USINE_AVANT_21_10.city ? "" : (offre.city ?? ""),
      whatYouSell: vend ? "" : (offre.whatYouSell ?? ""),
      valueProp: promet ? "" : (offre.valueProp ?? ""),
    },
  };
}

/** Ce que le modèle reçoit à la place d'une identité qui n'est pas la sienne. */
export const IDENTITE_NEUTRE =
  "Tu agis pour le compte de l'opérateur connecté. Sa société et son offre ne sont pas renseignées : ne nomme aucune société, ne signe au nom d'aucune, et n'invente aucune offre — demande-la.";

/**
 * L'identité à injecter dans un prompt, arbitrée par le SERVEUR.
 * Le maître garde la sienne ; un non-maître dont l'identité nomme une de nos
 * marques ou récite une de nos offres reçoit `IDENTITE_NEUTRE`.
 */
export function identiteServie(identity: string | undefined, maitre: boolean): string | undefined {
  if (maitre || !identity?.trim()) return identity;
  const t = norme(identity);
  const nous = [...MARQUES_DU_PORTEFEUILLE, ...OFFRES_A_NOUS].some((x) => x && t.includes(x));
  return nous ? IDENTITE_NEUTRE : identity;
}

/**
 * « Démo mobile » est NOTRE démonstration (Alpha montré sur un téléphone, nom et
 * couleurs du prospect). Dans un prompt d'inscrit, c'est « une démonstration ».
 */
export const pourInscrit = (texte: string, maitre: boolean): string =>
  maitre ? texte : texte.replace(/démo mobile/gi, "démonstration");

/**
 * Le repli SANS moteur IA d'un inscrit qui demande un script : `fallbackScript`
 * (`lib/hormozi.ts`) est notre pitch de visibilité (« voilà à quoi
 * ressemblerait votre entreprise en ligne », « je suis à Lyon »). Le sien
 * existe déjà, construit sur son profil (`lib/script-operateur.ts`).
 */
export const REPLI_SCRIPT_INSCRIT =
  "Aucun moteur IA n'a répondu. Le script de TON offre est déjà prêt sur l'écran Appels (« Le script — Ton offre »), construit sur ce que tu as dit vendre et à qui. Complète ton profil si des crochets y restent.";
