import { NextRequest, NextResponse } from "next/server";
import type { CallSession, TranscriptTurn, CallDirection, Speaker } from "@/lib/call-log";
import { liveSessions } from "@/lib/call-log";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Journal des sessions d'appel — ce que l'agent vocal pousse en DIRECT.
 *
 * POST : l'agent (voice/agent.py) annonce le début, chaque tour de parole
 *        transcrit, puis la fin de l'appel.
 * GET  : l'app lit les sessions (vivantes ou toutes) pour la salle de
 *        contrôle et l'historique de conversation d'une fiche.
 *
 * Stockage : mémoire de process. C'est assumé et documenté — le journal
 * survit à la session mais pas à un redéploiement, et ne se partage pas
 * entre instances serverless. Pour du durable, il faudra une table Supabase
 * (même schéma que `CallSession`) ; le module `lib/call-log.ts` est déjà
 * découplé pour ça. Ne pas prétendre que c'est persistant.
 *
 * Sécurité : l'agent s'authentifie avec VOICE_WEBHOOK_SECRET. Sans secret
 * configuré, la route n'accepte QUE les appels locaux (dev) — un journal
 * d'appels ouvert au monde serait une fuite de données personnelles.
 * ─────────────────────────────────────────────────────────────────────
 */

const SESSIONS = new Map<string, CallSession>();
/** Garde-fou mémoire : au-delà, on jette les plus anciennes terminées. */
const MAX_SESSIONS = 500;

function authorized(req: NextRequest): boolean {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const provided = req.headers.get("x-voice-secret");
  if (secret) return provided === secret;
  // Pas de secret configuré : on tolère seulement le local (poste de dev).
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function prune() {
  if (SESSIONS.size <= MAX_SESSIONS) return;
  const done = [...SESSIONS.values()]
    .filter((s) => s.state !== "en-cours")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const s of done.slice(0, SESSIONS.size - MAX_SESSIONS)) SESSIONS.delete(s.id);
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

interface Body {
  event?: "start" | "turn" | "end";
  id?: string;
  room?: string;
  prospectId?: string;
  accountId?: string;
  direction?: CallDirection;
  peer?: string;
  speaker?: Speaker;
  text?: string;
  confidence?: number;
  outcome?: CallSession["outcome"];
  recordingAnnounced?: boolean;
  recordingUrl?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  let b: Body;
  try {
    b = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const id = str(b.id);
  if (!id) return NextResponse.json({ error: "id de session requis" }, { status: 400 });
  const now = new Date().toISOString();

  if (b.event === "start") {
    const session: CallSession = {
      id,
      room: str(b.room) ?? id,
      prospectId: str(b.prospectId),
      accountId: str(b.accountId),
      direction: b.direction === "sortant" ? "sortant" : "entrant",
      peer: str(b.peer),
      startedAt: now,
      state: "en-cours",
      turns: [],
      recordingAnnounced: b.recordingAnnounced === true,
    };
    SESSIONS.set(id, session);
    prune();
    return NextResponse.json({ ok: true, session });
  }

  const s = SESSIONS.get(id);
  if (!s) return NextResponse.json({ error: "session inconnue" }, { status: 404 });

  if (b.event === "turn") {
    const text = str(b.text);
    if (!text) return NextResponse.json({ error: "texte requis" }, { status: 400 });
    const turn: TranscriptTurn = {
      at: now,
      speaker: b.speaker === "prospect" ? "prospect" : "agent",
      text,
      ...(typeof b.confidence === "number" ? { confidence: b.confidence } : {}),
    };
    s.turns.push(turn);
    return NextResponse.json({ ok: true, turns: s.turns.length });
  }

  if (b.event === "end") {
    s.endedAt = now;
    s.state = b.error ? "echec" : "terminee";
    if (b.error) s.error = str(b.error);
    if (b.outcome) s.outcome = b.outcome;
    if (str(b.recordingUrl)) {
      // On n'expose un enregistrement que s'il a été ANNONCÉ à l'interlocuteur.
      if (s.recordingAnnounced) s.recordingUrl = str(b.recordingUrl);
    }
    return NextResponse.json({ ok: true, session: s });
  }

  return NextResponse.json({ error: "event inconnu (start | turn | end)" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const url = new URL(req.url);
  const prospectId = url.searchParams.get("prospectId");
  const onlyLive = url.searchParams.get("live") === "1";

  let all = [...SESSIONS.values()];
  if (prospectId) all = all.filter((s) => s.prospectId === prospectId);
  if (onlyLive) all = liveSessions(all);
  else all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return NextResponse.json({
    sessions: all,
    persistence: "memoire",
    warning: "Journal en mémoire de process : perdu au redéploiement, non partagé entre instances.",
  });
}
