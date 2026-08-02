import type { Prospect } from "./types";
import { LINKEDIN_INVITE_LIMIT } from "./linkedin";
import { verticalForProspect } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Séquence LinkedIn — campagne « ALPHA SALES TEST 1 »
 * SCINTIA × EAGLEYE CORP · Lyon 6e
 *
 * Positionnement : c'est EAGLEYE (Zakaria) qui parle et qui offre
 * l'audit ; SCINTIA est la solution qu'on installe ensuite. L'audit
 * n'est jamais envoyé d'office — il est PROPOSÉ, et n'arrive qu'après
 * un oui. C'est ce qui distingue une newsletter d'un spam.
 *
 * Cadence volontairement lente (invitation → J+2 message → J+4 relance)
 * et plafonnée par LINKEDIN_DAILY_SAFE : le profil est un actif, on ne
 * le grille pas pour trois touches de plus.
 * ─────────────────────────────────────────────────────────────────────
 */

export type LinkedinStep = "invitation" | "message" | "relance" | "termine";

export const STEP_LABEL: Record<LinkedinStep, string> = {
  invitation: "1 · Invitation",
  message: "2 · Message",
  relance: "3 · Relance",
  termine: "Séquence terminée",
};

/** Délai minimum avant la touche suivante (jours). */
const DELAY: Record<LinkedinStep, number> = { invitation: 0, message: 2, relance: 4, termine: 0 };

const firstName = (p: Prospect) => (p.name || "").trim().split(/\s+/)[0] || "";

/**
 * L'invitation : ≤ 300 caractères, un critère, zéro pitch, zéro chiffre.
 * On ne vend rien ici — on demande la connexion, c'est tout.
 */
export function inviteText(p: Prospect): string {
  const v = verticalForProspect(p);
  const who = firstName(p) ? `Bonjour ${firstName(p)}, ` : "Bonjour, ";
  const metier = v ? v.label.toLowerCase().split("—")[0].trim() : "votre métier";
  // Le secteur géographique vient de la FICHE, jamais d'un arrondissement
  // codé en dur : un message qui se trompe de quartier se grille seul.
  const zone = p.city?.trim() ? ` à ${p.city.trim()}` : " à Lyon";
  const t = `${who}je suis Zakaria, d'EAGLEYE CORP. Je travaille avec les ${metier}${zone} sur un sujet précis : les appels qui arrivent quand personne ne peut les prendre. Je publie mes observations terrain — content d'échanger si le sujet vous parle.`;
  return t.length <= LINKEDIN_INVITE_LIMIT ? t : t.slice(0, LINKEDIN_INVITE_LIMIT - 1) + "…";
}

/**
 * Le message post-connexion : le critère, UNE question de diagnostic,
 * et la proposition d'audit — proposée, jamais imposée.
 */
export function messageText(p: Prospect): string {
  const v = verticalForProspect(p);
  const hi = firstName(p) ? `Bonjour ${firstName(p)},` : "Bonjour,";
  const diag = v?.diagnostic[0] ?? "Quand tout le monde est occupé et que le téléphone sonne, il se passe quoi chez vous ?";
  return [
    `${hi}`,
    ``,
    `Merci pour la connexion. Je vais être direct et court.`,
    ``,
    `Je n'écris pas au hasard : je travaille avec les métiers où le téléphone est le premier point de contact et où personne n'est dédié à le prendre. ${v ? v.criterion : ""}`.trim(),
    ``,
    `Une seule question, celle qui m'intéresse vraiment : ${diag}`,
    ``,
    `Si le sujet vous parle, je prépare pour ${p.company} un audit de votre accueil téléphonique — ce que vous captez, ce qui vous échappe, et ce que ça représente. C'est offert et il est à vous, avec ou sans suite. Dites-moi juste « oui » et je vous l'envoie.`,
    ``,
    `Zakaria — EAGLEYE CORP, Lyon`,
  ].join("\n");
}

/**
 * La relance : le coup du méta appliqué à l'écrit — on assume le
 * silence, on ne culpabilise pas, et on ferme sur un choix binaire.
 */
export function relanceText(p: Prospect): string {
  const hi = firstName(p) ? `${firstName(p)},` : "Bonjour,";
  return [
    `${hi}`,
    ``,
    `Pas de réponse et c'est très bien — vous êtes sur le terrain, pas sur LinkedIn. C'est exactement le problème dont je parlais.`,
    ``,
    `Je clos proprement : je vous envoie l'audit de ${p.company} ou je vous laisse tranquille ?`,
    ``,
    `Un mot suffit. Zakaria — EAGLEYE CORP`,
  ].join("\n");
}

export function textForStep(p: Prospect, step: LinkedinStep): string {
  if (step === "invitation") return inviteText(p);
  if (step === "message") return messageText(p);
  if (step === "relance") return relanceText(p);
  return "";
}

export interface LinkedinTarget {
  prospect: Prospect;
  step: LinkedinStep;
  /** Touches LinkedIn déjà consignées sur la fiche. */
  touches: number;
  lastTouchDays: number | null;
  text: string;
  /** Le délai de cadence est respecté : on peut envoyer maintenant. */
  ready: boolean;
  /** Jours restants avant que la touche soit permise. */
  waitDays: number;
}

const DAY = 86_400_000;

function linkedinEvents(p: Prospect) {
  return p.events
    .filter((e) => e.kind === "linkedin")
    .map((e) => new Date(e.date).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
}

/**
 * Construit la file du jour : qui en est où dans la séquence, et qui
 * est réellement « mûr » (cadence respectée).
 */
export function buildLinkedinQueue(prospects: Prospect[], filter?: { city?: string }): LinkedinTarget[] {
  const city = filter?.city?.trim().toLowerCase();

  return prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .filter((p) => (city ? p.city.toLowerCase().includes(city) : true))
    .map((p) => {
      const evts = linkedinEvents(p);
      const touches = evts.length;
      const step: LinkedinStep = touches === 0 ? "invitation" : touches === 1 ? "message" : touches === 2 ? "relance" : "termine";
      const lastTouchDays = evts.length ? Math.floor((Date.now() - evts[0]) / DAY) : null;
      const needed = DELAY[step];
      const ready = step !== "termine" && (lastTouchDays === null || lastTouchDays >= needed);
      const waitDays = ready || step === "termine" ? 0 : Math.max(0, needed - (lastTouchDays ?? 0));
      return { prospect: p, step, touches, lastTouchDays, text: textForStep(p, step), ready, waitDays };
    })
    .sort((a, b) => {
      // Les mûrs d'abord, puis l'étape la plus avancée (on finit ce qu'on a commencé).
      if (a.ready !== b.ready) return Number(b.ready) - Number(a.ready);
      return b.touches - a.touches;
    });
}
