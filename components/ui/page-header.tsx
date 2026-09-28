import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EN-TÊTE D'ÉCRAN — une seule fois, pas trente-cinq.
 *
 * ── CE QUI ÉTAIT CASSÉ ──
 *
 * La chaîne `font-display text-2xl font-bold text-paper` était recopiée à
 * la main dans 35 pages. Ça n'a jamais « planté » — c'est exactement pour
 * ça que ça a dérivé sans que personne le voie :
 *
 *   · le sur-titre existait dans 14 pages et pas dans les autres, sans
 *     règle : `/voice` en a un, `/kpis` non, et rien ne distingue les deux ;
 *   · l'alignement des actions oscillait entre `items-center` et
 *     `items-end` selon la page, donc les boutons sautaient d'un écran à
 *     l'autre ;
 *   · deux écrans (`/controle`, `/trajectoire`) n'avaient PAS de `<header>`
 *     du tout : un `<h1>` nu, sans repère pour un lecteur d'écran ;
 *   · le sous-titre était tantôt collé au titre, tantôt à `mt-1`.
 *
 * Une valeur recopiée trente-cinq fois n'est pas un choix de design : c'est
 * trente-cinq occasions de diverger. Ici, il y en a une.
 *
 * ── LA STRUCTURE, ET POURQUOI ELLE EST DANS CET ORDRE ──
 *
 *   sur-titre  → le CADRE (« calculé, pas déclaré ») : il se lit avant le
 *                titre parce qu'il dit dans quel monde on vient d'entrer ;
 *   titre      → le seul `<h1>` de la page — un et un seul, toujours ;
 *   sous-titre → ce que l'écran sert à faire, en une phrase ;
 *   actions    → à droite, alignées sur la BASE du bloc de titre.
 *
 * `items-end` et pas `items-center` : les boutons doivent s'aligner sur la
 * ligne de base du texte, pas flotter au milieu d'un bloc dont la hauteur
 * change selon qu'il y a un sous-titre ou non. Avec `items-center`, ajouter
 * une phrase de sous-titre déplaçait les boutons.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PageHeader({
  eyebrow,
  icon,
  title,
  badge,
  subtitle,
  actions,
  className,
}: {
  /** Le cadre, en petites capitales bronze. Facultatif. */
  eyebrow?: ReactNode;
  /** Icône posée avant le titre (lucide, taille 20-22). Facultative. */
  icon?: ReactNode;
  /** Le titre de l'écran — devient le `<h1>`. */
  title: ReactNode;
  /**
   * Une pastille d'état posée À CÔTÉ du titre, jamais dedans.
   *
   * ⚠ Elle a sa propre entrée pour une raison précise : glissée dans `title`,
   * son texte entrerait dans le `<h1>`. Un lecteur d'écran annoncerait alors
   * « titre : Menuiserie Charbonnier Négociation » comme un seul bloc, et le
   * plan du document deviendrait faux. Le titre nomme, la pastille qualifie.
   */
  badge?: ReactNode;
  /** Une phrase : ce que cet écran sert à faire. Facultative. */
  subtitle?: ReactNode;
  /** Boutons / compteurs, à droite. Facultatifs. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">{eyebrow}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-paper">
            {icon}
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-paper-faint">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
