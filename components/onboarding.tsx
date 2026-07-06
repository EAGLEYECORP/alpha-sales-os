"use client";

import { useEffect, useState } from "react";
import { useAlpha, useHydrated } from "@/lib/store";
import { SetupWizard } from "@/components/setup-wizard";

/**
 * Assistant de configuration guidé. S'ouvre automatiquement au premier
 * lancement (settings.onboarded = false) et se rouvre à la demande via
 * l'événement « alpha:open-setup » (bouton dans les Réglages).
 */
export function Onboarding() {
  const hydrated = useHydrated();
  const onboarded = useAlpha((s) => s.settings.onboarded);
  const [open, setOpen] = useState(false);

  // Premier lancement → ouvre l'assistant.
  useEffect(() => {
    if (hydrated && !onboarded) setOpen(true);
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
