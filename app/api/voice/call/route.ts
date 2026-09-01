import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import {
  auditScript,
  buildVoiceScript,
  callAllowedNow,
  outboundComplianceGate,
  toE164,
  CORPS_APPEL_FROID,
  type CallMode,
  type VoiceConfig,
} from "@/lib/voice-script";
import { estPartenaire } from "@/lib/validation-partenaire";
import { empreinte } from "@/lib/apprentissage";
import { getAccount } from "@/lib/accounts";
// La résolution de l'offre est pure et testable : elle vit dans lib/.
// Next.js n'autorise de toute façon aucun export hors handler dans ce fichier.
import { resoudreOffre } from "@/lib/voice-offre";
import type { EagleyeOffer } from "@/lib/offer-match";

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
  /**
   * Brief personnalisé issu du deep-dive (lib/deep-dive → briefForScript).
   * C'est LUI qui rend l'appel unique : signaux connus, trous à combler,
   * historique de conversation, objectif du jour. Sans lui, l'agent récite
   * un script générique — et un script générique ne convertit pas.
   */
  prospectBrief?: string;
  /**
   * Trame de l'appel à froid éditée par l'opérateur (`/prompts`).
   *
   * ⚠ Elle vient du NAVIGATEUR, donc on ne lui fait aucune confiance : elle
   * traverse `auditScript` comme le texte livré, et un corps amputé de
   * l'objectif unique, de l'interdiction de prix, du NON ou du OUI reçoit un
   * 422. La validation d'écran n'est qu'un confort ; celle-ci décide.
   */
  corpsFroid?: string;
  /** Fiche appelée — trace la session dans le journal d'appels. */
  prospectId?: string;
  /** Compte au nom duquel on appelle (portefeuille white-label). */
  accountId?: string;
  /**
   * La preuve que le partenaire a validé CETTE trame (`lib/validation-partenaire.ts`).
   * Absente sur un compte maître, exigée sur un compte partenaire.
   */
  validationPartenaire?: { par: string; le: string; empreinte: string };
  /**
   * L'offre REPRÉSENTÉE sur cet appel — celle que `deepDive` a retenue pour
   * cette fiche. C'est elle qui écrit le rôle de l'agent (voir `resoudreOffre`).
   */
  offre?: EagleyeOffer;
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

  const offreResolue = resoudreOffre(body.offre, body.accountId);

  const cfg: VoiceConfig = {
    mode,
    agentName: body.agentName?.trim() || "ALPHA",
    onBehalfOf: body.onBehalfOf?.trim() || "EAGLEYE CORP",
    company: body.company?.trim(),
    verticalId: body.verticalId,
    prospectBrief: body.prospectBrief,
    offre: offreResolue.offre,
    corpsFroid: body.corpsFroid,
  };

  const script = buildVoiceScript(cfg);

  // ── Porte 2 : la conformité du script ──
  // Le contexte déclenche les exigences de l'appel à froid, et celles de la
  // marque partenaire sur Callflow (voir lib/voice-script).
  const audit = auditScript(script, { mode: cfg.mode, offre: cfg.offre });
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

  /**
   * ── Porte 2 ter : L'ACCORD DU PARTENAIRE ──
   *
   * La conformité n'est pas l'accord. Un script peut être parfaitement légal
   * et ne pas être celui que ScintIA a relu — et sur un appel Callflow, c'est
   * LEUR marque que le prospect entend.
   *
   * ⚠ L'EMPREINTE PORTE SUR LA TRAME, PAS SUR LE SCRIPT ASSEMBLÉ. Le script
   * contient le nom du prospect : son empreinte changerait à chaque appel et
   * aucune validation ne tiendrait deux minutes. Le partenaire valide le
   * texte qu'on lui fait lire — la trame — et le code vérifie que c'est bien
   * celle-là qui part.
   *
   * ⚠⚠ CE QUE CETTE PORTE NE FAIT PAS : elle ne résiste pas à quelqu'un qui
   * forgerait l'empreinte dans la requête. C'est assumé, et c'est cohérent
   * avec le modèle de menace écrit dans `lib/validation-partenaire.ts` : on ne
   * se protège pas d'un adversaire, on se protège de NOUS — d'un texte modifié
   * il y a trois semaines dont plus personne ne se souvient qu'il n'a pas été
   * relu. Le client qui appelle cette route, c'est l'opérateur lui-même.
   */
  if (estPartenaire(body.accountId ?? "")) {
    const trame = cfg.corpsFroid?.trim() || CORPS_APPEL_FROID;
    const attendue = empreinte(trame);
    const v = body.validationPartenaire;
    if (!v || v.empreinte !== attendue) {
      return NextResponse.json(
        {
          error: "Texte non validé par le partenaire — aucun appel ne partira.",
          why:
            `Vous appelez au nom de ${getAccount(body.accountId).name}. Sur leur appel, c'est leur marque qui parle : ` +
            (v
              ? "la trame a changé depuis leur validation, leur accord ne couvre pas cette version."
              : "cette trame ne leur a jamais été soumise."),
          quoiFaire: "Ouvrir Réglages → Validation partenaire, faire relire le texte, puis enregistrer qui a validé.",
        },
        { status: 422 }
      );
    }
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
      // L'offre représentée voyage avec le script : l'opérateur doit pouvoir
      // vérifier CE QUE l'appel va proposer avant de le lancer, pas le
      // découvrir en écoutant.
      offre: offreResolue,
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
      // Rattache la session au prospect : sans ça, la transcription arrive
      // orpheline et l'historique de conversation ne se constitue jamais.
      prospectId: body.prospectId ?? "",
      accountId: body.accountId ?? "",
    });
    return NextResponse.json({ dispatched: true, room, dispatchId, script, audit, phone, offre: offreResolue });
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
  const offreRelue = resoudreOffre(q.get("offre"), q.get("accountId"));
  const cfg: VoiceConfig = {
    mode: (q.get("mode") as CallMode) ?? "demo-sortante",
    agentName: q.get("agentName") || "ALPHA",
    onBehalfOf: q.get("onBehalfOf") || "EAGLEYE CORP",
    company: q.get("company") ?? undefined,
    verticalId: q.get("verticalId"),
    // La relecture doit montrer LE script qui partira, offre comprise. Sans
    // ça, l'opérateur valide un texte et l'agent en dit un autre.
    offre: offreRelue.offre,
    // La relecture doit montrer la trame QUI PARTIRA, édition comprise.
    corpsFroid: q.get("corpsFroid") ?? undefined,
  };
  const script = buildVoiceScript(cfg);
  return NextResponse.json({
    script,
    offre: offreRelue,
    // Même contexte qu'à l'envoi : l'écran de relecture doit voir EXACTEMENT
    // les manques que la route d'appel refusera. Auditer moins ici, c'est
    // valider un script que l'appel rejettera ensuite.
    audit: auditScript(script, { mode: cfg.mode, offre: cfg.offre }),
    window: callAllowedNow(),
    livekit: livekitConfigured(),
  });
}
