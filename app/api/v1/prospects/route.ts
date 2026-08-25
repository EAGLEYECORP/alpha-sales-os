import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { normalizeBatch, KNOWN_FIELDS } from "@/lib/api-ingest";
import { triageImport } from "@/lib/import-triage";
import { autoriserApi } from "@/lib/api-keys";

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

/**
 * ⚠ Cette route vérifiait la clé À LA MAIN, sans PORTÉE.
 *
 * N'importe quelle clé valide pouvait donc écrire des prospects — y compris
 * une clé délivrée à un client pour tout autre chose. Le système de portées
 * existait déjà (`lib/api-keys.ts`) et cette route, la seule qui ÉCRIT, ne
 * s'en servait pas. Le test « toute route /api/v1 vérifie une portée » passait
 * parce qu'il acceptait la simple mention de `ALPHA_API_KEYS` : il regardait
 * le mot, pas le mécanisme.
 *
 * `autoriserApi` apporte aussi le PROPRIÉTAIRE de la clé, et c'est lui qui
 * rend `proprietaire` utile en base : les fiches d'un client lui restent
 * attribuées, donc la synchro de l'opérateur ne peut pas les supprimer.
 */

export async function POST(req: NextRequest) {
  const v = autoriserApi(req.headers.get("authorization"), "prospects.write");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });

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
      // ⚠ `proprietaire` est OBLIGATOIRE : sans lui, la ligne n'est lue ni par
      // l'orchestrateur ni par la synchro, et l'ingestion écrivait dans le
      // vide. C'est aussi ce qui empêche une synchro de l'opérateur de
      // supprimer les fiches entrées par la clé d'un client.
      return { id: merged.id, proprietaire: v.appelant.proprietaire, data: merged };
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
  // La documentation se lit avec la portée de LECTURE : décrire une route
  // d'écriture n'exige pas le droit d'écrire.
  const v = autoriserApi(req.headers.get("authorization"), "prospects.read");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });
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
