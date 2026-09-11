import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Meeting } from "@/lib/types";
import { LOT_MAX, PROPRIETAIRE_OPERATEUR } from "@/lib/sync-prospects";
import { ligneRdv } from "@/lib/sync-meetings";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SYNCHRO DES RENDEZ-VOUS — le chemin d'écriture qui n'existait pas.
 *
 * `meetings` était lue par `/api/calendar` (le flux iCal de l'opérateur) et
 * par `/api/push/tick` (la notification du matin), et écrite par PERSONNE.
 * L'agenda partagé servait un calendrier vide, la notif du matin n'annonçait
 * aucun rendez-vous, et les deux routes rendaient 200.
 *
 * ⚠ ROUTE SÉPARÉE DE `/api/sync/prospects`, DÉLIBÉRÉMENT. Les deux tables ont
 * des garde-fous d'effacement distincts et des volumes sans rapport (des
 * milliers de fiches, des dizaines de rendez-vous). Un corps de requête qui
 * porterait les deux ferait qu'un lot de fiches trop gros empêcherait aussi
 * les rendez-vous de partir — un couplage que rien ne justifie. Le préfixe
 * `/api/sync` est déjà muré par le middleware : la route hérite de la même
 * porte sans qu'il y ait rien à ajouter.
 *
 * Le MOTEUR, lui, reste unique (`components/sync-moteur.tsx`) : un seul
 * minuteur, un seul plan. Deux moteurs se disputeraient l'état de
 * confirmation d'effacement.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const indisponible = () =>
  NextResponse.json(
    {
      error: "Supabase n'est pas configuré côté serveur.",
      why: "Il manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. Sans eux, les rendez-vous restent dans ce navigateur — le flux iCal et la notification du matin ne voient rien.",
    },
    { status: 503 }
  );

/**
 * Les EMPREINTES du serveur.
 *
 * ⚠ On lit la colonne `version`, PAS le `data` jsonb. C'est toute la raison
 * d'être des empreintes : comparer sans télécharger. Déplier chaque `data`
 * pour recalculer l'empreinte coûterait autant que de tout charger, et la
 * comparaison n'économiserait plus rien.
 */
export async function GET() {
  const db = serviceClient();
  if (!db) return indisponible();

  const { data, error } = await db
    .from("meetings")
    .select("id, version")
    .eq("proprietaire", PROPRIETAIRE_OPERATEUR);

  if (error) {
    return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });
  }

  const empreintes = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return { id: String(row.id), maj: String(row.version ?? "") };
  });
  return NextResponse.json({ empreintes });
}

interface CorpsSyncRdv {
  ecrire?: Meeting[];
  supprimer?: string[];
}

export async function POST(req: NextRequest) {
  const db = serviceClient();
  if (!db) return indisponible();

  let corps: CorpsSyncRdv;
  try {
    corps = (await req.json()) as CorpsSyncRdv;
  } catch {
    return NextResponse.json({ error: "corps JSON invalide" }, { status: 400 });
  }

  const ecrire = Array.isArray(corps.ecrire) ? corps.ecrire : [];
  const supprimer = Array.isArray(corps.supprimer) ? corps.supprimer.filter((s) => typeof s === "string") : [];

  /**
   * ⚠ Le garde-fou d'effacement se calcule côté client (`planifierSyncRdv`),
   * et se REVÉRIFIE ici sur la taille du lot — comme pour les fiches. Le
   * client n'est pas une source de vérité sur sa propre prudence.
   */
  if (supprimer.length > LOT_MAX) {
    return NextResponse.json(
      {
        error: "Trop de suppressions dans un seul lot.",
        why: `${supprimer.length} suppressions demandées, ${LOT_MAX} maximum. Un effacement massif se fait en plusieurs lots, délibérément.`,
      },
      { status: 400 }
    );
  }
  if (ecrire.length > LOT_MAX) {
    return NextResponse.json(
      { error: `Lot trop gros : ${ecrire.length} rendez-vous pour ${LOT_MAX} maximum.` },
      { status: 400 }
    );
  }

  let ecrits = 0;
  let supprimes = 0;

  if (ecrire.length) {
    // Un rendez-vous sans identifiant ni date n'est pas un rendez-vous : le
    // laisser entrer créerait une ligne que le flux iCal ne saurait pas placer.
    const lignes = ecrire
      .filter((m) => m && typeof m.id === "string" && m.id.trim() && typeof m.date === "string")
      .map(ligneRdv);

    if (lignes.length) {
      const { error } = await db.from("meetings").upsert(lignes, { onConflict: "id" });
      if (error) {
        return NextResponse.json({ error: "écriture impossible", detail: error.message }, { status: 500 });
      }
      ecrits = lignes.length;
    }
  }

  if (supprimer.length) {
    // Restreint au périmètre de l'opérateur, comme les fiches.
    const { error } = await db
      .from("meetings")
      .delete()
      .eq("proprietaire", PROPRIETAIRE_OPERATEUR)
      .in("id", supprimer);
    if (error) {
      return NextResponse.json({ error: "suppression impossible", detail: error.message }, { status: 500 });
    }
    supprimes = supprimer.length;
  }

  return NextResponse.json({ ok: true, ecrits, supprimes });
}
