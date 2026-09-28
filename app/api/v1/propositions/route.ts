import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoriserApi } from "@/lib/api-keys";
import { statutReel, validerProposition, type Proposition } from "@/lib/propositions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PROPOSITIONS — le SEUL canal d'écriture d'un orchestrateur.
 *
 * POST dépose une proposition. Elle n'exécute rien : elle attend qu'un humain
 * l'approuve dans l'app. C'est ce qui permet à un agent de travailler sur un
 * pipe réel sans pouvoir se tromper de façon irréversible.
 *
 * ⚠ Ce qu'il faut refuser d'ajouter ici, même sur demande : un paramètre
 * `executer: true`. Le jour où cette route peut agir, tout l'édifice — la
 * revue humaine, la trace, la responsabilité — s'effondre en une ligne de
 * diff. C'est écrit pour que ça se voie en revue de code.
 *
 * GET liste. Portée `propositions.read` — un client peut voir ce qu'un agent
 * propose sur SON compte, pas sur celui d'un autre.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

const indisponible = () =>
  NextResponse.json(
    {
      error: "Stockage indisponible.",
      why: "Supabase n'est pas configuré. Une proposition qui ne survit pas à la requête ne sera jamais lue par personne.",
    },
    { status: 503 }
  );

export async function POST(req: NextRequest) {
  const v = autoriserApi(req.headers.get("authorization"), "propositions.write");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });

  let body: Partial<Proposition>;
  try {
    body = (await req.json()) as Partial<Proposition>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const erreurs = validerProposition(body);
  if (erreurs.length) {
    return NextResponse.json({ error: "Proposition refusée.", erreurs }, { status: 422 });
  }

  const db = serviceClient();
  if (!db) return indisponible();

  const now = new Date().toISOString();
  const proposition: Proposition = {
    id: `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: body.type!,
    // L'auteur vient de la CLÉ, jamais du corps de la requête : sinon
    // n'importe qui signerait ses propositions du nom d'un autre.
    auteur: v.appelant.nom,
    createdAt: now,
    prospectId: body.prospectId,
    titre: body.titre!.trim(),
    pourquoi: body.pourquoi!.trim(),
    contenu: body.contenu?.trim(),
    etape: body.etape?.trim(),
    quand: body.quand?.trim(),
    statut: "en-attente",
  };

  const { error } = await db.from("propositions").insert({
    id: proposition.id,
    proprietaire: v.appelant.proprietaire,
    data: proposition,
  });
  if (error) return NextResponse.json({ error: "écriture impossible", detail: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    id: proposition.id,
    statut: "en-attente",
    // Dit explicitement pour qu'aucun appelant ne croie avoir agi.
    note: "Déposée. RIEN n'a été envoyé ni modifié : un humain doit approuver dans l'app.",
  });
}

export async function GET(req: NextRequest) {
  const v = autoriserApi(req.headers.get("authorization"), "propositions.read");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });

  const db = serviceClient();
  if (!db) return indisponible();

  // Cloisonnement : une clé ne voit que les propositions de SON propriétaire.
  // L'opérateur voit tout — c'est lui qui tranche.
  let q = db.from("propositions").select("data").limit(200);
  if (v.appelant.proprietaire !== "operateur") q = q.eq("proprietaire", v.appelant.proprietaire);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });

  const now = new Date();
  const propositions = (data ?? [])
    .map((r) => r.data as Proposition)
    .filter(Boolean)
    .map((p) => ({ ...p, statut: statutReel(p, now) }));

  return NextResponse.json({ propositions, vu: propositions.length });
}
