import { NextResponse } from "next/server";
import { commissionFor } from "@/lib/accounts-commercial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RÉFÉRENCE D'UN DEAL — servie, jamais embarquée.
 *
 * Le calculateur a besoin du taux de référence, du plancher éventuel et des
 * LEVIERS qui permettent de le remonter. Tout ça vit dans
 * `lib/accounts-commercial.ts`, qui ne descend pas dans le navigateur : ces
 * leviers décrivent notre rapport de force avec un partenaire, en clair.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware, /api/catalogue).
 * ─────────────────────────────────────────────────────────────────────
 */
export async function POST(req: Request) {
  let body: { accountId?: string; amountHT?: number; offeringKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const reference = commissionFor(body.accountId?.trim() || "eagleye", {
    amountHT: typeof body.amountHT === "number" ? body.amountHT : 0,
    offeringKey: body.offeringKey,
  });

  return NextResponse.json({ reference });
}
