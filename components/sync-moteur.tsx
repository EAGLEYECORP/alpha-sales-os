"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAlpha } from "@/lib/store";
import {
  allegerPourSync, etatSync, lots, planifierSync,
  type EmpreinteServeur, type EtatSync, type PlanSync,
} from "@/lib/sync-prospects";
import { planifierSyncRdv } from "@/lib/sync-meetings";
import { peutSynchroniser } from "@/lib/hydratation";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MOTEUR DE SYNCHRO — monté UNE fois, dans la coquille, pour toute l'app.
 *
 * ⚠ POURQUOI IL A ÉTÉ SORTI DE `/settings` : LE MODE PIPE SERVEUR LE RENDAIT
 * DESTRUCTEUR.
 *
 * La synchro sortante vivait entièrement dans la carte affichée dans Réglages.
 * Tant que le navigateur PERSISTAIT les fiches, ce n'était qu'un confort : le
 * travail était de toute façon dans localStorage, et il partait au serveur à
 * la prochaine visite dans Réglages.
 *
 * `pipeServeur` renverse ça. Les fiches ne sont plus écrites sur le disque :
 * la seule copie durable est celle du serveur. Un opérateur qui travaille sa
 * journée sans jamais ouvrir Réglages n'aurait donc RIEN poussé — et tout
 * perdu en fermant l'onglet. Ce n'était pas un risque, c'était le cas normal.
 *
 * Le moteur est donc monté dans la coquille (il tourne partout), et Réglages
 * n'en garde que la VUE. Un seul moteur, un seul minuteur, un seul plan : deux
 * instances auraient poussé deux fois le même lot et se seraient disputé
 * l'état de confirmation d'effacement.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le silence à observer avant d'envoyer. Assez long pour couvrir une saisie. */
const DELAI_MS = 8_000;

export interface EtatMoteurSync {
  actif: boolean;
  /** A-t-on le droit de pousser ? (`lib/hydratation.ts`) */
  autorise: boolean;
  plan: PlanSync | null;
  etat: EtatSync;
  message: string;
  enCours: boolean;
  confirmerEffacement: boolean;
  annulerConfirmation: () => void;
  pousser: (forcer?: boolean) => Promise<void>;
}

const Ctx = createContext<EtatMoteurSync | null>(null);

/** L'état du moteur, ou `null` si la vue est rendue hors de la coquille. */
export const useMoteurSync = (): EtatMoteurSync | null => useContext(Ctx);

export function SyncMoteur({ children }: { children: React.ReactNode }) {
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const settings = useAlpha((s) => s.settings);
  const etatHydratation = useAlpha((s) => s.hydratationPipe);

  const [empreintes, setEmpreintes] = useState<EmpreinteServeur[] | null>(null);
  const [empreintesRdv, setEmpreintesRdv] = useState<EmpreinteServeur[] | null>(null);
  const [derniereSync, setDerniereSync] = useState<string | undefined>();
  const [erreur, setErreur] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);

  const active = settings.supabaseSync;
  /**
   * ⚠ LA PERMISSION DE POUSSER — une seule réponse dans tout le produit
   * (`lib/hydratation.ts`). En mode pipe serveur, un navigateur qui n'a pas
   * réussi à charger a une liste VIDE : pousser depuis là proposerait de
   * supprimer l'intégralité du pipe. `planifierSync` refuserait
   * (`SEUIL_EFFACEMENT`), mais compter sur un seul filet, c'est attendre le
   * jour où il cède.
   */
  const autorise = peutSynchroniser(etatHydratation);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lireEmpreintes = useCallback(async () => {
    try {
      const r = await fetch("/api/sync/prospects");
      const j = (await r.json()) as { empreintes?: EmpreinteServeur[]; why?: string; error?: string };
      if (!r.ok) {
        setErreur(j.why ?? j.error ?? "Le serveur n'a pas répondu.");
        setEmpreintes(null);
        return null;
      }
      setErreur(undefined);
      const e = j.empreintes ?? [];
      setEmpreintes(e);
      return e;
    } catch {
      setErreur("Le serveur n'a pas répondu.");
      return null;
    }
  }, []);

  /**
   * ⚠ LES RENDEZ-VOUS PASSENT PAR LE MÊME MOTEUR, ET C'EST LA RAISON D'ÊTRE
   * DE CE COMPOSANT. Ils n'étaient poussés NULLE PART : `/api/calendar` (le
   * flux iCal) et `/api/push/tick` (la notif du matin) lisaient une table que
   * personne ne remplissait, en répondant 200. Un agenda vide se lit comme une
   * journée libre.
   *
   * Deux ROUTES distinctes (volumes et garde-fous sans rapport), un seul
   * MOTEUR : deux minuteurs se disputeraient l'état de confirmation
   * d'effacement, et c'est ce composant qui existe pour l'empêcher.
   */
  const lireEmpreintesRdv = useCallback(async () => {
    try {
      const r = await fetch("/api/sync/meetings");
      const j = (await r.json()) as { empreintes?: EmpreinteServeur[]; why?: string; error?: string };
      if (!r.ok) {
        setEmpreintesRdv(null);
        return null;
      }
      const e = j.empreintes ?? [];
      setEmpreintesRdv(e);
      return e;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (active) {
      void lireEmpreintes();
      void lireEmpreintesRdv();
    }
  }, [active, lireEmpreintes, lireEmpreintesRdv]);

  const plan = empreintes ? planifierSync(prospects, empreintes) : null;

  /**
   * ⚠ LE PLAN DES RENDEZ-VOUS COMPTE DANS L'ÉTAT AFFICHÉ, et ce n'est pas
   * cosmétique. Sans lui, la carte de Réglages annoncerait « à jour » avec
   * trois rendez-vous jamais poussés — c'est-à-dire le mensonge exact que
   * l'agenda vide produisait déjà, mais cette fois avec un voyant vert pour
   * le couvrir. Un écran de supervision qui affiche du calme sur un travail
   * en attente est pire que pas d'écran du tout.
   */
  const planRdv = empreintesRdv ? planifierSyncRdv(meetings, empreintesRdv) : null;

  const pousser = useCallback(
    async (forcer = false) => {
      if (!peutSynchroniser(etatHydratation)) {
        setErreur(
          "Poussée bloquée : le pipe n'a pas été chargé depuis le serveur. Ce que ce navigateur affiche n'est " +
            "pas ton pipeline — l'envoyer maintenant supprimerait côté serveur tout ce qui n'a pas été chargé."
        );
        return;
      }
      const base = (await lireEmpreintes()) ?? [];
      const p = planifierSync(prospects, base);

      if (p.effacementMassif && !forcer) {
        setConfirmerEffacement(true);
        setErreur(p.resume);
        return;
      }
      setConfirmerEffacement(false);
      setEnCours(true);
      try {
        // Les écritures partent par lots : un corps de requête trop gros se
        // fait refuser par la plateforme, et l'échec serait TOTAL au lieu
        // d'être partiel.
        for (const lot of lots(p.aEcrire.map(allegerPourSync))) {
          const r = await fetch("/api/sync/prospects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ecrire: lot }),
          });
          if (!r.ok) {
            const j = (await r.json()) as { why?: string; error?: string };
            throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
          }
        }
        for (const lot of lots(p.aSupprimer)) {
          const r = await fetch("/api/sync/prospects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ supprimer: lot }),
          });
          if (!r.ok) {
            const j = (await r.json()) as { why?: string; error?: string };
            throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
          }
        }
        /**
         * ⚠ LES RENDEZ-VOUS PARTENT APRÈS LES FICHES, ET DANS CET ORDRE.
         * Un rendez-vous porte `prospectId` : poussé avant la fiche qu'il
         * référence, le flux iCal aurait un événement dont il ne peut pas
         * nommer l'entreprise. L'inverse ne coûte rien — une fiche sans son
         * rendez-vous est simplement une fiche.
         *
         * ⚠⚠ Et ils partent dans le MÊME try : si les rendez-vous échouent,
         * l'erreur s'affiche et `derniereSync` n'est PAS posée. Marquer « à
         * jour » sur une moitié poussée est exactement le mensonge qu'un
         * écran de supervision ne doit jamais faire.
         */
        const baseRdv = (await lireEmpreintesRdv()) ?? [];
        const pRdv = planifierSyncRdv(meetings, baseRdv);
        for (const lot of lots(pRdv.aEcrire)) {
          const r = await fetch("/api/sync/meetings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ecrire: lot }),
          });
          if (!r.ok) {
            const j = (await r.json()) as { why?: string; error?: string };
            throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
          }
        }
        // ⚠ Le garde-fou d'effacement massif vaut aussi ici : un navigateur qui
        // a perdu son store ne doit pas vider l'agenda du serveur.
        if (!pRdv.effacementMassif) {
          for (const lot of lots(pRdv.aSupprimer)) {
            const r = await fetch("/api/sync/meetings", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ supprimer: lot }),
            });
            if (!r.ok) {
              const j = (await r.json()) as { why?: string; error?: string };
              throw new Error(j.why ?? j.error ?? `HTTP ${r.status}`);
            }
          }
        }

        setDerniereSync(new Date().toISOString());
        setErreur(undefined);
        await lireEmpreintes();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de la synchro.");
      } finally {
        setEnCours(false);
      }
    },
    [prospects, meetings, lireEmpreintes, lireEmpreintesRdv, etatHydratation]
  );

  // Poussée automatique après un silence — jamais pendant la saisie, et
  // jamais depuis un état qu'on n'a pas chargé.
  useEffect(() => {
    if (!active || enCours || confirmerEffacement || !autorise) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void pousser(), DELAI_MS);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [prospects, meetings, active, enCours, confirmerEffacement, autorise, pousser]);

  /**
   * ⚠ LE PIÈGE DE TOUT ENVOI DIFFÉRÉ, déjà payé une fois sur l'écriture
   * localStorage (`lib/store.ts`) : si l'onglet se ferme pendant les 8
   * secondes de silence, l'envoi n'a jamais lieu. En mode local ce n'était
   * qu'une synchro ratée — le disque avait la donnée. En mode pipe serveur,
   * le disque n'a RIEN : la saisie est perdue pour de bon.
   *
   * `sendBeacon` est le seul envoi qu'un navigateur garantit après la
   * fermeture (`fetch` est annulé avec la page). Il ne porte QUE des
   * écritures, jamais de suppressions : on ne peut pas vérifier l'accusé de
   * réception d'un beacon, et une suppression non vérifiée n'a pas sa place.
   */
  useEffect(() => {
    if (!active || !settings.pipeServeur) return;
    const vider = () => {
      if (!peutSynchroniser(etatHydratation)) return;
      const p = empreintes ? planifierSync(prospects, empreintes) : null;
      if (!p?.aEcrire.length) return;
      // Un beacon est plafonné (~64 Ko) : on n'envoie que le premier lot de ce
      // qui a changé, ce qui couvre le cas réel (quelques fiches touchées
      // depuis la dernière poussée). Le reste repartira au prochain
      // chargement, depuis le serveur qui, lui, n'a pas bougé.
      const lot = lots(p.aEcrire.map(allegerPourSync), 20)[0] ?? [];
      navigator.sendBeacon?.(
        "/api/sync/prospects",
        new Blob([JSON.stringify({ ecrire: lot })], { type: "application/json" })
      );
    };
    // `pagehide` et `visibilitychange` sont les deux seuls événements qu'un
    // navigateur mobile garantit avant de tuer un onglet (`beforeunload` ne se
    // déclenche pas sur iOS).
    const onVisibilite = () => {
      if (document.visibilityState === "hidden") vider();
    };
    window.addEventListener("pagehide", vider);
    document.addEventListener("visibilitychange", onVisibilite);
    return () => {
      window.removeEventListener("pagehide", vider);
      document.removeEventListener("visibilitychange", onVisibilite);
    };
  }, [active, settings.pipeServeur, prospects, empreintes, etatHydratation]);

  const { etat, message } = etatSync({
    active,
    derniereSync,
    derniereErreur: erreur,
    // Fiches ET rendez-vous : ce qui reste à pousser, tout compris.
    aEcrire: (plan?.aEcrire.length ?? 0) + (planRdv?.aEcrire.length ?? 0),
    aSupprimer: (plan?.aSupprimer.length ?? 0) + (planRdv?.aSupprimer.length ?? 0),
  });

  return (
    <Ctx.Provider
      value={{
        actif: active,
        autorise,
        plan,
        etat,
        message,
        enCours,
        confirmerEffacement,
        annulerConfirmation: () => setConfirmerEffacement(false),
        pousser,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
