import { NextRequest, NextResponse } from "next/server";
import { createTrackedText, contactedEmails } from "@/lib/tracking";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * ─────────────────────────────────────────────────────────────────────
 * Préparation d'un envoi MANUEL.
 *
 * Cette route n'envoie rien — elle ne le peut pas, et c'est le principe.
 * Elle enregistre le message à venir pour deux raisons concrètes :
 *
 *  1. l'anti-doublon. Sans trace, rien n'empêche de réécrire dans trois
 *     jours à quelqu'un déjà contacté — la faute qui coûte le plus cher
 *     en crédibilité, et celle qu'on commet le plus facilement en
 *     envoyant à la main ;
 *  2. les clics. Les liens nus sont réécrits en liens tracés, donc un
 *     message parti de Gmail reste mesurable sur ce qui compte.
 *
 * Les OUVERTURES, elles, sont perdues : un message en texte brut n'a pas
 * d'images, donc pas de pixel. On le dit à l'écran plutôt que d'afficher
 * un zéro qui ressemblerait à un échec.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Body {
  to?: string;
  subject?: string;
  body?: string;
  prospectId?: string;
  campaignId?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

function baseUrl(request: NextRequest): string {
  const configured = process.env.TRACKING_BASE_URL || process.env.APP_BASE_URL;
  return (configured || request.nextUrl.origin).replace(/\/+$/, "");
}

function cooldownDays(): number {
  const n = Number(process.env.CONTACT_COOLDOWN_DAYS ?? 14);
  return Number.isFinite(n) && n >= 0 ? n : 14;
}

export async function POST(request: NextRequest) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const to = payload.to?.trim().toLowerCase() ?? "";
  const subject = payload.subject?.trim() ?? "";
  const body = typeof payload.body === "string" ? payload.body : "";

  if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Objet requis." }, { status: 400 });
  if (body.trim().length < 20) return NextResponse.json({ error: "Message trop court." }, { status: 400 });
  if (body.length > 20_000) return NextResponse.json({ error: "Message trop long." }, { status: 413 });

  // Déjà contacté récemment ? On le signale — sans bloquer : en envoi
  // manuel, l'opérateur peut avoir une raison légitime de réécrire, et
  // c'est lui qui décide. Mais il décide en le sachant.
  const seen = await contactedEmails([to], cooldownDays() * 86_400_000);
  const alreadyContacted = seen.has(to);

  const { id, text } = await createTrackedText(body, baseUrl(request), {
    channel: "email",
    email: to,
    subject,
    prospectId: payload.prospectId,
    campaignId: payload.campaignId,
  });

  return NextResponse.json({
    id,
    body: text,
    alreadyContacted,
    cooldownDays: cooldownDays(),
    /** Honnêteté d'affichage : ce que ce mode ne peut PAS mesurer. */
    tracksOpens: false,
  });
}
