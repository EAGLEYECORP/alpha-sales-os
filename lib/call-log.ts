/**
 * ─────────────────────────────────────────────────────────────────────
 * Sessions d'appel EN COURS + transcription — l'historique de conversation.
 *
 * Ce que l'agent vocal (voice/agent.py) pousse ici, en direct :
 *   · le début d'une session (room LiveKit, prospect, direction) ;
 *   · chaque TOUR de parole transcrit (Deepgram le produit déjà pour le STT —
 *     on ne paie donc rien de plus pour l'avoir) ;
 *   · la fin, avec le résultat de l'appel.
 *
 * Pourquoi c'est central : la transcription EST l'historique de conversation.
 * C'est elle qui nourrit le contexte du prochain contact — sans elle, chaque
 * appel repart de zéro et la personnalisation s'effondre.
 *
 * ⚠ ÉCOUTE / ENREGISTREMENT : techniquement possible (LiveKit permet de
 * rejoindre la room en auditeur et d'enregistrer via Egress). Juridiquement,
 * l'enregistrement d'un appel impose d'en informer l'interlocuteur — c'est une
 * mention DISTINCTE de la divulgation IA de l'article 50. Le flag
 * `recordingAnnounced` trace cette information ; sans lui, on n'enregistre pas.
 *
 * Module pur : types + calculs. Le stockage vit dans la route API.
 * ─────────────────────────────────────────────────────────────────────
 */

export type CallDirection = "entrant" | "sortant";
export type Speaker = "agent" | "prospect";

export interface TranscriptTurn {
  /** ISO. */
  at: string;
  speaker: Speaker;
  text: string;
  /** Confiance STT 0-1, si le moteur la fournit. */
  confidence?: number;
}

export type CallSessionState = "en-cours" | "terminee" | "echec";

export interface CallSession {
  id: string;
  /** Room LiveKit — c'est elle qui permet de rejoindre l'appel en écoute. */
  room: string;
  prospectId?: string;
  /** Compte au nom duquel l'agent parle. */
  accountId?: string;
  direction: CallDirection;
  /** Numéro de l'autre partie (E.164). */
  peer?: string;
  startedAt: string;
  endedAt?: string;
  state: CallSessionState;
  turns: TranscriptTurn[];
  /** Résultat déclaré en fin d'appel. */
  outcome?: "repondu" | "sans-reponse" | "opposition" | "invalide";
  /** L'interlocuteur a-t-il été informé d'un enregistrement ? */
  recordingAnnounced?: boolean;
  /** URL de l'enregistrement, si Egress est activé ET annoncé. */
  recordingUrl?: string;
  error?: string;
}

/** Une session est-elle réellement en cours ? */
export function isLive(s: CallSession, now: Date = new Date(), staleMs = 15 * 60_000): boolean {
  if (s.state !== "en-cours") return false;
  // Garde-fou : une session « en cours » depuis trop longtemps est une session
  // dont on a perdu la fin (crash agent). On ne l'affiche pas comme vivante.
  const last = s.turns.length ? s.turns[s.turns.length - 1].at : s.startedAt;
  return now.getTime() - new Date(last).getTime() < staleMs;
}

/** Durée en secondes (en cours = depuis le début). */
export function durationSec(s: CallSession, now: Date = new Date()): number {
  const end = s.endedAt ? new Date(s.endedAt).getTime() : now.getTime();
  return Math.max(0, Math.round((end - new Date(s.startedAt).getTime()) / 1000));
}

export const formatDuration = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** La transcription en texte lisible — ce qu'on relit après l'appel. */
export function transcriptText(s: CallSession): string {
  return s.turns.map((t) => `${t.speaker === "agent" ? "Alpha" : "Prospect"} : ${t.text}`).join("\n");
}

/**
 * Le contexte à réinjecter au PROCHAIN contact. On garde les derniers tours
 * (les plus récents portent l'état réel du dossier) sous une limite de
 * caractères, pour ne pas noyer le prompt.
 */
export function conversationContext(sessions: CallSession[], maxChars = 2000): string {
  const blocks: string[] = [];
  let used = 0;
  // Du plus récent au plus ancien : si on doit couper, on coupe le vieux.
  for (const s of [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    if (!s.turns.length) continue;
    const head = `— Appel ${s.direction} du ${new Date(s.startedAt).toLocaleDateString("fr-FR")} (${formatDuration(durationSec(s))})`;
    const body = transcriptText(s);
    const block = `${head}\n${body}`;
    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n");
}

/**
 * Ce que l'appel a appris et qu'on ne savait pas — la matière qui enrichit
 * la fiche. Heuristique lexicale volontairement PRUDENTE : elle propose, elle
 * ne réécrit jamais la fiche toute seule. Un humain (ou l'IA au stade audit)
 * valide.
 */
export interface CallInsight {
  kind: "objection" | "budget" | "delai" | "decideur" | "besoin";
  quote: string;
}

const PATTERNS: { kind: CallInsight["kind"]; re: RegExp }[] = [
  { kind: "objection", re: /(trop cher|pas le budget|on a d[ée]j[àa]|pas int[ée]ress|rappelez[- ]moi|je vais r[ée]fl[ée]chir)/i },
  { kind: "budget", re: /(budget|co[ûu]te|prix|tarif|combien)/i },
  { kind: "delai", re: /(en septembre|le mois prochain|apr[èe]s les vacances|d[ée]but|fin de mois|semaine prochaine)/i },
  { kind: "decideur", re: /(mon associ[ée]|le g[ée]rant|ma femme|mon mari|le directeur|c'est moi qui d[ée]cide|il faut voir avec)/i },
  { kind: "besoin", re: /(on rate|on perd|j'arrive pas|on n'a pas le temps|d[ée]bord[ée]|trop d'appels)/i },
];

export function extractInsights(s: CallSession): CallInsight[] {
  const out: CallInsight[] = [];
  const seen = new Set<string>();
  for (const t of s.turns) {
    if (t.speaker !== "prospect") continue; // ce qui compte, c'est ce que LUI dit
    for (const p of PATTERNS) {
      if (p.re.test(t.text) && !seen.has(`${p.kind}:${t.text}`)) {
        seen.add(`${p.kind}:${t.text}`);
        out.push({ kind: p.kind, quote: t.text.trim() });
      }
    }
  }
  return out;
}

/** Les sessions vivantes, la plus récente d'abord — la salle de contrôle. */
export function liveSessions(all: CallSession[], now: Date = new Date()): CallSession[] {
  return all.filter((s) => isLive(s, now)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
