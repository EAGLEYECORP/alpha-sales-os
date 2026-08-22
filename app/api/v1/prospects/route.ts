import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { normalizeBatch, KNOWN_FIELDS } from "@/lib/api-ingest";
import { triageImport } from "@/lib/import-triage";
import { safeEqual } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * ─────────────────────────────────────────────────────────────────────
 * API PUBLIQUE v1 — ingestion de prospects.
 *
 * C'est la porte d'entrée des intégrations : n8n, un CRM client, un
 * formulaire de site, un scraper. On envoie du JSON, on récupère un verdict.
 *
 * Authentification : `Authorization: Bearer <clé>`, la clé devant figurer
 * dans `ALPHA_API_KEYS` (liste séparée par des virgules). Sans cette variable,
 * la route est FERMÉE — une API d'écriture ouverte par défaut est une faute.
 *
 * Ce que la réponse rend, et pourquoi :
 *   · ce qui est ENTRÉ, ce qui est REFUSÉ (avec l'index et la raison) ;
 *   · les AVERTISSEMENTS par ligne — un intégrateur qui envoie `telephone`
 *     au lieu de `phone` doit l'apprendre à la première requête ;
 *   · le TRIAGE du lot : combien de fiches sont réellement appelables, où
 *     part le lot, et ce qui manque le plus souvent. Importer 1 000 lignes ne
 *     veut rien dire ; savoir que 40 sont exploitables, si.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function authorized(req: NextRequest): boolean {
  const raw = process.env.ALPHA_API_KEYS?.trim();
  // Pas de clés configurées = la route n'existe pas. Volontaire.
  if (!raw) return false;
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : (req.headers.get("x-api-key") ?? "").trim();
  if (provided.length === 0) return false;
  // Comparaison à temps constant sur CHAQUE clé : `includes` s'arrête au
  // premier caractère différent. On teste tout, sans court-circuit, pour ne
  // pas signaler par la durée combien de caractères sont justes.
  let ok = false;
  for (const k of keys) if (safeEqual(provided, k)) ok = true;
  return ok;
}

const unauthorized = () =>
  NextResponse.json(
    {
      error: "non autorisé",
      why: "Fournis « Authorization: Bearer <clé> ». Les clés valides sont listées dans ALPHA_API_KEYS côté serveur.",
    },
    { status: 401 }
  );

export async function POST(req: NextRequest) {
  if (!authorized(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // On accepte un tableau, ou { prospects: [...] } — les intégrations
  // envoient l'un ou l'autre selon l'outil, autant les prendre tous les deux.
  const rows = Array.isArray(body)
    ? body
    : Array.isArray((body as { prospects?: unknown[] })?.prospects)
      ? (body as { prospects: unknown[] }).prospects
      : null;

  if (!rows) {
    return NextResponse.json(
      { error: "Corps attendu : un tableau, ou { \"prospects\": [...] }.", champsConnus: KNOWN_FIELDS },
      { status: 400 }
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0, summary: "Lot vide — rien à faire." });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: `Lot trop grand (${rows.length}). Maximum 500 fiches par requête — découpe l'envoi.` },
      { status: 413 }
    );
  }

  const batch = normalizeBatch(rows);
  const accountId = new URL(req.url).searchParams.get("accountId") ?? "eagleye";

  // Le triage tourne AVANT l'écriture : même si le stockage échoue, l'appelant
  // sait ce que valait son lot.
  const triage = triageImport(batch.accepted, accountId);

  const db = serviceClient();
  let stored = 0;
  let storeError: string | undefined;

  if (db && batch.accepted.length > 0) {
    // On fusionne avec l'existant plutôt que d'écraser : une fiche déjà
    // travaillée ne doit pas perdre son stade ni ses événements parce qu'un
    // scraper la renvoie.
    const ids = batch.accepted.map((p) => p.id);
    const { data: existing } = await db.from("prospects").select("id, data").in("id", ids);
    const byId = new Map((existing ?? []).map((r) => [String(r.id), r.data as Prospect]));

    const rowsToWrite = batch.accepted.map((incoming) => {
      const prev = byId.get(incoming.id);
      const merged: Prospect = prev
        ? {
            ...prev,
            // Identité et coordonnées se rafraîchissent ; le travail terrain reste.
            company: incoming.company || prev.company,
            name: incoming.name || prev.name,
            email: incoming.email ?? prev.email,
            phone: incoming.phone ?? prev.phone,
            city: incoming.city || prev.city,
            sector: incoming.sector !== "autre" ? incoming.sector : prev.sector,
            notes: incoming.notes || prev.notes,
            deepAudit: {
              ...prev.deepAudit,
              ...Object.fromEntries(
                Object.entries(incoming.deepAudit).filter(([, v]) => v !== undefined && v !== "")
              ),
            },
            auditScore: Math.max(prev.auditScore, incoming.auditScore),
            updatedAt: new Date().toISOString(),
          }
        : incoming;
      return { id: merged.id, data: merged };
    });

    const { error } = await db.from("prospects").upsert(rowsToWrite, { onConflict: "id" });
    if (error) storeError = error.message;
    else stored = rowsToWrite.length;
  }

  return NextResponse.json(
    {
      ok: true,
      accepted: batch.accepted.length,
      rejected: batch.rejected,
      warnings: batch.warnings,
      summary: batch.summary,
      stored,
      ...(storeError ? { storeError } : {}),
      ...(db ? {} : { note: "Supabase non configuré : les fiches ont été validées mais PAS enregistrées." }),
      triage: {
        verdict: triage.verdict,
        chaudes: triage.byFit.chaud,
        tiedes: triage.byFit.tiede,
        froides: triage.byFit.froid,
        injoignables: triage.unusable,
        comptes: triage.accounts,
        trous: triage.topGaps,
      },
    },
    { status: batch.rejected.length && batch.accepted.length === 0 ? 422 : 200 }
  );
}

/** Documentation vivante : ce que la route accepte. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return unauthorized();
  return NextResponse.json({
    version: "v1",
    methode: "POST",
    corps: 'Un tableau de fiches, ou { "prospects": [...] }. Maximum 500 par requête.',
    champsConnus: KNOWN_FIELDS,
    obligatoire: "company (ou un de ses alias)",
    jamaisAccepte: ["stage", "probability", "payments", "contract"],
    pourquoi:
      "Le stade du pipeline et les paiements ne se pilotent pas depuis l'extérieur : un système tiers " +
      "n'a pas à décider qu'un prospect est signé.",
    stockage: serviceClient() ? "Supabase" : "aucun (validation seule)",
  });
}
