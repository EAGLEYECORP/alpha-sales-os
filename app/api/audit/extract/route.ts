import { NextRequest, NextResponse } from "next/server";
import { extractAudit } from "@/lib/audit-extract";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Import libre d'une recherche externe (Perplexity, ChatGPT, notes…) :
 * l'IA structure le texte en champs de fiche (deep-dive) — l'utilisateur
 * relit puis applique. POST { research, company?, city?, sector? }
 * → { data: ExtractedAudit, engine } | 422 si inexploitable | 501 si aucune IA.
 *
 * Le même schéma que le workflow n8n alpha-deepdive et PROMPTS.md — une vérité,
 * centralisée dans lib/audit-extract.ts (partagée avec /api/audit/generate).
 */
export async function POST(request: NextRequest) {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 300_000) return NextResponse.json({ error: "Recherche trop volumineuse (300 Ko max)." }, { status: 413 });

  let body: { research?: string; company?: string; city?: string; sector?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const research = body.research?.trim();
  if (!research || research.length < 40) {
    return NextResponse.json({ error: "Colle une recherche d'au moins quelques lignes." }, { status: 400 });
  }

  try {
    const { data, engine } = await extractAudit(research, body);
    if (data) return NextResponse.json({ data, engine });
    return NextResponse.json(
      { error: "L'IA n'a pas renvoyé de structure exploitable — utilise « Joindre en brut »." },
      { status: 422 }
    );
  } catch {
    return NextResponse.json(
      { error: "Aucune IA disponible pour structurer — utilise « Joindre en brut » (le texte ira dans les notes + pièces jointes)." },
      { status: 501 }
    );
  }
}
