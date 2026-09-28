import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/tracking";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stats de tracking (ouvertures / clics). Lecture pour l'UI de l'app.
 *   GET /api/track/stats
 *   GET /api/track/stats?prospectId=…
 *   GET /api/track/stats?campaignId=…
 *   GET /api/track/stats?messageId=…
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    // Chaque commercial ne voit QUE ses stats (multi-compte). Solo → null.
    const tenantId = await getTenantId(req);
    const stats = await getStats(
      {
        prospectId: sp.get("prospectId") ?? undefined,
        campaignId: sp.get("campaignId") ?? undefined,
        messageId: sp.get("messageId") ?? undefined,
      },
      tenantId
    );
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erreur stats" },
      { status: 500 }
    );
  }
}
