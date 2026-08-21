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

export interface Account {
  /** Slug stable — la clé stockée dans settings.accountId. */
  id: string;
  /** Nom de la marque (= agencyName une fois appliqué). */
  name: string;
  /** master = EAGLEYE (gère tout) ; client = marque revendue. */
  kind: AccountKind;
  city: string;
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
  /** Part prélevée par EAGLEYE sur chaque vente de ce compte (%). */
  commissionPct: number;
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
    note: "Compte maître — l'interface qui pilote tous les autres.",
  },
  {
    id: "scintia",
    name: "ScintIA",
    kind: "client",
    city: "Lyon",
    whatYouSell: "ScintIA Callflow — l'accueil & la relance au téléphone par IA",
    valueProp:
      "Chaque appel manqué est un client qui appelle le concurrent. ScintIA répond à votre place, 24/7, et prend le rendez-vous.",
    // Callflow UNIQUEMENT — le « ScintIA Lab » a été retiré (→ Nuwacom).
    offers: ["callflow"],
    commissionPct: 30,
    targetPerProject: 990, // setup Callflow public (lib/pipeline-juillet.ts)
    note: "Offre Callflow seule. Le pipe réel de juillet 2026 tourne sur ce compte.",
  },
  {
    id: "nuwacom",
    name: "Nuwacom",
    kind: "client",
    city: "Lyon",
    whatYouSell: "Transformation digitale — refonte des parcours et automatisation IA",
    valueProp:
      "On transforme un process assurance manuel et lent en parcours digital mesurable : moins de friction, plus de contrats traités.",
    // L'ex-« ScintIA Lab » : l'offre transformation / croissance.
    offers: ["visibilite-growth", "alpha-sales-os"],
    commissionPct: 15,
    targetPerProject: 5500,
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
        "Moins de 25 salariés (budget projet insuffisant pour ≥ 5 500 €)",
        "Aucun sponsor au comité de direction",
        "Chantier gelé / DSI en refonte de core system bloquante",
      ],
      angle:
        "« Votre concurrent traite un dossier en minutes, vous en jours. La transformation, ce n'est pas un logiciel de plus — c'est le parcours refait. »",
    },
    note: "Ex-« ScintIA Lab ». Commission 15 %. Objectif ≥ 5 500 €/projet.",
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
