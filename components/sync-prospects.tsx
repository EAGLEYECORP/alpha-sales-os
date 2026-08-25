"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CloudOff, RefreshCw, Upload } from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  allegerPourSync, etatSync, lots, planifierSync,
  type EmpreinteServeur, type EtatSync,
} from "@/lib/sync-prospects";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SYNCHRO, VUE DE L'OPÉRATEUR.
 *
 * ── POURQUOI C'EST UN INTERRUPTEUR, ET PAS UN COMPORTEMENT PAR DÉFAUT ──
 *
 * Activer cette synchro transfère vers un serveur les coordonnées de vraies
 * personnes : noms, téléphones, adresses d'entreprises qui n'ont rien demandé.
 * C'est notre base, c'est légitime, et ça reste une décision — pas un réglage
 * qu'on découvre après coup. Elle est donc éteinte par défaut, et l'écran dit
 * ce qu'elle change dans les deux sens.
 *
 * ── POURQUOI ELLE NE SE DÉCLENCHE PAS À CHAQUE FRAPPE ──
 *
 * Une fiche se modifie caractère par caractère. Pousser à chaque changement
 * ferait des centaines de requêtes pour une seule saisie. On attend que ça se
 * calme, puis on envoie ce qui a bougé.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le silence à observer avant d'envoyer. Assez long pour couvrir une saisie. */
const DELAI_MS = 8_000;

const TON: Record<EtatSync, string> = {
  "a-jour": "border-signal-green/40 text-signal-green",
  "en-retard": "border-signal-amber/50 text-signal-amber",
  erreur: "border-signal-red/50 text-signal-red",
  jamais: "border-ink-600 text-paper-faint",
  desactivee: "border-ink-600 text-paper-faint",
};

export function SyncProspects() {
  const prospects = useAlpha((s) => s.prospects);
  const settings = useAlpha((s) => s.settings);
  const patchSettings = useAlpha((s) => s.patchSettings);

  const [empreintes, setEmpreintes] = useState<EmpreinteServeur[] | null>(null);
  const [derniereSync, setDerniereSync] = useState<string | undefined>();
  const [erreur, setErreur] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);

  const active = settings.supabaseSync;
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lireEmpreintes = useCallback(async () => {
    try {
      const r = await fetch("/api/sync/prospects");
      const j = (await r.json()) as { empreintes?: EmpreinteServeur[]; why?: string; error?: string };
      if (!r.ok) {
        setErreur(j.why ?? j.error ?? "Le serveur n'a pas répondu.");
        setEmpreintes(null);
        return null;
      }
      setErreur(undefined);
      const e = j.empreintes ?? [];
      setEmpreintes(e);
      return e;
    } catch {
      setErreur("Le serveur n'a pas répondu.");
      return null;
    }
  }, []);

  useEffect(() => {
    if (active) void lireEmpreintes();
  }, [active, lireEmpreintes]);

  const plan = empreintes ? planifierSync(prospects, empreintes) : null;

  const pousser = useCallback(
    async (forcer = false) => {
      const base = (await lireEmpreintes()) ?? [];
      const p = planifierSync(prospects, base);

      if (p.effacementMassif && !forcer) {
        setConfirmerEffacement(true);
        setErreur(p.resume);
        return;
      }
      setConfirmerEffacement(false);
      setEnCours(true);
      try {
        // Les écritures partent par lots : un corps de requête trop gros se
        // fait refuser par la plateforme, et l'échec serait TOTAL au lieu
        // d'être partiel.
        for (const lot of lots(p.aEcrire.map(allegerPourSync))) {
          const r = await fetch("/api/sync/prospects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ecrire: lot }),
          });
          if (!r.ok) {
            const j = (await r.json()) as { why?: string; error?: string };
            throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
          }
        }
        for (const lot of lots(p.aSupprimer)) {
          const r = await fetch("/api/sync/prospects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ supprimer: lot }),
          });
          if (!r.ok) {
            const j = (await r.json()) as { why?: string; error?: string };
            throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
          }
        }
        setDerniereSync(new Date().toISOString());
        setErreur(undefined);
        await lireEmpreintes();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de la synchro.");
      } finally {
        setEnCours(false);
      }
    },
    [prospects, lireEmpreintes]
  );

  // Poussée automatique après un silence — jamais pendant la saisie.
  useEffect(() => {
    if (!active || enCours || confirmerEffacement) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void pousser(), DELAI_MS);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [prospects, active, enCours, confirmerEffacement, pousser]);

  const { etat, message } = etatSync({
    active,
    derniereSync,
    derniereErreur: erreur,
    aEcrire: plan?.aEcrire.length ?? 0,
    aSupprimer: plan?.aSupprimer.length ?? 0,
  });

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          {active ? <Upload size={15} className="text-bronze-400" /> : <CloudOff size={15} className="text-paper-faint" />}
          Synchro du pipe vers le serveur
        </h2>
        <button
          className={cn("chip cursor-pointer", active ? "border-signal-green/50 text-signal-green" : "border-ink-600 text-paper-faint")}
          onClick={() => patchSettings({ supabaseSync: !active })}
        >
          {active ? "activée" : "désactivée"}
        </button>
      </div>

      <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
        Le CRM vit dans <strong className="text-paper-dim">ce navigateur</strong>. Sans cette synchro, l&apos;orchestrateur
        ne voit rien du pipe et rien n&apos;est récupérable depuis un autre appareil. Avec elle, les coordonnées de tes
        prospects sont écrites sur ton serveur Supabase — c&apos;est ta base, et c&apos;est une décision, pas un défaut.
      </p>

      <p className={cn("mt-2 rounded-lg border px-3 py-2 text-[12px]", TON[etat])}>{message}</p>

      {confirmerEffacement && (
        <div className="mt-2 rounded-lg border border-signal-red/50 bg-signal-red/5 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-signal-red">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Synchro arrêtée avant d&apos;envoyer. Si tu as réellement supprimé ces fiches, confirme. Si tu viens de
            changer d&apos;appareil ou de vider ton navigateur, <strong>n&apos;confirme pas</strong> — désactive plutôt
            la synchro et récupère tes données d&apos;abord.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-ghost px-2.5 py-1.5 text-[12px] text-signal-red" onClick={() => void pousser(true)}>
              Oui, supprimer côté serveur
            </button>
            <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => setConfirmerEffacement(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button className="btn-bronze px-3 py-1.5 text-[12px]" disabled={enCours} onClick={() => void pousser()}>
            {enCours ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
            {enCours ? "Envoi…" : "Synchroniser maintenant"}
          </button>
          {plan && !plan.effacementMassif && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-paper-faint">
              {plan.aEcrire.length === 0 && plan.aSupprimer.length === 0 ? (
                <>
                  <Check size={12} className="text-signal-green" /> {plan.inchangees} fiche(s) déjà à jour
                </>
              ) : (
                plan.resume
              )}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
