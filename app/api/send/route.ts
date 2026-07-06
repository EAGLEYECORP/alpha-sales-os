import { NextRequest, NextResponse } from "next/server";
import { renderEmail, plainText } from "@/lib/email-html";
import { createTrackedEmail } from "@/lib/tracking";
import {
  unsubscribeUrl,
  deliverabilityHeaders,
  lintForSpam,
  allowSend,
  isSuppressed,
} from "@/lib/deliverability";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Envoi réel — 100 % open-source, zéro vendor lock-in :
 *  · email : Nodemailer (MIT) sur n'importe quel SMTP
 *      env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *  · sms   : API compatible Textbelt (open-source, auto-hébergeable)
 *      env : TEXTBELT_URL (défaut https://textbelt.com/text), TEXTBELT_KEY
 *
 * Les emails partent en HTML soigné (multipart html + texte), avec :
 *  · tracking ouvertures + clics (nombre de clics),
 *  · List-Unsubscribe One-Click + en-têtes anti-spam,
 *  · lint anti-spam (bloque ou avertit selon la sévérité).
 *
 * Le WhatsApp part en lien wa.me côté client (ton numéro, ta conversation).
 */

interface SendRequest {
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  /** Métadonnées de tracking (facultatives). */
  prospectId?: string;
  campaignId?: string;
  /** Bouton d'appel à l'action optionnel dans l'email. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Forcer l'envoi malgré un score anti-spam élevé. */
  force?: boolean;
}

/** Compte les liens de contenu uniques (hors désinscription). */
function countContentLinks(html: string): number {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
    .map((m) => m[1])
    .filter((u) => !u.includes("/api/unsubscribe"));
  return new Set(urls).size;
}

/** URL publique de base pour les liens de tracking / désinscription. */
function baseUrlFrom(req: NextRequest): string {
  return (
    process.env.TRACKING_BASE_URL ||
    process.env.APP_BASE_URL ||
    req.nextUrl.origin
  ).replace(/\/+$/, "");
}

export async function GET() {
  // Capability probe — the UI shows/hides send buttons based on this.
  return NextResponse.json({
    email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    sms: Boolean(process.env.TEXTBELT_KEY),
    tracking: true,
  });
}

export async function POST(request: NextRequest) {
  // Garde-fou taille : borne les charges utiles (anti-abus mémoire).
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 200_000) {
    return NextResponse.json({ error: "Charge utile trop volumineuse." }, { status: 413 });
  }
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
    const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return NextResponse.json(
        { error: "SMTP non configuré — renseigne SMTP_HOST / SMTP_USER / SMTP_PASS dans .env.local (n'importe quel fournisseur SMTP fonctionne)." },
        { status: 503 }
      );
    }

    const to = body.to.trim();
    if (isSuppressed(to)) {
      return NextResponse.json({ error: "Destinataire désinscrit — envoi bloqué." }, { status: 409 });
    }

    // Rate-limit anti-pic (protège la réputation d'envoi).
    const gate = allowSend("email");
    if (!gate.ok) {
      return NextResponse.json(
        { error: `Limite d'envoi atteinte (anti-spam). Réessaie dans ${gate.retryAfterSec}s.` },
        { status: 429, headers: { "retry-after": String(gate.retryAfterSec ?? 60) } }
      );
    }

    const subject = body.subject?.trim() || "(sans objet)";
    const base = baseUrlFrom(request);
    const unsub = unsubscribeUrl(base, to);

    // Rendu HTML soigné + alternative texte.
    const emailOpts = {
      subject,
      body: body.body,
      closerName: process.env.CLOSER_NAME || "EAGLEYE",
      ctaLabel: body.ctaLabel,
      ctaUrl: body.ctaUrl,
      unsubscribeUrl: unsub,
    };
    const html = renderEmail(emailOpts);
    const text = plainText(emailOpts);

    // Lint anti-spam — ne compter que les VRAIS liens de contenu (uniques,
    // hors désinscription ; le bouton « bulletproof » duplique son href).
    const lint = lintForSpam(subject, body.body, true, countContentLinks(html));
    if (lint.level === "risque" && !body.force) {
      return NextResponse.json(
        { error: "Score anti-spam élevé — corrige ou renvoie avec force:true.", lint },
        { status: 422 }
      );
    }

    // Injection tracking (ouvertures + clics).
    const { id: trackingId, html: trackedHtml } = await createTrackedEmail(html, base, {
      channel: "email",
      email: to,
      prospectId: body.prospectId,
      campaignId: body.campaignId,
      subject,
    });

    try {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      const info = await transporter.sendMail({
        from: SMTP_FROM ?? SMTP_USER,
        to,
        subject,
        text,
        html: trackedHtml,
        // List-Unsubscribe + One-Click (RFC 8058) et en-têtes anti-spam
        headers: deliverabilityHeaders(unsub),
      });
      return NextResponse.json({ ok: true, id: info.messageId, trackingId, lint });
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
