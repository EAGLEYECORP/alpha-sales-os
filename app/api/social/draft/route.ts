import { NextRequest, NextResponse } from "next/server";
import { runAIJson } from "@/lib/ai-engine";
import { PLATFORMS, fitPlatform, type Platform } from "@/lib/social";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Rédige un post PAR plateforme (LinkedIn · X · Meta) sur un sujet tech pour
 * EAGLEYE CORP. IA quand elle est là, sinon gabarit déterministe (l'app doit
 * marcher sans IA — règle de la maison).
 *   POST { topic, angle? } → { drafts: { linkedin, x, meta }, engine }
 */

function systemPrompt(agency: string, offerLine?: string): string {
  return `Tu es le responsable contenu de ${agency}${offerLine ? ` — ${offerLine}` : ""}.
Tu écris des posts de leadership tech, crédibles et concrets, en français.
RÈGLES : pas de bullshit ni de promesses creuses ; une idée forte ; accroche qui arrête le scroll ;
value d'abord, CTA discret ; jamais de fausses stats. Réponds UNIQUEMENT en JSON.`;
}

function userPrompt(topic: string, angle: string | undefined): string {
  const specs = (Object.keys(PLATFORMS) as Platform[])
    .map((p) => `- ${p} (≤${PLATFORMS[p].limit} car, ${PLATFORMS[p].hashtags} hashtags) : ${PLATFORMS[p].tone}`)
    .join("\n");
  return `Sujet : ${topic}${angle ? `\nAngle : ${angle}` : ""}

Écris UN post adapté à chaque plateforme, en respectant ses contraintes :
${specs}

Réponds ce JSON exact (chaînes prêtes à publier, hashtags inclus) :
{"linkedin":"…","x":"…","meta":"…"}`;
}

const tag = (s: string) => s.replace(/[^A-Za-zÀ-ÿ0-9]/g, "");

/** Gabarit déterministe (sans IA) — jamais parfait, jamais vide. */
function fallbackDrafts(topic: string, agency: string, valueProp?: string): Record<Platform, string> {
  const vp = valueProp?.trim() || "on outille les forces de vente avec l'automatisation IA — sans jargon, sur le terrain.";
  const base = `${topic}\n\nChez ${agency}, ${vp}`;
  return {
    linkedin: fitPlatform(`${base}\n\nCe qu'on en retient : la techno ne remplace pas le commercial, elle lui rend du temps pour closer.\n\n👉 On en parle ? #IA #Vente #Automatisation`, "linkedin"),
    x: fitPlatform(`${topic} — la techno ne remplace pas le commercial, elle lui rend du temps pour closer. #IA #Vente`, "x"),
    meta: fitPlatform(`${base}\n\n#IA #Vente #Automatisation #${tag(agency) || "Business"}`, "meta"),
  };
}

export async function POST(req: NextRequest) {
  let body: { topic?: string; angle?: string; agencyName?: string; offerLine?: string; valueProp?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const topic = body.topic?.trim();
  if (!topic || topic.length < 3) {
    return NextResponse.json({ error: "Donne un sujet (quelques mots)." }, { status: 400 });
  }
  const agency = body.agencyName?.trim() || "l'agence";

  try {
    const { data, engine } = await runAIJson<Partial<Record<Platform, string>>>(
      [
        { role: "system", content: systemPrompt(agency, body.offerLine) },
        { role: "user", content: userPrompt(topic, body.angle) },
      ],
      { temperature: 0.7, maxTokens: 1400, json: true, compress: { maxChars: 6000, headRatio: 0.8 } }
    );
    if (data && (data.linkedin || data.x || data.meta)) {
      const drafts = {
        linkedin: fitPlatform(String(data.linkedin ?? ""), "linkedin"),
        x: fitPlatform(String(data.x ?? ""), "x"),
        meta: fitPlatform(String(data.meta ?? ""), "meta"),
      };
      return NextResponse.json({ drafts, engine });
    }
  } catch {
    /* aucune IA → gabarit ci-dessous */
  }

  return NextResponse.json({ drafts: fallbackDrafts(topic, agency, body.valueProp), engine: "gabarit (hors-ligne)" });
}
