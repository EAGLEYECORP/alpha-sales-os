import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoriserApi } from "@/lib/api-keys";
import { lireProspectsOperateur } from "@/lib/lecture-serveur";
import { firstSendAt } from "@/lib/tracking";
import { rampDepuisPremierEnvoi } from "@/lib/email-ramp";
import { preparerCampagne } from "@/lib/preparer-campagne";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PRÉPARER UNE CAMPAGNE — la surface d'ÉCRITURE qui n'écrit rien.
 *
 * Portée `campagne.read`. Un agent (Cowork) l'appelle pour composer un lot
 * d'emails à froid prêt à partir : le TEXTE EXACT de chaque mail, plafonné au
 * palier d'envoi du jour, avec le préflight art. 50. Elle ne modifie aucune
 * fiche et n'envoie AUCUN email — l'envoi reste derrière la barre d'envoi
 * serveur (palier, DKIM, mentions) et l'armement de l'autopilote, qu'un humain décide.
 *
 * ⚠ Le palier du jour est LU côté serveur (`firstSendAt` → `rampDepuisPremierEnvoi`)
 * et borne le lot. En cas de panne de lecture, `firstSendAt` rend `null` et le
 * barème retombe au palier le plus bas (5/j) — jamais l'inverse. Le plan ne
 * peut donc pas proposer plus que ce que l'envoi accepterait.
 *
 * ⚠ Aucune adresse email ne sort : le plan porte le TEXTE à relire, pas les
 * coordonnées. Même règle que `/api/v1/etat`.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function POST(req: NextRequest) {
  const v = autoriserApi(req.headers.get("authorization"), "campagne.read");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Aucune source de données côté serveur.",
        why: "Supabase n'est pas configuré. Sans lui, le serveur ne voit RIEN du pipe — le CRM vit dans le navigateur de l'opérateur.",
      },
      { status: 503 },
    );
  }

  // `max` resserre le lot SOUS le palier ; il ne peut jamais l'élargir.
  let max: number | null = null;
  try {
    const body = (await req.json()) as { max?: unknown };
    if (typeof body?.max === "number" && Number.isFinite(body.max) && body.max > 0) {
      max = Math.floor(body.max);
    }
  } catch {
    // Corps absent ou invalide : on planifie tout le palier du jour. Pas une erreur.
  }

  const lecture = await lireProspectsOperateur(db);
  if (lecture.erreur)
    return NextResponse.json({ error: "lecture impossible", detail: lecture.erreur }, { status: 500 });

  if (lecture.prospects.length === 0) {
    return NextResponse.json({
      vu: 0,
      avertissement:
        "Aucun prospect côté serveur. Ce n'est PAS un pipe vide : c'est un pipe invisible. La synchro du pipe (Réglages) est éteinte, ou n'a jamais tourné.",
      envoiBranche: false,
    });
  }

  // Le palier du jour borne le lot. Toute panne de lecture → palier le plus bas.
  const ramp = rampDepuisPremierEnvoi(await firstSendAt("email", null));
  const plafond = max !== null ? Math.min(max, ramp.today) : ramp.today;

  const plan = preparerCampagne(lecture.prospects, { plafond });

  return NextResponse.json({
    vu: lecture.prospects.length,
    ...(lecture.tronque ? { tronque: true } : {}),
    palierDuJour: ramp.today,
    palierFrais: ramp.fresh,
    // `envoiBranche: false` vient du plan (`...plan`) — une seule source.
    rappel:
      "Plan seul. Pour envoyer : faire approuver, publier le DKIM, et armer l'autopilote. L'envoi serveur applique palier + mentions + divulgation à chaque envoi réel.",
    ...plan,
    genereLe: new Date().toISOString(),
  });
}
