import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Transcription côté serveur — pour que la dictée marche sur N'IMPORTE quel
 * navigateur (Chromium, Brave, Firefox…), pas seulement Chrome/Edge/Safari.
 *
 * Le navigateur enregistre l'audio (MediaRecorder) et le POST ici ; on le
 * confie à un service de reconnaissance, on renvoie le texte. C'est TES
 * propres notes qu'on transcrit, pas la parole d'un tiers.
 *
 * Deux fournisseurs, par ordre de préférence :
 *   1. Deepgram — REST simple, palier gratuit.   env : DEEPGRAM_API_KEY
 *   2. Whisper (compatible OpenAI) — OpenAI, Groq, NVIDIA, local…
 *        env : WHISPER_API_URL (…/v1/audio/transcriptions), WHISPER_API_KEY,
 *              WHISPER_MODEL (défaut whisper-1)
 */

function provider(): "deepgram" | "whisper" | null {
  if (process.env.DEEPGRAM_API_KEY) return "deepgram";
  if (process.env.WHISPER_API_URL && process.env.WHISPER_API_KEY) return "whisper";
  return null;
}

export async function GET() {
  return NextResponse.json({ configured: provider() !== null, provider: provider() });
}

export async function POST(request: NextRequest) {
  const p = provider();
  if (!p) {
    return NextResponse.json(
      { error: "Transcription non configurée — renseigne DEEPGRAM_API_KEY (palier gratuit) ou WHISPER_API_URL + WHISPER_API_KEY." },
      { status: 503 }
    );
  }

  const contentType = request.headers.get("content-type") || "audio/webm";
  const len = Number(request.headers.get("content-length") ?? 0);
  // Garde-fou : un débrief fait quelques dizaines de secondes ; 25 Mo large.
  if (len > 25_000_000) {
    return NextResponse.json({ error: "Audio trop volumineux (max 25 Mo)." }, { status: 413 });
  }

  const audio = Buffer.from(await request.arrayBuffer());
  if (audio.length === 0) {
    return NextResponse.json({ error: "Aucun audio reçu." }, { status: 400 });
  }

  try {
    if (p === "deepgram") {
      const url = "https://api.deepgram.com/v1/listen?model=nova-2&language=fr&punctuate=true&smart_format=true";
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": contentType },
        body: audio,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return NextResponse.json({ error: `Deepgram ${res.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}` }, { status: 502 });
      }
      const data = (await res.json()) as {
        results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
      };
      const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
      return NextResponse.json({ ok: true, text: text.trim() });
    }

    // Whisper (compatible OpenAI) — multipart/form-data.
    const form = new FormData();
    const ext = contentType.includes("mp4") ? "mp4" : contentType.includes("ogg") ? "ogg" : "webm";
    form.append("file", new Blob([audio], { type: contentType }), `debrief.${ext}`);
    form.append("model", process.env.WHISPER_MODEL || "whisper-1");
    form.append("language", "fr");
    const res = await fetch(process.env.WHISPER_API_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHISPER_API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json({ error: `Transcription ${res.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}` }, { status: 502 });
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ ok: true, text: (data.text ?? "").trim() });
  } catch (e) {
    return NextResponse.json({ error: `Transcription échouée : ${e instanceof Error ? e.message : "inconnue"}` }, { status: 502 });
  }
}
