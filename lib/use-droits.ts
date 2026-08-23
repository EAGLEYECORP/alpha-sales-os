"use client";

import { useEffect, useState } from "react";
import { peutOuvrir } from "./bricks-access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Les droits du compte, côté CLIENT — pour l'AFFICHAGE seulement.
 *
 * ⚠ Rien ici n'est une sécurité. La barrière est le middleware, qui refuse la
 * page ET l'API. Ce hook sert à ne pas promener un client dans des
 * culs-de-sac : une entrée de menu qui mène à une porte fermée est une
 * mauvaise expérience, pas une faille.
 *
 * Le jour où quelqu'un se met à autoriser une action à partir de cette
 * réponse, le trou est rouvert. C'est écrit ici parce que c'est exactement la
 * pente naturelle.
 *
 * Par défaut (avant réponse, ou en cas d'échec) : on considère qu'on a TOUT.
 * Un menu qui se vide une seconde au chargement fait croire à une panne ; et
 * comme le serveur refusera de toute façon, l'optimisme ne coûte rien.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Droits {
  bricks: string[];
  statut: "essai" | "actif" | "suspendu";
  essaiJusquA?: string;
  maitre: boolean;
  solo: boolean;
}

/** Optimiste : tout ouvert tant qu'on ne sait pas. */
const OPTIMISTE: Droits = { bricks: [], statut: "actif", maitre: true, solo: true };

let cache: Droits | null = null;

export function useDroits(): Droits {
  const [d, setD] = useState<Droits>(cache ?? OPTIMISTE);

  useEffect(() => {
    if (cache) return;
    let vivant = true;
    fetch("/api/compte/droits")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Droits) => {
        cache = j;
        if (vivant) setD(j);
      })
      .catch(() => {
        /* on reste optimiste : le serveur tranchera de toute façon */
      });
    return () => {
      vivant = false;
    };
  }, []);

  return d;
}

/** Faut-il MONTRER cette entrée de menu ? (confort, pas sécurité) */
export function afficherChemin(d: Droits, chemin: string): boolean {
  if (d.solo || d.maitre) return true;
  if (d.statut === "suspendu") return peutOuvrir(chemin, [], false);
  return peutOuvrir(chemin, d.bricks, false);
}
