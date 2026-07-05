import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Envoi réel — 100 % open-source, zéro vendor lock-in :
 *  · email : Nodemailer (MIT) sur n'importe quel SMTP
 *      env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *  · sms   : API compatible Textbelt (open-source, auto-hébergeable)
 *      env : TEXTBELT_URL (défaut https://textbelt.com/text), TEXTBELT_KEY
 *
 * Le WhatsApp part en lien wa.me côté client (ton numéro, ta conversation) —
 * pas besoin de serveur pour ça.
 */

interface SendRequest {
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
}

export async function GET() {
  // Capability probe — the UI shows/hides send buttons based on this.
  return NextResponse.json({
    email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    sms: Boolean(process.env.TEXTBELT_KEY),
  });
}

export async function POST(request: NextRequest) {
  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.to?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "champs to et body requis" }, { status: 400 });
  }

  if (body.channel === "email") {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return NextResponse.json(
        { error: "SMTP non configuré — renseigne SMTP_HOST / SMTP_USER / SMTP_PASS dans .env.local (n'importe quel fournisseur SMTP fonctionne)." },
        { status: 503 }
      );
    }
    try {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      const info = await transporter.sendMail({
        from: SMTP_FROM ?? SMTP_USER,
        to: body.to,
        subject: body.subject ?? "(sans objet)",
        text: body.body,
      });
      return NextResponse.json({ ok: true, id: info.messageId });
    } catch (e) {
      return NextResponse.json(
        { error: `Envoi email échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` },
        { status: 502 }
      );
    }
  }

  if (body.channel === "sms") {
    const url = process.env.TEXTBELT_URL ?? "https://textbelt.com/text";
    const key = process.env.TEXTBELT_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "SMS non configuré — renseigne TEXTBELT_KEY (et TEXTBELT_URL si auto-hébergé)." },
        { status: 503 }
      );
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: body.to, message: body.body, key }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; textId?: string };
      if (!data.success) {
        return NextResponse.json({ error: `SMS refusé : ${data.error ?? "erreur inconnue"}` }, { status: 502 });
      }
      return NextResponse.json({ ok: true, id: data.textId });
    } catch (e) {
      return NextResponse.json(
        { error: `Envoi SMS échoué : ${e instanceof Error ? e.message : "erreur inconnue"}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "channel invalide (email | sms)" }, { status: 400 });
}
