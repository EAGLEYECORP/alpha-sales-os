import { NextRequest, NextResponse } from "next/server";
import { moteurIADeLaRequete } from "@/lib/credentials-secret";
import { doctrineOrDefault } from "@/lib/business-rules";
import { ollamaChat, ollamaConfigured, ollamaModel } from "@/lib/ollama";
import { nvidiaChat, nvidiaConfigured, nvidiaModel } from "@/lib/nvidia";
import { playbookPrompt } from "@/lib/playbook";
import { AGENT_LIMITS, OS_MAP } from "@/lib/os-map";
import { compressContext } from "@/lib/ai-context";
import { wrapUntrusted, UNTRUSTED_RULES } from "@/lib/untrusted";
import { clipDoctrine } from "@/lib/identity";
import { assemble, budgetPour } from "@/lib/token-budget";
import { SYSTEME_AGENT } from "@/lib/prompts-textes";

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
  /** Identité + offre du compte (white-label) — l'agent parle au nom de CE compte. */
  identity?: string;
  /** Extraits du Cerveau (RAG) récupérés côté client — l'agent s'y appuie. */
  brainContext?: string;
}

const SYSTEM_BASE = SYSTEME_AGENT;

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
  // Repli serveur : voir lib/business-rules.ts.
  body.businessRules = doctrineOrDefault(body.businessRules);

  // Un assistant vaut ce que vaut son contexte : la méthode terrain (qui le
  // fait parler comme la maison), la carte de l'app, ses limites, et l'état
  // réel du pipe.
  //
  // Assemblage SOUS BUDGET de jetons. Le contexte grossit tout seul — le
  // Cerveau s'enrichit, les fiches accumulent des événements — et un prompt
  // qui coûtait 2 000 jetons en juillet en coûte 20 000 en janvier sans que
  // rien ne prévienne. Au-delà d'un certain volume, le contexte DILUE autant
  // qu'il aide : un modèle qui lit 30 000 jetons dont 2 000 utiles répond
  // moins bien qu'un modèle qui en lit 2 000.
  //
  // Priorité 1 = jamais coupé (identité, méthode, limites, règles sur les
  // données non fiables). Priorité 3 = sacrifié en premier.
  const assemblage = assemble(
    [
      { nom: "base", texte: SYSTEM_BASE, priorite: 1 },
      { nom: "identite", texte: body.identity ? "\n" + body.identity : "", priorite: 1 },
      { nom: "playbook", texte: "\n" + playbookPrompt(), priorite: 2 },
      { nom: "carte-os", texte: "\n" + OS_MAP, priorite: 3 },
      { nom: "limites", texte: "\n" + AGENT_LIMITS, priorite: 1 },
      { nom: "doctrine", texte: "\n## Règles business de l'agence\n" + clipDoctrine(body.businessRules ?? ""), priorite: 1 },
      {
        nom: "cerveau",
        texte: body.brainContext
          ? "\n## Cerveau — documents importés (appuie-toi dessus, cite les titres)\n" +
            wrapUntrusted("cerveau", body.brainContext, { maxChars: 12_000 })
          : "",
        priorite: 3,
      },
      {
        nom: "pipeline",
        texte:
          "\n## État réel de l'OS (JSON — la seule source de chiffres)\n" +
          wrapUntrusted("fiche", compressContext(body.context ?? "{}", { maxChars: 30000, headRatio: 0.7 }), {
            maxChars: 30_000,
            label: "état du pipeline (contient des champs libres saisis ou reçus de tiers)",
          }),
        priorite: 2,
      },
      // APRÈS les données : un modèle pondère ce qui est proche de sa réponse.
      { nom: "regles-donnees", texte: "\n" + UNTRUSTED_RULES, priorite: 1 },
    ],
    budgetPour("/api/agent")
  );
  const system = assemblage.texte;

  /**
   * ⚠⚠ CETTE ROUTE LISAIT LA CLÉ ELLE-MÊME — corrigé le 16/09/2026.
   *
   * Elle refaisait sa propre cascade (ollamaConfigured → nvidiaConfigured →
   * process.env.ANTHROPIC_API_KEY) au lieu de passer par `runAI`. Avec
   * `/api/sparring` qui faisait pareil, ça faisait TROIS définitions de
   * « comment on joint le modèle ».
   *
   * Tant que la clé était la nôtre, ça ne coûtait que de la dette. Avec le
   * BYOK, un chemin qui lit encore l'environnement facture à NOUS l'appel
   * d'un locataire qui a pourtant collé sa clé — et ça ne se voit que sur la
   * facture, un mois plus tard.
   *
   * Le streaming empêche de passer par `runAI` (qui ne rend qu'un texte
   * complet), donc la cascade reste ici — mais elle lit le MOTEUR RÉSOLU,
   * plus jamais l'environnement.
   */
  const moteur = await moteurIADeLaRequete(request);

  if (moteur.ollama) {
    try {
      const text = await ollamaChat(
        [{ role: "system" as const, content: system }, ...body.messages.map((m) => ({ role: m.role, content: m.content }))],
        moteur.ollama,
        { temperature: 0.4, maxTokens: 1500 }
      );
      return NextResponse.json({ text, engine: `ollama (${moteur.ollama.model})`, jetons: assemblage.jetons, coupes: assemblage.coupes });
    } catch (e) {
      console.error("Ollama agent error, falling back:", e);
    }
  }

  // NVIDIA NIM — gratuit, 70B, avant Anthropic qui est payant.
  if (moteur.nvidia) {
    try {
      const text = await nvidiaChat(
        [{ role: "system" as const, content: system }, ...body.messages.map((m) => ({ role: m.role, content: m.content }))],
        moteur.nvidia,
        { temperature: 0.4, maxTokens: 1500 }
      );
      return NextResponse.json({ text, engine: `nvidia (${moteur.nvidia.model})`, jetons: assemblage.jetons, coupes: assemblage.coupes });
    } catch (e) {
      console.error("NVIDIA agent error, falling back:", e);
    }
  }

  if (!moteur.anthropic) {
    return NextResponse.json({
      text: fallbackBriefing(body),
      engine: "template",
    });
  }

  try {
    const { streamText } = await import("ai");
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    // ⚠ `createAnthropic({ apiKey })`, jamais `anthropic(...)` : le second lit
    // ANTHROPIC_API_KEY dans l'environnement — donc NOTRE clé, quoi qu'ait
    // collé le locataire.
    const fournisseur = createAnthropic({ apiKey: moteur.anthropic.key });
    const result = streamText({
      model: fournisseur(moteur.anthropic.model),
      system,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 2500,
    });
    // Un flux ne peut pas porter de JSON de mesure : on met l'estimation en
    // en-tête, sinon la route la plus coûteuse est la seule qu'on ne mesure pas.
    return result.toTextStreamResponse({
      headers: { "x-engine": "claude", "x-jetons-entree": String(assemblage.jetons) },
    });
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
