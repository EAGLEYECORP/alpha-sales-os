import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import { lireProspectsOperateur } from "@/lib/lecture-serveur";
import { DROIT_SOLO } from "@/lib/entitlements";
import { eligibleColdMail, construireMailCold } from "@/lib/mail-autopilote";
import { habillageEnvoi } from "@/lib/expediteur";
import { renderEmail, plainText } from "@/lib/email-html";
import { verifieMentions, type RangMessage } from "@/lib/conformite";
import { verifieDivulgation, type ModeProduction } from "@/lib/signature-ia";
import { rampDepuisPremierEnvoi } from "@/lib/email-ramp";
import { lintForSpam, maxSendsPerHour, deliverabilityHeaders } from "@/lib/deliverability";
import {
  createTrackedEmail,
  countRecentSends,
  firstSendAt,
  aDejaEcrit,
  contactedEmails,
  supprimerTrace,
} from "@/lib/tracking";
import { resoudreSmtp, smtpUtilisable } from "@/lib/credentials-secret";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTOPILOTE D'ENVOI À FROID — l'app démarche toute seule, l'opérateur sort
 * de la boucle (mais pas du CLOSE).
 *
 * Un cron appelle ce tick. Il lit les prospects du maître, garde les éligibles
 * au premier contact (`lib/mail-autopilote.ts`), et envoie un mail à froid
 * conforme — en réutilisant EXACTEMENT les gardes de `/api/send` : palier du
 * jour, plafond horaire, dédup, mentions obligatoires, divulgation IA, lint
 * anti-spam, tracking. Les RÈGLES ont une seule définition (les libs) ; ce tick
 * est un second APPELANT, pas une seconde définition — parce que sa porte
 * (CRON_SECRET + compte maître) n'est pas celle de `/api/send` (session +
 * middleware), et qu'il ne peut donc pas passer par elle.
 *
 * ⚠ TROIS GARDES, comme les autres ticks : secret de cron, armement explicite
 * (`CAMPAIGN_AUTOPILOT=on`, sinon `dryRun` qui PLANIFIE sans envoyer), données
 * serveur présentes. Aucune contournable.
 *
 * ⚠⚠ L'ENVOI EST AUTONOME → chaque mail PORTE la divulgation IA (art. 50). Le
 * gabarit la contient déjà ; si un jour il ne la contenait plus,
 * `verifieDivulgation` REFUSE l'envoi (fail-closed) au lieu de partir illégal.
 *
 * ⚠ Compte MAÎTRE uniquement (`DROIT_SOLO`, `accountId: "eagleye"`). Ce n'est
 * pas l'autopilote de tous les locataires — c'est le nôtre, sur notre SMTP.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAX_MAILS_PAR_TICK = 5;
const MODE: ModeProduction = "autonome";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Pas de secret configuré = la route n'existe pas. Volontaire.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  return provided.length > 0 && safeEqual(provided, secret);
}

const armed = () => (process.env.CAMPAIGN_AUTOPILOT ?? "").trim().toLowerCase() === "on";

function baseUrlFrom(req: NextRequest): string {
  return (process.env.TRACKING_BASE_URL || process.env.APP_BASE_URL || req.nextUrl.origin).replace(/\/+$/, "");
}

/** Ne compter que les VRAIS liens de contenu (hors désinscription) — comme `/api/send`. */
function countContentLinks(html: string): number {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]).filter((u) => !u.includes("/api/unsubscribe"));
  return new Set(urls).size;
}

interface LigneEnvoi {
  email: string;
  company: string;
  etat: "envoyé" | "aurait-envoyé" | "ignoré";
  raison?: string;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Une route qui envoie de vrais emails ne s'ouvre pas." },
      { status: 401 },
    );
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      { error: "Supabase non configuré", why: "Les prospects vivent en base ; sans service role, ce tick ne voit rien." },
      { status: 412 },
    );
  }

  const url = new URL(req.url);
  const dryRun = !armed() || url.searchParams.get("dryRun") === "1";
  const base = baseUrlFrom(req);

  // La boîte d'envoi du MAÎTRE. En envoi réel elle est obligatoire ; en dryRun
  // on continue à planifier (on montre ce qui PARTIRAIT).
  const smtp = await resoudreSmtp(null, DROIT_SOLO);
  if (!dryRun && !smtpUtilisable(smtp)) {
    return NextResponse.json(
      { error: "Aucune boîte d'envoi maître (SMTP_* absents).", code: "smtp_absent" },
      { status: 503 },
    );
  }

  const lecture = await lireProspectsOperateur(db);
  if (lecture.erreur) return NextResponse.json({ error: "lecture impossible", detail: lecture.erreur }, { status: 500 });

  const eligibles = lecture.prospects.filter((p) => eligibleColdMail(p).ok);

  // ── Le palier du jour + le plafond horaire, lus comme `/api/send` (tenant null = maître/solo). ──
  const premierEnvoi = await firstSendAt("email", null);
  const ramp = rampDepuisPremierEnvoi(premierEnvoi);
  const envoyes24h = await countRecentSends("email", 86_400_000, null);
  const envoyes1h = await countRecentSends("email", 3_600_000, null);
  const budgetJour = ramp.today - envoyes24h;
  const budgetHeure = maxSendsPerHour() - envoyes1h;
  const capacite = Math.max(0, Math.min(budgetJour, budgetHeure, MAX_MAILS_PAR_TICK));

  // ── Dédup « déjà contacté » (fenêtre de refroidissement), comme `/api/send`. ──
  const cooldownDays = Number(process.env.CONTACT_COOLDOWN_DAYS ?? 14);
  const emails = eligibles.map((p) => (p.email ?? "").trim()).filter(Boolean);
  const dejaContactes =
    cooldownDays > 0 && emails.length ? await contactedEmails(emails, cooldownDays * 86_400_000, null) : new Set<string>();
  const candidats = eligibles.filter((p) => !dejaContactes.has((p.email ?? "").trim().toLowerCase()));

  const file = candidats.slice(0, capacite);
  const lignes: LigneEnvoi[] = [];

  for (const p of file) {
    const to = (p.email ?? "").trim();
    const { subject, body } = construireMailCold(p);
    const habillage = habillageEnvoi({ accountId: "eagleye", base });
    const emailOpts = { subject, body, closerName: habillage.closerName, addressLine: habillage.addressLine, logoUrl: habillage.logoUrl };
    const html = renderEmail(emailOpts);
    const text = plainText(emailOpts);

    // Mentions obligatoires (expéditeur + STOP) sur le texte RENDU.
    const rang: RangMessage = (await aDejaEcrit("email", to, null)) ? "suivant" : "premier";
    const manques = verifieMentions(text, habillage.closerName, habillage.marque, rang);
    if (manques.length) {
      lignes.push({ email: to, company: p.company, etat: "ignoré", raison: `mentions: ${manques.join(", ")}` });
      continue;
    }
    // Divulgation IA (envoi autonome) — refus plutôt qu'illégal.
    const divulg = verifieDivulgation(text, "email", MODE);
    if (divulg.length) {
      lignes.push({ email: to, company: p.company, etat: "ignoré", raison: `divulgation: ${divulg.join(", ")}` });
      continue;
    }
    // Lint anti-spam.
    const lint = lintForSpam(subject, body, true, countContentLinks(html));
    if (lint.level === "risque") {
      lignes.push({ email: to, company: p.company, etat: "ignoré", raison: `anti-spam: ${lint.warnings?.join(", ") || "score élevé"}` });
      continue;
    }

    if (dryRun || !smtpUtilisable(smtp)) {
      // dryRun (ou, par sécurité, SMTP indisponible alors qu'on n'est pas en
      // dryRun — impossible ici, on a rendu 503 plus haut, mais ça NARROW le type).
      lignes.push({ email: to, company: p.company, etat: "aurait-envoyé" });
      continue;
    }

    // ── Envoi réel (smtp narrowé en `Smtp` par le garde ci-dessus) ──
    const { id: trackingId, html: trackedHtml } = await createTrackedEmail(html, base, {
      channel: "email",
      email: to,
      prospectId: p.id,
      subject,
      userId: undefined,
    });
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      const stopMailto = smtp.from.match(/<([^>]+)>/)?.[1] ?? smtp.from;
      await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        text,
        html: trackedHtml,
        headers: deliverabilityHeaders(stopMailto),
      });
      lignes.push({ email: to, company: p.company, etat: "envoyé" });
    } catch (e) {
      // Une trace ne survit pas à un envoi raté (invariant : 1 ligne = 1 message parti).
      await supprimerTrace(trackingId);
      lignes.push({ email: to, company: p.company, etat: "ignoré", raison: `SMTP: ${e instanceof Error ? e.message : "échec"}` });
    }
  }

  const envoyes = lignes.filter((l) => l.etat === "envoyé").length;
  return NextResponse.json({
    ok: true,
    armed: armed(),
    dryRun,
    envoiBranche: !dryRun,
    eligibles: eligibles.length,
    capaciteDuTick: capacite,
    ramp: { jour: ramp.today, envoyes24h, envoyes1h, plafondHoraire: maxSendsPerHour() },
    envoyes,
    lignes,
    why:
      dryRun
        ? "dryRun : ce qui PARTIRAIT. Arme avec CAMPAIGN_AUTOPILOT=on pour envoyer pour de vrai."
        : "Envoi autonome réel — chaque mail porte la divulgation IA (art. 50) et passe palier + mentions.",
  });
}

/** Sonde lecture seule : combien d'éligibles + l'état du palier, sans envoyer. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const db = serviceClient();
  if (!db) return NextResponse.json({ armed: armed(), eligibles: null, why: "Supabase non configuré" }, { status: 412 });
  const lecture = await lireProspectsOperateur(db);
  if (lecture.erreur) return NextResponse.json({ error: lecture.erreur }, { status: 500 });
  const eligibles = lecture.prospects.filter((p) => eligibleColdMail(p).ok).length;
  const envoyes24h = await countRecentSends("email", 86_400_000, null);
  const ramp = rampDepuisPremierEnvoi(await firstSendAt("email", null));
  return NextResponse.json({ armed: armed(), envoiBranche: false, eligibles, ramp: { jour: ramp.today, envoyes24h } });
}
