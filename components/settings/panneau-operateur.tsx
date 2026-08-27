"use client";

import { Lock } from "lucide-react";
import { useDroits } from "@/lib/use-droits";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PANNEAU OPÉRATEUR — ce que le client ne doit pas voir dans SES réglages.
 *
 * `/settings` est un chemin COMMUN : tout compte y accède, et c'est voulu —
 * un client qui ne peut pas configurer son propre outil n'est pas un client.
 * Mais l'écran mélangeait deux métiers :
 *
 *   · les réglages du CLIENT — son agence, sa doctrine, son ICP, ses
 *     notifications, son PIN, ses imports à lui ;
 *   · le panneau OPÉRATEUR — le portefeuille de comptes (EAGLEYE / ScintIA /
 *     Nuwacom), notre grille tarifaire, les clés d'infrastructure, le
 *     gabarit d'environnement, le chargement de NOS fiches réelles.
 *
 * ⚠ CE COMPOSANT NE SÉCURISE RIEN, et c'est important de l'écrire ici.
 * Il masque. La vraie barrière est le middleware : `MAITRE_SEULEMENT` refuse
 * `/api/pipeline`, `/api/voice-costs`, `/api/knowledge` et `/api/references`
 * à tout compte non maître, côté serveur, sur l'email du JETON. Sans cette
 * barrière-là, cacher un bouton ne fait que déplacer le problème dans les
 * devtools.
 *
 * Par défaut, `useDroits` est OPTIMISTE (tout ouvert tant qu'on ne sait pas).
 * C'est le bon choix pour un menu — un écran qui clignote fait croire à une
 * panne — et c'est acceptable ici pour la même raison : le serveur tranche.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PanneauOperateur({
  titre,
  children,
}: {
  /** Nommé pour que l'opérateur SACHE qu'il regarde nos affaires, pas celles du client. */
  titre?: string;
  children: React.ReactNode;
}) {
  const d = useDroits();
  if (!d.maitre && !d.solo) return null;

  return (
    <div className="relative">
      {titre && (
        <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-bronze-400">
          <Lock size={11} /> {titre} — visible par toi seul
        </p>
      )}
      {children}
    </div>
  );
}

/** Le booléen nu, pour les cas où un fragment ne peut pas être enveloppé. */
export function useEstOperateur(): boolean {
  const d = useDroits();
  return d.maitre || d.solo;
}
