"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Clock, Info, X } from "lucide-react";
import type { Proposition } from "@/lib/propositions";
import { EXPIRATION_HEURES } from "@/lib/propositions";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA FILE — ce qu'un agent propose, et que TU tranches.
 *
 * L'idée du dispositif : l'orchestrateur observe le pipe en continu et
 * prépare la suite ; l'opérateur ne cherche plus quoi faire, il dit oui ou
 * non. C'est plus rapide que de décider, et ça laisse une trace.
 *
 * Trois choix d'interface qui viennent de la doctrine, pas du goût :
 *
 *  · LE « POURQUOI » EST AUSSI GROS QUE LE TITRE. Une proposition qu'on
 *    approuve sans lire sa justification est une proposition qu'on subit.
 *  · APPROUVER N'EXÉCUTE RIEN, et c'est écrit sur le bouton. « Approuver » et
 *    « envoyer » restent deux gestes quand un client réel est au bout.
 *  · LE REJET DEMANDE UN MOTIF. C'est la seule chose qui remonte à l'agent :
 *    sans motif, il repropose la même chose demain.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PropositionsPanel() {
  const [props, setProps] = useState<Proposition[] | null>(null);
  const [indispo, setIndispo] = useState<string | null>(null);
  const [motif, setMotif] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const charger = useCallback(() => {
    fetch("/api/propositions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { propositions: Proposition[]; indisponible?: boolean; why?: string }) => {
        setProps(d.propositions ?? []);
        setIndispo(d.indisponible ? (d.why ?? "indisponible") : null);
      })
      .catch(() => setIndispo("Le serveur n'a pas répondu."));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const trancher = async (p: Proposition, decision: "approuvee" | "rejetee") => {
    setBusy(p.id);
    try {
      const r = await fetch("/api/propositions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: p.id, decision, motif: motif[p.id] }),
      });
      if (!r.ok) {
        const j = (await r.json()) as { error?: string };
        setIndispo(j.error ?? "Refusé.");
      }
      charger();
    } finally {
      setBusy(null);
    }
  };

  const enAttente = (props ?? []).filter((p) => p.statut === "en-attente");
  const recentes = (props ?? []).filter((p) => p.statut !== "en-attente").slice(0, 5);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Bot size={15} className="text-bronze-400" /> Propositions de l&apos;orchestrateur
        </h2>
        <span className="text-[11px] text-paper-faint">
          {enAttente.length} à trancher · expirent après {EXPIRATION_HEURES} h
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-paper-faint">
        L&apos;agent observe et propose. Il n&apos;envoie rien, n&apos;appelle personne et ne déplace aucune fiche.
      </p>

      {indispo && (
        <p className="mt-2 rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-[11.5px] text-paper">
          {indispo}
        </p>
      )}

      {props && enAttente.length === 0 && !indispo && (
        <p className="mt-3 text-[12px] text-paper-faint">Rien à trancher.</p>
      )}

      <ul className="mt-3 space-y-2">
        {enAttente.map((p) => (
          <li key={p.id} className="panel p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="chip border-bronze-700/50 text-bronze-400">{p.type}</span>
              <span className="text-[10.5px] text-paper-faint">
                {p.auteur} · {new Date(p.createdAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-paper">{p.titre}</p>

            {/* Le POURQUOI, aussi visible que le titre : approuver sans lire la
                justification, c'est subir la proposition. */}
            <p className="mt-1 flex items-start gap-1.5 text-[12px] text-paper-dim">
              <Info size={12} className="mt-0.5 shrink-0 text-bronze-400" />
              {p.pourquoi}
            </p>

            {p.contenu && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-900 p-2.5 text-[11.5px] text-paper">
                {p.contenu}
              </pre>
            )}
            {p.etape && <p className="mt-1 text-[11.5px] text-paper-faint">Étape visée : {p.etape}</p>}
            {p.quand && (
              <p className="mt-1 text-[11.5px] text-paper-faint">
                Quand : {new Date(p.quand).toLocaleString("fr-FR")}
              </p>
            )}

            <input
              className="input mt-2 text-[12px]"
              placeholder="Motif du rejet — c'est la seule chose qui remonte à l'agent"
              value={motif[p.id] ?? ""}
              onChange={(e) => setMotif({ ...motif, [p.id]: e.target.value })}
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="btn-bronze px-3 py-1.5 text-[12px]"
                disabled={busy === p.id}
                onClick={() => trancher(p, "approuvee")}
              >
                <Check size={13} /> Approuver — {p.type === "alerte" ? "vu" : "à exécuter par toi"}
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-[12px] text-signal-red"
                disabled={busy === p.id}
                onClick={() => trancher(p, "rejetee")}
              >
                <X size={13} /> Rejeter
              </button>
            </div>
          </li>
        ))}
      </ul>

      {recentes.length > 0 && (
        <>
          <h3 className="mt-4 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-paper-faint">
            <Clock size={11} /> Déjà tranchées
          </h3>
          <ul className="mt-1.5 space-y-1">
            {recentes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-2 text-[11.5px]">
                <span
                  className={cn(
                    "chip",
                    p.statut === "approuvee"
                      ? "border-signal-green/50 text-signal-green"
                      : p.statut === "rejetee"
                        ? "border-signal-red/50 text-signal-red"
                        : "border-ink-600 text-paper-faint"
                  )}
                >
                  {p.statut}
                </span>
                <span className="text-paper-dim">{p.titre}</span>
                {p.motifRejet && <span className="text-paper-faint">— {p.motifRejet}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
