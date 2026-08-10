import { NextRequest, NextResponse } from "next/server";
import { runAI } from "@/lib/ai-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demander au Cerveau — RAG. Le client fait la RÉCUPÉRATION en local (lexical,
 * hors-ligne) et envoie ici la question + le contexte des notes retrouvées.
 * L'IA se contente de SYNTHÉTISER ce contexte : elle cite tes notes, elle
 * n'invente pas. Sans clé IA, l'appelant affiche simplement les notes.
 */
export async function POST(request: NextRequest) {
  let body: { query?: string; context?: string; identity?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  const context = (body.context ?? "").trim();
  if (!query) return NextResponse.json({ error: "query requise" }, { status: 400 });
  if (!context) {
    return NextResponse.json({ answer: "", engine: "aucun contexte", grounded: false });
  }

  const system = [
    body.identity?.trim(),
    "Tu réponds UNIQUEMENT à partir des notes fournies (le Cerveau de l'opérateur).",
    "Si les notes ne suffisent pas, dis-le franchement — n'invente rien.",
    "Réponse concise, en français, actionnable. Cite les titres de notes utilisés entre « ».",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, engine } = await runAI(
      [
        { role: "system", content: system },
        { role: "user", content: `Notes du Cerveau :\n\n${context}\n\n---\nQuestion : ${query}` },
      ],
      { temperature: 0.3 }
    );
    return NextResponse.json({ answer: text, engine, grounded: true });
  } catch {
    // Aucun moteur IA : pas d'erreur — le client affiche les notes récupérées.
    return NextResponse.json({ answer: "", engine: "aucun moteur IA", grounded: false });
  }
}
