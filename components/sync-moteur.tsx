"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAlpha } from "@/lib/store";
import {
  allegerPourSync, etatSync, lots, planifierSync,
  type EmpreinteServeur, type EtatSync, type PlanSync,
} from "@/lib/sync-prospects";
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
  const settings = useAlpha((s) => s.settings);
  const etatHydratation = useAlpha((s) => s.hydratationPipe);

  const [empreintes, setEmpreintes] = useState<EmpreinteServeur[] | null>(null);
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

  useEffect(() => {
    if (active) void lireEmpreintes();
  }, [active, lireEmpreintes]);

  const plan = empreintes ? planifierSync(prospects, empreintes) : null;

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
        setDerniereSync(new Date().toISOString());
        setErreur(undefined);
        await lireEmpreintes();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de la synchro.");
      } finally {
        setEnCours(false);
      }
    },
    [prospects, lireEmpreintes, etatHydratation]
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
  }, [prospects, active, enCours, confirmerEffacement, autorise, pousser]);

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
    aEcrire: plan?.aEcrire.length ?? 0,
    aSupprimer: plan?.aSupprimer.length ?? 0,
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
