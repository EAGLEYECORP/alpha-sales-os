import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import { lireProspectsOperateur } from "@/lib/lecture-serveur";
import { DROIT_SOLO } from "@/lib/entitlements";
import { habillageEnvoi } from "@/lib/expediteur";
import { renderEmail, plainText } from "@/lib/email-html";
import { verifieMentions, type RangMessage } from "@/lib/conformite";
import { verifieDivulgation, type ModeProduction } from "@/lib/signature-ia";
import { rampDepuisPremierEnvoi } from "@/lib/email-ramp";
import { lintForSpam, maxSendsPerHour, deliverabilityHeaders } from "@/lib/deliverability";
import { createTrackedEmail, countRecentSends, firstSendAt, historiqueEnvois, supprimerTrace } from "@/lib/tracking";
import { resoudreSmtp, smtpUtilisable } from "@/lib/credentials-secret";
import { autopiloteArmeEnv, estArme, lireDrapeauAutopilote } from "@/lib/autopilote";
import { relanceDue, construireRelanceMail, raisonRelance } from "@/lib/relance-mail";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTO-RELANCE EMAIL (B2) — rappeler sans harceler, tout seul.
 *
 * Après un 1er contact (`mail-tick`) resté sans réponse, ce tick envoie les
 * rappels — ESPACÉS, dans le plafond légal (4/30 j, décret 2022-1313), et chacun
 * avec une RAISON NEUVE ou pas du tout (`lib/relance-mail.ts` + `raison-neuve`).
 * La décision est pure et testée ; ce tick fait l'I/O.
 *
 * ⚠ MÊME PORTE QUE LE COLD : l'armement de l'autopilote (`estArme`) suffit — la
 * relance appartient à la famille de la prospection sortante, pas à l'inbound.
 * Non armé (ou `?dryRun=1`) ⇒ on PLANIFIE sans envoyer. Compte MAÎTRE (DROIT_SOLO).
 *
 * ⚠ Il passe EXACTEMENT les gardes de `mail-tick` : mentions, divulgation IA,
 * lint, palier + plafond horaire, tracking. Une seule définition des règles.
 *
 * ⚠ Il faut le SCHEDULER (pg_cron), comme `alpha-mail-tick` (migration 014) —
 * quelques passages par jour, dans les fenêtres. La route refuse hors fenêtre et
 * hors plafond de toute façon : le cron n'est qu'une économie d'invocations.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAX_RELANCES_PAR_TICK = 2;
const MODE: ModeProduction = "autonome";
const FENETRE_30J_MS = 30 * 86_400_000;

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  return provided.length > 0 && safeEqual(provided, secret);
}

function baseUrlFrom(req: NextRequest): string {
  return (process.env.TRACKING_BASE_URL || process.env.APP_BASE_URL || req.nextUrl.origin).replace(/\/+$/, "");
}

function countContentLinks(html: string): number {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]).filter((u) => !u.includes("/api/unsubscribe"));
  return new Set(urls).size;
}

interface LigneRelance {
  email: string;
  company: string;
  etat: "envoyée" | "aurait-envoyé" | "ignorée";
  motif: string;
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
      { error: "Supabase non configuré", why: "Les prospects et l'historique vivent en base ; sans service role, ce tick ne voit rien." },
      { status: 412 },
    );
  }

  const url = new URL(req.url);
  const arme = estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) });
  const dryRun = !arme || url.searchParams.get("dryRun") === "1";
  const base = baseUrlFrom(req);
  const now = Date.now();

  const smtp = await resoudreSmtp(null, DROIT_SOLO);
  if (!dryRun && !smtpUtilisable(smtp)) {
    return NextResponse.json({ error: "Aucune boîte d'envoi maître (SMTP_* absents).", code: "smtp_absent" }, { status: 503 });
  }

  const lecture = await lireProspectsOperateur(db);
  if (lecture.erreur) return NextResponse.json({ error: "lecture impossible", detail: lecture.erreur }, { status: 500 });

  // Les fiches encore en jeu, avec un email. On ne relance ni un signé, ni un perdu.
  const enJeu = lecture.prospects.filter(
    (p) => (p.email ?? "").trim() && p.stage !== "signe" && p.stage !== "perdu",
  );

  // Qui a RÉPONDU (une seule requête) — la cadence s'arrête sur une réponse.
  const { data: reps } = await db.from("inbound_events").select("email").eq("type", "email.reply");
  const ontRepondu = new Set((reps ?? []).map((r) => String(r.email ?? "").toLowerCase().trim()).filter(Boolean));

  // Palier du jour + plafond horaire, comme mail-tick.
  const ramp = rampDepuisPremierEnvoi(await firstSendAt("email", null));
  const envoyes24h = await countRecentSends("email", 86_400_000, null);
  const envoyes1h = await countRecentSends("email", 3_600_000, null);
  let capacite = Math.max(0, Math.min(ramp.today - envoyes24h, maxSendsPerHour() - envoyes1h, MAX_RELANCES_PAR_TICK));

  const habillage = habillageEnvoi({ accountId: "eagleye", base });
  const lignes: LigneRelance[] = [];

  for (const p of enJeu) {
    if (capacite <= 0 && !dryRun) break;
    const to = (p.email ?? "").trim();

    const hist = await historiqueEnvois(to, FENETRE_30J_MS, null);
    // ⚠ Contexte d'ouverture non branché ici : la raison « il a ouvert » exige
    // un dernier-open par fiche qu'on ne lit pas encore. Résultat conservateur —
    // seules les raisons « prix honoré » (tirées des events) déclenchent. C'est
    // le bon défaut : moins de relances, jamais un prétexte inventé.
    const raison = raisonRelance(p, now, {});
    const aRepondu = ontRepondu.has(to.toLowerCase());

    const decision = relanceDue({
      nbContacts30j: hist.count,
      dernierEnvoiISO: hist.dernierISO,
      aRepondu,
      raisonDisponible: Boolean(raison),
      maintenant: now,
    });

    if (!decision.du) {
      // On ne journalise que ce qui a une chance (déjà contacté) — sinon le
      // rapport se noie sous « jamais contacté » pour tout le pipe.
      if (hist.count > 0) lignes.push({ email: to, company: p.company, etat: "ignorée", motif: decision.motif });
      continue;
    }

    // decision.du ⇒ raison est non-null (relanceDue l'a exigé), mais on re-garde
    // pour le compilateur et par principe (jamais de mail sans raison).
    if (!raison) continue;
    const { subject, body } = construireRelanceMail(p, raison);
    const emailOpts = { subject, body, closerName: habillage.closerName, addressLine: habillage.addressLine, logoUrl: habillage.logoUrl };
    const html = renderEmail(emailOpts);
    const text = plainText(emailOpts);

    // Une relance n'est jamais un premier contact : rang « suivant ».
    const manques = verifieMentions(text, habillage.closerName, habillage.marque, "suivant" as RangMessage);
    if (manques.length) {
      lignes.push({ email: to, company: p.company, etat: "ignorée", motif: `mentions: ${manques.join(", ")}` });
      continue;
    }
    const divulg = verifieDivulgation(text, "email", MODE);
    if (divulg.length) {
      lignes.push({ email: to, company: p.company, etat: "ignorée", motif: `divulgation: ${divulg.join(", ")}` });
      continue;
    }
    const lint = lintForSpam(subject, body, true, countContentLinks(html));
    if (lint.level === "risque") {
      lignes.push({ email: to, company: p.company, etat: "ignorée", motif: `anti-spam: ${lint.warnings?.join(", ") || "score élevé"}` });
      continue;
    }

    if (dryRun || !smtpUtilisable(smtp)) {
      lignes.push({ email: to, company: p.company, etat: "aurait-envoyé", motif: decision.motif });
      continue;
    }

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
      await transporter.sendMail({ from: smtp.from, to, subject, text, html: trackedHtml, headers: deliverabilityHeaders(stopMailto) });
      lignes.push({ email: to, company: p.company, etat: "envoyée", motif: decision.motif });
      capacite -= 1;
    } catch (e) {
      await supprimerTrace(trackingId);
      lignes.push({ email: to, company: p.company, etat: "ignorée", motif: `SMTP: ${e instanceof Error ? e.message : "échec"}` });
    }
  }

  const envoyees = lignes.filter((l) => l.etat === "envoyée").length;
  return NextResponse.json({
    ok: true,
    armed: arme,
    dryRun,
    envoiBranche: !dryRun,
    enJeu: enJeu.length,
    ramp: { jour: ramp.today, envoyes24h, envoyes1h, plafondHoraire: maxSendsPerHour() },
    envoyees,
    lignes,
    why: dryRun
      ? "dryRun : les relances qui PARTIRAIENT. Arme l'autopilote pour envoyer."
      : "Relances réelles — raison neuve, plafond 4/30 j, divulgation art. 50, palier. Pas de raison ⇒ pas de relance.",
  });
}

/** Sonde lecture seule : combien de fiches en jeu, sans relancer. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const db = serviceClient();
  if (!db) return NextResponse.json({ armed: autopiloteArmeEnv(), enJeu: null, why: "Supabase non configuré" }, { status: 412 });
  const arme = estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) });
  const lecture = await lireProspectsOperateur(db);
  if (lecture.erreur) return NextResponse.json({ error: lecture.erreur }, { status: 500 });
  const enJeu = lecture.prospects.filter((p) => (p.email ?? "").trim() && p.stage !== "signe" && p.stage !== "perdu").length;
  return NextResponse.json({ armed: arme, envoiBranche: false, enJeu });
}
