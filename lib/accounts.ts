import type { AppSettings } from "./types";
import { type ICP, deriveICP, mergeICP } from "./icp";
import type { EagleyeOffer } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Portefeuille de comptes white-label — le compte MAÎTRE gère les autres.
 *
 * Le modèle métier de Zakaria : EAGLEYE est le compte maître, l'interface
 * qui pilote tout. Chaque marque revendue (ScintIA, Nuwacom, …) est un
 * COMPTE : sa propre identité, ses offres autorisées, sa commission, son
 * ICP. Le maître bascule d'un compte à l'autre ; `applyAccount()` produit
 * le patch de Réglages correspondant (identité + offre + commission).
 *
 * Pourquoi un registre en clair et pas une table : les comptes sont peu
 * nombreux et surtout STRUCTURELS (ils décident quelle offre proposer, quelle
 * commission prélever, quel client viser). Les coder ici les rend versionnés,
 * testables et lisibles — pas de dépendance, pas de réseau. Quand il en faudra
 * des dizaines créés à la volée, ce registre devient la valeur par défaut et
 * Supabase porte les comptes dynamiques.
 *
 * ⚠ Un compte n'est PAS une frontière de sécurité (ça, c'est la RLS + le JWT,
 * lib/tenant.ts). C'est une frontière d'IDENTITÉ COMMERCIALE : au nom de qui on
 * parle, quoi on vend, combien on prend.
 * ─────────────────────────────────────────────────────────────────────
 */

export type AccountKind = "master" | "client";

/**
 * Une OFFRE COMMERCIALE d'un compte, avec sa règle de commission propre.
 * La commission n'est pas la même selon l'offre ni selon la TAILLE du projet :
 *   • ScintIA Callflow  → 30 % du setup + 10 % du mensuel récurrent.
 *   • ScintIA Lab       → 15 %, uniquement les projets < 6 000 € HT.
 *   • Nuwacom           → 15 %, à partir de 20 000 € HT (idéal 30-50 k).
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

export interface Account {
  /** Slug stable — la clé stockée dans settings.accountId. */
  id: string;
  /** Nom de la marque (= agencyName une fois appliqué). */
  name: string;
  /** master = EAGLEYE (gère tout) ; client = marque revendue. */
  kind: AccountKind;
  city: string;
  /** Sites officiels de la marque (référence, jamais scrapés en dur). */
  sites?: string[];
  /** Ce que le compte vend, en une ligne. */
  whatYouSell: string;
  /** Sa proposition de valeur. */
  valueProp: string;
  /**
   * Offres AUTORISÉES pour ce compte. Contraint le routeur d'offre
   * (matchOffer) : ScintIA ne propose QUE callflow, même si l'audit
   * pointe ailleurs. Vide/absent = les trois (cas du maître).
   */
  offers: EagleyeOffer[];
  /**
   * Taux « vitrine » du compte — celui appliqué par défaut dans la page
   * Payouts (settings.commissionPct). C'est l'offre PRINCIPALE du compte
   * (Callflow 30 % pour ScintIA, 15 % pour Nuwacom). Les taux fins par
   * offre/taille vivent dans `offerings` (voir commissionFor()).
   */
  commissionPct: number;
  /** Les offres commerciales du compte + leurs règles de commission. */
  offerings: Offering[];
  /** Objectif minimal de valeur par projet (€), s'il existe. */
  targetPerProject?: number;
  /** ICP semé pour ce compte (surcharge le squelette déduit de l'offre). */
  icp?: Partial<ICP>;
  /** Une ligne pour l'humain — d'où vient le compte, son statut. */
  note?: string;
}

/**
 * Le portefeuille. EAGLEYE en tête (maître), puis les comptes clients.
 * L'ordre est l'ordre d'affichage dans le sélecteur du maître.
 */
export const ACCOUNTS: Account[] = [
  {
    id: "eagleye",
    name: "EAGLEYE CORP",
    kind: "master",
    city: "Lyon",
    whatYouSell: "Alpha Sales OS — l'OS de vente terrain",
    valueProp:
      "On outille les forces de vente avec l'automatisation IA : zéro lead perdu, la machine tourne 24/7.",
    // Le maître voit et propose tout — c'est lui qui arbitre l'offre.
    offers: ["alpha-sales-os", "callflow", "visibilite-growth"],
    commissionPct: 30,
    offerings: [
      { key: "alpha-sales-os", label: "Alpha Sales OS", setupHT: 10000, commissionPct: 30, recurringPct: 10 },
    ],
    note: "Compte maître — l'interface qui pilote tous les autres.",
  },
  {
    id: "scintia",
    name: "ScintIA",
    kind: "client",
    city: "Lyon",
    sites: ["https://scintia.ai/", "https://scintiacallflow.ai/"],
    whatYouSell: "ScintIA Callflow — l'accueil & la relance au téléphone par IA",
    valueProp:
      "Chaque appel manqué est un client qui appelle le concurrent. ScintIA répond à votre place, 24/7, et prend le rendez-vous.",
    // Callflow productisé (routeur d'offre). ScintIA Lab = projets sur mesure < 6 k.
    offers: ["callflow"],
    commissionPct: 30, // vitrine = l'offre Callflow
    offerings: [
      {
        key: "callflow",
        label: "ScintIA Callflow",
        setupHT: 990,
        commissionPct: 30,
        recurringPct: 10,
        note: "990 € HT de setup → 30 % ; + 10 % sur l'abonnement mensuel.",
      },
      {
        key: "scintia-lab",
        label: "ScintIA Lab (sur mesure)",
        commissionPct: 15,
        maxHT: 6000,
        note: "Projets sur mesure < 6 000 € HT → 15 %. Au-delà de 20 k : c'est Nuwacom.",
      },
    ],
    targetPerProject: 990, // setup Callflow public (lib/pipeline-juillet.ts)
    note: "Callflow (990 € HT, 30 % + 10 % mensuel) + ScintIA Lab (15 %, < 6 k). Pipe juillet 2026 ici.",
  },
  {
    id: "nuwacom",
    name: "Nuwacom",
    kind: "client",
    city: "Lyon",
    sites: ["https://nuwacom.fr/", "https://nuwacom.com/en"],
    whatYouSell: "Transformation digitale — refonte des parcours et automatisation IA",
    valueProp:
      "On transforme un process assurance manuel et lent en parcours digital mesurable : moins de friction, plus de contrats traités.",
    // Gros projets de transformation (assurance) : l'offre visibilité/growth + l'OS.
    offers: ["visibilite-growth", "alpha-sales-os"],
    commissionPct: 15,
    offerings: [
      {
        key: "transformation",
        label: "Transformation digitale",
        commissionPct: 15,
        minHT: 20000,
        note: "À partir de 20 000 € HT (preneur), cœur de cible 30-50 k €. 15 %.",
      },
    ],
    targetPerProject: 30000, // idéal 30-50 k ; plancher pris 20 k
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
        "Budget projet < 20 000 € HT (sous le plancher Nuwacom → oriente vers ScintIA Lab)",
        "Moins de 25 salariés (rarement le budget d'un projet de transformation)",
        "Aucun sponsor au comité de direction",
        "Chantier gelé / DSI en refonte de core system bloquante",
      ],
      angle:
        "« Votre concurrent traite un dossier en minutes, vous en jours. La transformation, ce n'est pas un logiciel de plus — c'est le parcours refait. »",
    },
    note: "Entrée sur le marché FR (déjà fort en Allemagne + Benelux). CEO Christophe. Projets ≥ 20 k € HT (idéal 30-50 k), 15 %.",
  },
];

const DEFAULT_ACCOUNT_ID = "eagleye";

/** Le compte par id, ou le maître par défaut si l'id est inconnu/absent. */
export function getAccount(id?: string): Account {
  return ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS.find((a) => a.id === DEFAULT_ACCOUNT_ID)!;
}

/** Le compte maître (celui qui pilote le portefeuille). */
export function masterAccount(): Account {
  return ACCOUNTS.find((a) => a.kind === "master") ?? ACCOUNTS[0];
}

/**
 * Le patch de Réglages qui fait basculer l'app sur CE compte : identité
 * (nom + offre), commission, et l'accountId qui trace le compte actif.
 * Volontairement RESTREINT — on ne touche ni aux données (prospects), ni à
 * la sécurité, ni aux clés. Basculer de compte change QUI on est, pas ce
 * qu'on possède.
 */
export function applyAccount(id: string): Partial<AppSettings> {
  const a = getAccount(id);
  return {
    accountId: a.id,
    agencyName: a.name,
    commissionPct: a.commissionPct,
    offer: { city: a.city, whatYouSell: a.whatYouSell, valueProp: a.valueProp },
  };
}

/**
 * L'ICP du compte : le squelette déduit de son offre, enrichi de l'ICP
 * curé du registre (Nuwacom : assurance / transformation digitale). Sans
 * surcharge, on retombe sur la déduction déterministe (lib/icp.ts) — donc
 * chaque compte a toujours un client parfait cohérent, affiné ou non.
 */
export function accountICP(id: string): ICP {
  const a = getAccount(id);
  const offer = { agencyName: a.name, whatYouSell: a.whatYouSell, valueProp: a.valueProp, city: a.city };
  return a.icp ? mergeICP(offer, a.icp) : deriveICP(offer);
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
 * taux (récurrent vs setup). C'est ce qui distingue un Callflow (30 % + 10 %
 * mensuel) d'un ScintIA Lab (15 %, < 6 k) ou d'un Nuwacom (15 %, ≥ 20 k).
 *
 * Repli : si aucune offre ne matche la taille (trou 6-20 k chez ScintIA, ou
 * compte sans offerings), on retombe sur le taux vitrine du compte — jamais
 * d'erreur silencieuse, on facture toujours QUELQUE chose de traçable.
 */
export function commissionFor(
  accountId: string,
  opts: { amountHT: number; recurring?: boolean; offeringKey?: string }
): CommissionQuote {
  const a = getAccount(accountId);
  const amt = Math.max(0, opts.amountHT || 0);
  const fits = (o: Offering) => (o.minHT == null || amt >= o.minHT) && (o.maxHT == null || amt <= o.maxHT);

  // 1. La vente NOMME son offre → autorité absolue (le montant seul est ambigu :
  //    990 € peut être un setup Callflow OU un petit projet Lab).
  // 2. Sinon récurrent → l'offre à abonnement (celle qui a un recurringPct).
  // 3. Sinon setup exact → l'offre productisée dont le prix colle.
  // 4. Sinon on route par la TAILLE (bornes min/max) — Lab < 6 k, Nuwacom ≥ 20 k.
  // 5. Repli : 1re offre, ou taux vitrine du compte. Jamais d'erreur muette.
  const picked =
    (opts.offeringKey && a.offerings.find((o) => o.key === opts.offeringKey)) ||
    (opts.recurring && a.offerings.find((o) => o.recurringPct != null)) ||
    (!opts.recurring && a.offerings.find((o) => o.setupHT != null && o.setupHT === amt)) ||
    a.offerings.filter((o) => o.minHT != null || o.maxHT != null).find(fits) ||
    a.offerings.find(fits) ||
    a.offerings[0];

  if (!picked) {
    const pct = a.commissionPct;
    return { offering: { key: "default", label: a.name, commissionPct: pct }, pct, amount: Math.round((amt * pct) / 100) };
  }
  const pct = opts.recurring && picked.recurringPct != null ? picked.recurringPct : picked.commissionPct;
  return { offering: picked, pct, amount: Math.round((amt * pct) / 100) };
}
