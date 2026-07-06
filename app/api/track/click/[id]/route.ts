import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redirection de clic — les liens des emails HTML pointent ici. On compte
 * le clic puis on redirige (302) vers l'URL d'origine STOCKÉE à l'envoi.
 * Pas d'open-redirect : on ne redirige jamais vers une URL arbitraire.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const idx = Number(req.nextUrl.searchParams.get("l") ?? "-1");

  let target: string | null = null;
  try {
    target = await recordClick(id, idx);
  } catch {
    target = null;
  }

  if (!target) {
    // lien inconnu (message purgé) → page d'accueil de l'app, jamais une URL client
    return NextResponse.redirect(new URL("/", req.nextUrl.origin), 302);
  }
  return NextResponse.redirect(target, 302);
}
