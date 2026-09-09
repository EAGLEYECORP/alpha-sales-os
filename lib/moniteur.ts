import { PENDING_MARK } from "./call-outcome";
import { INTERET_DANS_LE_RESUME, REPONSE_DANS_LE_RESUME } from "./call-cadence";
import type { Prospect, TimelineEvent } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MONITEUR — ce que la machine a RÉELLEMENT fait, vu du téléphone.
 *
 * ══ POURQUOI IL LIT LE SERVEUR, ET JAMAIS LE NAVIGATEUR ══
 *
 * L'app est local-first : le store vit dans le `localStorage`. Un téléphone et
 * un ordinateur sont donc deux navigateurs, donc DEUX Alpha différents. Et
 * l'autopilote, lui, ne tourne ni dans l'un ni dans l'autre : il tourne sur le
 * serveur, déclenché par `pg_cron`, et il écrit dans Supabase.
 *
 * Un moniteur qui lirait le store afficherait donc ce que CE navigateur croit
 * savoir — c'est-à-dire tout sauf le travail de la machine. Il montrerait zéro
 * appel pendant que le cron en passe quarante, et personne ne comprendrait
 * pourquoi. La seule source qui a la vérité est celle qui a été écrite par
 * celui qui a agi.
 *
 * ══ LA RÈGLE QUI TIENT TOUT LE MODULE ══
 *
 * ⚠ ZÉRO DONNÉE → ZÉRO CHIFFRE. `prospects: null` (Supabase absent, lecture en
 * échec) n'est PAS une liste vide. Le premier veut dire « je ne vois rien », le
 * second « il n'y a rien » — deux situations opposées qui mènent à deux gestes
 * opposés. Rendre `0` dans le premier cas afficherait un tableau de bord calme
 * sur une machine aveugle, et c'est le pire état possible pour un écran qu'on
 * consulte vingt fois par jour.
 *
 * Tous les compteurs sont donc `number | null`, et l'angle mort se DIT.
 * ─────────────────────────────────────────────────────────────────────
 */

export type EtatAutopilote =
  /** `CAMPAIGN_AUTOPILOT=on` : les appels partent pour de vrai. */
  | "arme"
  /** Tout est branché sauf l'armement : la route rend ce qu'elle AURAIT fait. */
  | "simulation"
  /** Il manque le secret ou la base : rien ne tourne, et ce n'est pas un bug. */
  | "non-configure";

/**
 * UNE tentative écrite par le ROBOT, jamais par l'humain.
 *
 * ⚠ LA DISTINCTION N'EST PAS COSMÉTIQUE. Si on comptait tous les événements
 * `appel`, l'écran annoncerait « la machine a passé 20 appels » un jour où
 * l'opérateur en a passé 20 à la main et le cron aucun. On croirait
 * l'autopilote en marche alors qu'il n'a jamais démarré — exactement la panne
 * silencieuse que ce module existe pour rendre visible.
 *
 * Le discriminant est le préfixe d'identifiant posé par `appendCallAttempt`
 * (`lib/campaign-tick.ts`), et un test vérifie que les deux ne divergent pas :
 * changer le format d'identifiant là-bas ferait tomber ce moniteur à zéro,
 * en silence.
 */
export const PREFIXE_AUTO = "auto-";

export function estTentativeAuto(e: TimelineEvent): boolean {
  return e.kind === "appel" && e.id.startsWith(PREFIXE_AUTO);
}

/** Une fiche montrée à l'écran. Aucune coordonnée : on ne joint personne d'ici. */
export interface FicheMoniteur {
  id: string;
  company: string;
  /** ISO de l'événement qui la fait remonter. */
  quand: string;
  resume: string;
}

export interface EntreeMoniteur {
  /** `null` = le serveur ne voit RIEN. Distinct d'une liste vide. */
  prospects: Prospect[] | null;
  autopilote: EtatAutopilote;
  /** Ce que le runner dit de la fenêtre d'appel. `null` = non calculé. */
  fenetre: { ouverte: boolean; pourquoi: string } | null;
  /** Taille de la file après toutes les portes. `null` = non calculée. */
  fileAttente: number | null;
  /** Plafond du palier courant. `null` = plus de bornage par palier. */
  plafondPalier: number | null;
  /** Appels cumulés déjà composés, tels que le runner les compte. */
  composesTotal: number | null;
  maintenant: Date;
}

export interface EtatMoniteur {
  source: "serveur" | "aucune";
  /** Ce qu'on ne voit pas, dit en clair. `null` quand on voit. */
  angleMort: string | null;
  autopilote: EtatAutopilote;
  /** La phrase d'état, écrite pour être lue d'un pouce. */
  phraseAutopilote: string;
  /** Tentatives automatiques depuis minuit. */
  tentativesDuJour: number | null;
  /** Composées automatiquement, résultat encore inconnu. */
  sansResultat: number | null;
  /** Fiches où quelqu'un a répondu — tous décrochés confondus. */
  ontRepondu: number | null;
  /**
   * Intérêt qualifié : un humain doit prendre le relais MAINTENANT.
   *
   * ⚠ C'est le seul cas qui mobilise quelqu'un. Un « non » ou un
   * « rappelez-moi » se traite et se consigne sans réveiller personne — c'est
   * ce qui rend le volume tenable.
   */
  demandentUneMain: FicheMoniteur[];
  fenetre: { ouverte: boolean; pourquoi: string } | null;
  fileAttente: number | null;
  plafondPalier: number | null;
  composesTotal: number | null;
  /** ISO de la dernière tentative automatique, tous jours confondus. */
  derniereActivite: string | null;
}

const PHRASES: Record<EtatAutopilote, string> = {
  arme: "Armé — les appels partent pour de vrai.",
  simulation:
    "En simulation — la machine calcule ce qu'elle ferait, et n'appelle personne. Il manque CAMPAIGN_AUTOPILOT=on, et c'est un geste délibéré.",
  "non-configure":
    "Pas configuré — il manque le secret du cron ou la base serveur. Rien ne tourne, et ce n'est pas une panne.",
};

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function etatMoniteur(e: EntreeMoniteur): EtatMoniteur {
  const socle = {
    autopilote: e.autopilote,
    phraseAutopilote: PHRASES[e.autopilote],
    fenetre: e.fenetre,
    fileAttente: e.fileAttente,
    plafondPalier: e.plafondPalier,
    composesTotal: e.composesTotal,
  };

  if (e.prospects === null) {
    return {
      ...socle,
      source: "aucune",
      angleMort:
        "Le serveur ne voit aucune fiche. Le CRM vit dans le navigateur tant que la synchro n'est pas activée — l'autopilote n'a donc rien à appeler, et cet écran ne peut rien mesurer.",
      tentativesDuJour: null,
      sansResultat: null,
      ontRepondu: null,
      demandentUneMain: [],
      derniereActivite: null,
    };
  }

  let tentativesDuJour = 0;
  let sansResultat = 0;
  let ontRepondu = 0;
  let derniereActivite: string | null = null;
  const demandentUneMain: FicheMoniteur[] = [];

  for (const p of e.prospects) {
    const autos = (p.events ?? []).filter(estTentativeAuto);
    if (autos.length === 0) continue;

    for (const ev of autos) {
      const d = new Date(ev.date);
      if (Number.isNaN(d.getTime())) continue;
      if (memeJour(d, e.maintenant)) tentativesDuJour++;
      if (!derniereActivite || ev.date > derniereActivite) derniereActivite = ev.date;
      // `PENDING_MARK` est la marque posée par le robot au moment de composer.
      // Tant qu'elle est là, le résultat n'est pas revenu — ce n'est ni un
      // échec ni un succès, et le compter comme l'un des deux serait inventer.
      if ((ev.summary ?? "").includes(PENDING_MARK)) sansResultat++;
    }

    /**
     * ⚠ L'ORDRE DES DEUX TESTS EST CELUI DE `lib/call-cadence.ts`, ET IL
     * COMPTE : `REPONSE_DANS_LE_RESUME` matche déjà « rdv obtenu ». Tester le
     * décroché d'abord ferait disparaître l'intérêt qualifié dans le tas des
     * simples décrochés — et plus personne ne serait réveillé.
     */
    const appels = (p.events ?? []).filter((ev) => ev.kind === "appel");
    const interet = appels.find((ev) => INTERET_DANS_LE_RESUME.test(ev.summary ?? ""));
    if (interet) {
      ontRepondu++;
      demandentUneMain.push({
        id: p.id,
        company: p.company,
        quand: interet.date,
        resume: interet.summary ?? "",
      });
      continue;
    }
    if (appels.some((ev) => REPONSE_DANS_LE_RESUME.test(ev.summary ?? ""))) ontRepondu++;
  }

  // Le plus récent d'abord : sur un téléphone, on lit trois lignes, pas trente.
  demandentUneMain.sort((a, b) => b.quand.localeCompare(a.quand));

  return {
    ...socle,
    source: "serveur",
    /**
     * ⚠ Une table VIDE n'est pas un angle mort — c'est une information. Mais
     * elle ne se lit pas comme « tout va bien » non plus : on le dit.
     */
    angleMort:
      e.prospects.length === 0
        ? "Le serveur répond, et la table est vide. Aucune fiche n'a encore été synchronisée : l'autopilote tournerait à vide."
        : null,
    tentativesDuJour,
    sansResultat,
    ontRepondu,
    demandentUneMain,
    derniereActivite,
  };
}
