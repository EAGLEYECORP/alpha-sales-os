"use client";

import { Eagle } from "@/components/eagle";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[70vh] place-items-center p-4">
      <div className="card max-w-md p-7 text-center">
        <span className="mx-auto block text-bronze-400">
          <Eagle size={56} glow />
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold text-paper">Un pépin, pas une perte</h1>
        <p className="mt-2 text-sm text-paper-dim">
          L&apos;écran a rencontré une erreur — tes données sont en sécurité dans le stockage local.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-[11px] text-paper-faint">
            {error.message.slice(0, 200)}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn-bronze" onClick={reset}>Réessayer</button>
          <a href="/" className="btn-ghost">Retour au dashboard</a>
        </div>
      </div>
    </div>
  );
}
