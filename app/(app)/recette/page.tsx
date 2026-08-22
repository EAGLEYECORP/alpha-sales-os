"use client";

import { GoLiveChecklist } from "@/components/recette/go-live-checklist";

export default function RecettePage() {
  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">Recette — good to go</h1>
        <p className="text-sm text-paper-faint">
          Le test de la boucle complète, en conditions réelles : envoi → ouverture → clic → réponse → STOP.
          Chaque voyant se vérifie tout seul. Tout vert = prêt pour les 100 premiers.
        </p>
      </header>
      <GoLiveChecklist />
    </div>
  );
}
