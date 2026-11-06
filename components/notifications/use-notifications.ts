"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAlpha } from "@/lib/store";
import { useMaitreProuve } from "@/lib/use-droits";
import type { EntreeJournal } from "@/lib/autopilote-inscrit";
import { fusionner, nonLues, notifsDuJournal, notifsDuSuivi, type LigneSuivi, type Notif } from "@/lib/notifications";

/**
 * Une seule lecture des notifications, partagée par la cloche (coquille) et
 * l'écran `/notifications`. Relue toutes les 30 s tant que l'onglet est visible.
 *
 * ⚠ D'où vient le journal : le MAÎTRE a son pilote dans le cloud
 * (`/api/autopilote/serveur`, verdict serveur) ; un inscrit, dans son
 * navigateur (`settings.autopilote`). Le suivi des ouvertures vient de
 * `/api/track/stats` — s'il est refusé (brique non ouverte), on cesse de le
 * demander et l'écran le dit, au lieu de marteler une porte fermée.
 */
const CLE_VU = "alpha-notifications-vu";
const PERIODE_MS = 30_000;

function lireVu(): string | null {
  try {
    return localStorage.getItem(CLE_VU);
  } catch {
    return null;
  }
}

export function useNotifications() {
  const maitre = useMaitreProuve();
  const journalLocal = useAlpha((s) => s.settings.autopilote?.etat?.journal) as EntreeJournal[] | undefined;
  const [journalServeur, setJournalServeur] = useState<EntreeJournal[] | null>(null);
  const [suivi, setSuivi] = useState<LigneSuivi[] | null>(null);
  const [suiviFerme, setSuiviFerme] = useState(false);
  const [vu, setVu] = useState<string | null>(null);

  useEffect(() => setVu(lireVu()), []);

  const charger = useCallback(async () => {
    if (!suiviFerme) {
      try {
        const r = await fetch("/api/track/stats", { cache: "no-store" });
        if (r.status === 401 || r.status === 403) setSuiviFerme(true);
        else if (r.ok) setSuivi(((await r.json()) as { records?: LigneSuivi[] }).records ?? []);
      } catch {
        /* réseau : on garde la dernière lecture */
      }
    }
    if (maitre) {
      try {
        const r = await fetch("/api/autopilote/serveur", { cache: "no-store" });
        if (r.ok) setJournalServeur(((await r.json()) as { journal?: EntreeJournal[] }).journal ?? []);
      } catch {
        /* idem */
      }
    }
  }, [maitre, suiviFerme]);

  useEffect(() => {
    void charger();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void charger();
    }, PERIODE_MS);
    return () => clearInterval(t);
  }, [charger]);

  const notifs: Notif[] = useMemo(() => {
    const journal = (maitre ? journalServeur : null) ?? journalLocal ?? [];
    return fusionner([notifsDuSuivi(suivi ?? []), notifsDuJournal(journal, { sansEnvois: suivi !== null })]);
  }, [maitre, journalServeur, journalLocal, suivi]);

  const marquerVu = useCallback(() => {
    const t = notifs[0]?.quand ?? new Date().toISOString();
    try {
      localStorage.setItem(CLE_VU, t);
    } catch {
      /* navigation privée : le compteur repartira à la prochaine visite */
    }
    setVu(t);
  }, [notifs]);

  return { notifs, nonLues: nonLues(notifs, vu), vu, suiviFerme, marquerVu };
}
