import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { buildCampaignRun } from "@/lib/campaign-runner";
import { PALIERS_CAMPAGNE, plafondPalierServeur } from "@/lib/paliers-campagne";
import { appendCallAttempt, planTick, MAX_CALLS_PER_TICK } from "@/lib/campaign-tick";
import { safeEqual } from "@/lib/access";

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
  const provided = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  // Temps constant : ce secret déclenche des appels téléphoniques réels, il ne
  // doit pas révéler par la durée combien de caractères sont justes.
  return provided.length > 0 && safeEqual(provided, secret);
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
  //
  // ⚠ La limite est une TRONCATURE, et elle était muette. Au-delà de 2 000
  // fiches, celles qui suivent n'entrent jamais dans la file : elles ne sont
  // jamais rappelées, et rien dans la réponse ne le disait. Un autopilote qui
  // ignore une partie du pipe sans le signaler est pire qu'un autopilote
  // arrêté — on croit qu'il tourne.
  //
  // On lit donc UNE de plus que la limite pour SAVOIR qu'on tronque, puis on
  // le remonte dans la réponse (et n8n peut alerter dessus).
  const LIMITE_LECTURE = 2000;
  const { data, error } = await db.from("prospects").select("data").limit(LIMITE_LECTURE + 1);
  if (error) {
    return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });
  }
  const brut = (data ?? []).map((r) => r.data as Prospect).filter(Boolean);
  const tronque = brut.length > LIMITE_LECTURE;
  const prospects = tronque ? brut.slice(0, LIMITE_LECTURE) : brut;
  const avertissement = tronque
    ? `⚠ Plus de ${LIMITE_LECTURE} prospects côté serveur : seuls les ${LIMITE_LECTURE} premiers entrent dans la file. Les suivants ne sont JAMAIS rappelés — il faut paginer le tick ou filtrer côté base.`
    : undefined;
  if (prospects.length === 0) {
    return NextResponse.json({
      ok: true,
      called: 0,
      // ⚠ Ce cas n'est PAS théorique : aucun composant de l'app ne pousse les
      // prospects vers la table `prospects`. Le store vit dans le navigateur.
      // Tant que la synchro n'existe pas, l'autopilote tourne à vide en
      // rendant « ok: true » — d'où cette formulation, qui ne se lit pas
      // comme un succès.
      why: "Aucun prospect synchronisé côté serveur — l'autopilote n'a rien à appeler. Le CRM vit dans le navigateur ; il faut une synchro vers Supabase pour que le cron voie quelque chose.",
    });
  }

  /**
   * ── LE PALIER DE CAMPAGNE, CÔTÉ SERVEUR ──
   *
   * Même philosophie que `CAMPAIGN_AUTOPILOT` : déployer ne suffit jamais, il
   * faut un second geste délibéré. Le palier ne se lit PAS dans les réglages
   * du navigateur — ils n'arrivent pas jusqu'ici, et un cron qui déduirait
   * tout seul qu'il a le droit de monter à 1 000 appels serait précisément le
   * bug qu'on refuse.
   *
   * ⚠ Absent ou illisible = palier le plus bas. Jamais « pas de plafond » :
   * une variable mal orthographiée ne doit pas ouvrir les vannes.
   */
  const plafondPalier = plafondPalierServeur(process.env.CAMPAIGN_PALIER);

  // ── La file, avec toutes les portes habituelles (jamais de force) ──
  const run = buildCampaignRun(prospects, { accountId, plafondPalier });

  if (run.queue.length === 0 && run.skipped.some((s) => s.reason === "palier-atteint")) {
    return NextResponse.json({
      ok: true,
      called: 0,
      palier: plafondPalier,
      composes: run.composesTotal,
      why:
        `Palier de ${plafondPalier} appels atteint (${run.composesTotal} composés). L'autopilote s'arrête ici : ` +
        `mesure ce qui est déjà sorti, valide le palier dans l'app, puis passe CAMPAIGN_PALIER au cran suivant.`,
    });
  }
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
      // Borné : l'autopilote tourne sur un cron. Un appel qui pend consomme
      // tout le budget de la fonction, le cron repart, et on ne sait pas si
      // l'appel précédent est parti ou non — c'est le pire état possible pour
      // une route qui compose des numéros.
      const res = await fetch(`${base}/api/voice/call`, {
        signal: AbortSignal.timeout(20_000),
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
    // Remonté à l'ordonnanceur : c'est le seul endroit où quelqu'un le lira.
    ...(avertissement ? { tronque: true, avertissement, lus: prospects.length } : {}),
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
    palier:
      (process.env.CAMPAIGN_PALIER ?? "").trim() ||
      `non défini — plafond le plus bas appliqué (${PALIERS_CAMPAGNE[0].appels} appels cumulés)`,
    note: "POST pour exécuter. Sans CAMPAIGN_AUTOPILOT=on, la route simule et rend ce qu'elle aurait fait.",
  });
}
