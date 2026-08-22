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
 * Niveau de service d'un compte.
 *
 * Décision structurante : EAGLEYE (notre compte) tourne en `interne` — accès
 * total, aucune limite, c'est l'atelier. TOUT compte client entre directement
 * en `vip`, jamais en offre d'appel dégradée.
 *
 * Pourquoi pas de palier bas : une version bridée crée un client qui juge le
 * produit sur ce qu'il ne peut pas faire, puis négocie pour l'obtenir. Mieux
 * vaut un client qui paie le prix fort et reçoit tout — et un « non » franc à
 * celui qui ne peut pas suivre.
 */
export type AccountTier = "interne" | "vip";

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

export interface Account {
  /** Slug stable — la clé stockée dans settings.accountId. */
  id: string;
  /** Nom de la marque (= agencyName une fois appliqué). */
  name: string;
  /** master = EAGLEYE (gère tout) ; client = marque revendue. */
  kind: AccountKind;
  /** Niveau de service. EAGLEYE = interne ; tout client = vip d'emblée. */
  tier: AccountTier;
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
  /**
   * Comment on CLOSE sur ce compte. Chaque marque a son rituel de signature :
   * un devis EAGLEYE, une proposition via le panel ScintIA, un cadrage avec le
   * CEO de Nuwacom. Se tromper de rituel = perdre le deal au dernier mètre.
   */
  closing?: {
    /** L'acte précis à poser quand le prospect est prêt. */
    action: string;
    /** Adresse d'expédition officielle pour ce compte. */
    fromEmail?: string;
    /** Outil à utiliser (panel de vente, espace devis…). */
    panelUrl?: string;
    /** Personne à impliquer (ex. le CEO côté Nuwacom). */
    contactName?: string;
    /** Fuseau de la personne à impliquer — évite de proposer un créneau absurde. */
    timezone?: string;
  };
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
    tier: "interne",
    city: "Lyon",
    whatYouSell: "Alpha Sales OS — l'OS de vente terrain",
    valueProp:
      "On outille les forces de vente avec l'automatisation IA : zéro lead perdu, la machine tourne 24/7.",
    // Le maître voit et propose tout — c'est lui qui arbitre l'offre.
    offers: ["alpha-sales-os", "callflow", "visibilite-growth"],
    commissionPct: 30,
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
    closing: {
      action: "Envoyer le DEVIS EAGLEYE CORP (chiffré, daté, avec la date de décision convenue).",
      fromEmail: "contact@eagleyecorp.fr",
    },
    note: "Compte maître. Prend TOUT ce qui est faisable par nous : visibilité, digitalisation < 40 k, ex-ScintIA Lab.",
  },
  {
    id: "scintia",
    name: "ScintIA",
    kind: "client",
    tier: "vip",
    city: "Lyon",
    sites: ["https://scintia.ai/", "https://scintiacallflow.ai/"],
    whatYouSell: "ScintIA Callflow — l'accueil & la relance au téléphone par IA",
    valueProp:
      "Chaque appel manqué est un client qui appelle le concurrent. ScintIA répond à votre place, 24/7, et prend le rendez-vous.",
    // Callflow UNIQUEMENT — négocié : ScintIA se concentre sur Callflow comme
    // PRODUIT. Le « ScintIA Lab » est repassé à EAGLEYE.
    offers: ["callflow"],
    commissionPct: 30,
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
      action: "Envoyer la PROPOSITION COMMERCIALE depuis le panel de vente ScintIA Callflow.",
      fromEmail: "z.tazi@scintia.ai",
      panelUrl: "https://sales.scintiacallflow.ai/",
    },
    note: "Callflow SEUL, vendu comme un produit (990 € HT, 30 % + 10 % mensuel). Pipe juillet 2026 ici.",
  },
  {
    id: "nuwacom",
    name: "Nuwacom",
    kind: "client",
    tier: "vip",
    city: "Lyon",
    sites: ["https://nuwacom.fr/", "https://nuwacom.com/en"],
    whatYouSell: "Transformation digitale — refonte des parcours et automatisation IA",
    valueProp:
      "On transforme un process assurance manuel et lent en parcours digital mesurable : moins de friction, plus de contrats traités.",
    // GROS chantiers seulement (> 40 k) : en dessous, c'est faisable par nous
    // et ça reste chez EAGLEYE. Au-dessus, c'est trop lourd pour nous.
    offers: ["visibilite-growth", "alpha-sales-os"],
    commissionPct: 15,
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
      action:
        "Caler le RDV de CADRAGE avec Christophe (CEO Nuwacom). Le contrat se dresse APRÈS ce cadrage — " +
        "c'est là qu'est le levier de négociation.",
      contactName: "Christophe (CEO Nuwacom)",
      timezone: "Europe/Luxembourg",
    },
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
    note:
      "Entrée sur le marché FR (déjà fort en Allemagne + Benelux). CEO Christophe (visio faite, réglo). " +
      "Chantiers > 40 k, 15 %. Contrat dressé APRÈS le cadrage = levier. Si un open-source ou nous-mêmes " +
      "pouvons le faire vite → on le fait nous ; si trop lourd (ou refusé par eux) → leur plateforme.",
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

/** Seuil au-delà duquel un chantier devient trop lourd pour nous (€ HT). */
export const NUWACOM_THRESHOLD_HT = 40000;

export interface AccountRoute {
  accountId: string;
  accountName: string;
  reason: string;
}

/**
 * LA règle de routage (négociée, définitive) — qui encaisse quel deal :
 *
 *   1. Callflow (accueil/relance téléphone) ................ → ScintIA
 *   2. Chantier > 40 k € HT (trop lourd pour nous) ......... → Nuwacom
 *   3. TOUT le reste, faisable par nous .................... → EAGLEYE
 *      (visibilité/sites/growth, digitalisation < 40 k, ex-« ScintIA Lab »)
 *
 * Le défaut est EAGLEYE, volontairement : on garde tout ce qu'on sait faire —
 * c'est la marge la plus haute et le meilleur levier de négociation. On ne
 * sous-traite que ce qu'on ne peut pas porter.
 */
export function routeAccount(deal: { offer?: EagleyeOffer; amountHT?: number }): AccountRoute {
  if (deal.offer === "callflow") {
    return { accountId: "scintia", accountName: "ScintIA", reason: "Callflow — produit ScintIA." };
  }
  const amt = deal.amountHT ?? 0;
  if (amt > NUWACOM_THRESHOLD_HT) {
    return {
      accountId: "nuwacom",
      accountName: "Nuwacom",
      reason: `Chantier ${amt.toLocaleString("fr-FR")} € > ${NUWACOM_THRESHOLD_HT.toLocaleString("fr-FR")} € — trop lourd pour nous.`,
    };
  }
  return {
    accountId: "eagleye",
    accountName: "EAGLEYE CORP",
    reason: "Faisable par nous — on le garde (marge + levier).",
  };
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
