"use client";

import { Lock } from "lucide-react";
import { useMaitreProuve } from "@/lib/use-droits";

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
 *   · le panneau OPÉRATEUR — le portefeuille de comptes (EAGLEYE /
 *     Nuwacom), notre grille tarifaire, les clés d'infrastructure, le
 *     gabarit d'environnement, le chargement de NOS fiches réelles.
 *
 * ⚠ CE COMPOSANT NE SÉCURISE RIEN, et c'est important de l'écrire ici.
 * Il masque. La vraie barrière est le middleware : `MAITRE_SEULEMENT`
 * (`lib/api-access.ts`) refuse ces routes à tout compte non maître, côté
 * serveur, sur l'email du JETON. Sans cette barrière-là, cacher un bouton ne
 * fait que déplacer le problème dans les devtools.
 *
 * ⚠ La liste n'est PAS recopiée ici — elle en portait quatre alors qu'il y en
 * a six depuis le 16/09 (`/api/digest` et `/api/notion` s'y sont ajoutées).
 * Une prose qui dérive du code ne casse rien : elle ment, à l'endroit précis
 * où quelqu'un vient chercher la règle.
 *
 * ⚠⚠ LE VERDICT EST PESSIMISTE (`useMaitreProuve`), PLUS OPTIMISTE (29/10/2026).
 * `useDroits` rendait « maître » tant que la réponse n'était pas arrivée — et
 * pour de bon si elle échouait. Vu en production, sur un `/settings` imprimé
 * par un VISITEUR sans compte : le panneau de validation partenaire Nuwacom,
 * nos trois offres, la charte interne. Le serveur tranchait bien les API ;
 * l'écran, lui, avait déjà raconté notre portefeuille. Ce panneau montre ce
 * qui n'est qu'à nous : dans le doute, il se tait. Même règle que les textes
 * qui se copient (`useMaitreProuve`, 22/10).
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
  const maitre = useMaitreProuve();
  if (!maitre) return null;

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
  return useMaitreProuve();
}
