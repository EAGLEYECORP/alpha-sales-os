import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoriserAppelant } from "@/lib/autoriser-appelant";
import { autopiloteArmeEnv, lireDrapeauAutopilote, estArme } from "@/lib/autopilote";
import { firstSendAt } from "@/lib/tracking";
import { rampDepuisPremierEnvoi } from "@/lib/email-ramp";
import { autoReponseAttestee } from "@/lib/reply-autosend";
import { layaDisponible } from "@/lib/laya";
import { jevDisponible } from "@/lib/jev";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉTAT D'EXPLOITATION — ce que voit un agent qui PILOTE, pas seulement
 * qui observe le pipe.
 *
 * Lecture seule, portée `etat.read`. `/api/v1/etat` dit qui est prêt, qui
 * dort ; il ne dit RIEN de la machine elle-même. Un agent Cowork ne pouvait
 * donc pas répondre à « est-ce que ça tourne ? » : autopilote armé ? palier du
 * jour ? les réponses partent-elles seules (attestation DKIM) ? et surtout
 * QUEL moteur classe les réponses — le souverain local, l'API US, ou le repli.
 * Cette route rend ces faits RUNTIME, pour que le rapport du matin soit complet.
 *
 * ── CE QU'ELLE NE FAIT PAS ──
 *  · Elle N'AGIT PAS : aucun envoi, aucun armement. Elle LIT.
 *  · Elle ne rend AUCUN secret ni coordonnée — que des booléens et des
 *    compteurs. C'est l'exact contraire de `/api/health` dont le DÉTAIL est
 *    gated par le cookie du site : ici on ne sort que l'état d'armement et de
 *    cadence, jamais la carte des variables serveur.
 *  · Elle ne DOUBLE PAS le moniteur ni `/api/health` : chaque fait vient de sa
 *    fonction unique (`estArme`, `rampDepuisPremierEnvoi`, `layaDisponible`…).
 *    Le « ce que la machine a FAIT aujourd'hui » (nombres d'appels/envois) reste
 *    au moniteur, qui lit les fiches par tenant — pas à une route à clé.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/**
 * Quel moteur classe RÉELLEMENT les intentions de réponse, aujourd'hui.
 * L'ordre reflète `lib/decision-typee.ts` : Laya (souverain, local) d'abord,
 * Jev (API US) ensuite, le LLM en repli. Une seule question posée à une seule
 * source — on ne redéfinit pas l'ordre ici, on le LIT.
 */
function moteurDecision(): { actif: "laya" | "jev" | "llm"; souverain: boolean; phrase: string } {
  if (layaDisponible()) {
    return {
      actif: "laya",
      souverain: true,
      phrase: "Laya (modèle souverain, poids ouverts, tourne en local) : rien de la donnée métier ne sort.",
    };
  }
  if (jevDisponible()) {
    return {
      actif: "jev",
      souverain: false,
      phrase:
        "Jev (API US, propriétaire) : le texte des réponses y transite. Contredit l'angle de souveraineté — " +
        "déployer le sidecar Laya (LAYA_URL) pour le remplacer.",
    };
  }
  return {
    actif: "llm",
    souverain: false,
    phrase:
      "Repli LLM : aucun décideur typé n'est configuré (ni LAYA_URL, ni Jev). Le classement marche mais coûte des jetons " +
      "et n'est pas souverain. Poser LAYA_URL le fait basculer sur Laya, local et gratuit.",
  };
}

export async function GET(req: NextRequest) {
  const v = autoriserAppelant(req.headers.get("authorization"), "etat.read");
  if (!v.ok) return NextResponse.json({ error: v.erreur, why: v.pourquoi }, { status: v.statut });

  const db = serviceClient();

  // Autopilote : le drapeau bouton vient de la base (null si injoignable, jamais
  // false par défaut sur une panne), le disjoncteur vient de l'env.
  const env = autopiloteArmeEnv();
  const drapeau = db ? await lireDrapeauAutopilote(db) : null;
  const arme = estArme({ env, dbActif: drapeau });

  // Palier du jour : sur la boîte d'envoi (per-box, pas per-tenant), comme
  // mail-tick. `firstSendAt` rend null sur une base injoignable → palier le plus
  // bas, jamais le plafond (une panne ne débride pas l'envoi).
  const first = db ? await firstSendAt("email", null) : null;
  const ramp = rampDepuisPremierEnvoi(first);

  const moteur = moteurDecision();
  const atteste = autoReponseAttestee();

  return NextResponse.json({
    ok: true,
    verifieLe: new Date().toISOString(),
    autopilote: {
      arme,
      env,
      drapeau,
      phrase: arme
        ? "Armé — les envois et appels partent pour de vrai."
        : "Désarmé — la machine calcule ce qu'elle ferait et n'envoie rien. Arme depuis /controle.",
    },
    envoiEmail: {
      palierDuJour: ramp.today,
      auPlafond: ramp.ceiling,
      baseVue: db !== null,
      phrase: db
        ? `Palier du jour : ${ramp.today} emails max sur 24 h glissantes (semaine ${ramp.weeks + 1}).`
        : "Base serveur injoignable → palier au plancher (5/j). Ce n'est pas une panne d'envoi, c'est la prudence.",
    },
    autoReponse: {
      attestee: atteste,
      phrase: atteste
        ? "REPLY_AUTOSEND=on : les réponses sûres partent seules (dans les gardes), sous réserve que l'autopilote soit armé."
        : "REPLY_AUTOSEND absent : les réponses se planifient mais NE partent pas. C'est ton attestation DKIM — le serveur ne peut pas la vérifier seul.",
    },
    moteurDecision: moteur,
  });
}
