import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Prospect } from "@/lib/types";
import { buildCampaignRun } from "@/lib/campaign-runner";
import { plafondPalierServeur } from "@/lib/paliers-campagne";
import { etatMoniteur, type EtatAutopilote } from "@/lib/moniteur";
import { PROPRIETAIRE_OPERATEUR } from "@/lib/sync-prospects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MONITEUR — ce que la machine a réellement fait.
 *
 * Lecture seule. Elle ne déclenche rien, ne compose rien, n'écrit rien : c'est
 * ce qui permet de la consulter d'un pouce, vingt fois par jour, sans risque.
 *
 * ⚠ ELLE LIT SUPABASE, PAS LE NAVIGATEUR, et c'est tout l'intérêt. L'autopilote
 * tourne sur le serveur, déclenché par `pg_cron`
 * (`supabase/migrations/004-ordonnanceur.sql`). Un moniteur qui lirait le store
 * local afficherait ce que CE téléphone croit savoir — donc zéro appel pendant
 * que le cron en passe quarante.
 *
 * ⚠⚠ AUCUNE COORDONNÉE NE SORT D'ICI. Ni téléphone, ni email, ni adresse. Un
 * écran qui dit « rappelle Untel » n'a pas besoin de savoir comment le joindre :
 * on ouvre la fiche pour ça, derrière le contrôle d'accès habituel. Sortir des
 * coordonnées de tiers vers un écran de supervision serait une transmission de
 * données personnelles sans nécessité — même règle que `/api/v1/etat`.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/**
 * L'état de l'autopilote, tel que le SERVEUR le connaît.
 *
 * ⚠ On teste la PRÉSENCE de `CRON_SECRET`, jamais sa valeur, et on ne la rend
 * évidemment jamais. Un moniteur n'a pas besoin de connaître un secret pour
 * dire s'il est posé.
 */
function autopilote(db: unknown): EtatAutopilote {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret || !db) return "non-configure";
  return (process.env.CAMPAIGN_AUTOPILOT ?? "").trim().toLowerCase() === "on" ? "arme" : "simulation";
}

/**
 * LA RÉPONSE D'UN SERVEUR AVEUGLE — écrite UNE fois.
 *
 * ⚠ `prospects: null`, jamais `[]`. « Je ne vois rien » et « il n'y a rien »
 * mènent à deux gestes opposés, et le module refuse de les confondre.
 *
 * ⚠⚠ ELLE EST EXTRAITE PARCE QUE LES DEUX CHEMINS AVEUGLES (base absente,
 * lecture en échec) LA RECOPIAIENT. Une mutation l'a montré : passer `[]` dans
 * un seul des deux ne faisait tomber AUCUN test — le module était testé, son
 * appelant ne l'était pas. C'est le défaut récurrent du dépôt, dans le code
 * même qui existe pour le rendre visible.
 */
function aveugle(etatAuto: EtatAutopilote) {
  return etatMoniteur({
    prospects: null,
    autopilote: etatAuto,
    fenetre: null,
    fileAttente: null,
    plafondPalier: null,
    composesTotal: null,
    maintenant: new Date(),
  });
}

export async function GET() {
  const db = serviceClient();
  const etatAuto = autopilote(db);

  if (!db) return NextResponse.json(aveugle(etatAuto));

  const { data, error } = await db
    .from("prospects")
    .select("data")
    // Le périmètre de l'opérateur, comme `/api/v1/etat` : sans ce filtre, le
    // jour où il y a deux locataires, l'un supervise le pipe de l'autre.
    .eq("proprietaire", PROPRIETAIRE_OPERATEUR)
    .limit(2000);

  // Une lecture en échec est un ANGLE MORT, pas un pipe vide. Rendre des
  // zéros ici afficherait un tableau de bord calme sur une machine aveugle.
  if (error) return NextResponse.json(aveugle(etatAuto));

  const prospects = (data ?? []).map((r) => r.data as Prospect).filter(Boolean);

  // ⚠ LE MÊME PLAFOND QUE LE CRON, par la même fonction. Le recopier ici
  // ferait annoncer à l'écran un plafond que l'autopilote n'applique pas.
  const plafondPalier = plafondPalierServeur(process.env.CAMPAIGN_PALIER);

  // La file telle que le cron la construirait à cet instant — mêmes portes,
  // même fenêtre. C'est ce qui rend l'écran fidèle et non décoratif.
  const run = prospects.length > 0 ? buildCampaignRun(prospects, { accountId: "eagleye", plafondPalier }) : null;

  return NextResponse.json(
    etatMoniteur({
      prospects,
      autopilote: etatAuto,
      fenetre: run ? { ouverte: run.windowOpen, pourquoi: run.windowWhy } : null,
      fileAttente: run ? run.queue.length : null,
      plafondPalier,
      composesTotal: run ? run.composesTotal : null,
      maintenant: new Date(),
    })
  );
}
