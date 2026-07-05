import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sparring — l'IA joue le prospect (méfiant mais juste) pour entraîner le
 * closer. Réponse JSON strict : { prospect, coach, status }.
 * Sans clé API : moteur local déterministe basé sur les objections.
 */

interface SparringRequest {
  prospect: {
    company: string;
    name: string;
    sector: string;
    pitch: string;
    objections: string[];
  };
  history: { role: "closer" | "prospect"; text: string }[];
  businessRules: string;
}

interface SparringReply {
  prospect: string;
  coach: string;
  status: "continue" | "gagne" | "perdu";
}

export async function POST(request: NextRequest) {
  let body: SparringRequest;
  try {
    body = (await request.json()) as SparringRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body?.prospect || !Array.isArray(body.history)) {
    return NextResponse.json({ error: "prospect et history requis" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...localEngine(body), engine: "local" });
  }

  const hist = body.history
    .map((m) => `${m.role === "closer" ? "COMMERCIAL" : "PROSPECT"}: ${m.text}`)
    .join("\n");

  const prompt = `Tu joues un patron de commerce lyonnais sceptique et pressé : ${body.prospect.name}, gérant de ${body.prospect.company} (${body.prospect.sector}).
Un commercial d'EAGLEYE CORP (sites web + IA pour commerces) essaie de te convaincre d'accepter un audit gratuit de 20 minutes.
Reste DANS LE PERSONNAGE : méfiant mais juste. S'il répond bien (douleur, preuve, next step daté, zéro jargon), tu t'adoucis. S'il pitche le produit, parle prix trop tôt ou reste vague, tu durcis.
Contexte réel du prospect : ${body.prospect.pitch || "commerce local sans vraie présence en ligne"}.
Ses objections favorites : ${body.prospect.objections.join(" ; ") || "pas le temps, trop cher, j'ai déjà ce qu'il faut"}.
Règles de vente de l'agence (le coach s'y réfère) : ${body.businessRules.slice(0, 1500)}

Conversation jusqu'ici :
${hist}

Réponds UNIQUEMENT en JSON strict, rien d'autre :
{"prospect":"ta réplique en personnage (1-2 phrases, ton parlé, français)","coach":"1 conseil bref et concret au commercial sur sa DERNIÈRE réponse","status":"continue|gagne|perdu"}
status="gagne" si le commercial vient d'obtenir un RDV d'audit daté ; "perdu" si après 5+ échanges il n'y arrive toujours pas ; sinon "continue".`;

  try {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { text } = await generateText({
      model: anthropic(process.env.AI_MODEL ?? "claude-opus-4-8"),
      prompt,
      maxTokens: 500,
    });
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(a, b + 1)) as SparringReply;
    if (!parsed.prospect) throw new Error("réponse vide");
    return NextResponse.json({ ...parsed, engine: "claude" });
  } catch (e) {
    console.error("sparring fallback:", e);
    return NextResponse.json({ ...localEngine(body), engine: "local" });
  }
}

/** Moteur local : objections en boucle, verdict simple sur la qualité des réponses. */
function localEngine(body: SparringRequest): SparringReply {
  const closerTurns = body.history.filter((m) => m.role === "closer");
  const last = closerTurns.at(-1)?.text ?? "";
  const round = closerTurns.length;

  const objs = body.prospect.objections.length
    ? body.prospect.objections
    : ["J'ai pas le temps là.", "C'est trop cher ces trucs.", "J'ai déjà une page Facebook, ça suffit."];

  const good =
    last.length > 50 &&
    !/€|euro|prix|tarif/i.test(last) && // pas de prix au téléphone
    /(audit|20 min|passe|mardi|jeudi|rdv|rendez-vous|chiffre|mesure|gratuit)/i.test(last);

  const coach = good
    ? "Bien : tu ramènes vers un créneau daté sans pitcher. Continue comme ça."
    : /€|euro|prix|tarif/i.test(last)
      ? "⛔ Tu as parlé prix avant la démo. Recentre : douleur → preuve → créneau d'audit."
      : "Trop court ou trop vague. Structure : sa douleur, une preuve locale, DEUX créneaux au choix.";

  if (round >= 4) {
    const wins = closerTurns.filter(
      (m) => m.text.length > 50 && /(audit|rdv|mardi|jeudi|créneau|gratuit)/i.test(m.text)
    ).length;
    if (wins >= 2)
      return { prospect: "Bon… d'accord. 20 minutes, pas plus. Passez mardi à 15h.", coach: "RDV daté obtenu — c'est exactement l'objectif. Rien de plus à vendre aujourd'hui.", status: "gagne" };
    return { prospect: "Écoutez, j'ai du travail. Laissez tomber.", coach: "Perdu : jamais 2 réponses orientées créneau. Objectif unique du premier contact : un RDV daté.", status: "perdu" };
  }

  const reply = good
    ? ["Mouais… et concrètement, ça donne quoi chez quelqu'un comme moi ?", "Admettons. Mais je vous préviens, j'ai déjà été déçu.", "20 minutes, vous dites ? Et vous vendez quoi au juste derrière ?"][round % 3]
    : `${objs[round % objs.length]}`;

  return { prospect: reply, coach, status: "continue" };
}
