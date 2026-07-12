import { NextRequest, NextResponse } from "next/server";
import { renderEmail, plainText } from "@/lib/email-html";
import { lintForSpam } from "@/lib/deliverability";

export const runtime = "nodejs";

/**
 * Prévisualisation d'email : rend le HTML soigné + l'alternative texte et
 * renvoie le lint anti-spam. Sert à l'aperçu avant envoi (« que de beaux
 * mails HTML »).
 *   POST { subject, body, ctaLabel?, ctaUrl? } → { html, text, lint }
 */
export async function POST(request: NextRequest) {
  let b: { subject?: string; body?: string; ctaLabel?: string; ctaUrl?: string };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const base = (
    process.env.TRACKING_BASE_URL ||
    process.env.APP_BASE_URL ||
    request.nextUrl.origin
  ).replace(/\/+$/, "");
  const opts = {
    subject: b.subject?.trim() || "(sans objet)",
    body: b.body ?? "",
    closerName: process.env.CLOSER_NAME || "EAGLEYE",
    ctaLabel: b.ctaLabel,
    ctaUrl: b.ctaUrl,
    logoUrl: `${base}/email-eagle.png`,
  };
  const html = renderEmail(opts);
  const text = plainText(opts);
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
  const lint = lintForSpam(opts.subject, opts.body, true, new Set(urls).size);
  return NextResponse.json({ html, text, lint });
}
