import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { LOT_MAX, PROPRIETAIRE_OPERATEUR } from "@/lib/sync-prospects";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SYNCHRO — le navigateur de l'OPÉRATEUR pousse son pipe vers le serveur.
 *
 * ── CE QUI LA DISTINGUE DE `/api/v1/prospects` ──
 *
 * `/api/v1/prospects` est la porte des CLIENTS : clé API à portée réduite,
 * fusion prudente (une fiche déjà travaillée ne perd ni son stade ni ses
 * événements parce qu'un scraper la renvoie), et jamais de suppression.
 *
 * Ici c'est l'inverse : c'est l'opérateur lui-même, sa version FAIT FOI, et
 * la réconciliation supprime ce qu'il a supprimé. Mélanger les deux dans une
 * seule route aurait donné à un intégrateur tiers le pouvoir d'effacer le
 * pipe.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware). Aucune clé
 * API, parce qu'il n'y a pas de tiers — c'est la session de l'opérateur.
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
      why: "Il manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. Sans eux, le pipe reste dans ce navigateur et l'orchestrateur ne voit rien.",
    },
    { status: 503 }
  );

/**
 * Les EMPREINTES du serveur : un identifiant et une date de modification.
 *
 * Le navigateur compare là-dessus au lieu de télécharger tout le pipe pour
 * savoir quoi envoyer. Sur 1 000 fiches, ça fait ~40 Ko au lieu de 3 Mo — et
 * c'est ce qui rend une synchro fréquente supportable.
 */
export async function GET() {
  const db = serviceClient();
  if (!db) return indisponible();

  const { data, error } = await db
    .from("prospects")
    .select("id, data->>updatedAt")
    .eq("proprietaire", PROPRIETAIRE_OPERATEUR);

  if (error) {
    return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });
  }

  const empreintes = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return { id: String(row.id), maj: String(row.updatedAt ?? "") };
  });
  return NextResponse.json({ empreintes });
}

interface CorpsSync {
  /** Les fiches à écrire (nouvelles ou modifiées). */
  ecrire?: Prospect[];
  /** Les identifiants à supprimer côté serveur. */
  supprimer?: string[];
}

export async function POST(req: NextRequest) {
  const db = serviceClient();
  if (!db) return indisponible();

  let corps: CorpsSync;
  try {
    corps = (await req.json()) as CorpsSync;
  } catch {
    return NextResponse.json({ error: "corps JSON invalide" }, { status: 400 });
  }

  const ecrire = Array.isArray(corps.ecrire) ? corps.ecrire : [];
  const supprimer = Array.isArray(corps.supprimer) ? corps.supprimer.filter((s) => typeof s === "string") : [];

  /**
   * ⚠ Le garde-fou d'effacement se calcule côté CLIENT (`planifierSync`), mais
   * il se REVÉRIFIE ici sur la taille du lot. Une route qui accepte une liste
   * de suppressions arbitraire est une route qui vide la table sur une requête
   * malformée — et le client n'est pas une source de vérité sur sa propre
   * prudence.
   */
  if (supprimer.length > LOT_MAX) {
    return NextResponse.json(
      {
        error: "Trop de suppressions dans un seul lot.",
        why: `${supprimer.length} suppressions demandées, ${LOT_MAX} maximum. Un effacement massif se fait en plusieurs lots, délibérément — pour qu'il ne puisse pas arriver par accident.`,
      },
      { status: 400 }
    );
  }
  if (ecrire.length > LOT_MAX) {
    return NextResponse.json(
      { error: `Lot trop gros : ${ecrire.length} fiches pour ${LOT_MAX} maximum.` },
      { status: 400 }
    );
  }

  let ecrites = 0;
  let supprimees = 0;

  if (ecrire.length) {
    // Une fiche sans identifiant ni entreprise n'est pas une fiche : la
    // laisser entrer créerait une ligne fantôme que rien ne pourrait relier.
    const lignes = ecrire
      .filter((p) => p && typeof p.id === "string" && p.id.trim())
      .map((p) => ({ id: p.id, proprietaire: PROPRIETAIRE_OPERATEUR, data: p }));

    if (lignes.length) {
      const { error } = await db.from("prospects").upsert(lignes, { onConflict: "id" });
      if (error) {
        return NextResponse.json({ error: "écriture impossible", detail: error.message }, { status: 500 });
      }
      ecrites = lignes.length;
    }
  }

  if (supprimer.length) {
    // Restreint au périmètre de l'opérateur : une synchro ne peut pas
    // supprimer les lignes entrées par la clé API d'un client.
    const { error } = await db
      .from("prospects")
      .delete()
      .eq("proprietaire", PROPRIETAIRE_OPERATEUR)
      .in("id", supprimer);
    if (error) {
      return NextResponse.json({ error: "suppression impossible", detail: error.message }, { status: 500 });
    }
    supprimees = supprimer.length;
  }

  return NextResponse.json({ ok: true, ecrites, supprimees });
}
