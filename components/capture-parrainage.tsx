"use client";

import { useEffect } from "react";
import { memoriseParrainage } from "@/lib/apporteur-attribution";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CAPTURE DU CODE D'APPORT — montée dans la RACINE, pas dans la coquille.
 *
 * ⚠ POURQUOI LA RACINE. Un prospect amené par un apporteur n'arrive PAS dans
 * l'application : il arrive sur `/vitrine`, qui vit hors de `app/(app)/layout`.
 * Monter la capture dans la coquille — le réflexe, puisque les autres moteurs
 * y sont — l'aurait rendue inerte pour exactement le seul public qu'elle
 * concerne. C'est la panne signature du dépôt : un mécanisme juste, branché au
 * mauvais endroit.
 *
 * ⚠⚠ Ce fichier ne porte AUCUNE logique : elle vit dans
 * `lib/apporteur-attribution.ts`, où elle est testable. Un `.tsx` client ne se
 * charge pas depuis `node:test`, et la première rédaction de ce module l'a
 * appris en faisant tomber toute une suite de tests au chargement.
 * ─────────────────────────────────────────────────────────────────────
 */
export function CaptureParrainage() {
  useEffect(() => {
    memoriseParrainage(window.location.href);
  }, []);
  return null;
}
