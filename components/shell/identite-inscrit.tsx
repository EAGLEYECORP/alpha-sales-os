"use client";

import { useEffect } from "react";
import { chargerDroits } from "@/lib/use-droits";
import { useAlpha } from "@/lib/store";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Retire de ses réglages l'identité d'usine d'un INSCRIT — une fois, au
 * chargement, monté dans la coquille (comme `SyncMoteur`).
 *
 * Avant le 21/10/2026, un store neuf naissait sous NOTRE identité. Ses emails
 * sont refusés côté serveur et ses prompts IA neutralisés (`identiteServie`),
 * mais un message LinkedIn se copie à la main : aucun serveur ne le relit, et
 * `presentation()` aurait continué d'écrire « je suis …, d'EAGLEYE CORP ».
 *
 * ⚠ On n'agit QUE sur la réponse du SERVEUR, jamais sur la valeur optimiste
 * de `useDroits()` (maître tant qu'on ne sait pas). `chargerDroits()` retombe
 * lui aussi sur « maître » en cas de panne : une panne réseau ne peut donc
 * jamais effacer l'identité du compte maître. L'inverse — garder notre nom
 * une visite de plus chez un inscrit — ne coûte qu'un rechargement.
 * ─────────────────────────────────────────────────────────────────────
 */
export function IdentiteInscrit() {
  const purger = useAlpha((s) => s.purgerIdentiteUsine);
  useEffect(() => {
    let vivant = true;
    void chargerDroits().then((d) => {
      if (vivant && d.session && !d.maitre) purger();
    });
    return () => {
      vivant = false;
    };
  }, [purger]);
  return null;
}
