import { NextRequest, NextResponse } from "next/server";
import { ollamaChat, ollamaConfigured, ollamaModel } from "@/lib/ollama";
import { playbookPrompt } from "@/lib/playbook";
import { AGENT_LIMITS, OS_MAP } from "@/lib/os-map";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Conversational AI agent — full-context copilot over the whole OS.
 * The client sends the chat history plus a compact snapshot of live data
 * (prospects, campaigns, meetings, rules). Streams text when
 * ANTHROPIC_API_KEY is set; otherwise returns a deterministic briefing.
 */

interface AgentRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  context: string; // compact JSON snapshot built client-side
  businessRules: string;
}

const SYSTEM_BASE = `Tu es ALPHA, l'agent commercial conversationnel d'EAGLEYE CORP (Lyon).
Tu as accès à l'état complet du pipeline (fourni en contexte JSON). Tu aides le closer à :
- préparer sa journée (priorités, next steps en retard, RDV)
- analyser un deal (croyances, obstacles/objections, Taxe d'Ignorance)
- rédiger scripts, emails, relances, réponses aux messages entrants
- décider (la doctrine tranche : démo mobile avant prix, next step daté, conviction 10/10, 3 Croyances à 10)
Réponds en français, direct, terrain, actionnable. Cite les chiffres réels du contexte. Markdown léger.`;

export async function POST(request: NextRequest) {
  let body: AgentRequest;
  try {
    body = (await request.json()) as AgentRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages requis" }, { status: 400 });
  }

  // Un assistant vaut ce que vaut son contexte. Quatre couches, dans
  // l'ordre d'importance : la méthode terrain (le playbook, qui le fait
  // parler comme la maison), la carte de l'app (pour guider vers le bon
  // écran), ses propres limites, puis l'état réel du pipe.
  const system = [
    SYSTEM_BASE,
    "\n" + playbookPrompt(),
    "\n" + OS_MAP,
    "\n" + AGENT_LIMITS,
    "\n## Règles business de l'agence\n" + (body.businessRules ?? ""),
    "\n## État réel de l'OS (JSON — la seule source de chiffres)\n" + (body.context ?? "{}").slice(0, 30000),
  ].join("\n");

  if (ollamaConfigured()) {
    try {
      const text = await ollamaChat(
        [{ role: "system" as const, content: system }, ...body.messages.map((m) => ({ role: m.role, content: m.content }))],
        { temperature: 0.4, maxTokens: 1500 }
      );
      return NextResponse.json({ text, engine: `ollama (${ollamaModel()})` });
    } catch (e) {
      console.error("Ollama agent error, falling back:", e);
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      text: fallbackBriefing(body),
      engine: "template",
    });
  }

  try {
    const { streamText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const result = streamText({
      model: anthropic(process.env.AI_MODEL ?? "claude-opus-4-8"),
      system,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 2500,
    });
    return result.toTextStreamResponse({ headers: { "x-engine": "claude" } });
  } catch (e) {
    console.error("agent route error:", e);
    return NextResponse.json({ text: fallbackBriefing(body), engine: "template" });
  }
}

/** Offline briefing: parse the snapshot and answer with real numbers. */
function fallbackBriefing(body: AgentRequest): string {
  let ctx: {
    prospects?: { company: string; stage: string; nextStep?: string; nextStepDate?: string; overdue?: boolean; weighted?: number; openObjections?: number }[];
    meetings?: { title: string; date: string }[];
    pipeWeighted?: number;
    mrrSigned?: number;
  } = {};
  try {
    ctx = JSON.parse(body.context ?? "{}");
  } catch {
    /* keep empty */
  }
  const prospects = ctx.prospects ?? [];
  const overdue = prospects.filter((p) => p.overdue);
  const redzone = prospects.filter((p) => (p.openObjections ?? 0) > 0);
  const lines = [
    `**Mode hors-ligne** (pas de clé ANTHROPIC_API_KEY) — voici le briefing à partir des données réelles :`,
    ``,
    `**Pipeline :** ${prospects.length} deals · pipe pondéré ${Math.round(ctx.pipeWeighted ?? 0).toLocaleString("fr-FR")} € · MRR signé ${Math.round(ctx.mrrSigned ?? 0).toLocaleString("fr-FR")} €`,
    overdue.length
      ? `**⚠ Next steps en retard (${overdue.length}) :** ${overdue.map((p) => `${p.company} — ${p.nextStep}`).join(" · ")}`
      : `**✓** Aucun next step en retard.`,
    redzone.length
      ? `**Red Zone :** ${redzone.map((p) => `${p.company} (${p.openObjections} objection(s))`).join(" · ")} — traiter la croyance cassée avant tout.`
      : ``,
    (ctx.meetings ?? []).length
      ? `**RDV à venir :** ${(ctx.meetings ?? []).slice(0, 3).map((m) => m.title).join(" · ")}`
      : `**RDV :** rien de planifié — un pipe sans RDV refroidit.`,
    ``,
    `Configure la clé API pour la conversation complète (analyse fine, rédaction, décisions).`,
  ];
  return lines.filter(Boolean).join("\n");
}
