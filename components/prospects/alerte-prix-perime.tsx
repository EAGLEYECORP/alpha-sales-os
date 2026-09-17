"use client";
import { AlertTriangle } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { phrasePrixPerime, prixPerime } from "@/lib/grille-perimee";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « CE PRIX VIENT D'UNE GRILLE QUI N'EXISTE PLUS » — dit AVANT de signer.
 *
 * ⚠ La dernière touche vient des ÉVÉNEMENTS de la fiche, pas d'un champ de
 * date à part. Un champ « modifié le » bougerait au moindre clic — ouvrir une
 * fiche n'est pas la travailler — et ferait passer une fiche figée depuis
 * juillet pour une fiche vivante, donc `datee` deviendrait `coincidence` et
 * l'alerte perdrait sa force exactement là où elle compte.
 *
 * ⚠ Rien n'est corrigé ici, et aucun bouton ne le propose. Le montant a pu
 * être annoncé au prospect : le réécrire depuis un écran, c'est renégocier
 * sans le dire. L'opérateur re-chiffre s'il le décide.
 * ─────────────────────────────────────────────────────────────────────
 */
export function AlertePrixPerime({ p }: { p: Prospect }) {
  const derniere = p.events?.length ? p.events[p.events.length - 1].date : null;
  const verdict = prixPerime(p, derniere);
  if (!verdict) return null;

  const dur = verdict.certitude === "datee";
  return (
    <section
      className={cn(
        "card flex items-start gap-2.5 p-4 lg:col-span-2",
        dur ? "text-signal-amber" : "text-paper-dim",
      )}
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">
          {dur ? "Prix à re-chiffrer" : "Prix à vérifier"}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed">{phrasePrixPerime(verdict)}</p>
        {/* ⚠ Le MOTIF du changement voyage avec l'alerte. Sans lui, « la grille
            a changé » se lit comme une hausse arbitraire — et c'est la première
            chose qu'un commercial a envie de contourner pour ne pas perdre son
            deal. Avec lui, il sait quoi répondre au prospect. */}
        <p className="mt-1.5 text-[11px] leading-snug text-paper-faint">{verdict.grille.motif}</p>
      </div>
    </section>
  );
}
