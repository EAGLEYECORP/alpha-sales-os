import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import { moteurIADeLaRequete } from "@/lib/credentials-secret";
import { aiAvailable } from "@/lib/ai-engine";
import { wrapUntrusted } from "@/lib/untrusted";
import { deciderTypee } from "@/lib/decision-typee";
import {
  INTENTIONS,
  PROMPT_CLASSER_REPONSE,
  interpreterClassement,
  routerReponse,
  estAutomatisable,
  type Disposition,
  type IntentionReponse,
} from "@/lib/reponse-auto";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTOPILOTE DES RÉPONSES ENTRANTES — le maillon qui retire l'humain de la
 * BOUCLE email, sans le retirer du CLOSE.
 *
 * Aujourd'hui chaque réponse d'un prospect oblige l'opérateur à ouvrir l'inbox,
 * cliquer « Réponse IA », lire, envoyer. Ce tick fait le TRI tout seul : il lit
 * les réponses non traitées, les fait CLASSER par le modèle, et le CODE décide
 * quoi en faire (`lib/reponse-auto.ts`). Un cron l'appelle, exactement comme
 * `/api/campaign/tick` pour la voix.
 *
 * ⚠⚠ CE QU'IL NE FAIT PAS ENCORE, ET POURQUOI C'EST VOULU. Il ne fait partir
 * AUCUN email. Deux raisons, dans l'ordre :
 *  1. L'auto-envoi d'une réponse à un vrai prospect part de NOTRE domaine
 *     (`/api/send`). Tant que le DKIM n'est pas publié chez Amen, tout part en
 *     spam : envoyer serait griller le domaine ET la fiche. La délivrabilité
 *     n'est pas un jugement qu'on force (`docs/SMTP-SUPABASE-AMEN.md`).
 *  2. `/api/send` est verrouillé par les droits PAR LOCATAIRE ; un chemin
 *     d'envoi pour l'autopilote maître se construit avec ses propres gardes et
 *     son propre test — pas en ouvrant la route la plus sensible du produit en
 *     passant. C'est la brique suivante, et elle s'enclenche ICI, sur le plan
 *     que ce tick produit déjà.
 *
 * Donc pour l'instant il rend le PLAN : pour chaque réponse, l'intention, la
 * disposition (`auto` / `escalade` / `clore`) et le motif. C'est ce plan que
 * l'opérateur (ou moi) lit pour agir — et sur lequel l'auto-envoi se branchera.
 *
 * ⚠ TROIS GARDES, comme le tick vocal : secret de cron, armement explicite
 * (`CAMPAIGN_AUTOPILOT=on`, sinon `dryRun`), et données serveur présentes.
 * Aucune n'est contournable.
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
  // Pas de secret configuré = la route n'existe pas. Volontaire, comme le tick vocal.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  return provided.length > 0 && safeEqual(provided, secret);
}

const armed = () => (process.env.CAMPAIGN_AUTOPILOT ?? "").trim().toLowerCase() === "on";

/** Une réponse entrante réduite à ce que le tri lit. */
interface EntrantABrasser {
  id: string;
  email: string;
  name: string | null;
  message: string;
}

/** Le verdict rendu pour une réponse : ce que la machine PROPOSE d'en faire. */
interface LigneDuPlan {
  id: string;
  email: string;
  intention: IntentionReponse;
  disposition: Disposition;
  motif: string;
  /** true seulement pour le milieu de tunnel sûr — le seul feu vert d'un futur auto-envoi. */
  automatisable: boolean;
  /** Quel moteur a tranché (`jev` si configuré, sinon `llm`) — transparence. */
  source: "jev" | "llm";
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Un tick qui lira les réponses des prospects ne s'ouvre pas." },
      { status: 401 }
    );
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Supabase non configuré",
        why: "Les réponses entrantes vivent dans `inbound_events`. Sans service role, ce tick ne voit rien.",
      },
      { status: 412 }
    );
  }

  const moteur = await moteurIADeLaRequete(req);
  if (!aiAvailable(moteur)) {
    return NextResponse.json(
      { error: "IA indisponible", why: "Le tri d'une réponse en langage libre exige le modèle — pas une liste de mots-clés." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get("max") ?? 20) || 20, 50);

  // Lecture des réponses non traitées. Même table que `/api/webhooks/inbound` ;
  // ici on ne lit que les réponses email (les ouvertures/formulaires ne se
  // « répondent » pas).
  const { data, error } = await db
    .from("inbound_events")
    .select("id, email, name, message, type")
    .eq("processed", false)
    .eq("type", "email.reply")
    .order("received_at", { ascending: true })
    .limit(max);
  if (error) return NextResponse.json({ error: "lecture impossible", detail: error.message }, { status: 500 });

  const entrants: EntrantABrasser[] = (data ?? []).map((r) => ({
    id: String(r.id),
    email: String(r.email ?? ""),
    name: r.name ? String(r.name) : null,
    message: String(r.message ?? ""),
  }));

  const plan: LigneDuPlan[] = [];
  for (const e of entrants) {
    // Décision typée : Jev si configuré, sinon le LLM (le joint `decision-typee`).
    // Le message entrant est du texte HOSTILE (écrit par un tiers) : on l'encadre.
    const { valeur: intention, source } = await deciderTypee<IntentionReponse>({
      texteEntrant: wrapUntrusted("message-entrant", e.message, { maxChars: 4_000 }),
      promptSysteme: PROMPT_CLASSER_REPONSE,
      valeurs: INTENTIONS,
      valider: interpreterClassement,
      moteur,
    });
    const routage = routerReponse(intention);
    plan.push({
      id: e.id,
      email: e.email,
      intention,
      disposition: routage.disposition,
      motif: routage.motif,
      automatisable: estAutomatisable(intention),
      source,
    });
  }

  const parDisposition = (d: Disposition) => plan.filter((l) => l.disposition === d).length;

  return NextResponse.json({
    ok: true,
    armed: armed(),
    // Honnête et central : rien ne part tant que ce n'est pas true.
    envoiBranche: false,
    dkimRequis: true,
    lus: entrants.length,
    compte: {
      auto: parDisposition("auto"),
      escalade: parDisposition("escalade"),
      clore: parDisposition("clore"),
    },
    plan,
    why:
      "Tri seul pour l'instant : le modèle CLASSE, le code DISPOSE. L'auto-envoi des réponses `auto` " +
      "s'enclenche une fois le DKIM publié (délivrabilité) et le chemin d'envoi maître branché avec ses gardes.",
  });
}

/** Sonde de lecture seule — combien de réponses attendent le tri, sans les traiter. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const db = serviceClient();
  if (!db) return NextResponse.json({ armed: armed(), enAttente: null, why: "Supabase non configuré" }, { status: 412 });
  const { count, error } = await db
    .from("inbound_events")
    .select("id", { count: "exact", head: true })
    .eq("processed", false)
    .eq("type", "email.reply");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ armed: armed(), envoiBranche: false, enAttente: count ?? 0 });
}
