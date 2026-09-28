import { NextRequest, NextResponse } from "next/server";
import { renderEmail, plainText } from "@/lib/email-html";
import { lintForSpam } from "@/lib/deliverability";
import { habillageEnvoi } from "@/lib/expediteur";

export const runtime = "nodejs";

/**
 * Prévisualisation d'email : rend le HTML soigné + l'alternative texte et
 * renvoie le lint anti-spam. Sert à l'aperçu avant envoi (« que de beaux
 * mails HTML »).
 *   POST { subject, body, ctaLabel?, ctaUrl? } → { html, text, lint }
 */
export async function POST(request: NextRequest) {
  let b: {
    subject?: string;
    body?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    accountId?: string;
    closerName?: string;
    agencyName?: string;
  };
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
  /**
   * ⚠ L'APERÇU MONTRAIT UN AUTRE EXPÉDITEUR QUE L'ENVOI.
   *
   * Il rendait une variable d'environnement, repli « EAGLEYE », pendant que `/api/send`
   * résolvait l'identité depuis le compte. L'opérateur relisait donc un email
   * signé « EAGLEYE » et en envoyait un signé de sa propre marque — ou
   * l'inverse. Un aperçu qui ment est pire qu'un aperçu absent : il donne le
   * sentiment d'avoir vérifié.
   *
   * Une seule source pour les deux routes : `habillageEnvoi`.
   */
  const habillage = habillageEnvoi({
    accountId: b.accountId,
    closerName: b.closerName,
    agencyName: b.agencyName,
    base,
  });
  const opts = {
    subject: b.subject?.trim() || "(sans objet)",
    body: b.body ?? "",
    closerName: habillage.closerName,
    addressLine: habillage.addressLine,
    ctaLabel: b.ctaLabel,
    ctaUrl: b.ctaUrl,
    logoUrl: habillage.logoUrl,
  };
  const html = renderEmail(opts);
  const text = plainText(opts);
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
  const lint = lintForSpam(opts.subject, opts.body, true, new Set(urls).size);
  return NextResponse.json({ html, text, lint });
}
