import { NextRequest, NextResponse } from "next/server";
import { peutLireSessions, REFUS_LECTURE } from "@/lib/voice-session-acces";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CallSession, TranscriptTurn, CallDirection, Speaker } from "@/lib/call-log";
import { liveSessions } from "@/lib/call-log";
import { applyOutcome } from "@/lib/call-outcome";
import { safeEqual } from "@/lib/access";
import type { Prospect } from "@/lib/types";

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
 * Stockage : Supabase (table `call_sessions`) dès que SUPABASE_SERVICE_ROLE_KEY
 * est configurée, sinon mémoire de process. La transcription EST l'historique
 * de conversation : la perdre à chaque redéploiement viderait de sa substance
 * la personnalisation des appels suivants.
 *
 * La mémoire reste alimentée dans les deux cas — elle sert de cache de lecture
 * et de repli si Supabase tombe : un journal indisponible ne doit jamais
 * empêcher un appel d'être tracé.
 *
 * Table attendue (à créer une fois) :
 *   create table call_sessions (
 *     id text primary key, room text, prospect_id text, account_id text,
 *     direction text, peer text, started_at timestamptz, ended_at timestamptz,
 *     state text, turns jsonb default '[]'::jsonb, outcome text,
 *     recording_announced boolean default false, recording_url text, error text
 *   );
 *
 * Sécurité : l'agent s'authentifie avec VOICE_WEBHOOK_SECRET. Sans secret
 * configuré, la route n'accepte QUE le mode développement (NODE_ENV) — un
 * journal d'appels ouvert au monde serait une fuite de données personnelles.
 * Poser VOICE_WEBHOOK_SECRET est donc obligatoire en production : sans lui,
 * la route refuse tout, y compris l'agent.
 * ─────────────────────────────────────────────────────────────────────
 */

const SESSIONS = new Map<string, CallSession>();
/** Garde-fou mémoire : au-delà, on jette les plus anciennes terminées. */
const MAX_SESSIONS = 500;

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** CallSession → ligne Supabase (snake_case). */
function toRow(s: CallSession) {
  return {
    id: s.id,
    room: s.room,
    prospect_id: s.prospectId ?? null,
    account_id: s.accountId ?? null,
    direction: s.direction,
    peer: s.peer ?? null,
    started_at: s.startedAt,
    ended_at: s.endedAt ?? null,
    state: s.state,
    turns: s.turns,
    outcome: s.outcome ?? null,
    recording_announced: s.recordingAnnounced ?? false,
    recording_url: s.recordingUrl ?? null,
    error: s.error ?? null,
  };
}

/** Ligne Supabase → CallSession. */
function fromRow(r: Record<string, unknown>): CallSession {
  return {
    id: String(r.id),
    room: String(r.room ?? r.id),
    prospectId: (r.prospect_id as string) ?? undefined,
    accountId: (r.account_id as string) ?? undefined,
    direction: (r.direction as CallDirection) ?? "entrant",
    peer: (r.peer as string) ?? undefined,
    startedAt: String(r.started_at),
    endedAt: (r.ended_at as string) ?? undefined,
    state: (r.state as CallSession["state"]) ?? "terminee",
    turns: Array.isArray(r.turns) ? (r.turns as TranscriptTurn[]) : [],
    outcome: (r.outcome as CallSession["outcome"]) ?? undefined,
    recordingAnnounced: Boolean(r.recording_announced),
    recordingUrl: (r.recording_url as string) ?? undefined,
    error: (r.error as string) ?? undefined,
  };
}

/**
 * Écriture durable, sans jamais bloquer l'appelant. Un échec Supabase est
 * journalisé et la session reste en mémoire : on préfère un journal partiel
 * à un agent qui se bloque sur une écriture.
 */
async function persist(s: CallSession): Promise<void> {
  const db = serviceClient();
  if (!db) return;
  const { error } = await db.from("call_sessions").upsert(toRow(s), { onConflict: "id" });
  if (error) console.warn("call_sessions upsert:", error.message);
}

/**
 * Reporte le resultat de la session sur la fiche prospect (Supabase).
 * Silencieux si la fiche est introuvable ou si Supabase n'est pas configure :
 * un retour de resultat qui echoue ne doit jamais faire echouer la fin d'appel.
 */
async function reconcile(s: CallSession): Promise<{ matched: boolean; learned: number; optOut: boolean } | null> {
  if (!s.prospectId) return null;
  const db = serviceClient();
  if (!db) return null;
  try {
    const { data } = await db.from("prospects").select("data").eq("id", s.prospectId).maybeSingle();
    const p = (data as { data?: Prospect } | null)?.data;
    if (!p) return null;

    const r = applyOutcome(p, s);
    const { error } = await db.from("prospects").update({ data: r.prospect }).eq("id", s.prospectId);
    if (error) {
      console.warn("reconcile prospect:", error.message);
      return null;
    }
    return { matched: r.matched, learned: r.learned.length, optOut: r.optOut };
  } catch (e) {
    console.warn("reconcile:", e instanceof Error ? e.message : e);
    return null;
  }
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const provided = req.headers.get("x-voice-secret");
  // Temps constant : ce secret ouvre les transcriptions d'appels.
  if (secret) return Boolean(provided) && safeEqual(provided!, secret);

  // Pas de secret configuré : tolérance au poste de développement UNIQUEMENT.
  //
  // ⚠ La version précédente lisait l'en-tête `Host` pour décider si on était en
  // local. `Host` est fourni par le client : `curl -H "Host: localhost" …`
  // contre le déploiement public suffisait à lire et écrire les sessions
  // d'appels et leurs transcriptions. On se fie maintenant à NODE_ENV, qui est
  // posé par le serveur et qu'un appelant ne peut pas toucher.
  return process.env.NODE_ENV !== "production";
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
    await persist(session);
    return NextResponse.json({ ok: true, session });
  }

  // Réhydratation : en serverless, `start` et `turn` peuvent tomber sur DEUX
  // instances différentes. Sans ce rattrapage, la mémoire de la seconde est
  // vide et TOUTE la transcription serait perdue avec un 404.
  let s = SESSIONS.get(id);
  if (!s) {
    const db = serviceClient();
    if (db) {
      const { data } = await db.from("call_sessions").select("*").eq("id", id).maybeSingle();
      if (data) {
        s = fromRow(data as Record<string, unknown>);
        SESSIONS.set(id, s);
      }
    }
  }
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
    await persist(s);
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
    await persist(s);
    // ── La boucle se ferme ici ──
    // Le resultat reel remonte dans la fiche : l'evenement « en attente »
    // pose par l'autopilote devient « repondu » / « opposition » / etc.
    // Sans ce retour, la cadence rappellerait quelqu'un qui a decroche.
    const reconciled = await reconcile(s);
    return NextResponse.json({ ok: true, session: s, ...(reconciled ? { fiche: reconciled } : {}) });
  }

  return NextResponse.json({ error: "event inconnu (start | turn | end)" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  // ⚠ LIRE et ÉCRIRE n'ont pas la même porte — voir lib/voice-session-acces.ts.
  // Le POST reste réservé au secret de l'agent ; la lecture s'ouvre à
  // l'application elle-même, sinon la Salle de contrôle est morte en prod.
  if (!peutLireSessions(req.headers, authorized(req))) {
    return NextResponse.json({ error: REFUS_LECTURE }, { status: 401 });
  }
  const url = new URL(req.url);
  const prospectId = url.searchParams.get("prospectId");
  const onlyLive = url.searchParams.get("live") === "1";

  // Supabase est la source de vérité quand elle est configurée ; la mémoire
  // sert de repli si la base tombe (un journal muet vaut mieux qu'une page morte).
  let all = [...SESSIONS.values()];
  const db = serviceClient();
  if (db) {
    const q = db.from("call_sessions").select("*").order("started_at", { ascending: false }).limit(200);
    const { data, error } = prospectId ? await q.eq("prospect_id", prospectId) : await q;
    if (error) console.warn("call_sessions select:", error.message);
    else if (data) {
      // Fusion : la mémoire peut porter une session en cours pas encore relue.
      const byId = new Map(data.map((r) => [String(r.id), fromRow(r as Record<string, unknown>)]));
      for (const s of SESSIONS.values()) byId.set(s.id, s);
      all = [...byId.values()];
    }
  }
  if (prospectId) all = all.filter((s) => s.prospectId === prospectId);
  if (onlyLive) all = liveSessions(all);
  else all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const durable = Boolean(serviceClient());
  return NextResponse.json({
    sessions: all,
    persistence: durable ? "supabase" : "memoire",
    ...(durable
      ? {}
      : { warning: "Journal en mémoire de process : perdu au redéploiement, non partagé entre instances." }),
  });
}
