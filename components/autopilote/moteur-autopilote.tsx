"use client";

import { useEffect, useRef, useState } from "react";
import { useAlpha } from "@/lib/store";
import { useMaitreProuve } from "@/lib/use-droits";
import { useExpediteurInscrit } from "@/lib/use-expediteur";
import type { Prospect } from "@/lib/types";
import { identiteEnvoi } from "@/lib/expediteur";
import { uid } from "@/lib/utils";
import { lireAdresseAgenda, lireCleDropcontact } from "@/lib/cle-locale";
import { lireReponseAgenda, type EtatAgenda } from "@/lib/agenda-occupe";
import { projeterImport, readStorageHealth } from "@/lib/storage-health";
import type { SuiteConversation } from "@/lib/relance-mail";
import type { MailSortant } from "@/lib/reponses-inscrit";
import { passagePilote, type PortesPilote, type RecuDeLecture } from "@/lib/pilote-executeur";
import {
  CYCLE_MS, ETAT_AUTOPILOTE_VIDE, REGLAGES_AUTOPILOTE_DEFAUT,
  expediteurDuPilote, journaliser,
  type EntreeJournal, type Envoi, type EtatAutopilote,
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

/**
 * ⚠ `suite` dit au serveur que ce message CONTINUE une conversation (réponse,
 * relance) : sans lui, la fenêtre de recontact de 14 jours refusait la
 * proposition de créneaux et chaque relance (`decisionRecontact`).
 */
async function envoyer(p: Prospect, mail: MailSortant, suite?: SuiteConversation, copieExpediteur = false): Promise<Envoi> {
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
        ...(suite ? { suite } : {}),
        ...(copieExpediteur ? { copieExpediteur } : {}),
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
/**
 * SON agenda (adresse secrète, `lib/agenda-occupe.ts`), relu au plus toutes les
 * 5 minutes : un passage qui traite trois réponses ne le lit qu'une fois. Sans
 * adresse : `absent`, et le pilote n'évite que ses propres rendez-vous.
 */
let agendaLu: { le: number; url: string; agenda: EtatAgenda } | null = null;
async function sonAgenda(): Promise<EtatAgenda> {
  const url = lireAdresseAgenda();
  if (!url) return { etat: "absent" };
  if (agendaLu && agendaLu.url === url && Date.now() - agendaLu.le < 5 * 60_000) return agendaLu.agenda;
  let agenda: EtatAgenda;
  try {
    const res = await fetch("/api/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    agenda = lireReponseAgenda(await res.json().catch(() => null), res.status);
  } catch {
    agenda = { etat: "non-lu", raison: "réseau indisponible" };
  }
  agendaLu = { le: Date.now(), url, agenda };
  return agenda;
}

/**
 * Les PORTES du navigateur (`lib/pilote-executeur.ts`) : le magasin local pour
 * les fiches et l'état, `/api/send` pour envoyer, `/api/reponses` pour lire la
 * boîte, `/api/agenda` pour l'agenda. Ce que le pilote FAIT n'est plus écrit
 * ici : le serveur (onglet fermé) branche les mêmes étapes sur ses portes.
 */
function portesNavigateur(inscrit: () => ReturnType<typeof expediteurDuPilote>): PortesPilote {
  return {
    maintenant: () => new Date(),
    uid,
    prospects: () => useAlpha.getState().prospects,
    meetings: () => useAlpha.getState().meetings,
    reglages: () => etatCourant().reglages,
    etat: () => etatCourant().etat,
    majEtat,
    patchProspect: (id, patch) => useAlpha.getState().patchProspect(id, patch),
    addEvent: (id, ev) => useAlpha.getState().addEvent(id, ev),
    upsertMeeting: (m) => useAlpha.getState().upsertMeeting(m),
    importer: (fiches) => {
      /**
       * Le mur de stockage AVANT d'écrire (règle d'écran n° 4). Ici personne ne
       * lit l'avertissement au moment de coller : le moteur s'arrête donc de lui-même
       * plutôt que d'écrire des fiches qui disparaîtraient à la fermeture de l'onglet.
       */
      const mur = projeterImport(readStorageHealth(), fiches, Math.round(JSON.stringify(fiches).length / fiches.length));
      if (mur?.alerte) return { refus: `Stockage du navigateur presque plein : ALPHA n'ajoute plus d'entreprises. ${mur.phrase}` };
      return { added: useAlpha.getState().importProspects(fiches).added };
    },
    expediteur: () => {
      const s = useAlpha.getState().settings;
      return { accountId: s.accountId, closerName: s.closerName, agencyName: s.agencyName, bookingUrl: s.bookingUrl };
    },
    inscrit,
    profil: () => useAlpha.getState().settings.profil,
    closing: () => useAlpha.getState().settings.closing,
    cleDropcontact: lireCleDropcontact,
    envoyer,
    lireReponses: async (q) => {
      const res = await fetch("/api/reponses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
      return (await res.json()) as RecuDeLecture;
    },
    agenda: sonAgenda,
    fetch: (u, i) => fetch(u, i),
  };
}

// ══════════ LE MOTEUR ══════════

export function MoteurAutopilote() {
  const actif = useAlpha((s) => Boolean(s.settings.autopilote?.reglages.actif));
  const maitre = useMaitreProuve();
  // Ce que dit le message : SON profil — celui de l'inscrit, ou celui du maître
  // dès qu'il a écrit « Ce que tu vends » (`expediteurDuPilote`).
  const inscrit = expediteurDuPilote({
    inscrit: useExpediteurInscrit(),
    profil: useAlpha((s) => s.settings.profil),
    agencyName: useAlpha((s) => s.settings.agencyName ?? ""),
    city: useAlpha((s) => s.settings.offer?.city ?? ""),
  });
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
        if (!etatCourant().reglages.actif) return;
        await passagePilote(portesNavigateur(() => inscritRef.current), { boite });
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
