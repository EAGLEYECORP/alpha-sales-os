import { NextRequest, NextResponse } from "next/server";
import { extractDebrief, parseFrenchDate, type DebriefDraft } from "@/lib/debrief";
import { aiAvailable, runAIJson } from "@/lib/ai-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Extraction du débrief vocal.
 *
 * L'extraction déterministe tourne TOUJOURS en premier : elle est
 * instantanée, hors-ligne, et elle ne peut pas inventer de date. L'IA
 * n'intervient qu'ensuite, et seulement pour affiner deux champs mous —
 * le résumé et le nom de l'interlocuteur. Elle ne touche jamais à la
 * date : une date hallucinée devient un rendez-vous manqué.
 */

const SYSTEM = `Tu extrais des informations d'un débrief oral de commercial de terrain, en français.
Tu réponds UNIQUEMENT par un objet JSON, sans texte autour, avec exactement ces clés :
{"interlocutor": string|null, "summary": string, "objections": string[], "action": string|null}
- interlocutor : le prénom ou nom de la personne rencontrée, uniquement s'il est explicitement dit. Sinon null.
- summary : UNE phrase factuelle de 140 caractères maximum, à la troisième personne, sans interprétation.
- objections : les freins réellement exprimés par le prospect, courts, tels qu'ils ont été dits.
- action : la prochaine action décidée (verbe à l'infinitif), sans date. Sinon null.
N'invente rien. Ce qui n'est pas dit vaut null ou tableau vide.`;

interface Body {
  transcript?: string;
}

/** Ce que l'IA a le droit de modifier — le reste vient du déterministe. */
interface Refinement {
  interlocutor?: string | null;
  summary?: string;
  objections?: string[];
  action?: string | null;
}

const clean = (s: unknown, max: number): string | undefined => {
  if (typeof s !== "string") return undefined;
  const v = s.trim().replace(/\s+/g, " ");
  return v ? v.slice(0, max) : undefined;
};

function merge(base: DebriefDraft, r: Refinement): DebriefDraft {
  const out: DebriefDraft = { ...base };

  const interlocutor = clean(r.interlocutor, 60);
  if (!out.interlocutor && interlocutor) out.interlocutor = interlocutor;

  const summary = clean(r.summary, 160);
  if (summary) out.summary = summary;

  // Les objections du modèle s'ajoutent, mais ne remplacent pas celles du
  // catalogue : celles-là portent la réponse du playbook.
  if (Array.isArray(r.objections)) {
    const known = new Set(out.objections.map((o) => o.label.toLowerCase()));
    for (const label of r.objections.slice(0, 5)) {
      const l = clean(label, 120);
      if (l && !known.has(l.toLowerCase())) out.objections.push({ id: `ia-${out.objections.length}`, label: l });
    }
  }

  // L'action peut être précisée, JAMAIS la date : elle reste celle qu'on a
  // entendue littéralement, ou rien.
  const action = clean(r.action, 80);
  if (action && out.nextStep) out.nextStep = { ...out.nextStep, action };

  out.missing = out.missing.filter(
    (m) => !(m.startsWith("interlocuteur") && out.interlocutor) && !(m.startsWith("aucune objection") && out.objections.length)
  );

  return out;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (transcript.length < 10) {
    return NextResponse.json({ error: "Débrief trop court — parle au moins une phrase complète." }, { status: 400 });
  }
  if (transcript.length > 8000) {
    return NextResponse.json({ error: "Débrief trop long (8 000 caractères max)." }, { status: 413 });
  }

  const base = extractDebrief(transcript);

  if (!aiAvailable()) {
    return NextResponse.json({ draft: base, engine: "déterministe (hors-ligne)" });
  }

  try {
    const { data, engine } = await runAIJson<Refinement>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: transcript },
      ],
      { temperature: 0.1, maxTokens: 500 }
    );
    // JSON invalide → on garde l'extraction déterministe, qui a déjà
    // l'essentiel. Un affinage raté ne doit pas coûter le débrief.
    if (!data) return NextResponse.json({ draft: base, engine: `${engine} — sortie illisible, extraction déterministe conservée` });
    return NextResponse.json({ draft: merge(base, data), engine });
  } catch (e) {
    // Un modèle qui rend du JSON invalide ne doit pas coûter le débrief :
    // le déterministe a déjà tout ce qui compte.
    console.error("Débrief — affinage IA indisponible, extraction déterministe conservée:", e);
    return NextResponse.json({ draft: base, engine: "déterministe (IA indisponible)" });
  }
}

/** Sonde d'aide au diagnostic : « telle phrase, ça donne quelle date ? ». */
export async function GET(request: NextRequest) {
  const phrase = request.nextUrl.searchParams.get("date");
  if (!phrase) return NextResponse.json({ error: "paramètre ?date= attendu" }, { status: 400 });
  return NextResponse.json({ phrase, date: parseFrenchDate(phrase) });
}
