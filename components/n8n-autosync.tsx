"use client";

import { useEffect } from "react";
import { useAlpha, useHydrated } from "@/lib/store";
import { n8nConnected, syncFromN8n } from "@/lib/n8n";

const FLAG = "alpha_n8n_synced_session";

/**
 * Synchro automatique : si n8n est connecté, tire les prospects du CRM à
 * l'ouverture de l'app (une fois par session navigateur) — les infos du Sheet
 * (History, deadline, étapes écrites par n8n) sont à jour sans clic. Les
 * boutons « Récupérer » (Réglages / assistant) restent là pour forcer.
 */
export function N8nAutoSync() {
  const hydrated = useHydrated();
  const logActivity = useAlpha((s) => s.logActivity);

  useEffect(() => {
    if (!hydrated || !n8nConnected()) return;
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
    void syncFromN8n().then((r) => {
      if (r.ok && ((r.added ?? 0) > 0 || (r.updated ?? 0) > 0)) {
        logActivity({ kind: "systeme", message: `Synchro n8n auto : ${r.added} nouveau(x), ${r.updated} mis à jour` });
      }
    });
  }, [hydrated, logActivity]);

  return null;
}
