"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play, Workflow } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { computeRoutines } from "@/lib/routines";
import { gardesArmes, journalRecent, lireCircuit, pouls } from "@/lib/circuit-alpha";
import { PageHeader } from "@/components/ui/page-header";
import { CircuitAlpha } from "@/components/alpha/circuit";
import { GardesAlpha } from "@/components/alpha/gardes";
import { JournalAlpha } from "@/components/alpha/journal";
import { Compteur, Revele } from "@/components/alpha/mouvement";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA AU TRAVAIL — pour l'UTILISATEUR : ce que la machine fait, étape par
 * étape, avec les règles qu'elle applique et ce qu'elle refuse de faire.
 *
 * Tout se décide dans `lib/circuit-alpha.ts` (testé, et ses citations de
 * fichiers vérifiées) ; cet écran le met en scène, en mouvement — mais le
 * mouvement n'accompagne que des faits (`components/alpha/mouvement.tsx`).
 *
 * ⚠ Il lit le CRM du NAVIGATEUR, onglet ouvert. C'est la frontière décidée le
 * 21/10/2026, pas un manque : l'écran le dit en bas.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function TravailPage() {
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const campaigns = useAlpha((s) => s.campaigns);
  const drafts = useAlpha((s) => s.drafts);
  const activities = useAlpha((s) => s.activities);

  // L'heure ne se lit qu'APRÈS le montage : la rendre côté serveur la figerait à
  // l'heure du build, et la fenêtre d'appel afficherait un état faux.
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    setMaintenant(new Date());
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const routines = useMemo(
    () => computeRoutines({ prospects, meetings, campaigns, drafts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, meetings, campaigns, drafts, maintenant]
  );
  const circuit = useMemo(() => lireCircuit(prospects, routines), [prospects, routines]);
  const poulsAlpha = useMemo(() => (maintenant ? pouls(prospects, routines, maintenant) : null), [prospects, routines, maintenant]);
  const gardes = useMemo(() => (maintenant ? gardesArmes(prospects, maintenant) : []), [prospects, maintenant]);
  const journal = useMemo(() => journalRecent(activities, 12), [activities]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="ALPHA"
        icon={<Workflow size={22} className="text-bronze-400" aria-hidden="true" />}
        title="ALPHA au travail"
        subtitle="Ce que la machine fait pour toi, étape par étape — et ce qu'elle refuse de faire."
        actions={
          <Link href="/aujourdhui#alpha" className="btn-bronze px-4 py-2 text-[13px]">
            <Play size={15} aria-hidden="true" /> Lancer ALPHA
          </Link>
        }
      />

      {poulsAlpha && (
        <Revele className="card p-4">
          <p className="text-[13px] leading-relaxed text-paper">{poulsAlpha.phrase}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="panel p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">Ouvertes</p>
              <Compteur valeur={poulsAlpha.ouvertes} className="font-display text-2xl text-paper" />
            </div>
            <div className="panel p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">T&apos;attendent</p>
              <Compteur valeur={poulsAlpha.aToi} className="font-display text-2xl text-signal-amber" />
            </div>
            <div className="panel p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">Ont dit non</p>
              <Compteur valeur={poulsAlpha.refuses} className="font-display text-2xl text-paper" />
            </div>
          </div>
        </Revele>
      )}

      <CircuitAlpha circuit={circuit} />

      {gardes.length > 0 && <GardesAlpha gardes={gardes} />}

      {maintenant && <JournalAlpha lignes={journal} maintenant={maintenant} />}

      <p className="text-[11px] leading-snug text-paper-faint">
        ALPHA travaille ici, dans ton navigateur, onglet ouvert : ton pipe ne quitte pas cet appareil, et ce tableau ne
        lit que ce qui s&apos;y trouve. App fermée, ALPHA ne fait rien — un ALPHA qui travaille pendant que tu dors
        n&apos;existe que sur l&apos;installation « chez vous », où le serveur est le tien.
      </p>
    </div>
  );
}
