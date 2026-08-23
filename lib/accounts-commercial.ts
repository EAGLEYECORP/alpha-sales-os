import { getAccount } from "./accounts";

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
 * Mesuré sur le build : `z.tazi@scintia.ai`, `sales.scintiacallflow.ai`,
 * `Christophe`, `setupHT: 10000` et la note « PUIS 100 % de tous les services
 * de maintenance mensuels » étaient dans un chunk téléchargeable. Ce n'est pas
 * une grille de prix client, c'est mieux : c'est le contrat entre nous et nos
 * partenaires, en clair.
 *
 * ── LA FRONTIÈRE, ET POURQUOI ELLE EST LÀ ──
 *
 * Descend encore dans le navigateur (dans `lib/accounts.ts`) :
 *   · l'identité (nom, ville, ce qu'on vend, la proposition de valeur) ;
 *   · l'ICP et le routage (seuil 40 k) ;
 *   · le TAUX vitrine (30 / 30 / 15) et l'ACTE de closing.
 *
 * Ne descend plus (ici) :
 *   · les MONTANTS (setup 10 000 / 990, objectif par projet) ;
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
 *   • ScintIA Callflow  → 990 € HT de setup : 30 % + 10 % du mensuel récurrent.
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

/** Le volet commercial d'UN compte du portefeuille. */
export interface AccountCommercial {
  accountId: string;
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
        note: "Ex-« ScintIA Lab » : récupéré par EAGLEYE. Au-delà de 40 k → Nuwacom.",
      },
    ],
    closing: { fromEmail: "contact@eagleyecorp.fr" },
    note:
      "Notre société. Toutes ses offres sont à 100 % : visibilité, Alpha Sales OS (VIP ou à la carte), " +
      "OS personnalisé, digitalisation < 40 k. On ne reverse à personne — les taux partiels ne concernent " +
      "que les comptes où nous sommes intermédiaires (ScintIA, Nuwacom).",
  },
  {
    accountId: "scintia",
    offerings: [
      {
        key: "callflow",
        label: "ScintIA Callflow",
        setupHT: 990,
        commissionPct: 30,
        recurringPct: 10,
        note: "990 € HT de setup → 30 % ; + 10 % sur l'abonnement mensuel.",
      },
    ],
    targetPerProject: 990, // setup Callflow public (lib/pipeline-juillet.ts)
    closing: {
      fromEmail: "z.tazi@scintia.ai",
      panelUrl: "https://sales.scintiacallflow.ai/",
    },
    note: "Callflow SEUL, vendu comme un produit (990 € HT, 30 % + 10 % mensuel). Pipe juillet 2026 ici.",
  },
  {
    accountId: "nuwacom",
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
 * taux (récurrent vs setup). C'est ce qui distingue un Callflow ScintIA
 * (30 % du setup + 10 % du mensuel) d'une digitalisation EAGLEYE (30 %,
 * jusqu'à 40 k) ou d'un chantier Nuwacom (15 % au-delà de 40 k, puis 100 %
 * de la maintenance mensuelle).
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
  //    990 € peut être un setup Callflow OU un petit projet Lab).
  // 2. Sinon récurrent → l'offre à abonnement (celle qui a un recurringPct).
  // 3. Sinon setup exact → l'offre productisée dont le prix colle.
  // 4. Sinon on route par la TAILLE (bornes min/max) — Lab < 6 k, Nuwacom ≥ 20 k.
  // 5. Repli : 1re offre, ou taux vitrine du compte. Jamais d'erreur muette.
  const picked =
    (opts.offeringKey && offerings.find((o) => o.key === opts.offeringKey)) ||
    (opts.recurring && offerings.find((o) => o.recurringPct != null)) ||
    (!opts.recurring && offerings.find((o) => o.setupHT != null && o.setupHT === amt)) ||
    offerings.filter((o) => o.minHT != null || o.maxHT != null).find(fits) ||
    offerings.find(fits) ||
    offerings[0];

  const offering: Offering = picked ?? { key: "default", label: a.name, commissionPct: a.commissionPct };

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
