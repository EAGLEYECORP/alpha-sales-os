"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, HelpCircle, Loader2, Rocket } from "lucide-react";
import { preparationAutonomie, type Preparation } from "@/lib/autonomie-checklist";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « PRÊT POUR L'AUTONOMIE ? » — le cockpit, en un écran, au pouce.
 *
 * Lit `/api/health` (déjà protégé, détaillé pour le maître seul), TRADUIT sa
 * réponse en checklist (`lib/autonomie-checklist.ts`), et l'affiche : une ligne
 * verte/rouge par prérequis, avec l'action exacte. Il ne mesure rien lui-même.
 *
 * ⚠ Si `/api/health` ne rend pas `capabilities` (non maître, ou sonde muette),
 * on n'affiche RIEN — plutôt qu'un mur de rouge trompeur à un compte qui n'a
 * pas à voir l'exploitation. Même posture que le bouton autopilote.
 * ─────────────────────────────────────────────────────────────────────
 */

export function PretAutonomie() {
  const [prep, setPrep] = useState<Preparation | null>(null);
  const [chargement, setChargement] = useState(true);
  const [indispo, setIndispo] = useState(false);

  const relire = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      const d = (await r.json()) as { capabilities?: unknown };
      if (d && typeof d === "object" && d.capabilities) {
        setPrep(preparationAutonomie(d.capabilities as Parameters<typeof preparationAutonomie>[0]));
      } else {
        // Sonde muette : pas de détail (non maître, ou app murée). On se tait.
        setIndispo(true);
      }
    } catch {
      setIndispo(true);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    relire();
  }, [relire]);

  if (indispo) return null;

  const icone = (etat: "ok" | "manque" | "inconnu") => {
    if (etat === "ok") return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-green" />;
    if (etat === "inconnu") return <HelpCircle size={15} className="mt-0.5 shrink-0 text-signal-amber" />;
    return <XCircle size={15} className="mt-0.5 shrink-0 text-signal-red" />;
  };

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Rocket size={15} className={prep?.pret ? "text-signal-green" : "text-bronze-400"} /> Prêt pour l'autonomie ?
        </h2>
        {chargement && <Loader2 size={14} className="animate-spin text-paper-faint" />}
      </div>

      <p className="mt-0.5 text-[12px] text-paper-dim">
        {chargement
          ? "Lecture de l'état serveur…"
          : prep?.pret
            ? "Socle serveur prêt. Il reste à confirmer le DKIM à la main (ci-dessous), puis à armer."
            : `${prep?.manquants ?? 0} prérequis à poser avant que la machine tourne seule.`}
      </p>

      <ul className="mt-3 space-y-2">
        {prep?.items.map((i) => (
          <li key={i.id} className="flex gap-2">
            {icone(i.etat)}
            <div className="min-w-0">
              <span className="text-[13px] text-paper">{i.label}</span>
              {i.etat !== "ok" && (
                <p className="text-[11px] leading-relaxed text-paper-faint">{i.action}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-paper-faint">
        Détail complet : <span className="text-bronze-400">docs/AUTONOMIE-100.md</span>. Le serveur ne voit pas le DNS —
        le DKIM se confirme à la main.
      </p>
    </section>
  );
}
