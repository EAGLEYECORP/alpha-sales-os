"use client";

import { useEffect, useRef, useState } from "react";
import { useAlpha } from "@/lib/store";
import { useMaitreProuve } from "@/lib/use-droits";
import { useExpediteurInscrit } from "@/lib/use-expediteur";
import type { Prospect } from "@/lib/types";
import { identiteEnvoi } from "@/lib/expediteur";
import { uid } from "@/lib/utils";
import { lireCleDropcontact } from "@/lib/cle-locale";
import { lireLot } from "@/lib/signaux-publics";
import { projeterImport, readStorageHealth } from "@/lib/storage-health";
import { fenetreOuverte } from "@/lib/conformite";
import { prochainsCreneaux, labelCreneau } from "@/lib/creneaux-rdv";
import { meetingToIcs } from "@/lib/ics";
import { construireRelanceMail, raisonRelance } from "@/lib/relance-mail";
import { TAG_DEJA_ECRIT } from "@/lib/mail-autopilote";
import { chercherEntreprises, croiserAnnonces, entrepriseVersProspect } from "@/lib/trouver-clients";
import { associerContacts, demandeDepuisFiche, lancerEnrichissement, lireEnrichissement, patchDepuisContact, resumeEnrichissement } from "@/lib/enrichissement";
import { confirmationRdv, deciderReponse, introRenseignement, propositionCreneaux, rdvChoisi, type MailSortant } from "@/lib/reponses-inscrit";
import type { MessageLu } from "@/lib/mime-lecture";
import {
  CYCLE_MS, ETAT_AUTOPILOTE_VIDE, MARQUE_PREMIER, MARQUE_RELANCE, REGLAGES_AUTOPILOTE_DEFAUT, REPONSES_VUES_MAX, TAG_ENVOI_REFUSE,
  adressesSuivies, cleRecherche, depuisLecture, idReponse, journaliser, planifier, premierMessage,
  type EntreeJournal, type EtatAutopilote,
} from "@/lib/autopilote-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MOTEUR DE L'AUTOPILOTE — monté UNE fois dans la coquille, il tourne sur
 * n'importe quel écran ouvert (`lib/autopilote-inscrit.ts` décide, ici on
 * exécute et on consigne).
 *
 * ⚠ Il lit l'état FRAIS à chaque étape (`useAlpha.getState()`), jamais une
 * copie prise au début du passage : une fiche importée à l'étape « chercher »
 * doit être vue par l'étape suivante, et une réponse traitée ne doit pas
 * l'être deux fois.
 * ⚠ Un passage à la fois (`enCours`) : deux passages qui se chevauchent
 * enverraient deux fois le même premier message.
 * ⚠ Il ne fait rien sans un droit PROUVÉ par le serveur (`useMaitreProuve` /
 * `/api/credentials`) : un verdict optimiste aurait fait écrire depuis une
 * boîte qu'on n'a pas vue branchée.
 * ─────────────────────────────────────────────────────────────────────
 */

type Envoi = { ok: true } | { ok: false; status: number; erreur: string; attendreMs?: number; dejaContacte?: boolean };

function etatCourant(): { reglages: typeof REGLAGES_AUTOPILOTE_DEFAUT; etat: EtatAutopilote } {
  const ap = useAlpha.getState().settings.autopilote;
  return { reglages: { ...REGLAGES_AUTOPILOTE_DEFAUT, ...(ap?.reglages ?? {}) }, etat: { ...ETAT_AUTOPILOTE_VIDE, ...(ap?.etat ?? {}) } };
}

function majEtat(f: (e: EtatAutopilote) => EtatAutopilote) {
  const { reglages, etat } = etatCourant();
  useAlpha.getState().patchSettings({ autopilote: { reglages, etat: f(etat) } });
}

function noter(e: Omit<EntreeJournal, "le">) {
  majEtat((etat) => journaliser(etat, e, new Date()));
}

const fiche = (id: string): Prospect | undefined => useAlpha.getState().prospects.find((p) => p.id === id);

async function envoyer(p: Prospect, mail: MailSortant): Promise<Envoi> {
  const s = useAlpha.getState().settings;
  try {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "email",
        // ⚠ Personne ne relit : la divulgation IA est exigée, et elle est dans le corps.
        modeProduction: "autonome",
        to: p.email,
        subject: mail.subject,
        body: mail.body,
        prospectId: p.id,
        attachments: mail.attachments,
        ...identiteEnvoi(s),
      }),
    });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => ({}))) as { error?: string; alreadyContacted?: boolean };
    const apres = Number(res.headers.get("retry-after"));
    return {
      ok: false,
      status: res.status,
      erreur: j.error ?? `erreur ${res.status}`,
      attendreMs: Number.isFinite(apres) && apres > 0 ? apres * 1000 : undefined,
      dejaContacte: Boolean(j.alreadyContacted),
    };
  } catch {
    return { ok: false, status: 0, erreur: "réseau indisponible" };
  }
}

/** Ce qu'un refus du serveur fait à l'autopilote : suspendre, marquer la fiche, ou réessayer plus tard. */
function subirRefus(p: Prospect, r: Exclude<Envoi, { ok: true }>) {
  const { patchProspect } = useAlpha.getState();
  if (r.dejaContacte) {
    patchProspect(p.id, { tags: [...new Set([...(p.tags ?? []), TAG_DEJA_ECRIT])] });
    noter({ type: "pause", texte: `${p.company} : déjà contacté récemment, ALPHA ne le réécrit pas.`, prospectId: p.id });
    return;
  }
  if (r.status === 429 || r.status === 402 || r.status === 503 || r.status === 0 || r.status >= 500) {
    const attendre = r.attendreMs ?? (r.status === 402 ? 12 * 3_600_000 : 15 * 60_000);
    majEtat((e) => journaliser({ ...e, envoisSuspendusJusqua: new Date(Date.now() + attendre).toISOString() }, { type: "pause", texte: `Envois suspendus : ${r.erreur}` }, new Date()));
    return;
  }
  // 4xx sur le contenu : un message construit par ALPHA a été refusé. On ne le rejoue pas.
  patchProspect(p.id, { tags: [...new Set([...(p.tags ?? []), TAG_ENVOI_REFUSE])] });
  noter({ type: "erreur", texte: `Message refusé pour ${p.company} : ${r.erreur}`, prospectId: p.id });
}

// ══════════ LES ÉTAPES ══════════

async function lire(imapHost: string | undefined, profilInscrit: boolean) {
  const maintenant = new Date();
  const s = useAlpha.getState();
  const { etat } = etatCourant();
  const adresses = adressesSuivies(s.prospects, maintenant);
  let rep: { etat?: string; raison?: string; messages?: MessageLu[] };
  try {
    const res = await fetch("/api/reponses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adresses, depuis: depuisLecture(etat, maintenant).toISOString(), imapHost }),
    });
    rep = await res.json();
  } catch {
    rep = { etat: "non-lu", raison: "réseau indisponible" };
  }
  if (rep.etat !== "lu" || !Array.isArray(rep.messages)) {
    const texte = `Réponses non lues : ${rep.raison ?? "réponse illisible"}`;
    // On ne remplit pas le journal de la même panne toutes les quatre minutes.
    if (etatCourant().etat.journal[0]?.texte !== texte) noter({ type: "erreur", texte });
    majEtat((e) => ({ ...e, derniereLecture: maintenant.toISOString() }));
    return;
  }
  const vues = new Set(etat.reponsesVues);
  const nouvelles = rep.messages.filter((m) => !vues.has(idReponse(m))).reverse();
  for (const m of nouvelles) await traiterReponse(m, profilInscrit);
  majEtat((e) => ({ ...e, derniereLecture: maintenant.toISOString() }));
}

async function traiterReponse(m: MessageLu, profilInscrit: boolean) {
  const maintenant = new Date();
  const s = useAlpha.getState();
  const p = s.prospects.find((x) => x.email?.trim().toLowerCase() === m.de);
  const id = idReponse(m);
  const vu = () => majEtat((e) => ({ ...e, reponsesVues: [id, ...e.reponsesVues].slice(0, REPONSES_VUES_MAX) }));
  if (!p) return vu();
  const profil = profilInscrit ? s.settings.profil : null;
  const d = deciderReponse(p, m, profil, maintenant);
  // Répondre hors des heures utiles attendra le passage suivant : on NE marque
  // PAS la réponse comme traitée, sinon elle ne serait jamais reprise.
  if (d.repondre && !fenetreOuverte(maintenant).open) return;

  const exp = { closerName: s.settings.closerName, agencyName: s.settings.agencyName, bookingUrl: s.settings.bookingUrl };
  s.patchProspect(p.id, d.patch);
  s.addEvent(p.id, { date: m.date ?? maintenant.toISOString(), kind: "email", summary: d.evenement });
  vu();

  if (d.escalade) return noter({ type: "escalade", texte: `${p.company} : ${d.escalade}`, prospectId: p.id });
  if (d.classement.intention === "refus") return noter({ type: "lit", texte: `${p.company} refuse : retiré, plus aucun message.`, prospectId: p.id });
  if (!d.repondre) return;

  if (d.repondre === "confirmer") {
    const proposes = (p.rdvPropose?.creneaux ?? []).map((c) => new Date(c));
    const creneau = proposes[d.classement.creneau ?? -1];
    const pris = s.meetings.some((x) => !x.done && Math.abs(Date.parse(x.date) - (creneau?.getTime() ?? 0)) < 3 * 3_600_000);
    if (!creneau || creneau.getTime() <= maintenant.getTime() || pris) {
      s.patchProspect(p.id, { tags: [...new Set([...(fiche(p.id)?.tags ?? []), "reponse-a-traiter"])], nextStep: { date: maintenant.toISOString().slice(0, 10), action: "Caler un autre créneau (le choisi n'est plus libre)" } });
      return noter({ type: "escalade", texte: `${p.company} a choisi un créneau qui n'est plus libre : à toi de recaler.`, prospectId: p.id });
    }
    const rdv = rdvChoisi(p, creneau, etatCourant().reglages.canalRdv, etatCourant().reglages.dureeRdvMin, uid());
    const mail = confirmationRdv(p, creneau, rdv.channel, exp, m.sujet, meetingToIcs(rdv, p));
    const r = await envoyer(fiche(p.id) ?? p, mail);
    if (!r.ok) return subirRefus(p, r);
    s.upsertMeeting(rdv);
    s.patchProspect(p.id, { stage: "demo", rdvPropose: undefined, nextStep: { date: creneau.toISOString().slice(0, 10), action: `Rendez-vous : ${labelCreneau(creneau)}` } });
    s.addEvent(p.id, { date: maintenant.toISOString(), kind: "meeting", summary: `Rendez-vous posé par ALPHA : ${labelCreneau(creneau)} (invitation envoyée).` });
    return noter({ type: "rdv", texte: `Rendez-vous avec ${p.company} : ${labelCreneau(creneau)}.`, prospectId: p.id });
  }

  // Proposer trois créneaux libres, hors de ses rendez-vous déjà posés.
  const creneaux = prochainsCreneaux(maintenant, { n: 3, occupes: s.meetings.filter((x) => !x.done).map((x) => new Date(x.date)) });
  const intro = d.repondre === "renseignement" ? introRenseignement(profil) ?? undefined : undefined;
  const r = await envoyer(fiche(p.id) ?? p, propositionCreneaux(p, creneaux, exp, m.sujet, intro));
  if (!r.ok) return subirRefus(p, r);
  s.patchProspect(p.id, { rdvPropose: { creneaux: creneaux.map((c) => c.toISOString()), le: maintenant.toISOString() } });
  s.addEvent(p.id, { date: maintenant.toISOString(), kind: "email", summary: `ALPHA a répondu : trois créneaux proposés.` });
  noter({ type: "repond", texte: `${p.company} est intéressé : trois créneaux proposés.`, prospectId: p.id });
}

async function relireEnrichissements(requestIds: string[], cle: string) {
  for (const requestId of requestIds) {
    const r = await lireEnrichissement(requestId, cle, (u, i) => fetch(u, i));
    if (r.etat === "en-cours") continue;
    const lot = etatCourant().etat.enrichissements.find((e) => e.requestId === requestId);
    majEtat((e) => ({ ...e, enrichissements: e.enrichissements.filter((x) => x.requestId !== requestId) }));
    if (!lot) continue;
    if (r.etat === "non-lu") {
      noter({ type: "erreur", texte: `Coordonnées non lues : ${r.raison}` });
      continue;
    }
    let trouves = 0;
    const lotFiches = lot.prospectIds.map((id) => ({ id, siren: fiche(id)?.siren }));
    associerContacts(lotFiches, r.contacts).forEach(({ id, contact: c }) => {
      const p = fiche(id);
      if (!p) return;
      const patch = patchDepuisContact(p, c);
      if (patch.email || patch.phone) trouves++;
      useAlpha.getState().patchProspect(id, patch);
      useAlpha.getState().addEvent(id, { date: new Date().toISOString(), kind: "note", summary: resumeEnrichissement(c) });
    });
    noter({ type: "enrichit", texte: `Coordonnées trouvées pour ${trouves} entreprise(s) sur ${lot.prospectIds.length}${r.credits !== null ? ` · ${r.credits} crédits Dropcontact restants` : ""}.` });
  }
}

async function lancerEnrichissements(ids: string[], cle: string) {
  const fiches = ids.map(fiche).filter((p): p is Prospect => Boolean(p));
  const demandes = fiches.map((p) => demandeDepuisFiche(p)).filter((d): d is NonNullable<typeof d> => d !== null);
  if (demandes.length !== fiches.length) return;
  const r = await lancerEnrichissement(demandes, cle, (u, i) => fetch(u, i));
  if (r.etat !== "lance") return noter({ type: "erreur", texte: `Recherche de coordonnées impossible : ${r.raison}` });
  const jour = new Date().toISOString().slice(0, 10);
  majEtat((e) => ({
    ...e,
    enrichissements: [...e.enrichissements, { requestId: r.requestId, prospectIds: fiches.map((p) => p.id), lance: new Date().toISOString() }],
    enrichisJour: { jour, n: (e.enrichisJour.jour === jour ? e.enrichisJour.n : 0) + fiches.length },
  }));
  noter({ type: "enrichit", texte: `Recherche des coordonnées de ${fiches.length} entreprise(s) lancée chez Dropcontact.` });
}

async function ecrire(id: string, inscrit: ReturnType<typeof useExpediteurInscrit>) {
  const p = fiche(id);
  if (!p) return;
  const s = useAlpha.getState().settings;
  const mail = premierMessage(p, s, inscrit);
  const r = await envoyer(p, mail);
  if (!r.ok) return subirRefus(p, r);
  const st = useAlpha.getState();
  st.addEvent(p.id, { date: new Date().toISOString(), kind: "email", summary: `${MARQUE_PREMIER} : ${mail.subject}` });
  st.patchProspect(p.id, { stage: "contact", nextStep: { date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), action: "ALPHA attend sa réponse" } });
  noter({ type: "ecrit", texte: `Premier message envoyé à ${p.company}.`, prospectId: p.id });
}

async function relancer(id: string, numero: number) {
  const p = fiche(id);
  if (!p) return;
  const raison = raisonRelance(p, Date.now());
  if (!raison) return;
  const mail = construireRelanceMail(p, raison);
  const r = await envoyer(p, mail);
  if (!r.ok) return subirRefus(p, r);
  useAlpha.getState().addEvent(p.id, { date: new Date().toISOString(), kind: "email", summary: `${MARQUE_RELANCE} (n°${numero}) : ${raison.fait}` });
  noter({ type: "relance", texte: `Relance n°${numero} envoyée à ${p.company} (${raison.fait}).`, prospectId: p.id });
}

async function chercher(c: { activites: string[]; zone: string; taille: "toutes" | "employeur" | "10-plus" | "50-plus"; page: number }) {
  const s = useAlpha.getState();
  const connus = new Set(s.prospects.map((p) => p.siren).filter((x): x is string => Boolean(x)));
  const r = await chercherEntreprises({ activites: c.activites, zone: c.zone, taille: c.taille }, c.page, (u, i) => fetch(u, i), connus);
  const jour = new Date().toISOString().slice(0, 10);
  const { reglages } = etatCourant();
  majEtat((e) => ({ ...e, recherchesJour: { jour, n: (e.recherchesJour.jour === jour ? e.recherchesJour.n : 0) + 1 } }));
  if (r.etat !== "lu") return noter({ type: "erreur", texte: `Registre non lu : ${r.raison}` });
  const annonces = await lireLot(r.lecture.entreprises.map((e) => e.siren), (u, i) => fetch(u, i));
  const x = croiserAnnonces(r.lecture.entreprises, annonces);
  const fiches = x.retenues.map((y) => entrepriseVersProspect(y.entreprise, new Date(), y.annonces));
  /**
   * Le mur de stockage AVANT d'écrire (règle d'écran n° 4). Ici personne ne
   * lit l'avertissement au moment de coller : le moteur s'arrête donc de lui-même
   * plutôt que d'écrire des fiches qui disparaîtraient à la fermeture de l'onglet.
   */
  const mur = fiches.length ? projeterImport(readStorageHealth(), fiches, Math.round(JSON.stringify(fiches).length / fiches.length)) : null;
  if (mur?.alerte) return noter({ type: "pause", texte: `Stockage du navigateur presque plein : ALPHA n'ajoute plus d'entreprises. ${mur.phrase}` });
  const { added } = fiches.length ? useAlpha.getState().importProspects(fiches) : { added: 0 };
  // Dernière page atteinte : la cible est épuisée POUR AUJOURD'HUI. Demain on
  // repart du début — de nouvelles entreprises s'inscrivent chaque jour.
  const epuisee = r.lecture.page >= r.lecture.pages;
  const cle = cleRecherche(reglages);
  majEtat((e) => ({
    ...e,
    pagesRegistre: { ...e.pagesRegistre, [cle]: epuisee ? 0 : r.lecture.page },
    ciblesEpuisees: epuisee ? { ...(e.ciblesEpuisees ?? {}), [cle]: jour } : e.ciblesEpuisees,
  }));
  noter({
    type: "cherche",
    texte: `Registre, page ${r.lecture.page} : ${added} entreprise(s) ajoutée(s)${x.exclues.length ? `, ${x.exclues.length} écartée(s) par une annonce légale` : ""}.`,
  });
}

// ══════════ LE MOTEUR ══════════

export function MoteurAutopilote() {
  const actif = useAlpha((s) => Boolean(s.settings.autopilote?.reglages.actif));
  const maitre = useMaitreProuve();
  const inscrit = useExpediteurInscrit();
  const [boite, setBoite] = useState<boolean | null>(null);
  const enCours = useRef(false);
  const inscritRef = useRef(inscrit);
  inscritRef.current = inscrit;

  // La boîte branchée, PROUVÉE par le serveur — jamais supposée.
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    if (maitre) {
      setBoite(true);
      return;
    }
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((j: { cles?: Record<string, { verifieLe?: string | null }> }) => vivant && setBoite(Boolean(j.cles?.email?.verifieLe)))
      .catch(() => vivant && setBoite(false));
    return () => {
      vivant = false;
    };
  }, [actif, maitre]);

  useEffect(() => {
    if (!actif || boite === null) return;
    const passage = async () => {
      if (enCours.current) return;
      enCours.current = true;
      try {
        const cle = lireCleDropcontact();
        const { reglages, etat } = etatCourant();
        if (!reglages.actif) return;
        const plan = planifier(useAlpha.getState().prospects, reglages, etat, { boite, cleDropcontact: Boolean(cle) }, new Date());
        if (plan.lire) await lire(reglages.imapHost, inscritRef.current !== null);
        if (plan.relireEnrichissements.length && cle) await relireEnrichissements(plan.relireEnrichissements, cle);
        if (plan.lancerEnrichissement.length && cle) await lancerEnrichissements(plan.lancerEnrichissement, cle);
        if (plan.relancer) await relancer(plan.relancer.prospectId, plan.relancer.numero);
        else if (plan.ecrire) await ecrire(plan.ecrire, inscritRef.current);
        if (plan.chercher) await chercher(plan.chercher);
      } catch (e) {
        noter({ type: "erreur", texte: `Passage interrompu : ${e instanceof Error ? e.message.slice(0, 160) : "erreur"}` });
      } finally {
        enCours.current = false;
      }
    };
    void passage();
    const id = setInterval(() => void passage(), CYCLE_MS);
    return () => clearInterval(id);
  }, [actif, boite]);

  return null;
}
