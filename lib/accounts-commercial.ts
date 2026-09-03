import { DEFAULT_ACCOUNT_ID, getAccount } from "./accounts";
import type { ICP } from "./icp";
import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉCONOMIE DU PORTEFEUILLE — montants et coordonnées partenaires.
 *
 * ── POURQUOI CE FICHIER EXISTE SÉPARÉMENT ──
 *
 * `lib/accounts.ts` est importé par le store Zustand et par cinq composants
 * client. Or tout ce qu'un composant client importe est compilé dans un
 * fichier JavaScript que le navigateur télécharge — et `_next/static/**` est
 * explicitement exclu du middleware : ces fichiers sont récupérables par
 * n'importe qui, mot de passe ou pas. C'est la même mécanique qui avait rendu
 * publique la grille de `lib/bricks.ts` (voir `app/api/catalogue/route.ts`).
 *
 * Mesuré sur le build : l'email d'expédition et le panel de vente d'un
 * partenaire, `Christophe`, `setupHT: 10000` et la note « PUIS 100 % des services
 * de maintenance mensuels » étaient dans un chunk téléchargeable. Ce n'est pas
 * une grille de prix client, c'est mieux : c'est le contrat entre nous et nos
 * partenaires, en clair.
 *
 * ── LA FRONTIÈRE, ET POURQUOI ELLE EST LÀ ──
 *
 * Descend encore dans le navigateur (dans `lib/accounts.ts`) :
 *   · l'identité (nom, ville, ce qu'on vend, la proposition de valeur) ;
 *   · l'ICP et le routage (seuil 40 k) ;
 *   · le TAUX vitrine et l'ACTE de closing.
 *
 * Ne descend plus (ici) :
 *   · les MONTANTS (setup, objectif par projet) ;
 *   · le détail des règles de commission par offre et leurs notes, qui
 *     expliquent l'économie du partenariat ligne à ligne ;
 *   · les COORDONNÉES partenaires (email d'expédition, panel de vente, nom du
 *     CEO à impliquer).
 *
 * Le taux vitrine reste côté client volontairement : il irrigue l'escalier,
 * la fiche prospect et les payouts à chaque rendu, et chaque partenaire le
 * connaît déjà — c'est son propre contrat. Le sortir coûterait un aller-retour
 * serveur par rendu pour protéger une information que l'intéressé possède.
 * Les montants et les coordonnées, eux, n'ont aucune raison d'être là.
 *
 * ⚠ Ce module ne doit JAMAIS être importé par un composant client. C'est
 * vérifié par `tests/vitrine-fuite.test.ts` (graphe d'imports), parce qu'un
 * seul import distrait suffirait à tout remettre dans le navigateur.
 * Côté app, il passe par `/api/catalogue` (route INTERNE).
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Une OFFRE COMMERCIALE d'un compte, avec sa règle de commission propre.
 *
 * Le taux mesure CE QUI NOUS REVIENT sur le deal — pas ce que le client paie.
 * Il ne descend en dessous de 100 % que là où nous sommes INTERMÉDIAIRES :
 *   • EAGLEYE           → 100 % sur tout. C'est notre société : visibilité,
 *                         Alpha Sales OS (VIP ou à la carte), OS personnalisé,
 *                         digitalisation jusqu'à 40 k € HT. Rien à reverser.
 *                         Alpha Voice y est revenu : l'offre se vendait sous
 *                         la marque d'un revendeur, l'accord est mort.
 *   • Nuwacom           → 15 % au-delà de 40 000 € HT, PUIS 100 % de toute la
 *                         maintenance mensuelle.
 *
 * `minHT`/`maxHT` bornent l'ÉLIGIBILITÉ d'un projet à cette offre.
 */
export interface Offering {
  key: string;
  label: string;
  /** Prix setup / one-shot public (€ HT), si productisé. */
  setupHT?: number;
  /**
   * % qui nous revient sur le one-shot / setup — la RÉFÉRENCE, pas une loi.
   *
   * Voir `pctEstPlancher` : sur certaines offres ce chiffre est un MINIMUM
   * qu'on remonte selon le levier qu'on garde dans le deal. Le taux réellement
   * négocié d'une affaire vit sur la fiche du prospect (`Prospect.dealTerms`),
   * pas ici.
   */
  commissionPct: number;
  /** % prélevé sur le mensuel récurrent (abonnement), si applicable. */
  recurringPct?: number;
  /** Plancher d'éligibilité du projet (€ HT). */
  minHT?: number;
  /** Plafond d'éligibilité du projet (€ HT). */
  maxHT?: number;
  /**
   * `commissionPct` est-il un PLANCHER plutôt qu'un taux fixe ?
   *
   * Chaque affaire se structure différemment : ce qui fait bouger le taux,
   * c'est le levier qu'on garde. Donner la main sur la technique juste après
   * la vision, c'est le plancher ; construire les démos soi-même et rester le
   * point d'entrée technique, c'est plus. Écrire un chiffre fixe ici faisait
   * croire que le taux était acquis — donc le laissait sur la table.
   */
  pctEstPlancher?: boolean;
  /** Ce qui fait MONTER le taux au-dessus du plancher, concrètement. */
  leviers?: string[];
  note?: string;
}

/** Coordonnées à mobiliser pour signer — jamais dans un bundle navigateur. */
export interface ClosingDetails {
  /** Adresse d'expédition officielle pour ce compte. */
  fromEmail?: string;
  /** Outil à utiliser (panel de vente, espace devis…). */
  panelUrl?: string;
  /** Personne à impliquer (ex. le CEO côté Nuwacom). */
  contactName?: string;
  /** Fuseau de la personne à impliquer — évite de proposer un créneau absurde. */
  timezone?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'IDENTITÉ D'UN COMPTE PARTENAIRE — elle a déménagé ICI, et voici pourquoi.
 *
 * ⚠ MESURÉ SUR LE BUILD, PAS SUPPOSÉ. `lib/accounts.ts` descend dans le
 * navigateur (il est importé par le store et par cinq composants client).
 * L'entrée Nuwacom y portait : le nom, les deux domaines, ce qu'ils vendent,
 * leur proposition de valeur, les familles d'offres autorisées, l'acte de
 * closing — et un ICP COMPLET : acheteur cible, douleurs, déclencheurs,
 * canaux, disqualifiants, angle d'attaque.
 *
 * Autrement dit : tout notre playbook commercial sur ce partenaire, dans un
 * fichier `_next/static/**` que n'importe qui télécharge sans compte. Relevé
 * avant correction : « Nuwacom » dans 3 chunks, « nuwacom.fr » dans 1.
 *
 * Ce n'était pas grave tant que l'app était notre outil interne. Depuis que
 * l'inscription est LIBRE (cf. freemium, `lib/entitlements.ts`), ça l'est :
 * n'importe quel inconnu inscrit en trente secondes lisait le dossier.
 *
 * Ce module-ci est servi par `/api/catalogue`, qui ne rend le portefeuille
 * qu'au compte MAÎTRE. C'est le même trajet que les taux de commission, qui
 * avaient fait le déménagement avant lui — le raisonnement s'était arrêté à
 * l'argent et n'était pas allé jusqu'à l'identité.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface IdentiteCompte {
  name: string;
  city?: string;
  sites?: string[];
  whatYouSell: string;
  valueProp: string;
  /** Les familles d'offres que ce compte a le droit de porter. */
  offers: EagleyeOffer[];
  /** L'acte de closing propre au compte (le rituel à ne pas rater). */
  closingAction?: string;
  /** Le client parfait de CE compte — notre travail de ciblage, pas le sien. */
  icp?: Partial<ICP>;
}

/** Le volet commercial d'UN compte du portefeuille. */
export interface AccountCommercial {
  accountId: string;
  /**
   * Présente pour les comptes PARTENAIRES uniquement. Le compte maître
   * (EAGLEYE) garde la sienne côté client : c'est notre propre marque, elle
   * est déjà sur chaque écran et sur la vitrine publique — la cacher ne
   * protégerait rien et casserait l'app hors ligne.
   */
  identite?: IdentiteCompte;
  /** Les offres commerciales du compte + leurs règles de commission. */
  offerings: Offering[];
  /** Objectif minimal de valeur par projet (€), s'il existe. */
  targetPerProject?: number;
  closing?: ClosingDetails;
  /** Une ligne pour l'humain — d'où vient le compte, son statut, son économie. */
  note?: string;
}

export const ACCOUNTS_COMMERCIAL: AccountCommercial[] = [
  {
    accountId: "eagleye",
    // ⚠ TOUTES les offres EAGLEYE sont à 100 %. C'est notre société : le
    // chiffre d'affaires ne se partage avec personne. Voir `lib/accounts.ts`
    // pour la distinction avec les 30 % facturés au CLIENT sur son CA généré.
    offerings: [
      {
        key: "alpha-sales-os-vip",
        label: "Alpha Sales OS — VIP",
        setupHT: 10000,
        commissionPct: 100,
        recurringPct: 100,
        note: "Offre haute : 10 000 € VIP. Sinon setup sur devis + 30 % du CA généré (ce que le CLIENT paie).",
      },
      {
        key: "alpha-sales-os-carte",
        label: "Alpha Sales OS — à la carte (par brique)",
        commissionPct: 100,
        recurringPct: 100,
        note: "Le client ne prend que ses briques et ne voit que les siennes ; nous voyons tout.",
      },
      {
        key: "os-personnalise",
        label: "OS personnalisé (construit pour le client)",
        commissionPct: 100,
        recurringPct: 100,
        note: "Un OS taillé sur SON métier, pas une déclinaison du nôtre. Chiffré au cadrage.",
      },
      {
        key: "visibilite",
        label: "Visibilité / Growth (sites, présence)",
        commissionPct: 100,
        recurringPct: 100,
        note: "TOUT ce qui est visibilité est à EAGLEYE — faisable par nous.",
      },
      {
        key: "digitalisation",
        label: "Digitalisation / transformation < 40 k",
        commissionPct: 100,
        recurringPct: 100,
        maxHT: 40000,
        note: "Récupéré par EAGLEYE. Au-delà de 40 k → Nuwacom.",
      },
      {
        /**
         * ⚠ CETTE OFFRE ÉTAIT CELLE D'UN PARTENAIRE, ELLE EST DEVENUE LA NÔTRE.
         *
         * Elle se vendait sous la marque d'un revendeur, à 30 % + 10 % du
         * mensuel. L'accord est mort. Le BESOIN, lui, ne meurt pas : un
         * commerce qui ne décroche pas perd le client, et Alpha Voice fait
         * exactement ça — il est opérationnel (`voice/agent.py`, entrant
         * vérifié). On le vend donc nous-mêmes, à 100 %.
         *
         * ⚠ LE MONTANT N'EST PAS ENCORE LE NÔTRE. `setupHT` est laissé à
         * `undefined` volontairement : les 990 € et les paliers minutes
         * étaient la grille NÉGOCIÉE PAR EUX. La recopier sous notre nom
         * afficherait un prix que nous n'avons jamais fixé. Il se chiffre au
         * cadrage tant que Zakaria n'a pas tranché — et le coût de revient
         * mesuré est là pour l'étayer (`lib/voice-costs.ts`).
         */
        key: "alpha-voice",
        label: "Alpha Voice — l'accueil & la relance au téléphone",
        commissionPct: 100,
        recurringPct: 100,
        note: "Notre agent vocal. À chiffrer au cadrage — la grille de l'ancien partenaire ne nous engage pas.",
      },
    ],
    closing: { fromEmail: "contact@eagleyecorp.fr" },
    note:
      "Notre société. Toutes ses offres sont à 100 % : visibilité, Alpha Sales OS (VIP ou à la carte), " +
      "OS personnalisé, digitalisation < 40 k, Alpha Voice. On ne reverse à personne — le taux partiel ne " +
      "concerne que le seul compte où nous sommes encore intermédiaires (Nuwacom).",
  },
  {
    accountId: "nuwacom",
    identite: {
      name: "Nuwacom",
      city: "Lyon",
      sites: ["https://nuwacom.fr/", "https://nuwacom.com/en"],
      whatYouSell: "Transformation digitale — refonte des parcours et automatisation IA",
      valueProp:
        "On transforme un process assurance manuel et lent en parcours digital mesurable : moins de friction, plus de contrats traités.",
      // GROS chantiers seulement (> 40 k) : en dessous, c'est faisable par nous
      // et ça reste chez EAGLEYE. Au-dessus, c'est trop lourd pour nous.
      offers: ["visibilite-growth", "alpha-sales-os"],
      closingAction:
        "Caler le RDV de CADRAGE avec le CEO de Nuwacom. Le contrat se dresse APRÈS ce cadrage — " +
        "c'est là qu'est le levier de négociation.",
      icp: {
        label: "Assureur en transformation digitale (compagnie, courtier, mutuelle)",
        buyer: "Directeur transformation / DSI / directeur général / responsable innovation",
        sector: "Assurance — compagnies, courtiers grossistes, mutuelles, bancassurance",
        companySize: "25 à 2 000 salariés (cœur de cible ~1 500)",
        geo: "Lyon puis national",
        pains: [
          "Process encore manuels (souscription, sinistres, relances) — lents et coûteux",
          "Systèmes hérités qui ne parlent pas entre eux",
          "Parcours client fragmenté, sans mesure de bout en bout",
          "Pression réglementaire et concurrence des assurtechs",
        ],
        triggers: [
          "Nomination d'un directeur transformation / innovation",
          "Programme de digitalisation annoncé ou budget voté",
          "Fusion / rapprochement (mutuelles) → besoin d'unifier les outils",
          "Publie qu'il recrute sur la data / le digital",
        ],
        channels: [
          "LinkedIn (comité de direction, transformation)",
          "Introduction par prescripteur (cabinet, éditeur)",
          "Email cadre + audit de parcours",
          "Événements assurance / assurtech",
        ],
        disqualifiers: [
          "Budget projet < 40 000 € HT → faisable par nous, ça reste chez EAGLEYE",
          "Moins de 25 salariés (rarement le budget d'un projet de transformation)",
          "Aucun sponsor au comité de direction",
          "Chantier gelé / DSI en refonte de core system bloquante",
        ],
        angle:
          "« Votre concurrent traite un dossier en minutes, vous en jours. La transformation, ce n'est pas un logiciel de plus — c'est le parcours refait. »",
      },
    },
    offerings: [
      {
        key: "transformation",
        label: "Gros chantier / transformation (> 40 k)",
        commissionPct: 15,
        // 15 %, c'est le PLANCHER, pas le tarif. Voir `leviers` : le taux suit
        // ce qu'on garde dans le deal, et le contrat se dresse APRÈS le cadrage
        // — c'est précisément là que ça se négocie.
        pctEstPlancher: true,
        leviers: [
          "PLANCHER 15 % : on passe la main sur la technique juste après la vision. On n'a plus de prise, on prend le minimum.",
          "PLUS : on construit les démos nous-mêmes avant de transmettre. Le client a vu NOTRE travail — le levier est de notre côté au moment du contrat.",
          "PLUS : on reste le point d'entrée technique du client. Le lien ne passe pas par eux.",
          "Le contrat se dresse APRÈS le cadrage : c'est le moment où le levier se convertit en pourcentage. Ne rien signer avant.",
        ],
        // Le gros devis justifie le plancher ; la MAINTENANCE mensuelle qui
        // suit revient à 100 % chez nous — c'est là qu'est la rente du chantier.
        recurringPct: 100,
        minHT: 40000,
        note:
          "Au-delà de 40 000 € HT : trop lourd pour nous → plateforme Nuwacom, 15 % MINIMUM sur le devis. " +
          "PUIS 100 % de tous les services de maintenance mensuels. " +
          "En dessous : EAGLEYE le fait (meilleur levier). Contrat dressé APRÈS le cadrage = c'est là qu'on remonte le taux.",
      },
    ],
    targetPerProject: 40000, // plancher de routage : sous 40 k, EAGLEYE le fait
    closing: {
      contactName: "Christophe (CEO Nuwacom)",
      timezone: "Europe/Luxembourg",
    },
    note:
      "Entrée sur le marché FR (déjà fort en Allemagne + Benelux). CEO Christophe (visio faite, réglo). " +
      "Chantiers > 40 k, 15 %. Contrat dressé APRÈS le cadrage = levier. Si un open-source ou nous-mêmes " +
      "pouvons le faire vite → on le fait nous ; si trop lourd (ou refusé par eux) → leur plateforme.",
  },
];

/** Le volet commercial d'un compte — vide plutôt qu'absent, pour ne jamais crasher. */
export function commercialFor(accountId: string): AccountCommercial {
  return (
    ACCOUNTS_COMMERCIAL.find((c) => c.accountId === accountId) ?? {
      accountId,
      offerings: [],
    }
  );
}

export interface CommissionQuote {
  offering: Offering;
  /** % appliqué (recurring si `recurring`, sinon setup/one-shot). */
  pct: number;
  /** Montant de la commission sur `amountHT`. */
  amount: number;
  /** Le taux vient-il des termes NÉGOCIÉS de l'affaire, ou de la référence ? */
  source: "deal" | "reference";
  /**
   * Le taux de référence, quand le deal s'en écarte. C'est ce qui permet de
   * dire « tu as signé 3 points sous ta référence » au lieu d'afficher un
   * chiffre sans point de comparaison.
   */
  referencePct?: number;
  /**
   * Alerte à montrer à l'opérateur. Deux cas : on est SOUS un plancher
   * (Nuwacom à moins de 15 %), ou on a laissé du levier sur la table.
   * Vide = rien à signaler.
   */
  alerte?: string;
}

/** Les termes négociés d'une affaire — voir `Prospect.dealTerms`. */
export interface DealTerms {
  commissionPct?: number;
  recurringPct?: number;
  structure?: string;
  agreedAt?: string;
}

/**
 * La commission EXACTE d'une vente : on choisit l'offre du compte dont les
 * bornes (`minHT`/`maxHT`) contiennent le montant, puis on applique le bon
 * taux (récurrent vs setup). C'est ce qui distingue une digitalisation
 * EAGLEYE (100 %, jusqu'à 40 k) d'un chantier Nuwacom (15 % au-delà de 40 k,
 * puis 100 % de la maintenance mensuelle).
 *
 * ⚠ Cette mécanique reste NÉCESSAIRE avec un seul intermédiaire. Elle a servi
 * à deux ; la réduire à Nuwacom aujourd'hui la rendrait à réécrire au premier
 * partenaire suivant, et c'est un calcul d'argent.
 *
 * Repli : si aucune offre ne matche la taille (montant hors des bornes, ou
 * compte sans offerings), on retombe sur le taux vitrine du compte — jamais
 * d'erreur silencieuse, on facture toujours QUELQUE chose de traçable.
 */
export function commissionFor(
  accountId: string,
  opts: { amountHT: number; recurring?: boolean; offeringKey?: string; deal?: DealTerms }
): CommissionQuote {
  const a = getAccount(accountId);
  const offerings = commercialFor(a.id).offerings;
  const amt = Math.max(0, opts.amountHT || 0);
  const fits = (o: Offering) => (o.minHT == null || amt >= o.minHT) && (o.maxHT == null || amt <= o.maxHT);

  // 1. La vente NOMME son offre → autorité absolue (le montant seul est ambigu :
  //    un même montant peut correspondre à deux offres différentes).
  // 2. Sinon récurrent → l'offre à abonnement (celle qui a un recurringPct).
  // 3. Sinon setup exact → l'offre productisée dont le prix colle.
  // 4. Sinon on route par la TAILLE (bornes min/max) — Nuwacom ≥ 20 k.
  // 5. Repli : 1re offre, ou taux vitrine du compte. Jamais d'erreur muette.
  const picked =
    (opts.offeringKey && offerings.find((o) => o.key === opts.offeringKey)) ||
    (opts.recurring && offerings.find((o) => o.recurringPct != null)) ||
    (!opts.recurring && offerings.find((o) => o.setupHT != null && o.setupHT === amt)) ||
    offerings.filter((o) => o.minHT != null || o.maxHT != null).find(fits) ||
    offerings.find(fits) ||
    offerings[0];

  /**
   * ⚠ CE REPLI LISAIT `a.commissionPct`, C'EST-À-DIRE LE REGISTRE CLIENT.
   *
   * Ce champ est parti : il descendait dans le navigateur avec le registre, et
   * publiait notre part chez chaque partenaire (voir `lib/accounts.ts`).
   *
   * Le repli ne se déclenche que pour un compte SANS offre — donc un compte
   * inconnu, puisque les trois du portefeuille en ont. `getAccount` renvoyait
   * déjà le compte maître dans ce cas, et son taux était 100 %. On lit donc ce
   * même 100 % à sa source ici, plutôt que de le réécrire : le comportement ne
   * change pas, et il n'y a toujours qu'une saisie.
   */
  const replMaitre = ACCOUNTS_COMMERCIAL.find((c) => c.accountId === DEFAULT_ACCOUNT_ID)?.offerings[0];
  const offering: Offering = picked ??
    replMaitre ?? { key: "default", label: a.name, commissionPct: 100 };

  // La RÉFÉRENCE : ce qu'on prend d'habitude sur ce type de deal.
  const reference = opts.recurring && offering.recurringPct != null ? offering.recurringPct : offering.commissionPct;

  // LES TERMES DU DEAL priment. Chaque affaire se structure différemment ; le
  // barème dit ce qu'on VISE, la fiche dit ce qui sera FACTURÉ. Afficher le
  // barème quand la réalité est ailleurs, c'est se mentir sur ses prévisions.
  const negocie = opts.recurring ? opts.deal?.recurringPct : opts.deal?.commissionPct;
  const utiliseDeal = typeof negocie === "number" && Number.isFinite(negocie) && negocie >= 0;
  const pct = utiliseDeal ? Math.min(100, negocie) : reference;

  return {
    offering,
    pct,
    amount: Math.round((amt * pct) / 100),
    source: utiliseDeal ? "deal" : "reference",
    ...(utiliseDeal && pct !== reference ? { referencePct: reference } : {}),
    ...alerteDe(offering, pct, reference, utiliseDeal, opts.recurring === true),
  };
}

/**
 * Ce qu'il faut dire à l'opérateur sur l'écart entre le deal et la référence.
 *
 * Deux situations valent une alerte, et une seule est un problème :
 *  · SOUS LE PLANCHER — on a signé moins que le minimum de l'offre. Ça arrive,
 *    mais ça doit se voir : c'est du chiffre d'affaires qui ne reviendra pas.
 *  · AU PLANCHER SANS AVOIR ESSAYÉ — le taux plancher est appliqué par défaut
 *    alors que les leviers existent. On rappelle lesquels : le contrat se
 *    dresse APRÈS le cadrage, donc il est encore temps.
 */
function alerteDe(
  offering: Offering,
  pct: number,
  reference: number,
  utiliseDeal: boolean,
  recurring: boolean
): { alerte?: string } {
  // Un plancher ne concerne que le one-shot : le récurrent a sa propre règle.
  if (recurring || !offering.pctEstPlancher) return {};

  if (utiliseDeal && pct < reference) {
    return { alerte: `⚠ ${pct} % : SOUS le plancher de ${reference} % sur « ${offering.label} ». C'est acté, mais ça se compte.` };
  }
  if (pct === reference) {
    const levier = offering.leviers?.[1];
    return {
      alerte:
        `${pct} % est le PLANCHER de « ${offering.label} », pas le tarif. ` +
        (levier ? `Levier à jouer : ${levier}` : `Le taux suit le levier qu'on garde dans le deal.`),
    };
  }
  return {};
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BARÈME PAR COMPTE — pour le calculateur d'offres.
 *
 * `lib/calculateur-offres.ts` applique UN taux par compte. C'est exact
 * aujourd'hui — chaque compte partenaire n'a qu'une offre, et les cinq offres
 * EAGLEYE sont toutes à 100 % — mais ce n'est pas garanti demain.
 *
 * ⚠ La dérivation REFUSE donc de choisir quand les offres d'un compte ne
 * s'accordent pas : elle rend le taux le plus BAS et le signale. Prendre la
 * première offre au hasard afficherait une part qui n'est celle d'aucune
 * affaire réelle, et ce serait invisible — c'est exactement le genre de chiffre
 * qui se retrouve dans une prévision de trésorerie.
 *
 * Le taux le plus bas plutôt que le plus haut : se tromper vers le bas fait
 * rater une bonne nouvelle, se tromper vers le haut fait promettre de l'argent
 * qui n'arrivera pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface BaremeDerive {
  accountId: string;
  nom: string;
  setupPct: number;
  mensuelPct: number;
  plancher?: boolean;
  /** Renseigné quand les offres du compte ne portent pas le même taux. */
  divergence?: string;
}

export function baremesPourCalculateur(nomDuCompte: (id: string) => string): BaremeDerive[] {
  return ACCOUNTS_COMMERCIAL.map((a) => {
    const offres = a.offerings ?? [];
    if (offres.length === 0) {
      return { accountId: a.accountId, nom: nomDuCompte(a.accountId), setupPct: 100, mensuelPct: 100 };
    }
    const setups = offres.map((o) => o.commissionPct);
    const mensuels = offres.map((o) => o.recurringPct ?? o.commissionPct);
    const setupPct = Math.min(...setups);
    const mensuelPct = Math.min(...mensuels);
    const divergent = new Set(setups).size > 1 || new Set(mensuels).size > 1;

    return {
      accountId: a.accountId,
      nom: nomDuCompte(a.accountId),
      setupPct,
      mensuelPct,
      plancher: offres.some((o) => o.pctEstPlancher),
      ...(divergent
        ? {
            divergence:
              `Les offres de ce compte n'ont pas toutes le même taux (setup ${[...new Set(setups)].join("/")} %, ` +
              `mensuel ${[...new Set(mensuels)].join("/")} %). Le calculateur applique le plus BAS — chiffre une ` +
              `affaire précise si le taux compte.`,
          }
        : {}),
    };
  });
}
