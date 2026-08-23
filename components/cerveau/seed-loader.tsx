"use client";

import { useEffect } from "react";
import { useAlpha } from "@/lib/store";
// `import type` est effacé à la compilation : la forme voyage, pas la doctrine.
import type { KnowledgeNote } from "@/lib/knowledge";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le semis du Cerveau — une fois, au premier chargement authentifié.
 *
 * Le socle de notes (playbook maison : rituels de closing, adresses
 * partenaires, taux par offre) initialisait le store depuis un import. Comme
 * le store est importé par toutes les pages client, ce texte partait dans le
 * bundle de chacune — donc téléchargeable sans mot de passe.
 *
 * Il descend maintenant par `/api/knowledge/seed`, route interne. Ce composant
 * ne rend rien : il déclenche l'appel et laisse le store fusionner (`seedNotes`
 * ignore les ids déjà présents et ne rejoue jamais après le premier semis, pour
 * ne pas faire repousser une note supprimée).
 *
 * Il pose aussi la DOCTRINE par défaut (`settings.businessRules`), qui récitait
 * la grille tarifaire complète et l'escalier des commissions en prose — et qui
 * partait donc, elle aussi, dans le bundle de chaque page.
 *
 * Si l'appel échoue, le Cerveau reste vide côté socle : les notes et les règles
 * écrites par l'utilisateur, elles, sont intactes. On retentera au prochain
 * chargement, puisque le drapeau n'aura pas été posé.
 * ─────────────────────────────────────────────────────────────────────
 */
export function KnowledgeSeedLoader() {
  const deja = useAlpha((s) => s.settings.knowledgeSeeded);
  const seedNotes = useAlpha((s) => s.seedNotes);

  useEffect(() => {
    if (deja) return;
    let vivant = true;
    fetch("/api/knowledge/seed")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { notes?: KnowledgeNote[]; businessRules?: string }) => {
        if (!vivant) return;
        // La doctrine par défaut : posée seulement si l'opérateur n'a rien
        // écrit. On n'écrase jamais ses règles à lui.
        if (d.businessRules && !useAlpha.getState().settings.businessRules.trim()) {
          useAlpha.getState().patchSettings({ businessRules: d.businessRules });
        }
        if (d.notes?.length) seedNotes(d.notes);
      })
      .catch(() => {
        /* on retentera au prochain chargement */
      });
    return () => {
      vivant = false;
    };
  }, [deja, seedNotes]);

  return null;
}
