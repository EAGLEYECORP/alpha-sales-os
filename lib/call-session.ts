import type { Prospect } from "./types";
import { heat } from "./closer";
import { stageById } from "./hormozi";
import { VERTICALS, type VerticalPlaybook, verticalForProspect } from "./playbook";
import { aRefuseTouteRelance } from "./voice-script";
import { ID_SCRIPT_OPERATEUR } from "./script-operateur";
import { exclusionPublique, momentFrais, phraseDuMoment, type ExclusionPublique } from "./signaux-publics";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Session d'appels — la « liste du matin », native.
 *
 * Reprend ce qui se faisait à la main dans des documents HTML jetables :
 * une verticale, un script, et une liste de prospects avec, pour chacun,
 * L'ANGLE — la raison précise de l'appeler lui, maintenant.
 *
 * Deux différences qui changent tout par rapport au document jetable :
 *  1. l'angle est calculé sur les VRAIES données de la fiche, pas
 *     retapé à la main pour chaque session ;
 *  2. le statut d'appel écrit dans le CRM (touche consignée, étape,
 *     next step) au lieu de disparaître au rechargement de la page.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CallTarget {
  prospect: Prospect;
  heat: number;
  /** La raison d'appeler celui-là, maintenant. Une phrase. */
  angle: string;
  /** Signal fort : à mettre en tête de liste. */
  hot: boolean;
  /** Jours depuis le dernier contact (null si jamais contacté). */
  daysSinceContact: number | null;
  /** Déjà appelé aujourd'hui — lu dans la timeline, donc vrai après un F5. */
  faitAujourdhui: boolean;
}

const DAY = 86_400_000;

function lastContactAt(p: Prospect): number | null {
  const dates = p.events
    .filter((e) => ["appel", "visite", "email", "whatsapp", "linkedin", "demo", "meeting"].includes(e.kind))
    .map((e) => new Date(e.date).getTime())
    .filter((t) => Number.isFinite(t));
  return dates.length ? Math.max(...dates) : null;
}

/**
 * L'angle : la phrase qui dit pourquoi celui-là, maintenant. Priorité
 * au signal le plus actionnable — jamais un chiffre € (interdit à froid,
 * cf. DOCTRINE_TERRAIN) ni la note Google prononcée telle quelle.
 */
export function callAngle(
  p: Prospect,
  v: VerticalPlaybook | null,
  daysSince: number | null,
  now: Date = new Date()
): { angle: string; hot: boolean } {
  const d = p.deepAudit;

  // 1. Une objection bloquante ouverte : c'est LE sujet de l'appel.
  const blocking = p.objections.find((o) => o.status === "bloquante");
  if (blocking) {
    return { angle: `Objection bloquante ouverte : « ${blocking.label} ». L'appel sert à l'isoler, pas à re-pitcher.`, hot: true };
  }

  // 2. Un next step daté dépassé : la promesse n'a pas été tenue.
  if (p.nextStep && new Date(p.nextStep.date).getTime() < now.getTime()) {
    return { angle: `Next step dépassé : « ${p.nextStep.action} ». Rappelle en assumant le retard, puis redate.`, hot: true };
  }

  // 3. Red Zone : l'offre est sur la table, il manque la décision.
  if (p.stage === "redzone") {
    return { angle: "Offre posée, décision en attente : l'appel sert à obtenir un oui ou un non, pas un « je réfléchis ».", hot: true };
  }

  // 4. Démo faite mais pas d'offre : la fenêtre se referme vite.
  if (p.stage === "demo") {
    return { angle: "Démo faite, offre pas encore présentée — la fenêtre se referme vite, appelle pendant que l'émotion est fraîche.", hot: true };
  }

  // 4 bis. Un MOMENT PUBLIC frais (annonce légale de moins de deux mois) :
  // nouvelle direction, déménagement, rachat… C'est la raison d'appeler
  // MAINTENANT plutôt que le mois prochain — et la phrase rappelle qu'on ne
  // la cite pas (`phraseDuMoment`). Derrière les étapes de l'affaire : une
  // offre sur la table compte plus qu'un changement de gérant.
  const moment = momentFrais(p, now);
  if (moment) {
    return { angle: phraseDuMoment(moment), hot: true };
  }

  // 5. Silence long après un contact : le rappel est le sujet.
  if (daysSince !== null && daysSince >= 14) {
    return { angle: `Sans contact depuis ${daysSince} jours. Reprends par ce qui s'est dit la dernière fois, pas par une nouvelle ouverture.`, hot: daysSince >= 30 };
  }

  // 6. Information critique manquante : l'appel sert à la récupérer.
  if (!p.phone?.trim()) {
    return { angle: "Pas de numéro en fiche — récupère-le sur la fiche Google avant d'appeler.", hot: false };
  }
  if (!d.currentProcess?.trim()) {
    return { angle: "Process actuel inconnu : deux questions de diagnostic suffisent à l'obtenir, puis tu te tais.", hot: false };
  }

  // 7. Signal réputation : le framing « on protège, on ne répare pas ».
  // ⚠ C'est un angle d'ALPHA VOICE (« ceux qui sonnent dans le vide »). Sur
  // le script d'un inscrit, qui vend autre chose, la note Google de son
  // prospect ne dit rien de son sujet : on ne l'en fait pas parler.
  if (v?.id !== ID_SCRIPT_OPERATEUR && d.googleRating !== undefined && d.googleRating >= 4.7 && (d.googleReviews ?? 0) >= 80) {
    return {
      angle: `Excellente réputation (${d.googleReviews} avis) : angle « on protège », jamais « on répare » — ceux qui sonnent dans le vide ne laissent pas d'avis.`,
      hot: false,
    };
  }

  // 8. Site absent ou muet : la douleur structurelle de la verticale.
  if (d.websiteState?.trim() && /aucun|absent|obsol|vitrine|muet/i.test(d.websiteState)) {
    return { angle: `Présence en ligne faible (${d.websiteState.slice(0, 60)}). Reste sur la douleur, pas sur le site.`, hot: false };
  }

  // 9. Repli : la douleur structurelle du métier.
  return {
    angle: v
      ? `${stageById(p.stage).label} · ${v.structuralPain.slice(0, 120)}…`
      : `${stageById(p.stage).label} · première conversation à ouvrir : permission, ciblage, diagnostic.`,
    hot: false,
  };
}

/**
 * Cette fiche a-t-elle DÉJÀ été appelée aujourd'hui ?
 *
 * La page d'appels gardait sa progression dans un `useState` — perdue au
 * rechargement, alors que son propre commentaire promettait le contraire.
 * Sur une session de cent numéros, un onglet fermé par erreur faisait
 * recommencer la liste à zéro, dans le même ordre, sans marquer les faits.
 *
 * La vraie source est la timeline : un appel consigné aujourd'hui EST la
 * preuve qu'on l'a fait. On la relit au lieu de la mémoriser deux fois.
 */
export function appeleAujourdhui(p: Prospect, now: Date = new Date()): boolean {
  const jour = now.toISOString().slice(0, 10);
  return (p.events ?? []).some((e) => e.kind === "appel" && (e.date ?? "").slice(0, 10) === jour);
}

/**
 * Une fiche entre-t-elle dans la file ? UNE définition, lue par la file et par
 * ses onglets (sinon l'onglet annonce « 12 » et la liste en montre 11).
 * Ne la reçoivent pas : l'affaire close, le refus de toute relance, et la
 * société qu'une annonce légale écarte (`lib/signaux-publics.ts`).
 */
export function dansLaFile(p: Prospect): boolean {
  return p.stage !== "signe" && p.stage !== "perdu" && !aRefuseTouteRelance(p) && !exclusionPublique(p);
}

/** Une fiche que l'annonce légale a sortie de la file — comptée et nommée, jamais tue. */
export interface FicheEcartee {
  prospect: Prospect;
  exclusion: ExclusionPublique;
}

/**
 * Construit la session : la verticale, puis les cibles triées.
 *
 * ⚠ DEUX RÔLES QUI ÉTAIENT CONFONDUS. `vertical` (le métier du PROSPECT)
 * regroupe la file et porte les leçons du terrain. `script` (ce que DIT
 * l'appelant) n'est la même chose que pour le compte maître : un inscrit vend
 * son offre, pas la nôtre (`lib/script-operateur.ts`). Sans ce second
 * paramètre, l'angle de chaque ligne reprenait la douleur de NOTRE pitch.
 */
export function buildCallSession(
  prospects: Prospect[],
  verticalId: string,
  now: Date = new Date(),
  scriptServi?: VerticalPlaybook | null
): { vertical: VerticalPlaybook | null; script: VerticalPlaybook | null; targets: CallTarget[]; ecartees: FicheEcartee[] } {
  const vertical = VERTICALS.find((v) => v.id === verticalId) ?? null;
  const script = scriptServi === undefined ? vertical : scriptServi;
  const duMetier = (p: Prospect) => !vertical || verticalForProspect(p)?.id === vertical.id;

  // ⚠ Les écartées se comptent dans la MÊME verticale que la file : sinon
  // l'onglet « restauration » annoncerait les liquidations des garages.
  const ecartees: FicheEcartee[] = prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu" && duMetier(p))
    .flatMap((p) => {
      const exclusion = exclusionPublique(p);
      return exclusion ? [{ prospect: p, exclusion }] : [];
    });

  const targets = prospects
    // Il a dit « ne plus m'appeler » : la fiche revenait dans la file le
    // lendemain matin, comme si de rien n'était. Une société en liquidation,
    // pareil — elle ne pourra pas payer, et l'appel le lui rappellerait.
    .filter(dansLaFile)
    .filter(duMetier)
    .map((p) => {
      const last = lastContactAt(p);
      const daysSinceContact = last === null ? null : Math.floor((now.getTime() - last) / DAY);
      const { angle, hot } = callAngle(p, script, daysSinceContact, now);
      return { prospect: p, heat: heat(p), angle, hot, daysSinceContact, faitAujourdhui: appeleAujourdhui(p, now) };
    })
    // Les fiches déjà traitées aujourd'hui descendent, elles ne disparaissent
    // pas : on doit pouvoir corriger un statut mal cliqué. Mais on travaille
    // toujours depuis le haut, et le compteur « restants » redevient juste.
    .sort(
      (a, b) =>
        Number(a.faitAujourdhui) - Number(b.faitAujourdhui) ||
        Number(b.hot) - Number(a.hot) ||
        b.heat - a.heat
    );

  return { vertical, script, targets, ecartees };
}

/** Les verticales qui ont réellement des cibles — pour les onglets. */
export function verticalsWithTargets(prospects: Prospect[]): { vertical: VerticalPlaybook; count: number }[] {
  // Même filtre que la file elle-même : sans ça, l'onglet annonce « 12 » et
  // la liste en montre 11, ce qui donne l'impression d'un bug d'affichage.
  const open = prospects.filter(dansLaFile);
  return VERTICALS.map((vertical) => ({
    vertical,
    count: open.filter((p) => verticalForProspect(p)?.id === vertical.id).length,
  })).filter((x) => x.count > 0);
}
