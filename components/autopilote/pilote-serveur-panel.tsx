"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Cloud, Power } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { EntreeJournal, ReglagesAutopilote } from "@/lib/autopilote-inscrit";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PILOTE DANS LE CLOUD — « ALPHA vend ALPHA » onglet fermé (30/10/2026).
 *
 * Monté pour le MAÎTRE seul (verdict prouvé, `useMaitreProuve`, par la page) ;
 * la route le revérifie (`/api/autopilote/serveur`, 403 sinon).
 *
 * Il envoie au serveur ce que le maître a réglé ICI (cible, plafonds, IMAP) et
 * son nom (Réglages → Closer) — tapés par lui, jamais une configuration. Les
 * secrets (Dropcontact, agenda) ne passent PAS par ici : ils vivent dans
 * l'environnement du serveur, et l'écran dit seulement s'ils sont posés.
 *
 * ⚠ Deux pilotes sur les mêmes réglages : celui de l'onglet travaille sur le
 * pipe du NAVIGATEUR, celui-ci sur le pipe du SERVEUR. Lancer celui-ci arrête
 * celui de l'onglet, pour qu'une même cible ne soit pas prospectée deux fois.
 * ─────────────────────────────────────────────────────────────────────
 */

interface EtatServeur {
  actif: boolean;
  journal: EntreeJournal[];
  dernierPassage: string | null;
  envoisSuspendusJusqua: string | null;
  ancienPiloteArme: boolean;
  manques: string[];
}

const heure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function PiloteServeurPanel({ reglages, arreterOnglet }: { reglages: ReglagesAutopilote; arreterOnglet: () => void }) {
  const closerName = useAlpha((s) => s.settings.closerName ?? "");
  const bookingUrl = useAlpha((s) => s.settings.bookingUrl ?? "");
  const [etat, setEtat] = useState<EtatServeur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    const lire = () =>
      fetch("/api/autopilote/serveur", { cache: "no-store" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!vivant) return;
          if (r.ok) {
            setEtat(j as EtatServeur);
            setErreur(null);
          } else setErreur((j as { error?: string }).error ?? `erreur ${r.status}`);
        })
        .catch(() => vivant && setErreur("réseau indisponible"));
    void lire();
    const id = setInterval(() => void lire(), 60_000);
    return () => {
      vivant = false;
      clearInterval(id);
    };
  }, []);

  const basculer = async () => {
    if (!etat) return;
    setEnvoi(true);
    try {
      const { actif: _a, ...saisis } = reglages;
      const res = await fetch("/api/autopilote/serveur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !etat.actif, reglages: saisis, closerName, bookingUrl }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur((j as { error?: string }).error ?? `erreur ${res.status}`);
        return;
      }
      if (!etat.actif) arreterOnglet();
      setEtat({ ...etat, ...(j as Partial<EtatServeur>) });
      setErreur(null);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section className={cn("card space-y-3 p-5", etat?.actif && "ring-1 ring-bronze-600")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-bold text-paper">
            <Cloud size={18} className="text-bronze-400" />
            {etat?.actif ? "ALPHA vend ALPHA dans le cloud." : "Dans le cloud, onglet fermé"}
          </p>
          <p className="text-[13px] text-paper-dim">
            {etat?.actif
              ? `Un passage toutes les 5 minutes en journée ouvrée, sur le pipe du serveur — ordinateur éteint compris.${etat.dernierPassage ? ` Dernier passage : ${heure(etat.dernierPassage)}.` : " Aucun passage encore : le premier viendra du planificateur."}`
              : "Compte maître : le même pilote, mêmes règles, tourne sur le serveur sans onglet ouvert ni n8n. Il reprend les réglages de cette page et ton nom (Réglages → Closer)."}
          </p>
        </div>
        <button type="button" className={etat?.actif ? "btn-ghost" : "btn-bronze"} disabled={!etat || envoi} onClick={() => void basculer()}>
          <Power size={16} /> {etat?.actif ? "Arrêter dans le cloud" : "Lancer dans le cloud"}
        </button>
      </div>

      {erreur && (
        <p className="flex gap-2 text-[13px] text-signal-amber">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erreur}
        </p>
      )}
      {etat?.ancienPiloteArme && (
        <p className="flex gap-2 text-[13px] text-signal-amber">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> L&apos;ancien autopilote d&apos;envoi (gabarits de l&apos;escalier) est armé : coupe-le, le pilote cloud refuse de tourner à côté.
        </p>
      )}
      {etat && etat.manques.length > 0 && (
        <ul className="space-y-1 text-[13px] text-paper-dim">
          {etat.manques.map((m) => (
            <li key={m}>· {m}</li>
          ))}
        </ul>
      )}
      {etat?.envoisSuspendusJusqua && new Date(etat.envoisSuspendusJusqua).getTime() > Date.now() && (
        <p className="text-[13px] text-paper-dim">Envois en pause jusqu&apos;à {heure(etat.envoisSuspendusJusqua)}.</p>
      )}
      {etat && etat.journal.length > 0 && (
        <ul className="space-y-1">
          {etat.journal.slice(0, 8).map((j, i) => (
            <li key={`${j.le}-${i}`} className="panel px-3 py-2 text-[13px] text-paper">
              <span className="text-paper-faint">{heure(j.le)} · </span>
              {j.texte}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
