import { NextRequest, NextResponse } from "next/server";
import { buildUrgentDigest } from "@/lib/digest";
import type { Meeting, Prospect } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Récap urgent — le cadran « faire » du jour, envoyé sur ton téléphone.
 *
 * Deux déclencheurs :
 *  · à la demande, depuis l'onglet Aujourd'hui (« M'envoyer le récap ») ;
 *  · automatique, chaque matin, par un cron n8n qui lit le CRM (Sheet) et
 *    POST ici (voir integrations/n8n/alpha-digest-urgent.workflow.json).
 *
 * Sécurité : le destinataire n'est JAMAIS pris dans la requête — toujours
 * dans l'environnement (ALERT_PHONE / DIGEST_EMAIL). Impossible de s'en
 * servir pour spammer un tiers.
 *   env : ALERT_PHONE (SMS via Textbelt) · DIGEST_EMAIL (défaut SMTP_FROM)
 *         canal auto : SMS si TEXTBELT_KEY, sinon email si SMTP configuré.
 */

function smsReady() {
  return Boolean(process.env.TEXTBELT_KEY && (process.env.ALERT_PHONE || "").trim());
}
function emailReady() {
  const to = process.env.DIGEST_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && to);
}

export async function GET() {
  return NextResponse.json({ sms: smsReady(), email: emailReady() });
}

interface DigestRequest {
  prospects?: Prospect[];
  meetings?: Meeting[];
  /** "sms" | "email" — sinon auto (SMS si dispo, puis email). */
  channel?: "sms" | "email";
  /** N'envoie rien, renvoie juste le texte calculé (aperçu). */
  dryRun?: boolean;
  /** Envoyer même si rien n'est critique (le cron ne le fait jamais). */
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 3_000_000) return NextResponse.json({ error: "Charge utile trop volumineuse." }, { status: 413 });

  let body: DigestRequest;
  try {
    body = (await request.json()) as DigestRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const prospects = Array.isArray(body.prospects) ? body.prospects : [];
  const meetings = Array.isArray(body.meetings) ? body.meetings : [];
  const digest = buildUrgentDigest(prospects, meetings);

  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, digest });
  }

  // Rien de critique : on n'envoie pas (sauf force). Un « rien d'urgent »
  // quotidien apprend à ignorer la notification.
  if (digest.count === 0 && !body.force) {
    return NextResponse.json({ ok: true, sent: false, reason: "rien de critique aujourd'hui", digest });
  }

  const channel = body.channel ?? (smsReady() ? "sms" : "email");

  if (channel === "sms") {
    if (!smsReady()) {
      return NextResponse.json(
        { error: "SMS non configuré — renseigne TEXTBELT_KEY et ALERT_PHONE.", digest },
        { status: 503 }
      );
    }
    try {
      const url = process.env.TEXTBELT_URL ?? "https://textbelt.com/text";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: process.env.ALERT_PHONE, message: digest.sms, key: process.env.TEXTBELT_KEY }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; textId?: string };
      if (!data.success) return NextResponse.json({ error: `SMS refusé : ${data.error ?? "inconnu"}`, digest }, { status: 502 });
      return NextResponse.json({ ok: true, sent: true, channel: "sms", id: data.textId, digest });
    } catch (e) {
      return NextResponse.json({ error: `Envoi SMS échoué : ${e instanceof Error ? e.message : "inconnu"}`, digest }, { status: 502 });
    }
  }

  // Email
  if (!emailReady()) {
    return NextResponse.json(
      { error: "Email non configuré — renseigne SMTP_* (et DIGEST_EMAIL ou SMTP_FROM).", digest },
      { status: 503 }
    );
  }
  const to = process.env.DIGEST_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER!;
  try {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject: digest.emailSubject,
      text: digest.emailBody,
    });
    return NextResponse.json({ ok: true, sent: true, channel: "email", id: info.messageId, digest });
  } catch (e) {
    return NextResponse.json({ error: `Envoi email échoué : ${e instanceof Error ? e.message : "inconnu"}`, digest }, { status: 502 });
  }
}
