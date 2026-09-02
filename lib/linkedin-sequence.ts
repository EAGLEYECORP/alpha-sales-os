import type { Prospect } from "./types";
import { LINKEDIN_INVITE_LIMIT } from "./linkedin";
import { verticalForProspect } from "./playbook";
// Le critère, la question et le signal d'audit viennent de l'aimant routé —
// la même source que l'email, pour que les deux canaux ne se contredisent pas.
import { approcheEcrite } from "./approche-ecrite";

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
export function messageText(p: Prospect, bookingUrl?: string, accountId?: string): string {
  const hi = firstName(p) ? `Bonjour ${firstName(p)},` : "Bonjour,";
  /**
   * ⚠ CES TROIS PHRASES ÉTAIENT ÉCRITES EN DUR, ET DUPLIQUÉES MOT POUR MOT
   * DANS `mail-compose.ts`. Elles annonçaient toutes l'angle Alpha Voice —
   * « le téléphone est le premier point de contact », « un audit de son
   * accueil téléphonique » — quel que soit le routage de la fiche.
   *
   * Sur un prospect classé « invisible en ligne », le message proposait donc
   * un audit téléphonique pendant que l'aimant réellement servi s'appelle
   * « Audit de votre visibilité locale ». Et corriger un des deux fichiers
   * laissait l'autre mentir.
   */
  const a = approcheEcrite(p, accountId);
  const booking = bookingUrl?.trim()
    ? ["", `Mon agenda est ouvert si vous voulez en parler un jour : ${bookingUrl.trim()}`]
    : [];
  return [
    `${hi}`,
    ``,
    `Merci pour la connexion. Je vais être direct et court.`,
    ``,
    `Je n'écris pas au hasard : je travaille avec ${a.critere}. ${a.critereMetier ?? ""}`.trim(),
    ``,
    `Une seule question, celle qui m'intéresse vraiment : ${a.question}`,
    ...(a.signal ? [``, a.signal] : []),
    ...booking,
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
    `Je ne relancerai pas : vous savez où me trouver si le sujet revient un jour. Bonne continuation à ${p.company}.`,
    ``,
    `Zakaria — EAGLEYE CORP`,
  ].join("\n");
}

export function textForStep(p: Prospect, step: LinkedinStep, bookingUrl?: string, accountId?: string): string {
  if (step === "invitation") return inviteText(p);
  if (step === "message") return messageText(p, bookingUrl);
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
export function buildLinkedinQueue(
  prospects: Prospect[],
  // Le compte décide des aimants disponibles, donc de ce que le message a le
  // droit d'annoncer. Absent, on retombe sur EAGLEYE.
  filter?: { city?: string; bookingUrl?: string; accountId?: string }
): LinkedinTarget[] {
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
      return {
        prospect: p,
        step,
        touches,
        lastTouchDays,
        text: textForStep(p, step, filter?.bookingUrl, filter?.accountId),
        ready,
        waitDays,
      };
    })
    .sort((a, b) => {
      // Les mûrs d'abord, puis l'étape la plus avancée (on finit ce qu'on a commencé).
      if (a.ready !== b.ready) return Number(b.ready) - Number(a.ready);
      return b.touches - a.touches;
    });
}
