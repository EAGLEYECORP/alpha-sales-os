"use client";
import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { PRIX_HONORE_JUSQU_AU, phrasePrixPerime, prixPerime } from "@/lib/grille-perimee";
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
  /** ⚠ Lue une fois au montage, comme l'horloge du cadrage : une carte qui
      change de ton pendant qu'on lit n'a aucune raison visible de le faire. */
  const [maintenant] = useState(() => Date.now());
  const derniere = p.events?.length ? p.events[p.events.length - 1].date : null;
  const verdict = prixPerime(p, derniere);
  if (!verdict) return null;

  /**
   * ⚠⚠ TROIS TONS, PAS DEUX — la décision du 17/09 a créé un état qui n'existait
   * pas : « le prix tient, et c'est une bonne nouvelle ». Le peindre en ambre
   * comme un problème ferait lire une FAVEUR comme une alerte, et l'opérateur
   * corrigerait le prix par réflexe — exactement l'inverse de la décision.
   */
  const honore = verdict.certitude === "datee" && Date.parse(PRIX_HONORE_JUSQU_AU) >= maintenant;
  const dur = verdict.certitude === "datee" && !honore;
  return (
    <section
      className={cn(
        "card flex items-start gap-2.5 p-4 lg:col-span-2",
        honore ? "text-signal-green" : dur ? "text-signal-amber" : "text-paper-dim",
      )}
    >
      {honore ? (
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      )}
      <div>
        <p className="text-sm font-medium">
          {honore ? "Prix honoré — ta raison de rappeler" : dur ? "Prix à re-chiffrer" : "Prix à vérifier"}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed">{phrasePrixPerime(verdict, maintenant)}</p>
        {/* ⚠ Le MOTIF du changement voyage avec l'alerte. Sans lui, « la grille
            a changé » se lit comme une hausse arbitraire — et c'est la première
            chose qu'un commercial a envie de contourner pour ne pas perdre son
            deal. Avec lui, il sait quoi répondre au prospect. */}
        <p className="mt-1.5 text-[11px] leading-snug text-paper-faint">{verdict.grille.motif}</p>
      </div>
    </section>
  );
}
