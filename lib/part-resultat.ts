import { REV_SHARE } from "./pricing";
import type { EventKind, Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTRE PART SUR CE QU'ALPHA FAIT GAGNER — et pourquoi elle se calcule sur
 * le CA, jamais sur le bénéfice.
 *
 * ══ LE MODÈLE, EN UNE PHRASE ══
 *
 * Le produit est gratuit jusqu'au moment où il dépense chez nous. Quelqu'un
 * qui n'a rien peut donc prospecter pour de vrai, décrocher des rendez-vous
 * et encaisser. Ce qu'on demande ensuite n'est pas un abonnement à l'aveugle :
 * c'est une part de ce qu'on lui a fait gagner. On ne gagne que s'il gagne.
 *
 * ══ ⚠⚠ LE PIÈGE À DIRE AVANT DE SIGNER QUOI QUE CE SOIT ══
 *
 * « Prendre 10 à 30 % des BÉNÉFICES » et « prendre 10 à 30 % du CA GÉNÉRÉ »
 * sonnent pareil et ne sont pas du tout la même clause.
 *
 *  · Le CA généré, NOUS le voyons : c'est le montant que le client a inscrit
 *    sur une affaire signée dans son propre CRM, sur une fiche dont la
 *    chronologie porte nos touches. C'est datable, opposable, et ça se
 *    facture le mois suivant.
 *
 *  · Le bénéfice, nous ne le voyons PAS. Il dépend de ses coûts, de ses
 *    salaires, de ses amortissements et de ses choix comptables — que nous ne
 *    pouvons ni lire ni auditer. Dans une clause au bénéfice, **celui qui
 *    paie contrôle le dénominateur** : chaque euro de charge qu'il impute à
 *    l'affaire réduit notre facture, légalement, sans qu'on ait un mot à
 *    dire. Une part au bénéfice se discute à chaque facture ; une part au CA
 *    se constate.
 *
 * Donc : **on facture sur le CA, et on CHOISIT un pourcentage plus bas.**
 * 20 % du CA d'une affaire à 50 k€ font 10 000 € encaissables ; 30 % d'un
 * bénéfice que l'autre calcule peuvent faire zéro, et faire zéro sans que
 * personne ait menti. Un pourcentage plus petit sur une base qu'on mesure
 * vaut mieux qu'un grand pourcentage sur une base qu'on subit.
 *
 * ⚠ Si un client EXIGE une base au bénéfice — ça arrive, et c'est parfois
 * légitime sur des marges très faibles — ça ne se calcule pas ici. Ça se
 * tranche au cadrage, et ça se convertit en un pourcentage FIXE du CA
 * équivalent, écrit dans le devis. Ce module refuse de rendre un chiffre sur
 * une base qu'il ne sait pas mesurer : c'est `BASE_REFUSEE`.
 *
 * ══ CE QUE CE MODULE NE RÉGLERA JAMAIS ══
 *
 * ⚠⚠ LA SOUS-DÉCLARATION. Tout repose sur un montant que le CLIENT saisit.
 * S'il n'inscrit rien, on ne voit rien ; s'il inscrit moins, on facture
 * moins. Aucun code ne corrige ça — c'est une clause de contrat (droit de
 * regard sur les factures de l'affaire) ou un forfait. L'écrire ici évite de
 * croire qu'un calcul juste suffit à se faire payer.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Ce qu'Alpha a RÉELLEMENT fait sur une affaire. C'est ce qui décide le
 * pourcentage — pas une négociation au cas par cas.
 *
 * ⚠ POURQUOI DÉRIVER LE TAUX DU TRAVAIL FAIT. Un taux unique force à
 * défendre le même prix sur une affaire qu'on a portée de bout en bout et
 * sur une autre où on a juste fourni un nom. La première se défend, la
 * seconde se perd — et c'est celle-là qui fait dire « votre pourcentage est
 * abusif », sur toutes les autres en même temps.
 */
export type NiveauPart =
  /** L'affaire a VÉCU dans Alpha avant d'être signée : au moins une touche. */
  | "suivi"
  /** Un contact SORTANT y est consigné : appel, email, LinkedIn, visite. */
  | "approche"
  /** Un rendez-vous ou une démo a eu lieu avant la signature. */
  | "rendez-vous";

/**
 * ⚠⚠ CE QU'ON MESURE EST « L'AFFAIRE A ÉTÉ TRAVAILLÉE DANS ALPHA », PAS
 * « ALPHA A FAIT LE TRAVAIL ». La nuance décide de ce qu'on a le droit de
 * facturer, et elle a failli être écrasée.
 *
 * La première rédaction de ce module avait un échelon « Alpha a SOURCÉ la
 * fiche », et `tsc` l'a fait tomber : il n'existe aucun événement de
 * chronologie qui l'atteste. `EventKind` vaut appel · visite · email ·
 * whatsapp · linkedin · demo · meeting · note · stage · offre — et rien n'y
 * distingue une fiche qu'Alpha a apportée d'une fiche tapée à la main après
 * un salon. L'échelon était une INVENTION, et il aurait été le plus fréquent
 * des trois : toute affaire l'aurait déclenché.
 *
 * On mesure donc ce qui existe. Une touche consignée ne prouve pas qu'Alpha
 * l'a passée — c'est l'opérateur qui l'écrit — mais elle prouve que l'affaire
 * a été conduite ici, avec ses relances et ses prochaines actions. C'est
 * exactement ce qu'une clause peut dire : « les affaires suivies dans Alpha ».
 * Prétendre mesurer l'attribution réelle serait un mensonge que le premier
 * client démonterait en trois questions.
 */

export interface PalierPart {
  niveau: NiveauPart;
  /** Part d'EAGLEYE sur le CA de l'affaire, en %. */
  pct: number;
  /** Ce qu'Alpha a fait — la justification qu'on prononce. */
  ceQuAlphaAFait: string;
  /** Ce qui reste au client — dit aussi, sinon la part paraît arbitraire. */
  ceQuIlAFait: string;
}

/**
 * ⚠ LE HAUT DE L'ÉCHELLE EST `REV_SHARE`, IMPORTÉ, PAS RECOPIÉ.
 *
 * `lib/pricing.ts` porte déjà « 30 % du CA généré » et la vitrine l'affiche.
 * Réécrire 30 ici créerait une deuxième définition de notre part : le jour où
 * l'une bouge, l'écran et le devis annonceraient deux prix, et c'est le
 * client qui le remarquerait.
 */
export const PALIERS_PART: PalierPart[] = [
  {
    niveau: "suivi",
    pct: 10,
    ceQuAlphaAFait: "L'affaire a été conduite dans Alpha : pipeline, relances, prochaine action datée.",
    ceQuIlAFait: "Il a cherché, contacté, décroché et signé — Alpha a tenu le fil.",
  },
  {
    niveau: "approche",
    pct: 20,
    ceQuAlphaAFait: "Le premier contact est consigné ici : appel, email, message LinkedIn ou visite.",
    ceQuIlAFait: "Il a mené la conversation, décroché le rendez-vous et signé.",
  },
  {
    niveau: "rendez-vous",
    pct: REV_SHARE * 100,
    ceQuAlphaAFait: "Approche, relances, et un rendez-vous au calendrier avant la signature.",
    ceQuIlAFait: "Il s'est présenté, il a rassuré, il a signé — ce qu'Alpha ne fait pas.",
  },
];

/** Rien à facturer : la base demandée n'est pas mesurable chez nous. */
export const BASE_REFUSEE =
  "Une part sur le BÉNÉFICE ne se calcule pas ici : nous ne voyons ni les coûts, ni les " +
  "salaires, ni les amortissements de l'affaire, et celui qui paie contrôlerait le " +
  "dénominateur. Ça se tranche au cadrage et ça s'écrit dans le devis comme un pourcentage " +
  "FIXE du CA. Ce module ne rend pas de chiffre sur une base qu'il ne mesure pas.";

/**
 * Ce qu'Alpha a fait sur cette affaire, lu dans sa chronologie.
 *
 * ⚠⚠ L'ATTRIBUTION SE JOUE AVANT LA SIGNATURE, ET C'EST TOUT LE SUJET.
 * Une touche consignée APRÈS la signature ne prouve rien — c'est du suivi de
 * client, pas de la conquête. Sans cette borne, toute fiche finirait au
 * palier haut : il suffit d'ouvrir l'app une fois le contrat signé.
 *
 * Rend `null` quand rien n'atteste d'un travail d'Alpha avant la signature.
 * `null` n'est PAS zéro : c'est « cette affaire ne nous revient pas », et ça
 * doit se dire au lieu de se facturer à 10 % par défaut.
 */
/** Un contact SORTANT — quelque chose est parti vers le prospect. */
const SORTANTS: EventKind[] = ["appel", "email", "linkedin", "whatsapp", "visite"];
/** Une rencontre — le prospect a donné de son temps. */
const RENCONTRES: EventKind[] = ["meeting", "demo"];

export function niveauAtteint(p: Prospect): NiveauPart | null {
  /**
   * ⚠ LA DATE DE SIGNATURE SE LIT SUR LE DERNIER CHANGEMENT DE STADE.
   * Il n'existe pas d'événement « signé » : le passage au stade `signe` pose
   * un `kind: "stage"`, et le dernier d'entre eux est donc celui-là sur une
   * fiche signée. Faute de mieux, et c'est dit plutôt que tu — une fiche dont
   * personne n'a consigné les changements de stade n'est pas bornée, et tout
   * son historique compte. C'est le sens le plus généreux POUR LE CLIENT, et
   * c'est le bon défaut : on ne se facture pas soi-même un doute.
   */
  const stades = p.events.filter((e) => e.kind === "stage").map((e) => e.date).sort();
  const signature = stades[stades.length - 1];
  const avant = signature ? p.events.filter((e) => e.date <= signature) : p.events;

  if (avant.some((e) => RENCONTRES.includes(e.kind))) return "rendez-vous";
  if (avant.some((e) => SORTANTS.includes(e.kind))) return "approche";
  /**
   * Le plancher : l'affaire a vécu ici. Une note, un changement de stade — la
   * preuve qu'elle a été conduite dans Alpha et pas seulement enregistrée
   * après coup. Une fiche SANS aucun événement n'est pas à nous : quelqu'un
   * l'a collée le jour où il a signé, et la facturer serait indéfendable.
   */
  if (avant.length > 0) return "suivi";
  return null;
}

export interface LigneFacturable {
  prospectId: string;
  company: string;
  niveau: NiveauPart;
  pct: number;
  /** Ce que le client a RÉELLEMENT encaissé sur cette affaire, en €. */
  encaisseEur: number;
  /** Ce qui nous revient, en €. */
  partEur: number;
}

export interface EtatPart {
  /** Les affaires signées et attribuables. */
  lignes: LigneFacturable[];
  /**
   * Le total facturable. `null` quand rien n'est mesurable — jamais `0`.
   *
   * ⚠ La règle du dépôt : zéro donnée → zéro chiffre. Un « 0 € » se lit
   * comme un résultat (« Alpha n'a rien rapporté »), alors que la vérité est
   * « personne n'a encore signé » ou « les montants ne sont pas saisis ».
   */
  totalEur: number | null;
  /** Signées, attribuables, mais RIEN d'encaissé : invisibles à la facture. */
  sansMontant: number;
  /** Signées mais qu'aucune touche d'Alpha ne précède : elles ne sont pas à nous. */
  nonAttribuables: number;
  /** Ce qui manque pour que le chiffre veuille dire quelque chose. */
  reserve: string;
}

/**
 * L'état de ce qui nous revient, sur un portefeuille.
 *
 * ⚠ NE FACTURE QUE DES AFFAIRES `signe`. Une affaire en négociation a une
 * valeur pondérée — utile pour prévoir, jamais pour facturer. Confondre les
 * deux, c'est envoyer une facture sur un deal qui n'existe pas encore, et
 * c'est la façon la plus rapide de perdre le client ET l'affaire.
 */
export function etatPart(prospects: Prospect[]): EtatPart {
  const signees = prospects.filter((p) => p.stage === "signe");

  const lignes: LigneFacturable[] = [];
  let sansMontant = 0;
  let nonAttribuables = 0;

  for (const p of signees) {
    const niveau = niveauAtteint(p);
    if (!niveau) {
      nonAttribuables++;
      continue;
    }
    /**
     * ⚠⚠ ON FACTURE SUR L'ARGENT REÇU, PAS SUR UNE PROJECTION — ET CETTE
     * CORRECTION VIENT DU RENDU, PAS D'UNE RELECTURE.
     *
     * La première version prenait `monthlyValue`. En regardant l'écran réel,
     * la fiche de démonstration affichait « 30 % de 349 € = 105 € ». 349 €
     * est un MENSUEL — la valeur récurrente de l'affaire, pas son chiffre
     * d'affaires. On facturait donc 30 % d'UN MOIS en l'appelant « le CA de
     * l'affaire » : faux dans un sens (on se sous-facture massivement sur une
     * affaire qui dure) et faux dans l'autre (on afficherait un pourcentage
     * d'annuel sur un nombre mensuel).
     *
     * `payments[]` porte l'argent RÉELLEMENT reçu, et c'est déjà la base de
     * `buildPayoutLedger` — donc pas une deuxième définition d'« encaissé ».
     * Trois raisons de préférer ça à n'importe quelle projection :
     *  · c'est constaté, pas estimé ;
     *  · on ne facture jamais avant que le client ait été payé, ce qui retire
     *    l'objection la plus légitime qui soit ;
     *  · le setup et le récurrent entrent naturellement — un paiement est un
     *    paiement, on n'a pas à trancher lequel « compte ».
     *
     * ⚠ Seuls les paiements au statut `paye`. « En attente » et « retard »
     * sont des promesses : les facturer reviendrait à prélever une part sur
     * de l'argent que le client n'a pas.
     */
    const encaisse = (p.payments ?? [])
      .filter((pay) => pay.status === "paye")
      .reduce((somme, pay) => somme + pay.amount, 0);
    if (!(encaisse > 0)) {
      sansMontant++;
      continue;
    }
    const pct = PALIERS_PART.find((x) => x.niveau === niveau)!.pct;
    lignes.push({
      prospectId: p.id,
      company: p.company,
      niveau,
      pct,
      encaisseEur: encaisse,
      partEur: Math.round(encaisse * (pct / 100)),
    });
  }

  const reserves: string[] = [];
  if (sansMontant > 0) {
    reserves.push(
      `${sansMontant} affaire${sansMontant > 1 ? "s" : ""} signée${sansMontant > 1 ? "s" : ""} sans aucun paiement encaissé : ` +
        `elle${sansMontant > 1 ? "s" : ""} ne peu${sansMontant > 1 ? "vent" : "t"} pas être facturée${sansMontant > 1 ? "s" : ""}. ` +
        "C'est voulu — on ne prélève rien tant que le client n'a pas été payé — et c'est aussi la " +
        "limite du modèle : on ne facture que ce qui est saisi ici."
    );
  }
  if (nonAttribuables > 0) {
    reserves.push(
      `${nonAttribuables} affaire${nonAttribuables > 1 ? "s" : ""} signée${nonAttribuables > 1 ? "s" : ""} qu'aucune touche ` +
        "d'Alpha ne précède : elles ne nous reviennent pas, et c'est normal."
    );
  }

  return {
    lignes,
    // Zéro ligne → `null`, jamais `0 €`.
    totalEur: lignes.length ? lignes.reduce((s, l) => s + l.partEur, 0) : null,
    sansMontant,
    nonAttribuables,
    reserve: reserves.join(" "),
  };
}
