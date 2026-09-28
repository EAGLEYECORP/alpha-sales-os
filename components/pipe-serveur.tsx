"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { pages, phraseListeVide, verdictChargement } from "@/lib/hydratation";
import type { Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CHARGEMENT DU PIPE AU DÉMARRAGE — quand il vit sur le serveur.
 *
 * ── POURQUOI CE COMPOSANT EST DANS LA COQUILLE, ET PAS DANS RÉGLAGES ──
 *
 * La synchro SORTANTE (`components/sync-prospects.tsx`) est montée dans
 * `/settings` : c'est une sauvegarde, elle peut n'exister que là où on la
 * règle. Le chargement ENTRANT, lui, conditionne TOUTES les pages : sans lui,
 * `/aujourdhui`, le pipeline et la file d'appels affichent un pipe vide et
 * l'opérateur croit avoir tout perdu. Il doit donc partir dès l'ouverture de
 * l'app, quelle que soit la page.
 *
 * ── ET POURQUOI IL AFFICHE QUELQUE CHOSE ──
 *
 * Un chargement silencieux qui échoue est indiscernable d'un pipe vide. C'est
 * exactement l'erreur que ce dépôt paie à répétition : l'écran continue de
 * fonctionner, il ment simplement sur ce qu'il montre. La bannière dit lequel
 * des deux c'est, et interdit explicitement les deux gestes qui détruisent
 * (réimporter par-dessus, supprimer ce qui « manque »).
 * ─────────────────────────────────────────────────────────────────────
 */

interface ReponsePage {
  fiches?: Prospect[];
  total?: number;
  error?: string;
  why?: string;
}

export function PipeServeur() {
  const hydrated = useAlpha((s) => s.hydrated);
  const settings = useAlpha((s) => s.settings);
  const etat = useAlpha((s) => s.hydratationPipe);
  const setEtat = useAlpha((s) => s.setHydratationPipe);
  const hydraterProspects = useAlpha((s) => s.hydraterProspects);

  const [detail, setDetail] = useState<string>("");
  const [recues, setRecues] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const enVol = useRef(false);

  const actif = Boolean(settings.pipeServeur && settings.supabaseSync);

  const charger = useCallback(async () => {
    // Un seul chargement à la fois : deux en parallèle poseraient les fiches
    // deux fois et le comptage ne voudrait plus rien dire.
    if (enVol.current) return;
    enVol.current = true;
    setEtat("en-cours");
    setRecues(0);
    setTotal(null);

    try {
      const lire = async (depuis: number, taille?: number): Promise<ReponsePage> => {
        const q = new URLSearchParams({ fiches: "1", depuis: String(depuis) });
        if (taille) q.set("taille", String(taille));
        const r = await fetch(`/api/sync/prospects?${q}`);
        const j = (await r.json()) as ReponsePage;
        if (!r.ok) throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
        return j;
      };

      // La première page annonce le total. Tout le reste s'en déduit : on ne
      // boucle pas « tant que ça renvoie quelque chose », parce qu'une page
      // vide au milieu ressemblerait alors à une fin de liste.
      const premiere = await lire(0);
      const attendu = premiere.total ?? 0;
      setTotal(attendu);

      const collectees: Prospect[] = [...(premiere.fiches ?? [])];
      setRecues(collectees.length);

      for (const p of pages(attendu).slice(1)) {
        const suite = await lire(p.depuis, p.taille);
        collectees.push(...(suite.fiches ?? []));
        setRecues(collectees.length);
      }

      const v = verdictChargement(collectees.length, attendu);
      // ⚠ On pose les fiches même sur un verdict d'échec : les avoir sous les
      // yeux vaut mieux que rien, tant que l'écran DIT que c'est incomplet et
      // que la poussée reste fermée (`peutSynchroniser("echec") === false`).
      hydraterProspects(collectees);
      setDetail(v.pourquoi);
      setEtat(v.etat);
    } catch (e) {
      const v = verdictChargement(0, 0, e instanceof Error ? e.message : "erreur inconnue");
      setDetail(v.pourquoi);
      setEtat(v.etat);
    } finally {
      enVol.current = false;
    }
  }, [hydraterProspects, setEtat]);

  useEffect(() => {
    // `hydrated` d'abord : lancer avant la lecture du localStorage ferait
    // partir le chargement sur les réglages par défaut, donc jamais.
    if (!hydrated || !actif) return;
    if (etat === "jamais") void charger();
  }, [hydrated, actif, etat, charger]);

  const phrase = phraseListeVide(etat);
  if (!actif || !phrase) return null;

  const grave = etat === "echec";

  return (
    <div
      role={grave ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-2 border-b px-4 py-2 text-[12px]",
        grave ? "border-signal-red/50 bg-signal-red/15 text-paper" : "border-ink-700 bg-ink-900 text-paper-dim"
      )}
    >
      {grave ? (
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-signal-red" />
      ) : (
        <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-bronze-400" />
      )}
      <p className="flex-1">
        {phrase}{" "}
        {etat === "en-cours" && total !== null && (
          <span className="font-mono text-paper-faint">
            {recues} / {total}
          </span>
        )}
        {grave && detail && <span className="block text-paper-dim">{detail}</span>}
      </p>
      {etat !== "en-cours" && (
        <button
          onClick={() => void charger()}
          className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-2 py-1 text-[11.5px] text-paper hover:bg-ink-800"
        >
          <RefreshCw size={12} /> Recharger
        </button>
      )}
    </div>
  );
}
