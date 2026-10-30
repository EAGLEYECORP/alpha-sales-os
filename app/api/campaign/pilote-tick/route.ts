import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import { DROIT_SOLO } from "@/lib/entitlements";
import { lireMeetingsBornes, lireProspectsOperateur } from "@/lib/lecture-serveur";
import { ligneProspect } from "@/lib/sync-prospects";
import { ligneRdv } from "@/lib/sync-meetings";
import { resoudreSmtp, smtpUtilisable } from "@/lib/credentials-secret";
import { autopiloteArmeEnv, estArme, lireDrapeauAutopilote } from "@/lib/autopilote";
import { lireReponseAgenda, type EtatAgenda } from "@/lib/agenda-occupe";
import { ENTETE_PILOTE_SERVEUR } from "@/lib/pilote-serveur-appel";
import { corpsEnvoiPilote, envoiDepuisReponse, passagePilote, type RecuDeLecture } from "@/lib/pilote-executeur";
import { CONFIGURATION_ALPHA_VEND_ALPHA } from "@/lib/alpha-vend-alpha";
import { journaliser } from "@/lib/autopilote-inscrit";
import { VERROU_MS, aReecrire, expediteurServeur, mondeServeur, portesServeur, reglagesServeur, type MondeServeur } from "@/lib/pilote-serveur";
import { uid } from "@/lib/utils";
import { POST as envoyerPOST } from "@/app/api/send/route";
import { POST as reponsesPOST } from "@/app/api/reponses/route";
import { POST as agendaPOST } from "@/app/api/agenda/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PILOTE SERVEUR — « ALPHA vend ALPHA » onglet fermé, sans n8n (30/10/2026).
 *
 * `pg_cron` (migration 020) appelle ce tick toutes les 5 minutes en journée.
 * Il joue UN passage du pilote — les MÊMES étapes que le navigateur
 * (`lib/pilote-executeur.ts`) — sur le pipe opérateur en base.
 *
 * ⚠ LES MÊMES PORTES QUE LE NAVIGATEUR, APPELÉES EN PROCESSUS. Envoyer, lire la
 * boîte et lire l'agenda passent par les gestionnaires de `/api/send`,
 * `/api/reponses` et `/api/agenda` eux-mêmes, avec l'en-tête du pilote
 * (`lib/pilote-serveur-appel.ts`) : palier du jour, mentions, divulgation IA,
 * fenêtre de recontact, garde-fou SSRF — une seule définition, aucune recopiée.
 *
 * ⚠ CINQ GARDES, aucune contournable :
 *  1. le CRON_SECRET (absent ⇒ la route n'existe pas) ;
 *  2. l'interrupteur `pilote_serveur.actif`, posé par le maître dans
 *     `/autopilote` — jamais par une configuration ;
 *  3. l'ANCIEN autopilote serveur (`mail-tick`, gabarits de l'escalier) ne doit
 *     pas être armé : deux pilotes sur le même pipe écriraient deux premiers
 *     messages différents à la même personne ;
 *  4. le verrou : un passage à la fois (UPDATE conditionnel, expire seul) ;
 *  5. sans boîte d'envoi maison, rien ne part — la lecture et la recherche,
 *     elles, continuent (`passagePilote` le dit dans ses attentes).
 *
 * ⚠ La fenêtre d'écriture n'est PAS décidée ici : `planifier` la lit. Hors
 * fenêtre, le passage lit sans écrire.
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
  // Pas de secret configuré = la route n'existe pas. Volontaire.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  return provided.length > 0 && safeEqual(provided, secret);
}

function baseUrlFrom(req: NextRequest): string {
  return (process.env.APP_BASE_URL || req.nextUrl.origin).replace(/\/+$/, "");
}

/** Une requête vers un gestionnaire voisin, EN PROCESSUS, avec la clé du pilote. */
function requeteInterne(base: string, chemin: string, corps: unknown): NextRequest {
  return new NextRequest(`${base}${chemin}`, {
    method: "POST",
    headers: { "content-type": "application/json", [ENTETE_PILOTE_SERVEUR]: process.env.CRON_SECRET?.trim() ?? "" },
    body: JSON.stringify(corps),
  });
}

async function ecrireMonde(db: SupabaseClient, m: MondeServeur, finPassage: boolean): Promise<string | null> {
  const { prospects, meetings } = aReecrire(m);
  if (prospects.length) {
    const { error } = await db.from("prospects").upsert(prospects.map(ligneProspect), { onConflict: "id" });
    if (error) return `fiches : ${error.message}`;
  }
  if (meetings.length) {
    const { error } = await db.from("meetings").upsert(meetings.map(ligneRdv), { onConflict: "id" });
    if (error) return `rendez-vous : ${error.message}`;
  }
  m.fichesModifiees.clear();
  m.rdvModifies.clear();
  const { error } = await db
    .from("pilote_serveur")
    .update({
      etat: m.etat,
      modifie_le: new Date().toISOString(),
      ...(finPassage ? { verrou_jusqua: null, dernier_passage: new Date().toISOString() } : {}),
    })
    .eq("id", "maitre");
  return error ? `état : ${error.message}` : null;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Une route qui envoie de vrais emails ne s'ouvre pas." },
      { status: 401 },
    );
  }
  const db = serviceClient();
  if (!db) {
    return NextResponse.json({ error: "Supabase non configuré", why: "Le pipe du pilote serveur vit en base." }, { status: 412 });
  }

  const { data: ligne, error: errLigne } = await db.from("pilote_serveur").select("actif, reglages, expediteur, etat").eq("id", "maitre").maybeSingle();
  if (errLigne) {
    return NextResponse.json({ error: "table pilote_serveur illisible", detail: errLigne.message, why: "Migration 019 non appliquée ?" }, { status: 500 });
  }
  if (!ligne?.actif) return NextResponse.json({ ok: true, actif: false, why: "Le pilote serveur est à l'arrêt (/autopilote)." });

  if (estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) })) {
    return NextResponse.json(
      { ok: false, actif: true, error: "L'ancien autopilote d'envoi (mail-tick) est armé sur le même pipe : coupe-le avant de laisser tourner ALPHA." },
      { status: 409 },
    );
  }

  // Le verrou : seul celui qui le prend joue le passage.
  const maintenant = new Date();
  const { data: pris } = await db
    .from("pilote_serveur")
    .update({ verrou_jusqua: new Date(maintenant.getTime() + VERROU_MS).toISOString() })
    .eq("id", "maitre")
    .or(`verrou_jusqua.is.null,verrou_jusqua.lt.${maintenant.toISOString()}`)
    .select("id");
  if (!pris?.length) return NextResponse.json({ ok: true, actif: true, why: "Un passage est déjà en cours." });

  const [pipe, rdv] = await Promise.all([lireProspectsOperateur(db), lireMeetingsBornes(db)]);
  if (pipe.erreur || rdv.erreur) {
    await db.from("pilote_serveur").update({ verrou_jusqua: null }).eq("id", "maitre");
    return NextResponse.json({ error: "lecture impossible", detail: pipe.erreur ?? rdv.erreur }, { status: 500 });
  }

  const base = baseUrlFrom(req);
  const m = mondeServeur(pipe.prospects, rdv.meetings, ligne.etat);
  const expediteur = expediteurServeur(ligne.expediteur);
  const identite = { accountId: "eagleye", closerName: expediteur.closerName, agencyName: CONFIGURATION_ALPHA_VEND_ALPHA.agencyName };
  const adresseAgenda = process.env.AGENDA_ICS_URL?.trim() ?? "";
  let agendaLu: EtatAgenda | null = null;

  const pp = portesServeur(m, {
    maintenant: () => new Date(),
    uid,
    reglages: reglagesServeur(true, ligne.reglages),
    expediteur,
    lienSignature: `${base}/compte`,
    cleDropcontact: process.env.DROPCONTACT_API_KEY?.trim() ?? "",
    envoyer: async (p, mail, suite, copie) => {
      /**
       * ⚠ On ÉCRIT ce qui a bougé AVANT chaque envoi : un passage tué par la
       * plateforme après un envoi ne doit pas avoir perdu la consignation du
       * message précédent — le passage suivant le renverrait. Il ne reste que le
       * message EN COURS, que la fenêtre de recontact du serveur couvre pour un
       * premier message.
       */
      const err = await ecrireMonde(db, m, false);
      if (err) return { ok: false, status: 503, erreur: `écriture impossible avant envoi (${err})` };
      try {
        return await envoiDepuisReponse(await envoyerPOST(requeteInterne(base, "/api/send", corpsEnvoiPilote(p, mail, identite, suite, copie))));
      } catch (e) {
        return { ok: false, status: 0, erreur: e instanceof Error ? e.message.slice(0, 160) : "envoi impossible" };
      }
    },
    lireReponses: async (q) => (await (await reponsesPOST(requeteInterne(base, "/api/reponses", q))).json()) as RecuDeLecture,
    agenda: async () => {
      if (!adresseAgenda) return { etat: "absent" };
      if (agendaLu) return agendaLu; // une lecture par passage
      const res = await agendaPOST(requeteInterne(base, "/api/agenda", { url: adresseAgenda }));
      agendaLu = lireReponseAgenda(await res.json().catch(() => null), res.status);
      return agendaLu;
    },
    fetch: (u, i) => fetch(u, i),
  });

  const boite = smtpUtilisable(await resoudreSmtp(null, DROIT_SOLO));
  let plan: Awaited<ReturnType<typeof passagePilote>> | null = null;
  let erreur: string | null = null;
  try {
    plan = await passagePilote(pp, { boite });
  } catch (e) {
    erreur = e instanceof Error ? e.message.slice(0, 200) : "passage interrompu";
    const texte = `Passage interrompu : ${erreur}`;
    pp.majEtat((etat) => journaliser(etat, { type: "erreur", texte }, new Date()));
  }
  const errEcriture = await ecrireMonde(db, m, true);

  return NextResponse.json(
    {
      ok: !erreur && !errEcriture,
      actif: true,
      boite,
      plan,
      ...(erreur ? { error: erreur } : {}),
      ...(errEcriture ? { ecriture: errEcriture } : {}),
      ...(pipe.avertissement ? { avertissement: pipe.avertissement } : {}),
    },
    { status: errEcriture ? 500 : 200 },
  );
}
