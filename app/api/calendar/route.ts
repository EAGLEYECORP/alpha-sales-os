import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { lireMeetingsBornes, lireProspectsOperateur } from "@/lib/lecture-serveur";
import { icsCalendar, meetingToIcs } from "@/lib/ics";
import { safeEqual } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * FLUX CALENDRIER ABONNABLE — les rendez-vous d'ALPHA dans ton agenda.
 *
 *   GET /api/calendar?k=<CALENDAR_TOKEN>
 *
 * À coller dans Google Agenda (« Autres agendas → À partir de l'URL »),
 * Outlook / Teams (« Ajouter un calendrier → S'abonner à partir du web »)
 * ou Apple Calendrier (« Nouvel abonnement »). L'agenda relit tout seul,
 * environ tous les quarts d'heure.
 *
 * ── POURQUOI UN JETON DANS L'URL ──
 *
 * Un client de calendrier n'envoie ni cookie ni en-tête d'autorisation :
 * il fait un GET nu, souvent depuis les serveurs de Google, pas depuis la
 * machine de l'utilisateur. L'authentification ne PEUT donc être que dans
 * l'URL. C'est le même compromis que « l'adresse secrète au format iCal »
 * de Google Agenda.
 *
 * Ce que ça implique, et qu'il faut assumer les yeux ouverts : qui a l'URL
 * a les rendez-vous. Elle se traite comme un mot de passe — on ne la
 * partage pas, et on la change en modifiant CALENDAR_TOKEN si elle a fuité.
 * Sans `CALENDAR_TOKEN` configuré, la route est FERMÉE.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Fenêtre publiée : un agenda n'a pas besoin de tout l'historique. */
const PASSE_JOURS = 30;
const FUTUR_JOURS = 180;

export async function GET(req: NextRequest) {
  const expected = process.env.CALENDAR_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Flux calendrier désactivé", why: "CALENDAR_TOKEN non configuré côté serveur. Une URL d'agenda sans jeton serait publique." },
      { status: 503 }
    );
  }

  const given = (req.nextUrl.searchParams.get("k") ?? "").trim();
  if (!given || !safeEqual(given, expected)) {
    // 404 plutôt que 401 : inutile de confirmer à un curieux que l'adresse
    // existe et qu'il ne lui manque que le bon jeton.
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      {
        error: "Supabase non configuré",
        why: "Les rendez-vous vivent dans le navigateur tant que la synchronisation n'est pas activée. Un agenda distant ne peut rien y lire.",
      },
      { status: 503 }
    );
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  // ⚠ Les deux lectures étaient sans borne ni filtre. Voir lib/lecture-serveur.
  const [rdv, pipe] = await Promise.all([lireMeetingsBornes(db), lireProspectsOperateur(db)]);
  const meetings = rdv.meetings;
  const byId = new Map(pipe.prospects.map((p) => [p.id, p]));

  const now = Date.now();
  const min = now - PASSE_JOURS * 86_400_000;
  const max = now + FUTUR_JOURS * 86_400_000;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
  const events = meetings
    .filter((m) => {
      const t = new Date(m.date).getTime();
      return Number.isFinite(t) && t >= min && t <= max;
    })
    .map((m) => {
      try {
        return meetingToIcs(m, byId.get(m.prospectId), appUrl);
      } catch {
        // Une fiche à la date illisible ne doit pas vider tout l'agenda.
        return null;
      }
    })
    .filter((e): e is string => Boolean(e));

  return new NextResponse(icsCalendar(events, "ALPHA SALES OS — rendez-vous"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="alpha-sales-os.ics"',
      // Pas de cache intermédiaire : un agenda qui relit doit voir l'état du
      // moment, pas une copie de la veille servie par un CDN.
      "cache-control": "no-store, max-age=0",
    },
  });
}
