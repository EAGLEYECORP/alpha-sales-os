"use client";

import { GoLiveChecklist } from "@/components/recette/go-live-checklist";
import { PageHeader } from "@/components/ui/page-header";

export default function RecettePage() {
  return (
    <div className="page">
      <PageHeader
        title="Recette — good to go"
        subtitle="Le test de la boucle complète, en conditions réelles : envoi → ouverture → clic → réponse → STOP. Chaque voyant se vérifie tout seul. Tout vert = prêt pour les 100 premiers."
      />
      <GoLiveChecklist />
    </div>
  );
}
