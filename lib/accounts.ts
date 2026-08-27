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
 *
 * ⚠⚠ CE FICHIER DESCEND DANS LE NAVIGATEUR. Il est importé par le store et par
 * cinq composants client : tout ce qu'on écrit ici finit dans un fichier
 * JavaScript téléchargeable par n'importe qui (`_next/static/**` est exclu du
 * middleware). Les MONTANTS, le détail des règles de commission et les
 * COORDONNÉES partenaires vivent donc dans `lib/accounts-commercial.ts`,
 * servi par `/api/catalogue`. N'ajoute ici que ce qu'un inconnu peut lire.
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
   * ⚠ LE TAUX DU COMPTE N'EST PLUS ICI, ET LA RAISON EST UNE MESURE.
   *
   * Ce champ portait 100 / 30 / 15. Ce module descend dans le navigateur, et
   * `_next/static/**` est exclu du middleware : le chunk qui le contient
   * répond 200 sans cookie, SITE_PASSWORD actif — vérifié sur serveur réel.
   * Notre part chez ScintIA et chez Nuwacom était donc publique.
   *
   * Le commentaire qui l'y laissait plaidait que « chaque partenaire connaît
   * déjà son propre taux ». La moitié tient. L'autre non : le chunk les
   * montre TOUS LES TROIS, à n'importe qui — et CLAUDE.md pose que le taux
   * Nuwacom se dresse APRÈS le cadrage. Ce n'est pas un chiffre connu, c'est
   * celui qu'on négocie.
   *
   * Il vient maintenant du serveur, dérivé des offres du compte
   * (`tauxVitrinePct`, lib/client-catalogue.ts) et servi au compte MAÎTRE
   * seulement (`/api/catalogue`). La bascule de compte l'applique aux
   * Réglages ; tant qu'il n'est pas arrivé, elle est désactivée — un
   * `/payouts` qui calculerait une part ScintIA à 100 % en silence serait
   * pire que la fuite qu'on vient de fermer.
   */
  /**
   * Comment on CLOSE sur ce compte. Chaque marque a son rituel de signature :
   * un devis EAGLEYE, une proposition via le panel ScintIA, un cadrage avec le
   * CEO de Nuwacom. Se tromper de rituel = perdre le deal au dernier mètre.
   *
   * Seul l'ACTE est ici. Les coordonnées qui vont avec (adresse d'expédition,
   * panel de vente, nom du CEO à impliquer, fuseau) sont dans
   * `lib/accounts-commercial.ts` et arrivent par `/api/catalogue` : elles
   * n'ont rien à faire dans un fichier que n'importe qui télécharge.
   */
  closing?: {
    /** L'acte précis à poser quand le prospect est prêt. */
    action: string;
  };
  /** ICP semé pour ce compte (surcharge le squelette déduit de l'offre). */
  icp?: Partial<ICP>;
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
    // Le taux d'EAGLEYE est à 100 % et ne se lit plus ici (voir `Account`) :
    // EAGLEYE CORP, c'est NOUS, il n'y a personne à qui reverser. Il vit avec
    // les autres dans `lib/accounts-commercial.ts`.
    //
    // ⚠ À ne pas confondre avec les 30 % de l'offre « setup + 30 % du CA
    // généré » : ceux-là, c'est ce qu'on FACTURE à un client sur le chiffre
    // qu'on lui fait gagner (lib/pricing → REV_SHARE). Deux choses différentes
    // qui portaient le même nombre — c'est précisément ce qui rendait l'erreur
    // invisible.
    closing: {
      action: "Envoyer le DEVIS EAGLEYE CORP (chiffré, daté, avec la date de décision convenue).",
    },
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
    closing: {
      action: "Envoyer la PROPOSITION COMMERCIALE depuis le panel de vente ScintIA Callflow.",
    },
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
    closing: {
      // Le NOM du CEO est dans `lib/accounts-commercial.ts` : l'acte se dit
      // sans lui, et cette chaîne-ci part dans le navigateur.
      action:
        "Caler le RDV de CADRAGE avec le CEO de Nuwacom. Le contrat se dresse APRÈS ce cadrage — " +
        "c'est là qu'est le levier de négociation.",
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
  },
];

export const DEFAULT_ACCOUNT_ID = "eagleye";

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
 * (nom + offre) et l'accountId qui trace le compte actif.
 * Volontairement RESTREINT — on ne touche ni aux données (prospects), ni à
 * la sécurité, ni aux clés. Basculer de compte change QUI on est, pas ce
 * qu'on possède.
 *
 * ⚠ `commissionPct` NE FAIT PLUS PARTIE DU PATCH, et l'omission est le fond
 * du correctif : ce module descend dans le navigateur, donc le taux de
 * chaque compte y descendait avec lui (voir l'interface `Account`).
 *
 * Le taux arrive maintenant du serveur et c'est le SÉLECTEUR de comptes qui
 * l'écrit dans les Réglages, une fois qu'il l'a reçu. Tant qu'il ne l'a pas,
 * il n'y a pas de bascule : mieux vaut un bouton en attente qu'un `/payouts`
 * calculant notre part d'un deal ScintIA à 100 % sans que personne ne le
 * voie.
 */
export function applyAccount(id: string): Partial<AppSettings> {
  const a = getAccount(id);
  return {
    accountId: a.id,
    agencyName: a.name,
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

// `commissionFor()` et `CommissionQuote` ont déménagé dans
// `lib/accounts-commercial.ts` : ils ont besoin des MONTANTS par offre, et ce
// fichier-ci descend dans le navigateur. Voir l'en-tête pour la frontière.
