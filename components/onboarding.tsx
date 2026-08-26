"use client";

import { useEffect, useState } from "react";
import { useAlpha, useHydrated } from "@/lib/store";
import { SetupWizard } from "@/components/setup-wizard";
import { chargerProgression, doitSOuvrirSeul } from "@/lib/wizard-progress";

/**
 * Assistant de configuration guidé. S'ouvre automatiquement au premier
 * lancement (settings.onboarded = false) et se rouvre à la demande via
 * l'événement « alpha:open-setup » (bouton dans les Réglages).
 */
export function Onboarding() {
  const hydrated = useHydrated();
  const onboarded = useAlpha((s) => s.settings.onboarded);
  const [open, setOpen] = useState(false);

  /**
   * Premier lancement → ouvre l'assistant. MAIS pas s'il a déjà été repoussé.
   *
   * Sans ce second garde-fou, la croix ne servait à rien : `open` revenait à
   * faux, puis la navigation suivante remontait cet effet et le panneau
   * plein écran (z-95) reprenait la main. L'app était injouable tant que les
   * dix étapes n'avaient pas été traversées — et personne ne fait ça avant
   * d'avoir seulement regardé le produit.
   */
  useEffect(() => {
    if (hydrated && doitSOuvrirSeul(onboarded, chargerProgression())) setOpen(true);
  }, [hydrated, onboarded]);

  // Réouverture manuelle depuis n'importe où.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("alpha:open-setup", onOpen);
    return () => window.removeEventListener("alpha:open-setup", onOpen);
  }, []);

  if (!hydrated || !open) return null;
  return <SetupWizard onClose={() => setOpen(false)} />;
}
