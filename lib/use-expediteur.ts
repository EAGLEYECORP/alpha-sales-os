"use client";

import { useMemo } from "react";
import { useAlpha } from "./store";
import { useMaitreProuve } from "./use-droits";
import type { ExpediteurInscrit } from "./approche-ecrite";

/**
 * Qui écrit, pour les textes que l'écran fabrique (email, LinkedIn, WhatsApp) :
 * `null` = le compte maître, PROUVÉ par le serveur ; sinon l'inscrit, avec SA
 * société et SON profil (`ExpediteurInscrit`, `lib/approche-ecrite.ts`).
 * Pessimiste par construction (`useMaitreProuve`).
 */
export function useExpediteurInscrit(): ExpediteurInscrit | null {
  const maitre = useMaitreProuve();
  const profil = useAlpha((s) => s.settings.profil);
  const agencyName = useAlpha((s) => s.settings.agencyName ?? "");
  const city = useAlpha((s) => s.settings.offer?.city ?? "");
  return useMemo(() => (maitre ? null : { profil, agencyName, city }), [maitre, profil, agencyName, city]);
}
