import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { PROPRIETAIRE_OPERATEUR } from "@/lib/sync-prospects";
import { autoriserApi } from "@/lib/api-keys";
import { vitalSigns } from "@/lib/vital-signs";
import { statutReel, resumeFile, type Proposition } from "@/lib/propositions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉTAT DU PIPE — ce que voit un orchestrateur.
 *
 * Lecture seule, portée `etat.read`. C'est la surface qui permet à un agent
 * de SAVOIR sans pouvoir AGIR : il voit ce qui bloque, ce qui dort, ce qui
 * est prêt, et il en tire des propositions (voir /api/v1/propositions).
 *
 * ── CE QU'ELLE NE FAIT PAS, ET POURQUOI ──
 *
 * Elle ne rend AUCUNE coordonnée : ni email, ni téléphone, ni adresse. Un
 * moniteur n'a pas besoin de savoir comment joindre quelqu'un pour dire qu'il
 * faut le joindre. Sortir des coordonnées de tiers vers un agent externe
 * serait une transmission de données personnelles sans nécessité.
 *
 * ── LA VÉRITÉ SUR LA SOURCE ──
 *
 * Le CRM vit dans le navigateur de l'opérateur. Cette route lit Supabase, qui
 * n'est alimenté que si la synchro est en place. Quand la table est vide, elle
 * le DIT au lieu de rendre un zéro qui ressemble à un pipe sain — c'est la
 * différence entre « rien à faire » et « je ne vois rien ».
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function GET(req: NextRequest) {
  const v = autoriserApi(req.headers.get("authorization"), "etat.read");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Aucune source de données côté serveur.",
        why: "Supabase n'est pas configuré. Sans lui, le serveur ne voit RIEN du pipe — le CRM vit dans le navigateur de l'opérateur.",
      },
      { status: 503 }
    );
  }

  /**
   * ⚠ Restreint au périmètre de l'OPÉRATEUR.
   *
   * La requête balayait la table entière. Tant qu'il n'y a qu'un locataire ça
   * ne se voit pas ; le jour où il y en a deux, l'agent de l'un lit le pipe de
   * l'autre. Le filtre coûte un index et ferme la porte avant qu'elle serve.
   */
  const { data, error } = await db
    .from("prospects")
    .select("data")
    .eq("proprietaire", PROPRIETAIRE_OPERATEUR)
    .limit(2001);
  if (error) return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });

  const brut = (data ?? []).map((r) => r.data as Prospect).filter(Boolean);
  const tronque = brut.length > 2000;
  const prospects = tronque ? brut.slice(0, 2000) : brut;

  if (prospects.length === 0) {
    return NextResponse.json({
      vu: 0,
      // ⚠ Formulation délibérée : « je ne vois rien » ≠ « rien à faire ».
      avertissement:
        "Aucun prospect côté serveur. Ce n'est PAS un pipe vide : c'est un pipe invisible. La synchro existe (Réglages → Synchro du pipe) mais elle est éteinte, ou elle n'a encore jamais tourné.",
      propositions: { enAttente: 0, aDecider: 0, alertes: 0, expirees: 0 },
    });
  }

  const now = new Date();
  const signes = prospects.map((p) => ({ p, s: vitalSigns(p, now) }));

  // Ce qu'un moniteur doit voir, et RIEN de plus. Pas de coordonnées.
  const fiche = (x: { p: Prospect; s: ReturnType<typeof vitalSigns> }) => ({
    id: x.p.id,
    company: x.p.company,
    sector: x.p.sector,
    stage: x.p.stage,
    valeurAnnuelle: x.p.setupValue + x.p.monthlyValue * 12,
    readiness: x.s.readiness,
    fatigue: x.s.fatigueLevel,
    joursDepuisContact: x.s.daysSinceLastTouch,
    prochainePas: x.p.nextStep?.date ?? null,
  });

  const { data: propsData } = await db.from("propositions").select("data").limit(500);
  const propositions = ((propsData ?? []).map((r) => r.data as Proposition).filter(Boolean));

  return NextResponse.json({
    vu: prospects.length,
    ...(tronque ? { tronque: true, avertissement: "Plus de 2 000 fiches : seules les 2 000 premières sont observées." } : {}),
    // Trois listes, parce qu'un moniteur agit sur des ÉCARTS, pas sur un total.
    pretsASigner: signes.filter((x) => x.s.readiness >= 70).map(fiche),
    sansProchainPas: signes.filter((x) => !x.p.nextStep?.date && x.p.stage !== "signe" && x.p.stage !== "perdu").map(fiche),
    endormis: signes
      .filter((x) => (x.s.daysSinceLastTouch ?? 0) > 14 && x.p.stage !== "signe" && x.p.stage !== "perdu")
      .map(fiche),
    satures: signes.filter((x) => x.s.fatigueLevel === "sature").map(fiche),
    propositions: resumeFile(propositions, now),
    genereLe: now.toISOString(),
  });
}
