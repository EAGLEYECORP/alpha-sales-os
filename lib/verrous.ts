import { BRIQUES_GRATUITES } from "./entitlements";
import { ACCES_PAR_CHEMIN, briquesPourChemin, type BrickId } from "./bricks-access";
import { OFFRES, type OffrePublique } from "./offres-publiques";
import { CAPACITES as CATALOGUE_PUBLIC, SOCLE_GRATUIT } from "./public-catalogue";
import { CAPACITES as CAPACITES_CLE, cheminOuvertParCle, type Capacite } from "./capacites-cle";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI EST FERMÉ, ET POURQUOI — dit à celui qui se heurte à la porte.
 *
 * ── LE DÉFAUT : ON MASQUAIT, DONC ON NE RÉPONDAIT À RIEN ──
 *
 * Le rail filtrait les entrées que le compte ne possède pas. Un inscrit
 * gratuit voyait donc une application plus petite que la vraie, sans jamais
 * apprendre ce qui manquait. Trois conséquences, et la troisième est la pire :
 *
 *  1. il ne peut pas vouloir ce qu'il ne voit pas — un menu masqué ne vend
 *     rien, jamais ;
 *  2. il croit avoir tout le produit, et le juge sur un quart ;
 *  3. **il ne peut pas comprendre un refus.** Il clique un bouton laissé
 *     quelque part (`/controle` affiche le lanceur de campagnes, exprès), le
 *     serveur répond 403, et rien à l'écran n'explique lequel de ses droits
 *     manque. C'est le pire des deux mondes : la porte est invisible ET
 *     fermée.
 *
 * La doctrine était déjà écrite pour `/controle` — « voir la porte fermée
 * vaut mieux que ne pas savoir qu'elle existe, et la sécurité ne dépend
 * jamais de l'écran ». Elle n'était appliquée qu'à un endroit. Ce module la
 * généralise.
 *
 * ══ CE QUI RESTE MASQUÉ, ET CE N'EST PAS UNE EXCEPTION DE CONFORT ══
 *
 * ⚠ `/payouts`, `/offre` et les routes MAÎTRE ne se GRISENT PAS : elles
 * disparaissent. Griser, c'est annoncer. Montrer à un client une porte
 * « Payouts » revient à lui dire que nous prenons une part sur quelque
 * chose, et à l'inviter à demander laquelle. Ce n'est pas une fonctionnalité
 * qu'il pourrait acheter — c'est NOTRE économie, elle ne lui sera jamais
 * vendue. Une porte qu'on ne peut pas ouvrir contre de l'argent n'a aucune
 * raison d'être montrée.
 *
 * La règle, en une ligne : **on grise ce qui est à vendre, on masque ce qui
 * est à nous.**
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatVerrou =
  /** Ouvert : le compte possède ce qu'il faut. */
  | { type: "ouvert" }
  /** Fermé, mais achetable : on grise et on dit pourquoi. */
  | { type: "verrouille"; brique: BrickId; pourquoi: string; offreId: string | null }
  /** Ni ouvert ni vendable : on ne montre rien. */
  | { type: "masque" };

/**
 * POURQUOI chaque brique est payante — la vraie raison, pas un argumentaire.
 *
 * ⚠ CE NE SONT PAS DES ARBITRAGES COMMERCIAUX, et c'est ce qui rend ces
 * phrases dicibles. La ligne gratuit/payant est imposée par un fait
 * technique : `/api/send` lit `SMTP_*` dans l'environnement du SERVEUR,
 * `/api/voice/call` lit `LIVEKIT_*`, `/api/ai` brûle NOS jetons. (« Aucun
 * chemin d'identifiants par locataire » : vrai à l'écriture, faux pour l'IA
 * et l'email depuis le BYOK — voir `clesQuiOuvrent` plus bas.) Ouvrir une de ces briques au
 * gratuit revient à donner notre carte de crédit et notre nom de domaine à
 * des inconnus — et ça ne se voit que sur la facture, un mois plus tard.
 *
 * ⚠⚠ ON LE DIT COMME ÇA, EN CLAIR. Un « passez au premium » sans raison se
 * lit comme une rançon sur une fonctionnalité qu'on retient exprès. La vraie
 * raison est meilleure que n'importe quel argumentaire : elle est vérifiable,
 * elle explique pourquoi le gratuit est vraiment gratuit et sans limite de
 * durée, et elle dit implicitement que le jour où les identifiants seront par
 * locataire, la ligne se rediscutera.
 */
export const POURQUOI_PAYANT: Record<string, string> = {
  campagnes:
    "Envoyer part de NOTRE serveur d'emails et de NOTRE nom de domaine. Chaque message engage une réputation d'expéditeur qu'on met des mois à construire et une soirée à perdre.",
  "alpha-voice":
    "Chaque appel consomme de vraies minutes de téléphonie, facturées à nous. Un numéro composé coûte de l'argent au moment où il sonne.",
  "agent-alpha":
    /**
     * ⚠ « C'est la SEULE brique dont la dépense n'a pas de plafond naturel »
     * — retiré le 16/09/2026, parce que c'était devenu faux et que cette
     * phrase est SERVIE au client. Alpha Voice non plus n'en a pas : une
     * ligne ouverte facture tant que quelqu'un parle, et `HORS_ESSAI`
     * (lib/essai.ts) l'exclut de l'ouverture pour exactement cette raison.
     * Deux prose qui se contredisent dans le même dépôt, et c'est celle qui
     * s'affiche qui aurait menti. Ce qui reste vrai — et ce qui distingue
     * vraiment cette brique — c'est que la boucle tourne SANS QUE PERSONNE
     * REGARDE : le volume ne dépend d'aucun geste humain.
     */
    "L'agent autonome brûle nos jetons d'IA à chaque tour de boucle, sans que personne regarde : sa consommation ne dépend d'aucun geste humain.",
  /**
   * ⚠⚠ L'ENTRÉE `alpha-live` A ÉTÉ RETIRÉE LE 12/09/2026, ET SA RAISON ÉTAIT
   * FAUSSE — pas seulement le classement.
   *
   * Elle affirmait au client : « une session en direct fait tourner le modèle
   * en continu pendant qu'elle dure — même mécanique que l'agent ». C'est un
   * raisonnement par ANALOGIE, jamais une mesure. Mesuré :
   * `components/live/alpha-live.tsx` n'appelle AUCUN `/api/…`, aucune route
   * n'est classée sur `/overlay`, et le copilote tourne entièrement dans le
   * navigateur (store local, RAG hors-ligne, reconnaissance vocale native).
   * Il ne fait tourner aucun modèle chez nous.
   *
   * Faire payer est légitime ; donner une raison inventée ne l'est pas — et
   * celle-ci se vérifiait en ouvrant un fichier.
   */
  audits:
    "L'audit va chercher les pages du prospect par notre infrastructure : c'est notre adresse IP qui frappe, et c'est elle qui se fait bloquer.",
  /**
   * ⚠ Réécrite le 13/10/2026. L'ancienne phrase finissait sur « sans lui, on
   * ne peut pas isoler ce qui vient de quel compte » — un argument
   * d'architecture, pas un coût, et illisible pour qui la reçoit. Ce qui
   * coûte est concret : chaque ouverture et chaque clic frappent NOTRE
   * serveur (`/api/track/open`, `/api/track/click`) et s'écrivent dans NOTRE
   * base.
   */
  tracking:
    "Chaque ouverture et chaque clic passent par notre serveur et s'écrivent dans notre base, sous notre domaine. Un domaine de traçage signalé l'est pour tous les comptes qui le partagent.",
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE NOM QU'UN HUMAIN LIT — jamais l'identifiant.
 *
 * ⚠ L'écran du refus titrait « « agent-alpha » n'est pas incluse » : un
 * identifiant de code, servi tel quel à quelqu'un qui n'a jamais vu le code,
 * au moment précis où on lui demande de comprendre. Les libellés viennent du
 * catalogue PUBLIC (`lib/public-catalogue.ts`), pas de `lib/bricks` — lui
 * est serveur, il porte nos marges.
 * ─────────────────────────────────────────────────────────────────────
 */
export function libelleBrique(id: string): string {
  return CATALOGUE_PUBLIC.find((c) => c.id === id)?.label ?? id;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'IL PEUT FAIRE À LA PLACE, GRATUITEMENT, TOUT DE SUITE.
 *
 * ⚠⚠ UN REFUS SANS ISSUE EST UN CUL-DE-SAC, MÊME BIEN EXPLIQUÉ. La raison
 * dit pourquoi la porte est fermée ; elle ne dit pas où aller. Quelqu'un sans
 * budget qui lit « ça consomme nos minutes » repart avec un non — alors que
 * le même travail existe, gratuit, fait à la main, deux écrans plus loin.
 * C'est la doctrine « si Alpha ne le fait pas pour toi, tu le fais à la main,
 * et l'outil t'y aide », appliquée à la porte même.
 *
 * ⚠ Chaque `href` est vérifié GRATUIT par un test : une alternative qui
 * mènerait à une autre porte fermée serait un deuxième refus, déguisé en
 * solution.
 * ⚠ Chaque phrase dit ce qui RESTE à la main. « Fais pareil gratuitement »
 * serait faux : ce qui se paie, c'est précisément que la machine le fasse.
 * ─────────────────────────────────────────────────────────────────────
 */
export const ALTERNATIVE_GRATUITE: Record<string, { texte: string; href: string; lien: string }> = {
  campagnes: {
    texte:
      "Écris tes messages ici — modèles, aperçu, file LinkedIn — et envoie-les depuis ta propre boîte. Ce qui se paie, c'est que l'envoi parte de notre serveur, en séquence, sans toi.",
    href: "/templates",
    lien: "Écrire mes messages",
  },
  "alpha-voice": {
    texte:
      "La liste d'appels du matin est gratuite : c'est toi qui composes, depuis ton téléphone, avec le script et les objections sous les yeux. Ce qui se paie, c'est le robot qui compose à ta place.",
    href: "/appels",
    lien: "Ouvrir ma liste d'appels",
  },
  "agent-alpha": {
    texte:
      "Le Cerveau répond à tes objections sans IA payante : il cherche dans ta propre doctrine, dans ton navigateur. Ce qui se paie, c'est l'agent qui rédige et décide à ta place.",
    href: "/cerveau",
    lien: "Ouvrir le Cerveau",
  },
  audits: {
    texte:
      "Ouvre son site toi-même et note sur sa fiche ce que tu y vois : c'est exactement ce que l'audit automatise. Ce qui se paie, c'est que notre serveur aille le lire et le rédige pour toi.",
    href: "/pipeline",
    lien: "Ouvrir mon pipeline",
  },
  tracking: {
    texte:
      "Sans traçage, la réponse reste le meilleur signal : consigne-la sur la fiche, et le fil d'activité — gratuit — te montre tout ce qui bouge. Ce qui se paie, c'est de savoir qui a ouvert sans avoir répondu.",
    href: "/activity",
    lien: "Ouvrir le fil d'activité",
  },
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'UNE CLÉ À LUI OUVRE — sans rien nous payer.
 *
 * ⚠⚠ L'ÉCRAN AFFIRMAIT L'INVERSE : « il n'existe pas, aujourd'hui, de moyen
 * de faire passer ces appels par TES identifiants ». Vrai le jour où la
 * phrase a été écrite, faux depuis le BYOK (`lib/capacites-cle.ts`) : une
 * clé IA ouvre l'agent, une boîte SMTP ouvre les campagnes. On disait non à
 * quelqu'un qui pouvait entrer gratuitement — sur la page même qui existe
 * pour lui dire comment entrer.
 *
 * ⚠ RIEN N'EST ÉCRIT À LA MAIN : la réponse vient de `cheminOuvertParCle`,
 * la fonction que le MIDDLEWARE appelle pour accorder l'accès. Deux
 * définitions de « sa clé ouvre-t-elle ce chemin ? » finiraient par
 * diverger, et c'est l'écran qui promettrait une porte que le serveur
 * refuse.
 * ⚠ `Record<Capacite, …>` : une capacité ajoutée demain ne compile pas tant
 * qu'on n'a pas dit où se branche sa clé.
 * ─────────────────────────────────────────────────────────────────────
 */
const REGLAGE_DE_LA_CLE: Record<Capacite, { href: string; libelle: string }> = {
  ia: { href: "/settings#cle-ia", libelle: "ta propre clé IA" },
  email: { href: "/settings#boite-envoi", libelle: "ta propre boîte d'envoi" },
};

export interface PorteParCle {
  capacite: Capacite;
  /** Ce qu'il branche, en mots. */
  libelle: string;
  /** Où il la branche. */
  href: string;
  /** Les écrans de la brique que cette clé ouvre — jamais vide. */
  chemins: string[];
}

export function clesQuiOuvrent(brique: string): PorteParCle[] {
  const chemins = Object.entries(ACCES_PAR_CHEMIN)
    .filter(([, briques]) => briques.includes(brique as BrickId))
    .map(([chemin]) => chemin);
  return CAPACITES_CLE.flatMap((capacite) => {
    const ouverts = chemins.filter((c) => cheminOuvertParCle(c, [capacite]));
    return ouverts.length ? [{ capacite, ...REGLAGE_DE_LA_CLE[capacite], chemins: ouverts }] : [];
  });
}

/**
 * L'offre qui ouvre une brique — la MOINS CHÈRE qui la contient.
 *
 * ⚠ On la CALCULE, on ne l'écrit pas. Une correspondance brique → offre
 * tenue à la main devient fausse au premier changement de grille, et elle
 * devient fausse en silence : le bouton mènerait vers une offre qui n'ouvre
 * plus ce qu'on vient de promettre.
 */
export function offrePourBrique(brique: string): OffrePublique | null {
  const candidates = OFFRES.filter((o) => o.capacites.includes(brique) && o.prixHT !== null);
  if (!candidates.length) return OFFRES.find((o) => o.capacites.includes(brique)) ?? null;
  return candidates.reduce((a, b) => ((a.prixHT ?? 0) <= (b.prixHT ?? 0) ? a : b));
}

/**
 * L'état d'un chemin pour un compte donné.
 *
 * `possedees` vient de `/api/compte/droits`. `maitre` court-circuite tout :
 * c'est nous, on voit tout.
 *
 * ⚠ CE MODULE NE SÉCURISE RIEN, et il faut le redire ici parce que c'est la
 * pente naturelle. Il décide de ce qui est GRIS. Le middleware décide de ce
 * qui est REFUSÉ, et lui seul. Quelqu'un qui trafique sa réponse
 * `/api/compte/droits` dégrise un lien qui rend 403 deux clics plus loin.
 */
/**
 * ── SANS COMPTE, LA RAISON N'EST PAS L'ARGENT ──
 *
 * ⚠ MÊME DÉFAUT QUE `MonOffre`, ET IL S'EST VU EN PRODUCTION. Un visiteur
 * sans session reçoit `DROIT_REFUSE` : zéro brique. Les verrous se
 * calculaient donc à partir de zéro brique et annonçaient « cette brique
 * consomme des minutes de téléphonie » — une explication vraie sur le fond,
 * et hors sujet pour quelqu'un dont le problème est qu'il n'est pas inscrit.
 *
 * On lui demande de payer avant de lui avoir donné ce qui est gratuit.
 */
/**
 * ⚠⚠ CETTE PHRASE ÉNUMÉRAIT QUATRE BRIQUES À LA MAIN, ET ELLE A MENTI LE JOUR
 * OÙ LE SOCLE EN A GAGNÉ UNE CINQUIÈME (12/09/2026).
 *
 * Trouvé en vérifiant que `/overlay` s'ouvre bien au gratuit : il s'ouvre, et
 * la phrase servie au visiteur SANS compte ne citait pas le copilote. Elle
 * disait donc, sur la porte même du copilote, que ce qui s'ouvre
 * immédiatement est autre chose. Rien ne tombait — une chaîne littérale n'a
 * aucun lien avec la liste qu'elle prétend décrire.
 *
 * Elle se DÉRIVE maintenant de `BRIQUES_GRATUITES`, l'ordre inclus. Les
 * libellés viennent de `SOCLE_GRATUIT`, écrits avec leur article parce qu'ils
 * servent déjà à faire des phrases sur la vitrine ; une brique gratuite sans
 * libellé retomberait sur son identifiant — visible, plutôt qu'absente.
 */
const enumereEnFrancais = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;

const libelleGratuit = (brique: string, premier: boolean): string => {
  const label = SOCLE_GRATUIT.find((s) => s.id === brique)?.label ?? brique;
  // « Le CRM » en tête de phrase, « le CRM » au milieu. On ne touche QUE la
  // première lettre : « Le CRM » ne doit pas devenir « le crm ».
  return premier ? label : label.charAt(0).toLowerCase() + label.slice(1);
};

export const RAISON_SANS_COMPTE =
  "Il faut d'abord créer ton compte — c'est gratuit et sans limite de durée. " +
  `${enumereEnFrancais(BRIQUES_GRATUITES.map((b, i) => libelleGratuit(b, i === 0)))} s'ouvrent immédiatement.`;

export function etatChemin(
  chemin: string,
  possedees: readonly string[],
  maitre: boolean,
  solo: boolean,
  /**
   * Un compte est-il connecté ? Par défaut `true` — l'appelant qui ne le sait
   * pas se comporte comme avant. Un défaut à `false` ferait annoncer
   * « inscris-toi » à des comptes parfaitement connectés dont l'appelant n'a
   * simplement pas transmis l'information.
   */
  session = true
): EtatVerrou {
  if (maitre || solo) return { type: "ouvert" };

  const requises = briquesPourChemin(chemin);
  // Chemin commun (`null`) : toujours ouvert.
  if (requises === null) return { type: "ouvert" };
  /**
   * `undefined` = chemin non classé, `[]` = réservé au maître. Les deux se
   * masquent, et pour la même raison : ils ne correspondent à rien qu'on
   * puisse vendre. Un chemin non classé est probablement un oubli — le
   * montrer grisé promettrait une fonctionnalité qui n'existe pas.
   */
  if (requises === undefined || requises.length === 0) return { type: "masque" };

  if (requises.some((b) => possedees.includes(b))) return { type: "ouvert" };

  /**
   * Plusieurs briques possibles : on explique celle qu'on va lui vendre,
   * c'est-à-dire la première qui a une offre. Lui citer une brique sans
   * porte d'achat serait un cul-de-sac de plus.
   */
  const brique = requises.find((b) => offrePourBrique(b)) ?? requises[0];
  const offre = offrePourBrique(brique);
  return {
    type: "verrouille",
    brique,
    // Sans compte, on n'explique pas un prix : on explique qu'il manque une
    // inscription. Et on ne propose aucune offre — la marche suivante est
    // gratuite.
    pourquoi: session
      ? (POURQUOI_PAYANT[brique] ?? "Cette brique consomme des ressources facturées à l'usage.")
      : RAISON_SANS_COMPTE,
    offreId: session ? (offre?.id ?? null) : null,
  };
}

/**
 * Toutes les briques payantes, avec leur raison — pour l'écran qui les
 * présente d'un bloc.
 *
 * ⚠ DÉRIVÉE, jamais recopiée : « payant » = « pas dans `BRIQUES_GRATUITES` ».
 * Une seconde liste divergerait, et la divergence se lirait comme une
 * promesse : une brique annoncée gratuite qui refuse à l'usage.
 */
export function briquesPayantes(): { brique: string; pourquoi: string; offreId: string | null }[] {
  const payantes = Object.keys(POURQUOI_PAYANT).filter((b) => !BRIQUES_GRATUITES.includes(b as BrickId));
  return payantes.map((brique) => ({
    brique,
    pourquoi: POURQUOI_PAYANT[brique],
    offreId: offrePourBrique(brique)?.id ?? null,
  }));
}
