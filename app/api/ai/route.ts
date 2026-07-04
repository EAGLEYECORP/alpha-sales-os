import { NextRequest, NextResponse } from "next/server";
import type { Prospect } from "@/lib/types";
import {
  fallbackAuditNotes,
  fallbackObjectionAnswer,
  fallbackScript,
  fallbackSummary,
  nextBestAction,
  stageById,
} from "@/lib/hormozi";

export const runtime = "nodejs";
export const maxDuration = 60;

type AiTask = "script" | "audit" | "objection" | "summary" | "next-action";

interface AiRequest {
  task: AiTask;
  prospect: Prospect;
  businessRules: string;
  objection?: string;
}

const SYSTEM = `Tu es le copilote de vente d'EAGLEYE CORP (agence lyonnaise : sites premium + overlays IA pour restaurants, pubs, ambulances, artisans).
Doctrine Hormozi non négociable :
- La décision EST le produit. Émotion d'abord (démo mobile avant le prix), logique ensuite.
- OBSTACLES (pré-offre) ≠ OBJECTIONS (post-offre / Red Zone). Ne jamais confondre.
- Oignon du Blâme : Circonstances → Les Autres → Soi. On épluche couche par couche.
- Toujours chiffrer la Taxe d'Ignorance (€/mois perdus à ne rien faire).
- 3 Croyances à 10/10 avant signature : le produit fonctionne, tu le soutiens, ça marche POUR LUI.
- Chaque contact se termine par un next step DATÉ. Conviction 10/10 requise.
Réponds en français, format Markdown, concret et terrain — zéro corporate.`;

function buildPrompt(req: AiRequest): string {
  const p = req.prospect;
  const ctx = [
    `## Prospect`,
    `- ${p.name}, ${p.company} (${p.sector}) — ${p.city}`,
    `- Étape : ${stageById(p.stage).label} · Probabilité ${p.probability} % · Confiance ${p.trust}/100`,
    `- Valeur : ${p.setupValue} € setup + ${p.monthlyValue} €/mois · Taxe d'Ignorance : ${p.ignoranceTax} €/mois`,
    `- Croyances : produit ${p.croyances.produit}/10, soutien ${p.croyances.soutien}/10, pour lui ${p.croyances.pourLui}/10`,
    `- Démo mobile avant prix : ${p.demoShownBeforePrice ? "OUI ✓" : "NON ⚠"}`,
    `- Obstacles ouverts : ${p.obstacles.filter((o) => !o.resolved).map((o) => o.label).join(" ; ") || "aucun"}`,
    `- Objections ouvertes : ${p.objections.filter((o) => o.status !== "traitee").map((o) => o.label).join(" ; ") || "aucune"}`,
    `- Notes : ${p.notes || "—"}`,
    ``,
    `## Règles business de l'agence`,
    req.businessRules,
  ].join("\n");

  switch (req.task) {
    case "script":
      return `${ctx}\n\n## Tâche\nGénère un script de vente terrain complet pour le prochain contact : ouverture, démo mobile (avant tout prix), Taxe d'Ignorance, anticipation des couches de l'Oignon du Blâme, installation des 3 Croyances, clôture avec next step daté.`;
    case "audit":
      return `${ctx}\n\n## Tâche\nRédige des notes d'audit pré-remplies : situation, Taxe d'Ignorance chiffrée avec hypothèses, points à vérifier sur place, recommandation.`;
    case "objection":
      return `${ctx}\n\n## Tâche\nObjection Red Zone à traiter : « ${req.objection} ». Identifie la croyance cassée (1, 2 ou 3), donne le recadrage et une phrase terrain exacte à prononcer.`;
    case "summary":
      return `${ctx}\n\n## Tâche\nRésumé intelligent en 5 lignes max : où on en est, quel est le vrai blocage, quelle est la prochaine action et pourquoi.`;
    case "next-action":
      return `${ctx}\n\n## Tâche\nRecommande LA prochaine meilleure action (une seule), avec le pourquoi doctrine et le timing exact.`;
  }
}

function fallback(req: AiRequest): string {
  switch (req.task) {
    case "script":
      return fallbackScript(req.prospect, req.businessRules);
    case "audit":
      return fallbackAuditNotes(req.prospect);
    case "objection":
      return fallbackObjectionAnswer(req.objection ?? "Objection inconnue", req.prospect);
    case "summary":
      return fallbackSummary(req.prospect);
    case "next-action": {
      const nba = nextBestAction(req.prospect);
      return `**Action recommandée (${nba.urgency}) :** ${nba.action}\n\n**Pourquoi :** ${nba.why}`;
    }
  }
}

export async function POST(request: NextRequest) {
  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body?.task || !body?.prospect) {
    return NextResponse.json({ error: "task et prospect requis" }, { status: 400 });
  }

  // No key → deterministic Hormozi template engine (app works offline).
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ text: fallback(body), engine: "template" });
  }

  try {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { text } = await generateText({
      model: anthropic(process.env.AI_MODEL ?? "claude-opus-4-8"),
      system: SYSTEM,
      prompt: buildPrompt(body),
      maxTokens: 2000,
    });
    return NextResponse.json({ text, engine: "claude" });
  } catch (e) {
    // API failure → degrade gracefully to the template engine.
    console.error("AI route error, falling back to templates:", e);
    return NextResponse.json({ text: fallback(body), engine: "template" });
  }
}
