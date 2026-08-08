import { NextRequest, NextResponse } from "next/server";
import {
  renderJson2Video,
  pollJson2Video,
  textToVideo,
  buildSimpleMovie,
  json2videoConfigured,
  textToVideoConfigured,
} from "@/lib/video-gen";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Lance / sonde un rendu vidéo pour le contenu social.
 *
 *   POST { lines:[…] }            → json2video (gabarit simple)
 *   POST { movie:{…} }            → json2video (movie JSON complet)
 *   POST { prompt:"…" }           → endpoint text-to-video (HunyuanVideo hébergé)
 *   GET  ?project=<id>            → état du rendu json2video
 *
 * Rien de configuré → 503 franc (la fonctionnalité est optionnelle).
 */
export async function POST(req: NextRequest) {
  let body: { lines?: string[]; movie?: Record<string, unknown>; prompt?: string; subtitle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // Voie text-to-video (endpoint GPU type HunyuanVideo) si un prompt est fourni.
  if (body.prompt?.trim()) {
    if (!textToVideoConfigured()) {
      return NextResponse.json(
        { error: "Aucun endpoint text-to-video — configure VIDEO_GEN_ENDPOINT (HunyuanVideo hébergé / Replicate)." },
        { status: 503 }
      );
    }
    return NextResponse.json(await textToVideo(body.prompt.trim()));
  }

  // Voie json2video (gabarit) — la voie gratuite qui marche sans GPU.
  if (!json2videoConfigured()) {
    return NextResponse.json(
      { error: "Rendu vidéo non configuré — ajoute JSON2VIDEO_API_KEY (offre gratuite)." },
      { status: 503 }
    );
  }
  const movie =
    body.movie ??
    (Array.isArray(body.lines) && body.lines.length
      ? buildSimpleMovie(body.lines.map(String), { subtitle: body.subtitle })
      : null);
  if (!movie) {
    return NextResponse.json({ error: "Fournis lines[], movie{} ou prompt." }, { status: 400 });
  }
  return NextResponse.json(await renderJson2Video(movie));
}

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project");
  if (!project) return NextResponse.json({ error: "paramètre project requis" }, { status: 400 });
  if (!json2videoConfigured()) {
    return NextResponse.json({ error: "Rendu vidéo non configuré." }, { status: 503 });
  }
  return NextResponse.json(await pollJson2Video(project));
}
