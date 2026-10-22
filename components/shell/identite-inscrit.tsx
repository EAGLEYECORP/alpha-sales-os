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
 * Trouvé AU RENDU (22/10/2026) : sur une installation client sans comptes, le
 * serveur répond `session: false`, et la première version, qui exigeait une
 * session, ne purgeait rien — l'écran de démarrage affichait encore notre nom.
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
      // `session` OU `exploitant` : sur notre cloud, un visiteur DÉCONNECTÉ a
      // aussi `maitre: false` — ce peut être nous, et la purge effacerait notre
      // propre identité. Une installation client sans comptes n'a pas de
      // session, mais le serveur y PROUVE l'exploitant, qui n'est jamais nous.
      if (vivant && !d.maitre && (d.session || d.exploitant)) purger();
    });
    return () => {
      vivant = false;
    };
  }, [purger]);
  return null;
}
