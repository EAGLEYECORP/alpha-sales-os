import { NextRequest, NextResponse } from "next/server";
import { recordOpen, PIXEL_GIF } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pixel d'ouverture — <img src="…/api/track/open/<id>"> injecté dans les
 * emails HTML. Retourne un GIF transparent 1×1, jamais mis en cache.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await recordOpen(id);
  } catch {
    /* ne jamais casser le rendu de l'email */
  }
  return new NextResponse(new Uint8Array(PIXEL_GIF), {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, private, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "content-length": String(PIXEL_GIF.length),
    },
  });
}
