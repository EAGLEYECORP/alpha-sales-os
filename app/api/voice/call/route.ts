import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import {
  auditScript,
  buildVoiceScript,
  callAllowedNow,
  outboundComplianceGate,
  toE164,
  type CallMode,
  type VoiceConfig,
} from "@/lib/voice-script";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * ─────────────────────────────────────────────────────────────────────
 * Déclenchement d'un appel ALPHA VOICE.
 *
 * Cette route ne parle pas : elle construit le script, le VÉRIFIE, puis
 * crée un dispatch LiveKit. C'est le service Python (voice/agent.py) qui
 * décroche et qui parle.
 *
 * Trois portes, dans cet ordre, avant qu'un appel puisse partir :
 *   1. le mode demandé doit être autorisé — le démarchage à froid ne
 *      l'est pas, et ce n'est pas configurable ;
 *   2. le script doit porter les mentions de l'article 50. S'il en manque
 *      une, on refuse et on dit laquelle ;
 *   3. la fenêtre horaire professionnelle doit être ouverte, sauf si
 *      l'opérateur force explicitement (démo en rendez-vous un samedi,
 *      ça arrive).
 *
 * Sans identifiants LiveKit, la route rend le script et le verdict de
 * conformité sans rien déclencher : on peut relire ce que dirait l'agent
 * avant d'avoir monté quoi que ce soit.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Body {
  mode?: CallMode;
  phone?: string;
  company?: string;
  verticalId?: string;
  agentName?: string;
  onBehalfOf?: string;
  /** Passer outre la fenêtre horaire — geste explicite, journalisé. */
  force?: boolean;
  /** Ne rien déclencher : rendre le script et le verdict. */
  dryRun?: boolean;
  /** Prospection B2B : la cible est-elle confirmée professionnelle ? */
  isProfessional?: boolean;
  /** La fiche a-t-elle exercé son droit d'opposition (ne pas appeler) ? */
  optedOut?: boolean;
}

/** Modes exposés. Le démarchage grand public reste absent. */
const ALLOWED_MODES: CallMode[] = ["demo-entrante", "demo-sortante", "rappel-entrant", "prospection-b2b"];

function livekitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim()
  );
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const mode = body.mode ?? "demo-sortante";
  if (!ALLOWED_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `Mode « ${mode} » non autorisé. Modes disponibles : ${ALLOWED_MODES.join(", ")}.` },
      { status: 400 }
    );
  }

  const cfg: VoiceConfig = {
    mode,
    agentName: body.agentName?.trim() || "ALPHA",
    onBehalfOf: body.onBehalfOf?.trim() || "EAGLEYE CORP",
    company: body.company?.trim(),
    verticalId: body.verticalId,
  };

  const script = buildVoiceScript(cfg);

  // ── Porte 2 : la conformité du script ──
  const audit = auditScript(script);
  if (!audit.ok) {
    return NextResponse.json(
      {
        error: "Script non conforme — aucun appel ne partira.",
        manquantes: audit.manquantes,
        why: "L'article 50 du règlement européen sur l'IA impose que l'agent se déclare artificiel et dise pour le compte de qui il agit.",
      },
      { status: 422 }
    );
  }

  // ── Porte 2 bis : conformité DURE (non forçable) ──
  // Droit d'opposition toujours ; en prospection B2B, cible professionnelle
  // confirmée. Ce sont des conditions de licéité, pas des préférences : on
  // ne les contourne pas avec `force`.
  const gate = outboundComplianceGate({ mode, isProfessional: body.isProfessional, optedOut: body.optedOut });
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: "Conditions de conformité non réunies — aucun appel ne partira.",
        blockers: gate.blockers,
        why: "La prospection vocale n'est licite qu'en B2B (hors Bloctel), cible confirmée, et jamais vers une fiche qui s'est opposée.",
        script,
      },
      { status: 422 }
    );
  }

  // Un appel sortant exige un numéro exploitable.
  const needsPhone = mode !== "demo-entrante";
  const phone = needsPhone ? toE164(body.phone ?? "") : null;
  if (needsPhone && !phone) {
    return NextResponse.json(
      { error: `Numéro inexploitable : « ${body.phone ?? ""} ». Attendu un numéro français (06…, +33…).` },
      { status: 400 }
    );
  }

  // ── Porte 3 : la fenêtre horaire ──
  const window = callAllowedNow();
  if (needsPhone && !window.allowed && !body.force) {
    return NextResponse.json(
      { error: "Hors fenêtre d'appel.", why: window.why, forceable: true, script },
      { status: 409 }
    );
  }

  if (body.dryRun || !livekitConfigured()) {
    return NextResponse.json({
      dispatched: false,
      reason: body.dryRun ? "relecture demandée" : "LiveKit non configuré (LIVEKIT_URL / API_KEY / API_SECRET)",
      script,
      audit,
      phone,
      window,
    });
  }

  // ── Dispatch ──
  //
  // On appelle l'API LiveKit directement plutôt que d'ajouter le SDK :
  // le jeton est un JWT HS256, que node:crypto signe nativement. Zéro
  // dépendance nouvelle, comme partout ailleurs dans ce projet.
  try {
    const room = `alpha-voice-${Date.now().toString(36)}`;
    const dispatchId = await createDispatch(room, {
      phone,
      script,
      company: cfg.company ?? "",
    });
    return NextResponse.json({ dispatched: true, room, dispatchId, script, audit, phone });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Dispatch impossible.",
        detail: e instanceof Error ? e.message : String(e),
        hint: "Vérifie LIVEKIT_URL / API_KEY / API_SECRET, et que l'agent tourne : cd voice && python agent.py dev",
        script,
      },
      { status: 502 }
    );
  }
}

/** Base64url sans remplissage — le format des JWT. */
const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Jeton d'accès LiveKit (JWT HS256).
 *
 * Les droits sont volontairement minimaux : créer la salle et la piloter,
 * rien d'autre. Un jeton trop large qui fuite donne accès à tout le
 * projet LiveKit.
 */
function livekitToken(room: string, ttlSeconds = 300): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: process.env.LIVEKIT_API_KEY,
      sub: "alpha-sales-os",
      iat: now,
      nbf: now - 5,
      exp: now + ttlSeconds,
      video: { roomCreate: true, roomAdmin: true, room, agent: true },
    })
  );
  const sig = createHmac("sha256", process.env.LIVEKIT_API_SECRET!)
    .update(`${header}.${payload}`)
    .digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

/** URL HTTP du projet — LIVEKIT_URL est en wss://, l'API en https://. */
function livekitHttpUrl(): string {
  return (process.env.LIVEKIT_URL ?? "").replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/+$/, "");
}

async function createDispatch(room: string, metadata: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${livekitHttpUrl()}/twirp/livekit.AgentDispatchService/CreateDispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${livekitToken(room)}`,
    },
    body: JSON.stringify({ room, agent_name: "alpha-voice", metadata: JSON.stringify(metadata) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LiveKit ${res.status} — ${detail.slice(0, 300) || "réponse sans détail"}`);
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? room;
}

/** Relecture du script sans rien déclencher. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const cfg: VoiceConfig = {
    mode: (q.get("mode") as CallMode) ?? "demo-sortante",
    agentName: q.get("agentName") || "ALPHA",
    onBehalfOf: q.get("onBehalfOf") || "EAGLEYE CORP",
    company: q.get("company") ?? undefined,
    verticalId: q.get("verticalId"),
  };
  const script = buildVoiceScript(cfg);
  return NextResponse.json({
    script,
    audit: auditScript(script),
    window: callAllowedNow(),
    livekit: livekitConfigured(),
  });
}
