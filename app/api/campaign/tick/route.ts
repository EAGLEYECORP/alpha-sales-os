import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { buildCampaignRun } from "@/lib/campaign-runner";
import { appendCallAttempt, planTick, MAX_CALLS_PER_TICK } from "@/lib/campaign-tick";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * DÉCLENCHEUR AUTOMATIQUE DE CAMPAGNE.
 *
 * Appelé par un cron (Vercel Cron ou n8n). Construit la file, prend la tête,
 * écrit la tentative, puis déclenche l'appel.
 *
 * ⚠ TROIS CONDITIONS, toutes obligatoires, aucune contournable :
 *
 *  1. SECRET — `CRON_SECRET` doit être configuré ET fourni. Sans secret
 *     configuré, la route REFUSE de tourner. Une route qui déclenche des
 *     appels téléphoniques réels ne peut pas être ouverte au monde.
 *
 *  2. ARMEMENT EXPLICITE — `CAMPAIGN_AUTOPILOT=on` doit être posé en variable
 *     d'environnement. Sans lui, la route s'exécute en SIMULATION et rend ce
 *     qu'elle AURAIT fait. Déployer ce fichier ne suffit donc jamais à faire
 *     partir un appel : il faut un second geste, délibéré.
 *
 *  3. DONNÉES SERVEUR — les prospects doivent être synchronisés dans Supabase.
 *     Le store de l'app vit dans le navigateur ; sans synchronisation, un cron
 *     serveur ne voit RIEN et ne peut rien appeler. La route le dit au lieu de
 *     rendre un succès vide.
 *
 * La fenêtre horaire n'est JAMAIS forcée en automatique : `force` n'existe pas
 * ici. Un humain peut décider d'appeler un samedi ; une machine, non.
 * ─────────────────────────────────────────────────────────────────────
 */

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
  const provided = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "";
  return provided === secret;
}

const armed = () => (process.env.CAMPAIGN_AUTOPILOT ?? "").trim().toLowerCase() === "on";

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Une route qui passe des appels ne s'ouvre pas." },
      { status: 401 }
    );
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Supabase non configuré",
        why:
          "Les prospects vivent dans le navigateur tant que la synchronisation n'est pas activée. " +
          "Un cron serveur ne voit alors aucune donnée — il ne peut pas appeler à l'aveugle.",
      },
      { status: 412 }
    );
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") ?? "eagleye";
  const max = Number(url.searchParams.get("max") ?? MAX_CALLS_PER_TICK);
  const dryRun = !armed() || url.searchParams.get("dryRun") === "1";

  // ── Lecture des prospects ──
  const { data, error } = await db.from("prospects").select("data").limit(2000);
  if (error) {
    return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });
  }
  const prospects = (data ?? []).map((r) => r.data as Prospect).filter(Boolean);
  if (prospects.length === 0) {
    return NextResponse.json({ ok: true, called: 0, why: "Aucun prospect synchronisé côté serveur." });
  }

  // ── La file, avec toutes les portes habituelles (jamais de force) ──
  const run = buildCampaignRun(prospects, { accountId });
  if (!run.windowOpen) {
    return NextResponse.json({
      ok: true,
      called: 0,
      skipped: run.queue.length,
      why: `Fenêtre fermée — ${run.windowWhy} Une machine n'appelle pas hors des heures ouvrées.`,
    });
  }

  const plan = planTick(run.queue.map((t) => t.prospectId), prospects, { max });
  const tasks = run.queue.filter((t) => plan.take.includes(t.prospectId));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      simulation: true,
      why: armed()
        ? "dryRun demandé explicitement."
        : "CAMPAIGN_AUTOPILOT n'est pas sur « on » — rien ne part tant que ce second geste n'est pas fait.",
      wouldCall: tasks.map((t) => ({ prospectId: t.prospectId, company: t.company, phone: t.phone, objective: t.objective })),
      queueSize: run.queue.length,
      tooSoon: plan.tooSoon.length,
      cap: plan.cap,
    });
  }

  // ── Exécution ──
  const base = url.origin;
  const results: { prospectId: string; company: string; ok: boolean; detail?: string }[] = [];

  for (const t of tasks) {
    const p = prospects.find((x) => x.id === t.prospectId);
    if (!p) continue;

    // ⚠ L'ORDRE EST CRITIQUE : on écrit la tentative AVANT d'appeler.
    // Un crash après l'écriture coûte un appel manqué ; l'ordre inverse
    // coûterait un appel RÉPÉTÉ à chaque tick — du harcèlement.
    const updated = appendCallAttempt(p);
    const { error: wErr } = await db.from("prospects").update({ data: updated }).eq("id", p.id);
    if (wErr) {
      results.push({ prospectId: p.id, company: t.company, ok: false, detail: `écriture refusée : ${wErr.message}` });
      continue; // sans trace écrite, on n'appelle PAS.
    }

    try {
      const res = await fetch(`${base}/api/voice/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "prospection-b2b",
          phone: t.phone,
          company: t.company,
          prospectBrief: t.brief,
          prospectId: t.prospectId,
          accountId: t.accountId,
          isProfessional: true,
          optedOut: false,
          // `force` volontairement absent : la fenêtre ne se force pas en auto.
        }),
      });
      const body = (await res.json()) as Record<string, unknown>;
      results.push({
        prospectId: p.id,
        company: t.company,
        ok: res.ok && body.dispatched === true,
        detail: res.ok ? undefined : ((body.error as string) ?? `HTTP ${res.status}`),
      });
    } catch (e) {
      results.push({ prospectId: p.id, company: t.company, ok: false, detail: e instanceof Error ? e.message : "réseau" });
    }
  }

  return NextResponse.json({
    ok: true,
    called: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    queueSize: run.queue.length,
    tooSoon: plan.tooSoon.length,
    results,
  });
}

/** GET = état du pilote, sans rien déclencher. Utile pour vérifier la config. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json({
    autopilot: armed() ? "armé" : "désarmé (simulation)",
    supabase: serviceClient() ? "configuré" : "absent — le cron ne verrait aucun prospect",
    maxParTick: MAX_CALLS_PER_TICK,
    note: "POST pour exécuter. Sans CAMPAIGN_AUTOPILOT=on, la route simule et rend ce qu'elle aurait fait.",
  });
}
