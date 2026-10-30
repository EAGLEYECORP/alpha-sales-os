import { NextRequest, NextResponse } from "next/server";
import { DROIT_SOLO, resoudreDroits } from "@/lib/entitlements";
import { estAppelPiloteServeur } from "@/lib/pilote-serveur-appel";
import { fetchCalendrier } from "@/lib/site-fetch";
import { adresseAgenda, lireAgendaIcs } from "@/lib/agenda-occupe";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * ─────────────────────────────────────────────────────────────────────
 * POST /api/agenda — les plages OCCUPÉES de l'agenda de l'inscrit.
 *
 * Le pilote automatique (`components/autopilote/moteur-autopilote.tsx`)
 * envoie l'adresse secrète de son agenda (Google : « adresse secrète au
 * format iCal » ; Outlook : « publier un calendrier », disponibilités
 * seulement de préférence). La route le lit et ne rend QUE des plages
 * `{ debut, fin }` sur les 30 prochains jours — aucun titre, aucun lieu,
 * aucun participant. Rien n'est stocké : ni l'adresse, ni l'agenda.
 *
 * ⚠ Pourquoi par notre serveur et pas du navigateur, comme le registre ou
 * le BODACC : ces deux services publics répondent aux appels d'un navigateur
 * (vérifié) ; un agenda Google ou Outlook, à notre connaissance non — NON
 * vérifié, le proxy de développement bloque leurs hôtes. Le serveur, lui,
 * n'en dépend pas. L'agenda TRANSITE donc par la route — exactement comme
 * sa boîte dans `/api/reponses` — et l'écran le dit.
 *
 * ⚠ Une panne est `non-lu` avec sa raison, jamais une liste vide : « tu es
 * libre toute la semaine » et « on n'a pas pu lire ton agenda » demandent
 * deux gestes opposés — le second interdit de proposer un créneau.
 * ─────────────────────────────────────────────────────────────────────
 */

const FENETRE_MS = 30 * 86_400_000;

function nonLu(raison: string, status = 200) {
  return NextResponse.json({ etat: "non-lu", raison }, { status });
}

export async function POST(req: NextRequest) {
  // Le pilote serveur (onglet fermé) appelle ce gestionnaire EN PROCESSUS, avec le
  // CRON_SECRET : droits du maître, comme `/api/send` (`lib/pilote-serveur-appel.ts`).
  const droits = estAppelPiloteServeur(req) ? DROIT_SOLO : await resoudreDroits(req);
  if (!droits.tenantId && !droits.solo) return nonLu("Connecte-toi : la lecture de ton agenda est réservée à ton compte.", 401);

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return nonLu("JSON invalide", 400);
  }
  const url = adresseAgenda(typeof body.url === "string" ? body.url : "");
  if (!url) return nonLu("Colle l'adresse secrète de ton agenda (elle commence par https:// ou webcal://).", 400);

  const maintenant = Date.now();
  try {
    const texte = await fetchCalendrier(url);
    const l = lireAgendaIcs(texte, { debut: maintenant, fin: maintenant + FENETRE_MS });
    return NextResponse.json({
      etat: "lu",
      plages: l.plages.map((p) => ({ debut: new Date(p.debut).toISOString(), fin: new Date(p.fin).toISOString() })),
      evenements: l.evenements,
      approximes: l.approximes,
      ignores: l.ignores,
    });
  } catch (e) {
    return nonLu(e instanceof Error ? e.message : "Agenda illisible.");
  }
}
