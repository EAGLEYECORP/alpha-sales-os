import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { statutReel, peutApprouver, type Proposition } from "@/lib/propositions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA FILE DE PROPOSITIONS, CÔTÉ APP.
 *
 * Route INTERNE (porte d'accès + même origine) : c'est l'opérateur connecté
 * qui lit et qui tranche, pas un agent. La route jumelle `/api/v1/propositions`
 * sert les agents, avec une clé et des portées.
 *
 * PATCH approuve ou rejette. Approuver ne DÉCLENCHE RIEN non plus : ça marque
 * la proposition comme validée, et c'est l'opérateur qui exécute depuis
 * l'app (envoyer l'email, lancer l'appel). Deux gestes, volontairement —
 * « approuver » et « faire » ne doivent pas être le même clic quand un client
 * réel est au bout.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function GET() {
  const db = serviceClient();
  // Pas de Supabase = pas de file. On le dit plutôt que de rendre une liste
  // vide, qui se lit comme « rien à faire ».
  if (!db) return NextResponse.json({ propositions: [], indisponible: true, why: "Supabase non configuré." });

  const { data, error } = await db.from("propositions").select("data").limit(200);
  if (error) return NextResponse.json({ propositions: [], indisponible: true, why: error.message });

  const now = new Date();
  const propositions = (data ?? [])
    .map((r) => r.data as Proposition)
    .filter(Boolean)
    .map((p) => ({ ...p, statut: statutReel(p, now) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ propositions });
}

export async function PATCH(req: NextRequest) {
  let body: { id?: string; decision?: "approuvee" | "rejetee"; motif?: string; par?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.id || (body.decision !== "approuvee" && body.decision !== "rejetee")) {
    return NextResponse.json({ error: "id et decision (approuvee|rejetee) requis" }, { status: 400 });
  }

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });

  const { data, error } = await db.from("propositions").select("data").eq("id", body.id).limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const p = (data ?? [])[0]?.data as Proposition | undefined;
  if (!p) return NextResponse.json({ error: "Proposition introuvable." }, { status: 404 });

  // Une proposition périmée ne s'approuve pas : le contexte a bougé, le
  // prospect a peut-être répondu. L'approuver ferait partir un message qui ne
  // correspond plus à rien.
  if (body.decision === "approuvee") {
    const v = peutApprouver(p);
    if (!v.ok) return NextResponse.json({ error: v.raison }, { status: 409 });
  }

  const suivante: Proposition = {
    ...p,
    statut: body.decision,
    decidePar: body.par?.trim() || "opérateur",
    decideLe: new Date().toISOString(),
    ...(body.decision === "rejetee" ? { motifRejet: body.motif?.trim() } : {}),
  };

  const { error: e2 } = await db.from("propositions").update({ data: suivante }).eq("id", body.id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    statut: suivante.statut,
    note:
      body.decision === "approuvee"
        ? "Approuvée. RIEN n'est parti : à toi d'exécuter depuis l'app. « Approuver » et « faire » restent deux gestes."
        : "Rejetée.",
  });
}
