import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import { moteurIADeLaRequete } from "@/lib/credentials-secret";
import { aiAvailable } from "@/lib/ai-engine";
import { wrapUntrusted } from "@/lib/untrusted";
import { deciderTypee } from "@/lib/decision-typee";
import { autopiloteArmeEnv, estArme, lireDrapeauAutopilote } from "@/lib/autopilote";
import { autoReponseAttestee, doitEnvoyerReponse } from "@/lib/reply-autosend";
import { DROIT_SOLO } from "@/lib/entitlements";
import { habillageEnvoi } from "@/lib/expediteur";
import { renderEmail, plainText } from "@/lib/email-html";
import { verifieMentions, type RangMessage } from "@/lib/conformite";
import { verifieDivulgation, type ModeProduction } from "@/lib/signature-ia";
import { rampDepuisPremierEnvoi } from "@/lib/email-ramp";
import { lintForSpam, maxSendsPerHour, deliverabilityHeaders } from "@/lib/deliverability";
import { createTrackedEmail, countRecentSends, firstSendAt, aDejaEcrit, supprimerTrace } from "@/lib/tracking";
import { resoudreSmtp, smtpUtilisable } from "@/lib/credentials-secret";
import { lireMeetingsBornes } from "@/lib/lecture-serveur";
import { prochainsCreneaux, labelsCreneaux } from "@/lib/creneaux-rdv";
import {
  INTENTIONS,
  PROMPT_CLASSER_REPONSE,
  interpreterClassement,
  routerReponse,
  estAutomatisable,
  construireReponseAuto,
  type Disposition,
  type IntentionReponse,
} from "@/lib/reponse-auto";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTOPILOTE DES RÉPONSES ENTRANTES — le maillon qui retire l'humain de la
 * BOUCLE email, sans le retirer du CLOSE.
 *
 * Le tick lit les réponses non traitées, les fait CLASSER par le modèle
 * (`lib/reponse-auto.ts`), et le CODE décide quoi en faire. Le milieu de tunnel
 * SÛR (`veut-rdv`, `renseignement`) reçoit une réponse DÉTERMINISTE ; tout ce qui
 * touche l'argent, la signature ou le doute REMONTE à l'humain.
 *
 * ⚠⚠ L'ENVOI EST FAIL-CLOSED (`lib/reply-autosend.ts`). Trois conditions
 * cumulatives : intention automatisable, autopilote armé, et DKIM attesté
 * (`REPLY_AUTOSEND=on`). Le serveur NE PEUT PAS vérifier le DKIM (c'est du DNS) ;
 * c'est l'opérateur qui l'atteste après l'avoir relevé. Tant que l'attestation
 * manque, la boucle est BRANCHÉE mais INERTE : elle planifie, elle n'envoie pas.
 *
 * ⚠ Quand elle envoie, elle passe EXACTEMENT les gardes de `mail-tick` /
 * `/api/send` : mentions, divulgation IA (art. 50), lint anti-spam, palier +
 * plafond horaire, tracking. Un envoi réussi marque la réponse `processed` — un
 * message parti deux fois est un bug, pas une relance.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAX_REPONSES_PAR_TICK = 3;
const MODE: ModeProduction = "autonome";

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

/** Ne compter que les VRAIS liens de contenu (hors désinscription) — comme `/api/send`. */
function countContentLinks(html: string): number {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]).filter((u) => !u.includes("/api/unsubscribe"));
  return new Set(urls).size;
}

interface EntrantABrasser {
  id: string;
  email: string;
  name: string | null;
  message: string;
}

interface LigneDuPlan {
  id: string;
  email: string;
  intention: IntentionReponse;
  disposition: Disposition;
  motif: string;
  automatisable: boolean;
  source: "laya" | "jev" | "llm";
  /** true seulement si le tick a RÉELLEMENT envoyé la réponse. */
  envoye: boolean;
  /** Pourquoi envoyé / pas envoyé — jamais décoratif. */
  raisonEnvoi: string;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Un tick qui lit et répond aux prospects ne s'ouvre pas." },
      { status: 401 },
    );
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Supabase non configuré",
        why: "Les réponses entrantes vivent dans `inbound_events`. Sans service role, ce tick ne voit rien.",
      },
      { status: 412 },
    );
  }

  const arme = estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) });
  const atteste = autoReponseAttestee();
  // La boucle d'envoi est-elle LIVE ? (armée ET DKIM attesté). Sinon : plan seul.
  const envoiLive = arme && atteste;

  const moteur = await moteurIADeLaRequete(req);
  if (!aiAvailable(moteur)) {
    return NextResponse.json(
      { error: "IA indisponible", why: "Le tri d'une réponse en langage libre exige le modèle — pas une liste de mots-clés." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get("max") ?? 20) || 20, 50);

  const { data, error } = await db
    .from("inbound_events")
    .select("id, email, name, message, type")
    .eq("processed", false)
    .eq("type", "email.reply")
    .order("received_at", { ascending: true })
    .limit(max);
  if (error) return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });

  const entrants: EntrantABrasser[] = (data ?? []).map((r) => ({
    id: String(r.id),
    email: String(r.email ?? ""),
    name: r.name ? String(r.name) : null,
    message: String(r.message ?? ""),
  }));

  // ── Ce qu'il faut pour ENVOYER (résolu une fois, utilisé seulement si live). ──
  const base = baseUrlFrom(req);
  const habillage = habillageEnvoi({ accountId: "eagleye", base });
  const smtp = envoiLive ? await resoudreSmtp(null, DROIT_SOLO) : null;
  const ramp = rampDepuisPremierEnvoi(await firstSendAt("email", null));
  const envoyes24h = envoiLive ? await countRecentSends("email", 86_400_000, null) : 0;
  const envoyes1h = envoiLive ? await countRecentSends("email", 3_600_000, null) : 0;
  let capacite = envoiLive
    ? Math.max(0, Math.min(ramp.today - envoyes24h, maxSendsPerHour() - envoyes1h, MAX_REPONSES_PAR_TICK))
    : 0;

  // B3 — de VRAIS créneaux à proposer (fenêtres ouvertes, RDV calés évités).
  // Lu une fois par tick ; le close reste humain.
  let creneaux: string[] = [];
  if (envoiLive) {
    const rdv = await lireMeetingsBornes(db);
    const occupes = (rdv.meetings ?? [])
      .map((m) => new Date(m.date))
      .filter((d) => !Number.isNaN(d.getTime()));
    creneaux = labelsCreneaux(prochainsCreneaux(new Date(), { occupes }));
  }

  const plan: LigneDuPlan[] = [];
  for (const e of entrants) {
    const { valeur: intention, source } = await deciderTypee<IntentionReponse>({
      texteEntrant: wrapUntrusted("message-entrant", e.message, { maxChars: 4_000 }),
      promptSysteme: PROMPT_CLASSER_REPONSE,
      valeurs: INTENTIONS,
      valider: interpreterClassement,
      moteur,
    });
    const routage = routerReponse(intention);
    const automatisable = estAutomatisable(intention);
    const decision = doitEnvoyerReponse({ automatisable, arme, atteste });

    let envoye = false;
    let raisonEnvoi = decision.raison;

    // Envoi réel : seulement si la décision l'autorise, qu'il reste du budget,
    // et que la boîte maître est utilisable. Sinon on reste au PLAN.
    if (decision.envoyer && capacite > 0 && smtp && smtpUtilisable(smtp)) {
      const to = e.email.trim();
      const reponse = construireReponseAuto(intention, e.name ?? undefined, creneaux);
      if (!reponse) {
        raisonEnvoi = "aucun gabarit — intention non automatisable (ne devrait pas arriver ici)";
      } else {
        const emailOpts = {
          subject: reponse.subject,
          body: reponse.body,
          closerName: habillage.closerName,
          addressLine: habillage.addressLine,
          logoUrl: habillage.logoUrl,
        };
        const html = renderEmail(emailOpts);
        const text = plainText(emailOpts);
        // Une réponse n'est jamais un premier contact : rang « suivant » (pas de
        // mention de provenance), mais expéditeur + STOP restent exigés.
        const rang: RangMessage = (await aDejaEcrit("email", to, null)) ? "suivant" : "premier";
        const manques = verifieMentions(text, habillage.closerName, habillage.marque, rang);
        const divulg = verifieDivulgation(text, "email", MODE);
        const lint = lintForSpam(reponse.subject, reponse.body, true, countContentLinks(html));

        if (manques.length) {
          raisonEnvoi = `NON envoyé — mentions: ${manques.join(", ")}`;
        } else if (divulg.length) {
          raisonEnvoi = `NON envoyé — divulgation: ${divulg.join(", ")}`;
        } else if (lint.level === "risque") {
          raisonEnvoi = `NON envoyé — anti-spam: ${lint.warnings?.join(", ") || "score élevé"}`;
        } else {
          const { id: trackingId, html: trackedHtml } = await createTrackedEmail(html, base, {
            channel: "email",
            email: to,
            subject: reponse.subject,
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
              subject: reponse.subject,
              text,
              html: trackedHtml,
              headers: deliverabilityHeaders(stopMailto),
            });
            // ⚠ Marquer traité APRÈS un envoi réussi : sinon le prochain tick
            // renvoie la même réponse. Un message parti deux fois est un bug.
            await db.from("inbound_events").update({ processed: true }).eq("id", e.id);
            envoye = true;
            capacite -= 1;
            raisonEnvoi = "envoyé (réponse déterministe, dans les gardes)";
          } catch (err) {
            // Une trace ne survit pas à un envoi raté (1 ligne = 1 message parti).
            await supprimerTrace(trackingId);
            raisonEnvoi = `NON envoyé — SMTP: ${err instanceof Error ? err.message : "échec"}`;
          }
        }
      }
    }

    plan.push({
      id: e.id,
      email: e.email,
      intention,
      disposition: routage.disposition,
      motif: routage.motif,
      automatisable,
      source,
      envoye,
      raisonEnvoi,
    });
  }

  const parDisposition = (d: Disposition) => plan.filter((l) => l.disposition === d).length;
  const envoyes = plan.filter((l) => l.envoye).length;

  return NextResponse.json({
    ok: true,
    armed: arme,
    // Honnête et central : la boucle envoie-t-elle réellement, ou planifie-t-elle ?
    envoiBranche: envoiLive,
    autoReponse: atteste,
    dkimRequis: true,
    lus: entrants.length,
    envoyes,
    compte: {
      auto: parDisposition("auto"),
      escalade: parDisposition("escalade"),
      clore: parDisposition("clore"),
    },
    plan,
    why: envoiLive
      ? "Auto-réponse LIVE : le milieu de tunnel reçoit une réponse déterministe, dans les gardes. Le reste remonte à l'humain."
      : "Plan seul : le modèle CLASSE, le code DISPOSE. L'auto-envoi s'active avec l'autopilote armé ET REPLY_AUTOSEND=on (DKIM attesté).",
  });
}

/** Sonde de lecture seule — combien de réponses attendent le tri, sans les traiter. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const db = serviceClient();
  if (!db)
    return NextResponse.json(
      { armed: autopiloteArmeEnv(), autoReponse: autoReponseAttestee(), enAttente: null, why: "Supabase non configuré" },
      { status: 412 },
    );
  const arme = estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) });
  const atteste = autoReponseAttestee();
  const { count, error } = await db
    .from("inbound_events")
    .select("id", { count: "exact", head: true })
    .eq("processed", false)
    .eq("type", "email.reply");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ armed: arme, autoReponse: atteste, envoiBranche: arme && atteste, enAttente: count ?? 0 });
}
