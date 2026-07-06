import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubToken, suppress } from "@/lib/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Désinscription. Lien humain (GET) + One-Click RFC 8058 (POST) pour le
 * bouton natif de Gmail / Apple Mail. Ajoute l'email à la liste de
 * suppression (plus jamais recontacté par l'app).
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = verifyUnsubToken(token);
  if (!email) return NextResponse.json({ error: "jeton invalide" }, { status: 400 });
  suppress(email);
  return NextResponse.json({ ok: true, email });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = verifyUnsubToken(token);
  const ok = Boolean(email);
  if (email) suppress(email);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Désinscription</title>
<style>
  body{margin:0;font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#0f0d0b;color:#e9e2d6;
       display:flex;min-height:100vh;align-items:center;justify-content:center;}
  .card{max-width:440px;padding:40px;background:#181410;border:1px solid #2a231b;border-radius:16px;text-align:center;}
  h1{font-family:Georgia,serif;color:#e7c46b;font-size:22px;margin:0 0 12px;}
  p{color:#a89c8a;line-height:1.6;margin:0;}
</style></head><body><div class="card">
  <h1>🦅 EAGLEYE</h1>
  ${
    ok
      ? `<p><strong style="color:#e9e2d6;">C'est fait.</strong><br/>${email} ne recevra plus nos emails. Merci, et bonne continuation.</p>`
      : `<p>Ce lien de désinscription est invalide ou expiré. Répondez simplement « STOP » à un de nos emails et nous vous retirons manuellement.</p>`
  }
</div></body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
