import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SYNCHRO NAVIGATEUR → SERVEUR — rendre le pipe VISIBLE.
 *
 * ── LE TROU QUE ÇA BOUCHE ──
 *
 * Le CRM vit dans le navigateur (Zustand + localStorage). L'orchestrateur,
 * lui, lit Supabase. Personne ne remplissait cette table : `/api/v1/etat`
 * répondait honnêtement « ce n'est PAS un pipe vide, c'est un pipe invisible »
 * et tout ce qui est bâti autour — MCP, propositions, salle de contrôle —
 * tournait à vide.
 *
 * ── POURQUOI UNE RÉCONCILIATION, ET PAS UN SIMPLE ENVOI ──
 *
 * Un envoi qui ne fait qu'ajouter laisse des FANTÔMES : une fiche supprimée
 * dans le navigateur reste côté serveur, et l'agent propose de relancer
 * quelqu'un qui n'existe plus. Sur un canal qui écrit à de vraies personnes,
 * c'est la pire sorte de bug — silencieux, et visible seulement par le
 * destinataire.
 *
 * Le navigateur envoie donc la LISTE COMPLÈTE de ses identifiants (léger) et
 * seulement les fiches qui ont CHANGÉ (lourd). Le serveur écrit les
 * changements et supprime ce qui n'est plus dans la liste.
 *
 * ── LE DANGER DE CETTE MÉCANIQUE, ET SON GARDE-FOU ──
 *
 * Une réconciliation exacte fait qu'un navigateur vide efface le serveur.
 * localStorage se vide tout seul : navigation privée, nettoyage du cache,
 * changement d'appareil, quota dépassé. Le jour où ça arrive, la synchro
 * effacerait tout le pipe côté serveur — sans rien demander à personne.
 *
 * D'où `SEUIL_EFFACEMENT` : au-delà d'une certaine proportion supprimée d'un
 * coup, la synchro REFUSE et demande une confirmation explicite. Perdre une
 * synchro coûte une minute ; perdre le pipe coûte le travail de six mois.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que le serveur rend pour permettre au navigateur de comparer sans tout télécharger. */
export interface EmpreinteServeur {
  id: string;
  /** `updatedAt` de la fiche côté serveur. */
  maj: string;
}

export interface PlanSync {
  /** Fiches à écrire (nouvelles ou modifiées). */
  aEcrire: Prospect[];
  /** Identifiants à supprimer côté serveur. */
  aSupprimer: string[];
  /** Fiches identiques des deux côtés — rien à faire. */
  inchangees: number;
  /** Vrai si le plan efface une part anormale du serveur. */
  effacementMassif: boolean;
  /** Ce qu'il faut afficher avant d'exécuter. */
  resume: string;
}

/**
 * Proportion de suppressions au-delà de laquelle on s'arrête pour demander.
 *
 * 0,34 n'est pas un chiffre magique : c'est « plus d'un tiers du pipe ». Un
 * nettoyage normal ne supprime pas un tiers des fiches d'un coup ; un
 * localStorage vidé, si.
 */
export const SEUIL_EFFACEMENT = 0.34;

/** En dessous de ce nombre de fiches côté serveur, le seuil ne s'applique pas. */
export const PLANCHER_EFFACEMENT = 10;

/**
 * Compare l'état local et les empreintes serveur, et rend le plan.
 *
 * Pur et déterministe : testable sans Supabase, et il rend le MÊME plan deux
 * fois de suite — une synchro qui change d'avis n'est pas une synchro.
 */
export function planifierSync(locaux: Prospect[], serveur: EmpreinteServeur[]): PlanSync {
  // `updatedAt` fait foi pour une fiche. Il est écrit à chaque modification par
  // le store ; comparer les objets entiers coûterait plus cher que d'envoyer.
  return planifier(locaux, serveur, (p) => p.updatedAt, "fiche(s)");
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PLAN, POUR N'IMPORTE QUELLE TABLE — un seul algorithme, deux versions.
 *
 * ⚠ POURQUOI C'EST GÉNÉRIQUE PLUTÔT QUE RECOPIÉ. Les rendez-vous ont besoin
 * exactement du même plan : quoi écrire, quoi supprimer, et le garde-fou
 * d'effacement massif qui refuse de vider le serveur depuis un navigateur qui
 * a perdu ses données. Recopier l'algorithme aurait donné DEUX garde-fous à
 * tenir d'accord — et c'est toujours celui qu'on ne relit pas qui cesse de
 * mordre le jour où l'on ajuste le seuil.
 *
 * ⚠⚠ CE QUI DIFFÈRE LÉGITIMEMENT, C'EST LA VERSION. Un `Prospect` porte
 * `updatedAt`, écrit par le store à chaque modification. Un `Meeting` n'en a
 * PAS — et lui en ajouter un demanderait de migrer l'état déjà persisté dans
 * les navigateurs, pour un gain nul. Sa version est donc l'EMPREINTE DE SON
 * CONTENU : elle change exactement quand le rendez-vous change, ce qui est la
 * propriété qu'on cherchait de toute façon.
 *
 * L'extracteur de version est donc un paramètre, pas une branche `if` : une
 * branche aurait fait du planificateur un module qui connaît ses appelants.
 * ─────────────────────────────────────────────────────────────────────
 */
export function planifier<T extends { id: string }>(
  locaux: T[],
  serveur: EmpreinteServeur[],
  version: (x: T) => string,
  unite = "ligne(s)"
): PlanGenerique<T> {
  const parId = new Map(serveur.map((e) => [e.id, e.maj]));
  const idsLocaux = new Set(locaux.map((x) => x.id));

  const aEcrire: T[] = [];
  let inchangees = 0;

  for (const x of locaux) {
    const majServeur = parId.get(x.id);
    if (majServeur === undefined || majServeur !== version(x)) aEcrire.push(x);
    else inchangees++;
  }

  const aSupprimer = serveur.filter((e) => !idsLocaux.has(e.id)).map((e) => e.id);

  const effacementMassif =
    serveur.length >= PLANCHER_EFFACEMENT && aSupprimer.length / serveur.length > SEUIL_EFFACEMENT;

  const resume = effacementMassif
    ? `⚠ Cette synchro supprimerait ${aSupprimer.length} ${unite} sur ${serveur.length} côté serveur. C'est le symptôme d'un navigateur qui a perdu ses données, pas d'un nettoyage. Rien n'a été envoyé.`
    : `${aEcrire.length} à écrire · ${aSupprimer.length} à supprimer · ${inchangees} inchangée(s).`;

  return { aEcrire, aSupprimer, inchangees, effacementMassif, resume };
}

export interface PlanGenerique<T> {
  aEcrire: T[];
  aSupprimer: string[];
  inchangees: number;
  effacementMassif: boolean;
  resume: string;
}

/**
 * Taille maximale d'un lot envoyé au serveur.
 *
 * Une fiche pèse ~3 Ko. 200 fiches font ~600 Ko de corps de requête, ce qui
 * passe partout ; 1 000 d'un coup se font refuser par les limites de
 * plateforme, et l'échec serait total au lieu d'être partiel.
 */
export const LOT_MAX = 200;

/** Découpe les écritures en lots envoyables. */
export function lots<T>(items: T[], taille = LOT_MAX): T[][] {
  if (taille <= 0) return items.length ? [items] : [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += taille) out.push(items.slice(i, i + taille));
  return out;
}

/**
 * Ce qui est RETIRÉ d'une fiche avant de partir vers le serveur.
 *
 * ⚠ Pas les coordonnées : elles restent, parce que la base est la NÔTRE et que
 * c'est `/api/v1/etat` qui les projette hors de la vue de l'agent. Les
 * supprimer ici rendrait la table inutilisable pour tout le reste (relances,
 * export, reprise après changement d'appareil).
 *
 * Ce qu'on retire, ce sont les PIÈCES JOINTES : un audit en base64 dans une
 * fiche pèse des mégaoctets, ne sert à rien à l'orchestrateur, et ferait
 * exploser la taille des lots. On garde leur nombre, pour que la fiche ne
 * mente pas sur ce qu'elle contient.
 */
export function allegerPourSync(p: Prospect): Prospect {
  const attachments = p.attachments ?? [];
  if (attachments.length === 0) return p;
  return {
    ...p,
    // `url` porte soit un chemin de stockage Supabase (léger, on le garde),
    // soit une data URL complète en base64 (lourde, on la coupe). Le nom, la
    // taille et la date restent : la fiche continue de dire ce qu'elle a.
    attachments: attachments.map((a) =>
      a.url?.startsWith("data:") ? { ...a, url: undefined } : a
    ),
  };
}

export interface ResultatSync {
  ok: boolean;
  ecrites: number;
  supprimees: number;
  /** Message à afficher — succès comme échec. */
  message: string;
}

/**
 * L'état de la synchro, tel qu'il s'affiche.
 *
 * `jamais` est un état distinct de `erreur` : « pas encore synchronisé » et
 * « la synchro a échoué » demandent deux gestes différents, et les confondre
 * fait chercher une panne là où il n'y a qu'un interrupteur éteint.
 */
export type EtatSync = "jamais" | "a-jour" | "en-retard" | "erreur" | "desactivee";

export function etatSync(i: {
  active: boolean;
  derniereSync?: string;
  derniereErreur?: string;
  aEcrire: number;
  aSupprimer: number;
}): { etat: EtatSync; message: string } {
  if (!i.active) {
    return {
      etat: "desactivee",
      message:
        "Synchro désactivée. Le pipe reste dans ce navigateur : l'orchestrateur ne voit rien, et rien n'est récupérable depuis un autre appareil.",
    };
  }
  if (i.derniereErreur) return { etat: "erreur", message: i.derniereErreur };
  if (!i.derniereSync) {
    return { etat: "jamais", message: "Jamais synchronisé — le serveur ne voit encore rien du pipe." };
  }
  const enAttente = i.aEcrire + i.aSupprimer;
  if (enAttente > 0) {
    return { etat: "en-retard", message: `${enAttente} changement(s) en attente d'envoi.` };
  }
  return { etat: "a-jour", message: `À jour — dernière synchro ${new Date(i.derniereSync).toLocaleString("fr-FR")}.` };
}

/**
 * Le propriétaire des lignes écrites côté serveur.
 *
 * Même convention que la table `propositions` : les lignes du serveur
 * appartiennent à « operateur », pas à un utilisateur Supabase authentifié.
 * C'est ce qui permet au service role d'écrire sans session, et à
 * `/api/v1/etat` de ne lire QUE ce périmètre au lieu de balayer la table
 * entière — ce qu'il faisait, et qui aurait mélangé les locataires le jour où
 * il y en a deux.
 */
export const PROPRIETAIRE_OPERATEUR = "operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA FORME D'UNE LIGNE `prospects` — écrite ici, lue ici, nulle part ailleurs.
 *
 * ⚠ ELLE ÉTAIT DÉFINIE DEUX FOIS, ET RIEN NE LES TENAIT ENSEMBLE.
 * `/api/sync/prospects` construisait `{ id, proprietaire, data: p }` en dur
 * dans la route ; `lib/lecture-serveur.ts` dépliait `(r as { data: Prospect }).data`
 * de son côté. Les deux s'accordaient — par inspection, pas par construction.
 *
 * C'est précisément la configuration que ce dépôt s'interdit : deux endroits
 * qui posent la même question. Le jour où quelqu'un éclate `data` en colonnes
 * (les colonnes générées `stage`, `sector`, `company` existent déjà et donnent
 * envie), ou passe la lecture en `select("*")`, l'écriture et la lecture
 * divergent **sans que rien n'échoue** : l'autopilote lit des `undefined` et
 * rend `ok: true` sur zéro appel. Exactement le mode de panne qu'on ne voit
 * pas.
 *
 * Les deux fonctions ci-dessous sont l'aller et le retour de la MÊME forme, et
 * `tests/sync-prospects.test.ts` les fait tourner l'une dans l'autre.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface LigneProspect {
  id: string;
  proprietaire: string;
  data: Prospect;
}

/** Aller : la fiche telle qu'elle s'écrit en base. */
export function ligneProspect(p: Prospect): LigneProspect {
  return { id: p.id, proprietaire: PROPRIETAIRE_OPERATEUR, data: p };
}

/**
 * Retour : la fiche telle qu'elle se relit.
 *
 * ⚠ Rend `null` plutôt que de jeter. Une ligne malformée — écrite par une
 * version antérieure, ou par une main dans le SQL Editor — ne doit pas faire
 * tomber le tick entier : elle doit être ignorée pendant que les autres
 * fiches partent. Une exception ici arrêterait toute la campagne du jour pour
 * une ligne abîmée.
 */
export function prospectDepuisLigne(row: unknown): Prospect | null {
  if (!row || typeof row !== "object") return null;
  const data = (row as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const p = data as Prospect;
  return typeof p.id === "string" && p.id.trim() ? p : null;
}
