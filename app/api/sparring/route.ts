import { NextRequest, NextResponse } from "next/server";
import { doctrineOrDefault } from "@/lib/business-rules";
import { resoudreDroits } from "@/lib/entitlements";
import { aiAvailable, runAI } from "@/lib/ai-engine";
import { moteurIADeLaRequete } from "@/lib/credentials-secret";
import { moteurLocalSparring, promptSparring, type SparringReply, type SparringRequest } from "@/lib/sparring";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sparring — l'IA joue le prospect (méfiant mais juste) pour entraîner le
 * closer. Réponse JSON strict : { prospect, coach, status }.
 * Sans clé API : moteur local déterministe basé sur les objections.
 */

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
  // Repli serveur : voir lib/business-rules.ts. Un coach sans doctrine
  // entraîne à mal vendre, et ça ne se voit pas dans la réponse.
  // Notre doctrine (escalier, comptes, offres) ne sert qu'au maître ; un
  // inscrit sans doctrine reçoit la méthode seule (`REGLES_DE_METHODE`).
  const { maitre } = await resoudreDroits(request);
  body.businessRules = doctrineOrDefault(body.businessRules, maitre);

  /**
   * ⚠⚠ CETTE ROUTE REFAISAIT SA PROPRE CASCADE — supprimée le 16/09/2026.
   *
   * Elle enchaînait ollamaConfigured → nvidiaConfigured →
   * process.env.ANTHROPIC_API_KEY, en dupliquant `runAI` ligne pour ligne,
   * repli local compris. Avec `/api/agent` qui faisait pareil, ça faisait
   * TROIS définitions de « comment on joint le modèle ».
   *
   * Tant que la clé était la nôtre, ça ne coûtait que de la dette. Avec le
   * BYOK, un chemin qui lit encore l'environnement facture à NOUS l'appel
   * d'un locataire qui a collé sa clé. Contrairement à `/api/agent`, cette
   * route ne streame pas : elle peut donc repasser par `runAI`, et la
   * cascade dupliquée disparaît au lieu d'être rustinée.
   */
  const moteur = await moteurIADeLaRequete(request);
  if (!aiAvailable(moteur)) {
    return NextResponse.json({ ...moteurLocalSparring(body, maitre), engine: "local" });
  }

  // Le maître garde son sparring ; un inscrit joue contre un décideur qui
  // objecte à SON offre — voir lib/sparring.ts.
  const prompt = promptSparring(body, maitre);

  try {
    // ⚠ Le parsing reste CELUI DE CETTE ROUTE (premier `{` → dernier `}`) et
    // non `runAIJson` : changer la tolérance du parseur en même temps que la
    // cascade mêlerait deux corrections, et on ne saurait pas laquelle a
    // cassé le sparring si quelque chose cassait.
    const { text, engine } = await runAI([{ role: "user", content: prompt }], moteur, {
      temperature: 0.5,
      maxTokens: 500,
      json: true,
    });
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(a, b + 1)) as SparringReply;
    if (!parsed.prospect) throw new Error("réponse vide");
    return NextResponse.json({ ...parsed, engine });
  } catch (e) {
    console.error("sparring fallback:", e);
    return NextResponse.json({ ...moteurLocalSparring(body, maitre), engine: "local" });
  }
}
