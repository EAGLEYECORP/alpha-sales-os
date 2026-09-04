"use client";

import { useEffect, useState } from "react";
import { useAlpha, useHydrated } from "@/lib/store";
import { SetupWizard } from "@/components/setup-wizard";
import { chargerProgression, doitSOuvrirSeul } from "@/lib/wizard-progress";
import { chargerDroits } from "@/lib/use-droits";

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
  /**
   * ⚠ TROISIÈME GARDE-FOU : IL NE S'OUVRE QUE POUR L'OPÉRATEUR.
   *
   * Cet assistant configure NOTRE installation : Google Sheets, n8n, SMTP,
   * Ollama, Supabase, déploiement. Ce sont des variables d'environnement du
   * SERVEUR et des services tiers qu'un locataire ne possède pas et ne peut
   * pas poser — il n'existe aucun chemin d'identifiants par locataire.
   *
   * Or il s'ouvrait AUTOMATIQUEMENT au premier lancement, pour tout le monde.
   * Mesuré sur une capture mobile : la toute première chose qu'un inscrit
   * gratuit voit, avant même le produit, est un panneau plein écran qui lui
   * explique « Google Sheets = la mémoire, n8n = le cerveau » — la pile de
   * quelqu'un d'autre, qu'il ne peut ni installer ni contourner autrement
   * qu'en trouvant la croix.
   *
   * C'est exactement le défaut corrigé sur `/demarrage` : un parcours
   * d'opérateur servi à un client. La différence, c'est que celui-ci est
   * MODAL — il ne se contente pas d'être hors sujet, il barre l'écran.
   *
   * Le bon parcours pour un inscrit existe déjà et il est filtré par ses
   * droits : `/demarrage`. Celui-ci reste ouvrable à la main depuis les
   * Réglages, pour qui a de quoi s'en servir.
   *
   * ⚠ `droits.maitre` OU `droits.solo` : le mode solo est l'installation
   * locale de l'opérateur, sans comptes configurés. L'exclure ferait
   * disparaître l'assistant de la machine de développement, c'est-à-dire du
   * seul endroit où il sert vraiment.
   *
   * ⚠⚠ ON ATTEND LA RÉPONSE DU SERVEUR — `useDroits` ne suffit PAS ici.
   * Ce hook est OPTIMISTE par construction : il rend `maitre: true` tant que
   * la réponse n'est pas arrivée, pour qu'un menu ne clignote pas. Bon pour un
   * menu ; faux pour un panneau modal qui barre l'écran et ne se referme pas
   * tout seul — l'assistant se serait ouvert pendant le chargement, et serait
   * resté. On lit donc la promesse, pas la valeur d'attente.
   */
  useEffect(() => {
    if (!hydrated) return;
    let vivant = true;
    void chargerDroits().then((d) => {
      if (!vivant) return;
      if (!(d.maitre || d.solo)) return;
      if (doitSOuvrirSeul(onboarded, chargerProgression())) setOpen(true);
    });
    return () => {
      vivant = false;
    };
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
