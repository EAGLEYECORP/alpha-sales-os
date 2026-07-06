import { NextRequest, NextResponse } from "next/server";
import { contactedEmails } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dédup « déjà contacté » (durable). Rend, parmi une liste d'emails, ceux qui
 * ont reçu un email depuis `days` jours. Sert à pré-marquer les brouillons de
 * campagne avant relecture — on ne recontacte pas quelqu'un par erreur.
 *   GET /api/track/contacted?emails=a@x,b@y&days=14 → { contacted: [...] }
 */
export async function GET(req: NextRequest) {
  const emails = (req.nextUrl.searchParams.get("emails") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const days = Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 14));
  if (emails.length === 0) return NextResponse.json({ contacted: [] });
  try {
    const set = await contactedEmails(emails, days * 86_400_000);
    return NextResponse.json({ contacted: [...set] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 500 });
  }
}
