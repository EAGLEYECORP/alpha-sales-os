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
 * La commission n'est pas la même selon l'offre ni selon la TAILLE du projet :
 *   • ScintIA Callflow  → 990 € HT de setup : 30 % + 10 % du mensuel récurrent.
 *   • EAGLEYE           → 30 % : visibilité, et digitalisation jusqu'à 40 k € HT
 *                         (l'ex-« ScintIA Lab », récupéré à la renégociation).
 *   • Nuwacom           → 15 % au-delà de 40 000 € HT, PUIS 100 % de toute la
 *                         maintenance mensuelle.
 * `minHT`/`maxHT` bornent l'ÉLIGIBILITÉ d'un projet à cette offre.
 */
export interface Offering {
  key: string;
  label: string;
  /** Prix setup / one-shot public (€ HT), si productisé. */
  setupHT?: number;
  /** % prélevé sur le one-shot / setup. */
  commissionPct: number;
  /** % prélevé sur le mensuel récurrent (abonnement), si applicable. */
  recurringPct?: number;
  /** Plancher d'éligibilité du projet (€ HT). */
  minHT?: number;
  /** Plafond d'éligibilité du projet (€ HT). */
  maxHT?: number;
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
    offerings: [
      {
        key: "alpha-sales-os-vip",
        label: "Alpha Sales OS — VIP",
        setupHT: 10000,
        commissionPct: 30,
        recurringPct: 10,
        note: "Offre haute : 10 000 € VIP. Sinon 30 % + frais de setup sur devis.",
      },
      {
        key: "visibilite",
        label: "Visibilité / Growth (sites, présence)",
        commissionPct: 30,
        note: "TOUT ce qui est visibilité est à EAGLEYE — faisable par nous.",
      },
      {
        key: "digitalisation",
        label: "Digitalisation / transformation < 40 k",
        commissionPct: 30,
        maxHT: 40000,
        note: "Ex-« ScintIA Lab » : récupéré par EAGLEYE. Au-delà de 40 k → Nuwacom.",
      },
    ],
    closing: { fromEmail: "contact@eagleyecorp.fr" },
    note: "Compte maître. Prend TOUT ce qui est faisable par nous : visibilité, digitalisation < 40 k, ex-ScintIA Lab.",
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
        // Le gros devis justifie les 15 % ; la MAINTENANCE mensuelle qui suit
        // revient à 100 % chez nous — c'est là qu'est la rente du chantier.
        recurringPct: 100,
        minHT: 40000,
        note:
          "Au-delà de 40 000 € HT : trop lourd pour nous → plateforme Nuwacom, 15 % sur le devis. " +
          "PUIS 100 % de tous les services de maintenance mensuels. " +
          "En dessous : EAGLEYE le fait (meilleur levier). Contrat dressé APRÈS le cadrage.",
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
  opts: { amountHT: number; recurring?: boolean; offeringKey?: string }
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

  if (!picked) {
    const pct = a.commissionPct;
    return { offering: { key: "default", label: a.name, commissionPct: pct }, pct, amount: Math.round((amt * pct) / 100) };
  }
  const pct = opts.recurring && picked.recurringPct != null ? picked.recurringPct : picked.commissionPct;
  return { offering: picked, pct, amount: Math.round((amt * pct) / 100) };
}
