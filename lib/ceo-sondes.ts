import type { EtatSysteme } from "./alpha-ceo";
import type { EtatHydratation } from "./hydratation";
import { peutSynchroniser } from "./hydratation";
import type { StorageLevel } from "./storage-health";
import type { CampaignDraft, Prospect } from "./types";
import { PLAFOND_SOLLICITATIONS_B2C, cibleDepuisProspect, plafondRappels } from "./call-cadence";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES SONDES D'ALPHA CEO — le branchement, séparé de l'écran.
 *
 * `lib/alpha-ceo.ts` sait DIAGNOSTIQUER un `EtatSysteme`. Il ne sait pas d'où
 * viennent ses champs, et c'est voulu : il ne contient aucun `fetch`, aucun
 * `process.env`, et un test l'interdit. Ce module est l'autre moitié — celle
 * qui remplit l'état à partir des vraies sondes.
 *
 * ⚠ POURQUOI CE N'EST PAS ÉCRIT DANS LA PAGE. Le défaut le plus fréquent de
 * ce dépôt est « un mécanisme juste, branché nulle part ». Le corollaire moins
 * visible est celui-ci : un branchement écrit DANS un composant client n'est
 * testable par rien. Personne ne peut vérifier que la réponse tronquée de
 * `/api/health` produit bien `null` et pas `false` — et c'est exactement le
 * genre d'erreur qui allume une alerte rouge permanente sur une installation
 * saine, jusqu'à ce qu'on apprenne à ne plus lire l'écran.
 *
 * ⚠⚠ LE PIÈGE CENTRAL DE CE FICHIER, ET IL EST RÉEL.
 *
 * `GET /api/health` ne rend le DÉTAIL qu'au porteur du cookie d'accès. Sans
 * lui, la réponse est `{ ok: true, checkedAt }` — un 200 parfaitement valide,
 * sans `capabilities`. Lire `capabilities?.email?.configured` avec un
 * `Boolean(...)` autour rendrait donc `false` : « le SMTP est cassé »,
 * affirmé sur une sonde qu'on n'a jamais eu le droit de lire.
 *
 * `false` déclenche une alerte. `null` n'en déclenche aucune et se DIT comme
 * angle mort. La distinction entre les deux est toute la valeur du module de
 * diagnostic ; c'est ici qu'elle se perd si on n'y fait pas attention.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * La forme MINIMALE de `/api/health` dont Alpha CEO a besoin.
 *
 * Tout est optionnel, et pas par laxisme : la route rend réellement deux
 * formes différentes selon le cookie d'accès. Un type qui promettrait
 * `capabilities` mentirait au premier déploiement protégé par mot de passe.
 */
export interface ReponseSante {
  ok?: boolean;
  capabilities?: {
    email?: { configured?: boolean };
    billing?: { prices?: boolean };
  };
}

/** La part de `/api/voice/presence` dont Alpha CEO a besoin. */
export interface ReponsePresence {
  etat?: "vivant" | "silencieux" | "inconnu";
}

/** La part de `/api/moniteur` dont Alpha CEO a besoin. */
export interface ReponseMoniteur {
  autopilote?: "arme" | "simulation" | "non-configure";
}

export interface EntreeSondes {
  /** La réponse de `/api/health`. `null` = pas encore revenue, ou en échec. */
  sante: ReponseSante | null;
  /** Niveau rendu par `analyseStorage`. `null` = non mesurable (SSR, navigation privée). */
  stockage: StorageLevel | null;
  /** Le réglage `pipeServeur` est-il actif ? */
  pipeServeur: boolean;
  hydratation: EtatHydratation;
  brouillons: CampaignDraft[];
  prospects: Prospect[];
  /** Un palier de campagne est-il `pret` sans avoir été validé ? */
  palierPret: boolean;
  /** La réponse de `/api/moniteur`. `null` = pas revenue, ou en échec. */
  moniteur: ReponseMoniteur | null;
  /** La réponse de `/api/voice/presence`. `null` = pas revenue, ou en échec. */
  presence: ReponsePresence | null;
}

/**
 * Un booléen de sonde, ou `null` quand la sonde n'a pas répondu.
 *
 * ⚠ `Boolean(v)` ici serait le bug : il transforme « je n'ai pas la réponse »
 * en « la réponse est non ». On exige le TYPE, pas la véracité.
 */
function lireBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/**
 * Les fiches encore vivantes. Une fiche signée ou perdue n'a plus de prochaine
 * action à avoir — la compter gonflerait l'alerte d'un chiffre qu'aucun geste
 * ne fait baisser, ce qui est la définition d'une alerte qu'on apprend à
 * ignorer.
 */
export function fichesActives(prospects: Prospect[]): Prospect[] {
  return prospects.filter((p) => p.stage !== "signe" && p.stage !== "perdu");
}

/** Le nombre de fiches vivantes sans prochaine action DATÉE. */
export function sansProchaineAction(prospects: Prospect[]): number {
  // ⚠ La date, pas l'action : « rappeler » sans date ne se déclenche jamais.
  // C'est la même règle que `vital-signs` (`nextStepDated`), et elle doit
  // répondre pareil des deux côtés.
  return fichesActives(prospects).filter((p) => !p.nextStep?.date).length;
}

/**
 * L'état système, assemblé depuis les sondes réelles.
 *
 * C'est le seul endroit où l'on décide comment chaque champ se lit. Deux
 * lectures du même signal finiraient par diverger, et l'écran de diagnostic
 * est le pire endroit possible pour une divergence : il ne planterait pas, il
 * MENTIRAIT.
 */
export function etatDepuisSondes(e: EntreeSondes): EtatSysteme {
  const caps = e.sante?.capabilities;

  return {
    smtpConfigure: lireBool(caps?.email?.configured),
    prixStripeConfigures: lireBool(caps?.billing?.prices),
    stockage: e.stockage,
    /**
     * ⚠ `null` QUAND LE MODE N'EST PAS ACTIF, et ce n'est pas de la prudence
     * décorative. Hors mode serveur, `hydratation` vaut `locale` et
     * `peutSynchroniser` rend vrai — on afficherait donc « le pipe est
     * synchronisable » à quelqu'un qui n'a aucun pipe serveur. Un voyant vert
     * sur un organe absent est pire qu'un voyant éteint.
     */
    pipeSynchronisable: e.pipeServeur ? peutSynchroniser(e.hydratation) : null,
    // Seuls les brouillons EN ATTENTE demandent une main. Les approuvés,
    // envoyés, ignorés ou en erreur ont déjà eu leur décision.
    brouillonsEnAttente: e.brouillons.filter((d) => d.status === "pending").length,
    fichesSansProchaineAction: sansProchaineAction(e.prospects),
    palierEnAttente: e.palierPret,
    /**
     * ⚠ Même piège que `/api/health` : une réponse absente n'est pas « il ne
     * tourne pas », c'est « on n'a pas regardé ». Une valeur inconnue non plus
     * — un état futur qu'on ne saurait pas lire ne doit pas se faire passer
     * pour l'un des trois qu'on connaît.
     */
    autopilote:
      e.moniteur?.autopilote === "arme" ||
      e.moniteur?.autopilote === "simulation" ||
      e.moniteur?.autopilote === "non-configure"
        ? e.moniteur.autopilote
        : null,
    /**
     * ⚠ Même discipline que l'autopilote : une réponse absente n'est PAS
     * « l'agent est mort », et un état qu'on ne saurait pas lire ne doit pas
     * se faire passer pour l'un des trois connus.
     *
     * ⚠⚠ Et `inconnu` n'est pas `null`. `inconnu` est une réponse : le serveur
     * a répondu et dit qu'aucun agent ne s'est jamais annoncé — c'est une
     * information, et elle vaut REFUS de composer. `null` veut dire qu'on n'a
     * pas pu demander. Les fondre ferait disparaître la panne la plus chère
     * du relevé le jour où la sonde tombe.
     */
    agentVocal:
      e.presence?.etat === "vivant" || e.presence?.etat === "silencieux" || e.presence?.etat === "inconnu"
        ? e.presence.etat
        : null,
    ciblesAuPlafond: ciblesAuPlafond(e.prospects),
  };
}

/** Les canaux qui comptent comme une SOLLICITATION au sens du décret. */
const CANAUX_SOLLICITATION = new Set(["appel", "email", "whatsapp", "linkedin"]);

/** La fenêtre du décret n° 2022-1313 : 30 jours GLISSANTS. */
export const FENETRE_DECRET_MS = 30 * 86_400_000;

/**
 * Combien de fiches ont atteint le plafond de 4 sollicitations sur 30 jours.
 *
 * ⚠⚠ CETTE PANNE ÉTAIT DÉCRITE ET NON SURVEILLÉE, et sa propre fiche disait
 * pourquoi : « chaque appel pris isolément est légitime, c'est le CUMUL qui
 * dépasse, et personne ne compte de tête sur trente jours ». `plafondRappels`
 * arbitre un appel à venir ; il ne regarde jamais en arrière. Personne ne
 * comptait.
 *
 * ⚠ LES CANAUX SONT ÉNUMÉRÉS, PAS DÉDUITS. Une `visite`, une `demo`, un
 * `meeting` sont des rendez-vous ACCEPTÉS — les compter comme sollicitations
 * ferait dépasser le plafond au client le plus engagé, c'est-à-dire
 * exactement celui qu'on veut pouvoir rappeler. `note`, `stage` et `offre`
 * sont des écritures internes : elles ne touchent personne.
 *
 * ⚠ GLISSANT, pas calendaire. Un mois civil autoriserait quatre sollicitations
 * le 31 et quatre le 1er — huit en deux jours, le schéma exact que le décret
 * vise.
 */
export function ciblesAuPlafond(prospects: Prospect[], maintenant: Date = new Date()): number {
  const depuis = maintenant.getTime() - FENETRE_DECRET_MS;
  let n = 0;
  for (const p of prospects) {
    /**
     * ⚠ LE PLAFOND NE VAUT QUE SUR LES CIBLES SANS SIREN — c'est `plafondRappels`
     * qui le dit, et la question ne se pose qu'à UN endroit. Une entreprise
     * inscrite au registre est hors du champ du décret ; la compter ici ferait
     * une alerte permanente que rien ne fait baisser.
     */
    const { plafonne } = plafondRappels(cibleDepuisProspect(p));
    if (!plafonne) continue;

    const sollicitations = p.events.filter((ev) => {
      if (!CANAUX_SOLLICITATION.has(ev.kind)) return false;
      const t = new Date(ev.date).getTime();
      // Une date illisible ne COMPTE PAS : inventer une sollicitation ferait
      // bloquer un recontact légitime.
      return Number.isFinite(t) && t >= depuis;
    }).length;

    if (sollicitations >= PLAFOND_SOLLICITATIONS_B2C) n++;
  }
  return n;
}
