"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { readStorageHealth, type StorageHealth } from "@/lib/storage-health";
import { storageIsFailing } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * L'alerte de stockage — la seule chose qui se met AU-DESSUS de tout.
 *
 * Quand `localStorage` sature, rien ne s'enregistre plus et l'app continue de
 * fonctionner normalement à l'écran. C'est ce qui rend la panne dangereuse :
 * elle ne ressemble pas à une panne. L'opérateur travaille une demi-journée,
 * ferme l'onglet, et tout ce qui a suivi la première écriture ratée n'existe
 * plus.
 *
 * Cette bannière est donc volontairement intrusive quand c'est grave, et
 * discrète quand ce n'est qu'un seuil d'attention. Elle nomme le plus gros
 * poste, parce que « stockage plein » sans « c'est le Cerveau » n'aide pas.
 */
export function StorageAlert() {
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const refresh = () => setHealth(readStorageHealth());
    refresh();
    // Une mesure par minute suffit : le volume bouge à l'échelle des imports,
    // pas des frappes clavier. Recalculer plus souvent coûterait plus que ça
    // ne rapporte.
    const t = setInterval(refresh, 60_000);

    const onStorage = (e: Event) => {
      const detail = (e as CustomEvent<{ failed: boolean }>).detail;
      setFailed(Boolean(detail?.failed));
      if (detail?.failed) setDismissed(false); // un échec réel ne se masque pas
      refresh();
    };
    window.addEventListener("alpha:storage", onStorage);
    setFailed(storageIsFailing());

    return () => {
      clearInterval(t);
      window.removeEventListener("alpha:storage", onStorage);
    };
  }, []);

  const grave = failed || health?.level === "sature" || health?.level === "critique";
  if (!health?.message && !failed) return null;
  if (!grave && dismissed) return null;

  return (
    <div
      role={grave ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-2 border-b px-4 py-2 text-[12px]",
        grave ? "border-signal-red/50 bg-signal-red/15 text-paper" : "border-ink-700 bg-ink-900 text-paper-dim"
      )}
    >
      <AlertTriangle size={14} className={cn("mt-0.5 shrink-0", grave ? "text-signal-red" : "text-signal-amber")} />
      <p className="flex-1">
        {failed ? (
          <>
            <strong className="text-paper">Le stockage local n&apos;enregistre plus.</strong> Ce que tu saisis
            depuis maintenant sera perdu en fermant l&apos;onglet. {health?.heaviest && <>Le plus lourd : {health.heaviest.label}. </>}
            Active la synchronisation pour mettre tes données à l&apos;abri.
          </>
        ) : (
          health?.message
        )}{" "}
        <Link href="/settings" className="underline">
          Ouvrir les réglages →
        </Link>
      </p>
      {!grave && (
        <button onClick={() => setDismissed(true)} className="text-paper-faint hover:text-paper">
          Masquer
        </button>
      )}
    </div>
  );
}
