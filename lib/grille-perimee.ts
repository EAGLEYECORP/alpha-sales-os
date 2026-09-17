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
export function phrasePrixPerime(p: PrixPerime): string {
  const quoi = p.reconnus.join(" et ");
  const jour = new Date(p.grille.remplaceeLe).toLocaleDateString("fr-FR");
  return p.certitude === "datee"
    ? `Cette fiche porte ${quoi} — la grille remplacée le ${jour}, et elle n'a plus bougé depuis. ` +
        `En vigueur : ${p.enVigueur.join(", ")}. À re-chiffrer avant d'envoyer quoi que ce soit.`
    : `${quoi} : c'est exactement la grille remplacée le ${jour}. La fiche a vécu depuis, donc c'est ` +
        `peut-être un choix — à vérifier. En vigueur : ${p.enVigueur.join(", ")}.`;
}
