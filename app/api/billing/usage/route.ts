import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";
import { accountTier } from "@/lib/stripe";
import { countRecentSends } from "@/lib/tracking";
import { FREE_TIER, startOfMonthMs } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consommation du compte pour l'affichage (jauge de quota sur /compte).
 *   GET → { tier, emailsUsed, emailsLimit }
 * emailsLimit = null quand illimité (unmetered / owner / active).
 */
export async function GET(req: NextRequest) {
  const tenant = await getTenant(req);
  const tier = await accountTier(tenant?.id ?? null, tenant?.email ?? null);

  if (tier === "free" && tenant?.id) {
    const emailsUsed = await countRecentSends("email", Date.now() - startOfMonthMs(), tenant.id);
    return NextResponse.json({ tier, emailsUsed, emailsLimit: FREE_TIER.emailsPerMonth });
  }
  // unmetered / owner / active / anon → pas de quota mensuel à afficher.
  return NextResponse.json({ tier, emailsUsed: 0, emailsLimit: null });
}
