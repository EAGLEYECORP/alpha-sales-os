"use client";

import { useRouter } from "next/navigation";
import { FileSpreadsheet, Compass } from "lucide-react";
import { useAlpha, useHydrated } from "@/lib/store";
import { Eagle } from "@/components/eagle";

/**
 * First-run choice: explore the Lyon demo, or start clean with real data.
 * Shown once (settings.onboarded), non-destructive by default.
 */
export function Onboarding() {
  const hydrated = useHydrated();
  const { settings, patchSettings, clearAllData, prospects } = useAlpha();
  const router = useRouter();

  if (!hydrated || settings.onboarded) return null;

  const keepDemo = () => patchSettings({ onboarded: true });
  const startReal = () => {
    if (prospects.length > 0) clearAllData();
    patchSettings({ onboarded: true });
    router.push("/settings");
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-7 text-center animate-fade-up">
        <span className="mx-auto block animate-floaty text-bronze-400">
          <Eagle size={80} glow />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-paper">
          Bienvenue dans ALPHA <span className="text-bronze-400">SALES OS</span>
        </h1>
        <p className="mt-2 text-sm text-paper-dim">
          Émotion d&apos;abord, logique ensuite. Chaque contact se termine par un next step daté.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={keepDemo} className="card card-hover p-4 text-left">
            <Compass size={20} className="text-bronze-400" />
            <p className="mt-2 font-display text-sm font-bold text-paper">Explorer la démo</p>
            <p className="mt-1 text-[12px] text-paper-faint">
              8 prospects lyonnais fictifs pour prendre en main la doctrine, le Kanban et l&apos;agent. Effaçable en un clic.
            </p>
          </button>
          <button onClick={startReal} className="card card-hover border-bronze-700/60 p-4 text-left">
            <FileSpreadsheet size={20} className="text-bronze-400" />
            <p className="mt-2 font-display text-sm font-bold text-paper">Démarrer en réel</p>
            <p className="mt-1 text-[12px] text-paper-faint">
              Base vide + import direct de ton Google Sheet / CSV (prospects et deep audit). Tu es opérationnel en 2 minutes.
            </p>
          </button>
        </div>
        <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper-faint">
          Changeable à tout moment dans Réglages
        </p>
      </div>
    </div>
  );
}
