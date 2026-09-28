import { ALPHA_VOICE_PALIERS, ALPHA_VOICE_SETUP_HT } from "./offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE FICHE CHIFFRÉE SUR UNE GRILLE QUI N'EXISTE PLUS.
 *
 * ══ CE QUI A ÉTÉ MESURÉ LE 17/09/2026 ══
 *
 * Les trois fiches au stade `offre` du pipeline réel portent
 * `setupValue = 990` et des mensuels à `115`, `115`, `319`.
 *
 * Ces montants ne sont pas approximatifs : ce sont EXACTEMENT ceux de la
 * grille remplacée le 02/09, puis réajustée le 12/09. Le setup est passé à
 * 1 490 € et les cinq paliers à deux. **Les trois offres encore sur la table
 * sont donc chiffrées sur un barème mort depuis quinze jours.**
 *
 * ⚠ Personne ne l'avait vu, et c'est le défaut de signature du dépôt : une
 * DÉCISION prise dans la doctrine qui n'atteint jamais la DONNÉE. Le Cerveau
 * avait déjà payé ça (`sc-voix-tarifs` annonçait l'ancien setup dix jours
 * après le changement). Ici c'est pire : le Cerveau alimente un prompt, une
 * fiche alimente un DEVIS.
 *
 * ══ ON SIGNALE, ON NE CORRIGE PAS — et c'est l'inverse du cadrage ══
 *
 * Le verrou du cadrage BLOQUE un document. Ici, non :
 *
 * · un prix a pu être ANNONCÉ au prospect. Le réécrire en douce, c'est
 *   renégocier sans le dire — la faute que le cadrage existe justement pour
 *   éviter à la livraison ;
 * · « aucun poids ne s'auto-corrige » s'applique : l'humain re-chiffre, et
 *   sa décision se voit.
 *
 * Ce qu'on doit à l'opérateur, c'est qu'il ne l'apprenne pas en signant.
 *
 * ══ ⚠⚠ UN MONTANT QUI COÏNCIDE N'EST PAS UNE PREUVE ══
 *
 * Quelqu'un peut négocier 115 €/mois aujourd'hui, en connaissance de cause.
 * Rendre « périmé » sur le seul montant fabriquerait des faux positifs — et un
 * garde qui crie sur une fiche juste est un garde qu'on désarme.
 *
 * D'où deux niveaux de certitude, et c'est la DATE qui les sépare :
 * · `datee` — la fiche n'a plus bougé depuis le remplacement. Le montant vient
 *   de l'ancienne grille, ce n'est pas une coïncidence.
 * · `coincidence` — la fiche a vécu depuis. Le montant peut être un choix.
 *   On le dit, on ne l'affirme pas.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Une grille de prix qui a été remplacée, et ce qui l'a remplacée. */
export interface GrillePerimee {
  id: string;
  /** Le jour où la décision a été prise. Les fiches plus anciennes sont datées. */
  remplaceeLe: string;
  /** Pourquoi elle est morte — jamais « obsolète » tout court. */
  motif: string;
  /** Les setups de l'ancienne grille. */
  setupsHT: number[];
  /** Les mensuels de l'ancienne grille. */
  mensuelsHT: number[];
}

/**
 * ⚠ LES MONTANTS PÉRIMÉS SE RECOPIENT ICI, ET C'EST LE SEUL ENDROIT OÙ C'EST
 * LÉGITIME : ils n'existent plus nulle part ailleurs, justement. Les montants
 * EN VIGUEUR, eux, sont IMPORTÉS — deux sources pour le prix courant, et c'est
 * celle qu'on ne relit pas qui mentirait.
 */
export const GRILLES_PERIMEES: GrillePerimee[] = [
  {
    id: "grille-02-09",
    remplaceeLe: "2026-09-02",
    motif:
      "Cinq paliers font comparer les paliers entre eux au lieu de comparer à ce que le prospect perd. " +
      "Et le palier d'entrée ne couvrait pas le socle fixe : c'était une perte déguisée en offre d'appel.",
    setupsHT: [990],
    mensuelsHT: [59, 115, 169, 219, 319],
  },
];

/**
 * ══════════════════════════════════════════════════════════════════════
 * LA DÉCISION DU 17/09/2026 — déléguée par Zakaria, prise ici.
 *
 * **On HONORE le prix annoncé sur les dossiers ouverts avant le changement.
 * Tout ce qui est neuf part au tarif en vigueur. Sans exception.**
 *
 * ══ POURQUOI HONORER, ET NON RE-CHIFFRER ══
 *
 * · **Le prix a été ANNONCÉ.** Le remonter deux mois après, sur un dossier
 *   qu'on n'a pas relancé entre-temps, c'est exactement ce que le cadrage
 *   existe pour empêcher : un montant qui bouge après coup. Le client a
 *   raison de le reprocher, et il le reprochera au moment du closing.
 * · **La hausse a été décidée pour un AUTRE acheteur.** Le passage de 990 à
 *   1 490 € vient du changement d'ICP du 09/09 : le maître d'ouvrage compare à
 *   une agence d'automatisation (1 840–11 040 €), pas au télésecrétariat. Ces
 *   trois dossiers datent de l'ICP d'AVANT. Leur appliquer un ancrage qui ne
 *   les concerne pas n'est pas défendable en conversation.
 * · **À zéro vente, la première signature ne vaut pas sa marge.** Elle vaut ce
 *   qu'elle débloque : un coût d'installation MESURÉ au lieu d'estimé, une
 *   livraison réelle, et `gagnes > 0` — le seuil qui lève tout un pan de ce que
 *   les gardes interdisent aujourd'hui de dire. 1 500 € d'écart ne pèsent rien
 *   contre ça.
 * · **Le mensuel annoncé le plus bas (115 €) couvre le socle fixe (~57 €/mois).**
 *   C'est 59 € qui ne le couvrait pas — le motif de la refonte ne vise pas ces
 *   dossiers.
 *
 * ══ ⚠⚠ ET POURQUOI IL Y A UNE DATE LIMITE ══
 *
 * Un prix honoré sans échéance devient une **seconde grille** : deux tarifs en
 * vigueur, celui qu'on affiche et celui qu'on pratique. C'est le défaut que ce
 * dépôt traque partout ailleurs. La faveur est donc bornée, et la borne est ce
 * qui la rend crédible en conversation — « votre tarif tient jusqu'au X » est
 * une raison de rappeler ; « on vous fait un prix » est une remise.
 *
 * ⚠ C'est aussi la RAISON NEUVE qu'exige la cadence de relance : ces fiches
 * dorment depuis juillet, et « je me permets de relancer » est interdit. Le
 * changement de tarif est un fait daté, vrai, et qui n'appartient pas au
 * prospect — exactement ce qu'il faut pour rouvrir sans mendier.
 * ══════════════════════════════════════════════════════════════════════
 */
export const PRIX_HONORE_JUSQU_AU = "2026-10-17";

export type Certitude =
  /** La fiche n'a pas bougé depuis le remplacement : le montant vient de l'ancienne grille. */
  | "datee"
  /** La fiche a vécu depuis. Le montant COÏNCIDE, il n'est pas forcément faux. */
  | "coincidence";

export interface PrixPerime {
  grille: GrillePerimee;
  certitude: Certitude;
  /** Ce qui a été reconnu, en clair : « setup 990 € », « mensuel 115 € ». */
  reconnus: string[];
  /** Ce que la grille EN VIGUEUR dit aujourd'hui, pour la même chose. */
  enVigueur: string[];
}

/** Les mensuels servis aujourd'hui, DÉRIVÉS — jamais recopiés. */
function mensuelsActuels(): number[] {
  return ALPHA_VOICE_PALIERS.map((p) => p.prixHT).sort((a, b) => a - b);
}

/**
 * Cette fiche est-elle chiffrée sur une grille morte ?
 *
 * `derniereTouche` est la date du dernier événement de la fiche (ISO), ou
 * `null` si elle n'a jamais bougé. C'est elle qui décide de la certitude —
 * l'horloge n'est jamais lue ici, pour la même raison que `creneauPasse` :
 * un test qui dépend de « aujourd'hui » devient vert tout seul.
 */
export function prixPerime(
  fiche: { monthlyValue: number; setupValue: number },
  derniereTouche: string | null,
): PrixPerime | null {
  for (const grille of GRILLES_PERIMEES) {
    const reconnus: string[] = [];
    const enVigueur: string[] = [];

    if (grille.setupsHT.includes(fiche.setupValue)) {
      reconnus.push(`setup ${fiche.setupValue} €`);
      enVigueur.push(`setup ${ALPHA_VOICE_SETUP_HT} €`);
    }
    if (grille.mensuelsHT.includes(fiche.monthlyValue)) {
      reconnus.push(`mensuel ${fiche.monthlyValue} €`);
      enVigueur.push(`paliers ${mensuelsActuels().join(" / ")} €`);
    }
    if (!reconnus.length) continue;

    /**
     * ⚠ Une fiche SANS aucune touche est `datee` : elle n'a rien pu apprendre
     * de la décision. L'inconnu penche du côté qui ALERTE, parce qu'ici
     * alerter ne coûte qu'une lecture — l'inverse du cadrage, où l'inconnu
     * bloque un document.
     */
    const t = derniereTouche ? Date.parse(derniereTouche) : NaN;
    const bougeDepuis = !Number.isNaN(t) && t > Date.parse(grille.remplaceeLe);

    return { grille, certitude: bougeDepuis ? "coincidence" : "datee", reconnus, enVigueur };
  }
  return null;
}

/**
 * La phrase servie à l'opérateur. Elle nomme la DATE et la grille en vigueur :
 * « prix obsolète » sans les deux envoie chercher dans un fichier de prix.
 *
 * ⚠ Elle ne dit jamais « corrige » sur une `coincidence` : sur une fiche qui a
 * vécu depuis la décision, le montant peut être un choix assumé, et donner un
 * ordre là-dessus ferait renégocier un prix déjà annoncé.
 */
export function phrasePrixPerime(p: PrixPerime, maintenant: number): string {
  const quoi = p.reconnus.join(" et ");
  const jour = new Date(p.grille.remplaceeLe).toLocaleDateString("fr-FR");
  const limite = new Date(PRIX_HONORE_JUSQU_AU).toLocaleDateString("fr-FR");

  if (p.certitude !== "datee") {
    return (
      `${quoi} : c'est exactement la grille remplacée le ${jour}. La fiche a vécu depuis, donc c'est ` +
      `peut-être un choix — à vérifier. En vigueur : ${p.enVigueur.join(", ")}.`
    );
  }

  /**
   * ⚠ L'ÉCHÉANCE PASSÉE NE DIT PAS LA MÊME CHOSE, et c'est tout l'intérêt
   * d'avoir posé une date : sans elle, la phrase d'avant (« honoré ») se
   * serait servie indéfiniment et la faveur serait devenue la grille.
   */
  return Date.parse(PRIX_HONORE_JUSQU_AU) >= maintenant
    ? `${quoi} : la grille a été remplacée le ${jour}, mais ce prix a été ANNONCÉ avant — on l'honore ` +
        `jusqu'au ${limite}. C'est ta raison de rappeler, et elle est vraie. En vigueur ensuite : ` +
        `${p.enVigueur.join(", ")}.`
    : `${quoi} : grille remplacée le ${jour}, et le délai d'honneur a expiré le ${limite}. ` +
        `À re-chiffrer avant d'envoyer quoi que ce soit — en vigueur : ${p.enVigueur.join(", ")}.`;
}
