import type { Prospect } from "./types";
import { heat } from "./closer";
import { stageById } from "./hormozi";
import { VERTICALS, type VerticalPlaybook, verticalForProspect } from "./playbook";

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
export function callAngle(p: Prospect, v: VerticalPlaybook | null, daysSince: number | null): { angle: string; hot: boolean } {
  const d = p.deepAudit;

  // 1. Une objection bloquante ouverte : c'est LE sujet de l'appel.
  const blocking = p.objections.find((o) => o.status === "bloquante");
  if (blocking) {
    return { angle: `Objection bloquante ouverte : « ${blocking.label} ». L'appel sert à l'isoler, pas à re-pitcher.`, hot: true };
  }

  // 2. Un next step daté dépassé : la promesse n'a pas été tenue.
  if (p.nextStep && new Date(p.nextStep.date).getTime() < Date.now()) {
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
  if (d.googleRating !== undefined && d.googleRating >= 4.7 && (d.googleReviews ?? 0) >= 80) {
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

/** Construit la session : la verticale, puis les cibles triées. */
export function buildCallSession(prospects: Prospect[], verticalId: string): { vertical: VerticalPlaybook | null; targets: CallTarget[] } {
  const vertical = VERTICALS.find((v) => v.id === verticalId) ?? null;

  const targets = prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .filter((p) => {
      if (!vertical) return true;
      const own = verticalForProspect(p);
      return own?.id === vertical.id;
    })
    .map((p) => {
      const last = lastContactAt(p);
      const daysSinceContact = last === null ? null : Math.floor((Date.now() - last) / DAY);
      const { angle, hot } = callAngle(p, vertical, daysSinceContact);
      return { prospect: p, heat: heat(p), angle, hot, daysSinceContact };
    })
    .sort((a, b) => Number(b.hot) - Number(a.hot) || b.heat - a.heat);

  return { vertical, targets };
}

/** Les verticales qui ont réellement des cibles — pour les onglets. */
export function verticalsWithTargets(prospects: Prospect[]): { vertical: VerticalPlaybook; count: number }[] {
  const open = prospects.filter((p) => p.stage !== "signe" && p.stage !== "perdu");
  return VERTICALS.map((vertical) => ({
    vertical,
    count: open.filter((p) => verticalForProspect(p)?.id === vertical.id).length,
  })).filter((x) => x.count > 0);
}
