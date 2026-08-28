import { NextRequest, NextResponse } from "next/server";
import { renderEmail, plainText } from "@/lib/email-html";
import { createTrackedEmail, countRecentSends, contactedEmails } from "@/lib/tracking";
import { deliverabilityHeaders, lintForSpam, maxSendsPerHour } from "@/lib/deliverability";
import { getTenant } from "@/lib/tenant";
import { accountTier } from "@/lib/stripe";
import { FREE_TIER, startOfMonthMs } from "@/lib/plans";
import { isDemoProspect, EMAILS_DE_DEMO } from "@/lib/seed";

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
 *  · pied « Répondez STOP » + List-Unsubscribe mailto (géré par n8n),
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
  /** Pièces jointes (ex. audit cadeau). Contenu en base64. */
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
}

/** Borne les pièces jointes : ≤ 3 fichiers, ≤ 400 Ko chacun (décodé). */
function safeAttachments(atts: SendRequest["attachments"]) {
  if (!Array.isArray(atts) || atts.length === 0) return [];
  return atts.slice(0, 3).flatMap((a) => {
    if (!a?.filename || !a?.contentBase64) return [];
    const content = Buffer.from(a.contentBase64, "base64");
    if (content.length === 0 || content.length > 400_000) return [];
    return [{ filename: a.filename.slice(0, 120), content, contentType: a.contentType || undefined }];
  });
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
  // Marge pour d'éventuelles pièces jointes en base64 (audit cadeau ≈ 6 Ko).
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 1_500_000) {
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

  /**
   * ─────────────────────────────────────────────────────────────────────
   * AUCUN ENVOI VERS UNE FICHE DE DÉMONSTRATION — AU POINT DE PASSAGE.
   *
   * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT. La boîte d'envoi refusait ces fiches,
   * et elle expliquait pourquoi : « Écrire à l'une d'elles produit un rebond
   * dur, et les rebonds comptent contre ton domaine pendant des mois. »
   *
   * Trois AUTRES surfaces appelaient cette route sans ce contrôle :
   * `/newsletter` (« Envoyer à 4 destinataire(s) », en LOT, d'un seul
   * bouton), la revue de campagne, et la barre d'envoi d'une fiche. La garde
   * existait, câblée à un seul endroit — le défaut le plus fréquent de ce
   * dépôt.
   *
   * Le contrôle vit donc ICI, où passent tous les envois. Une quatrième
   * surface écrite demain est couverte sans que personne y pense.
   *
   * Deux clés, toutes deux DÉRIVÉES du jeu de démonstration :
   *  · `prospectId` — l'identifiant, quand l'appelant le fournit ;
   *  · l'adresse elle-même — pour l'appelant qui ne le fournirait pas.
   * On refuse en 409 (conflit d'état), pas en 400 : la requête est correcte,
   * c'est la CIBLE qui ne doit pas être écrite.
   * ─────────────────────────────────────────────────────────────────────
   */
  const cibleDemo =
    (body.prospectId ? isDemoProspect(body.prospectId) : false) ||
    EMAILS_DE_DEMO.has(body.to.trim().toLowerCase());
  if (cibleDemo) {
    return NextResponse.json(
      {
        error:
          "Fiche de démonstration — adresse inventée. Écrire dessus produit un rebond dur, et les rebonds comptent contre ton domaine pendant des mois. Charge tes vraies fiches (Réglages → Tout vider, puis importe ton CSV).",
        demo: true,
      },
      { status: 409 }
    );
  }

  // Locataire courant (multi-compte) : identité + accès. Résolu une fois, réutilisé.
  const tenant = await getTenant(request);
  const tenantId = tenant?.id ?? null;

  // Freemium (opt-in REQUIRE_SUBSCRIPTION). Envoyer est l'action à valeur :
  //  · unmetered/owner/active → illimité (usage loyal) ;
  //  · anon (aucun compte)    → bloqué ;
  //  · free                   → autorisé jusqu'au quota mensuel, puis 402.
  // Solo / facturation non exigée : « unmetered » → aucun effet.
  const tier = await accountTier(tenantId, tenant?.email ?? null);
  if (tier === "anon") {
    return NextResponse.json(
      { error: "Compte requis pour envoyer — connecte-toi (/compte).", needsSubscription: true },
      { status: 402 }
    );
  }
  if (tier === "free" && body.channel === "email" && tenantId) {
    const usedThisMonth = await countRecentSends("email", Date.now() - startOfMonthMs(), tenantId);
    if (usedThisMonth >= FREE_TIER.emailsPerMonth) {
      return NextResponse.json(
        {
          error: `Quota gratuit atteint (${FREE_TIER.emailsPerMonth} e-mails/mois). Passe à Solo ou Pro pour continuer — /compte.`,
          needsSubscription: true,
          quota: { used: usedThisMonth, limit: FREE_TIER.emailsPerMonth },
        },
        { status: 402 }
      );
    }
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

    // Le tenantId (résolu plus haut) borne rate-limit, dédup et tracking à SON
    // périmètre. En solo (pas de compte), null → comportement d'origine.

    // Rate-limit anti-pic (durable) : nb d'emails partis dans la dernière heure.
    const recent = await countRecentSends("email", 3600_000, tenantId);
    if (recent >= maxSendsPerHour()) {
      return NextResponse.json(
        { error: `Limite d'envoi atteinte (${maxSendsPerHour()}/h, anti-spam). Réessaie plus tard.` },
        { status: 429, headers: { "retry-after": "300" } }
      );
    }

    // Dédup durable « déjà contacté » : ne pas recontacter avant la fenêtre de
    // refroidissement (partagé entre instances via Supabase). force:true passe outre.
    const cooldownDays = Number(process.env.CONTACT_COOLDOWN_DAYS ?? 14);
    if (cooldownDays > 0 && !body.force) {
      const already = await contactedEmails([to], cooldownDays * 86_400_000, tenantId);
      if (already.has(to.toLowerCase())) {
        return NextResponse.json(
          { error: `Déjà contacté dans les ${cooldownDays} derniers jours — renvoie avec force:true si nécessaire.`, alreadyContacted: true },
          { status: 409 }
        );
      }
    }

    const subject = body.subject?.trim() || "(sans objet)";
    const base = baseUrlFrom(request);

    // Rendu HTML soigné + alternative texte (pied « Répondez STOP »).
    const emailOpts = {
      subject,
      body: body.body,
      closerName: process.env.CLOSER_NAME || "EAGLEYE",
      ctaLabel: body.ctaLabel,
      ctaUrl: body.ctaUrl,
      // Logo aigle hébergé (PNG public, non gaté par le middleware).
      logoUrl: `${base}/email-eagle.png`,
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
      userId: tenantId ?? undefined,
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
      // List-Unsubscribe en mailto : le clic natif envoie un email STOP,
      // traité par le même flux entrant que « Répondez STOP ».
      const stopMailto = (SMTP_FROM ?? SMTP_USER)?.match(/<([^>]+)>/)?.[1] ?? SMTP_FROM ?? SMTP_USER;
      const info = await transporter.sendMail({
        from: SMTP_FROM ?? SMTP_USER,
        to,
        subject,
        text,
        html: trackedHtml,
        headers: deliverabilityHeaders(stopMailto),
        attachments: safeAttachments(body.attachments),
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
        signal: AbortSignal.timeout(30_000),
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
