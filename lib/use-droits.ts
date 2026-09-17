"use client";

import { useEffect, useState } from "react";
// ⚠ Import de TYPE seulement : `lib/essai.ts` reste hors du bundle client,
// seule sa forme descend. L'écran affiche ce que le serveur a calculé, il ne
// recalcule jamais l'état d'un essai — deux définitions de « l'essai est-il
// ouvert ? » finiraient par diverger, et c'est celle du navigateur qui ment.
import type { EtatEssai } from "./essai";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Les droits du compte, côté CLIENT — pour l'AFFICHAGE seulement.
 *
 * ⚠ Rien ici n'est une sécurité. La barrière est le middleware, qui refuse la
 * page ET l'API. Ce hook sert à ne pas promener un client dans des
 * culs-de-sac : une entrée de menu qui mène à une porte fermée est une
 * mauvaise expérience, pas une faille.
 *
 * Le jour où quelqu'un se met à autoriser une action à partir de cette
 * réponse, le trou est rouvert. C'est écrit ici parce que c'est exactement la
 * pente naturelle.
 *
 * Par défaut (avant réponse, ou en cas d'échec) : on considère qu'on a TOUT.
 * Un menu qui se vide une seconde au chargement fait croire à une panne ; et
 * comme le serveur refusera de toute façon, l'optimisme ne coûte rien.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Droits {
  /**
   * Un compte est-il RÉELLEMENT connecté ?
   *
   * ⚠ Distinct de `statut`. Sans session, le serveur rend
   * `statut: "suspendu"` — c'est son discriminant interne, pas un message.
   * Confondre les deux fait dire « compte suspendu, régularise » à quelqu'un
   * qui n'a jamais eu de compte. C'est arrivé en production.
   */
  session: boolean;
  bricks: string[];
  statut: "essai" | "actif" | "suspendu";
  essaiJusquA?: string;
  maitre: boolean;
  solo: boolean;
  /**
   * L'état de l'essai, `null` quand ce compte n'en a pas.
   *
   * ⚠ `null` ≠ « essai fermé ». Un essai FERMÉ descend quand même, avec sa
   * raison : sans ça l'écran ne peut pas distinguer « ton essai vient de se
   * terminer » de « tu n'as jamais eu d'essai », et le locataire perd trois
   * briques en silence. `null` veut dire qu'il n'y a rien à raconter.
   */
  essai: EtatEssai | null;
}

/** Optimiste : tout ouvert tant qu'on ne sait pas. */
const OPTIMISTE: Droits = { session: true, bricks: [], statut: "actif", maitre: true, solo: true, essai: null };

let cache: Droits | null = null;
let enCours: Promise<Droits> | null = null;

/**
 * La requête, partagée — une seule par page, quel que soit le nombre
 * d'appelants. Extraite du hook parce qu'un appelant a besoin de SAVOIR quand
 * la réponse est arrivée, et pas seulement de la valeur optimiste.
 */
export function chargerDroits(): Promise<Droits> {
  if (cache) return Promise.resolve(cache);
  if (!enCours) {
    enCours = fetch("/api/compte/droits")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Droits) => {
        cache = j;
        return j;
      })
      .catch(() => {
        // On reste optimiste : le serveur tranchera de toute façon. Mais on
        // ne met PAS l'optimisme en cache — une panne réseau passagère ne doit
        // pas graver « maître » pour toute la session.
        enCours = null;
        return OPTIMISTE;
      });
  }
  return enCours;
}

export function useDroits(): Droits {
  const [d, setD] = useState<Droits>(cache ?? OPTIMISTE);

  useEffect(() => {
    if (cache) return;
    let vivant = true;
    void chargerDroits().then((j) => vivant && setD(j));
    return () => {
      vivant = false;
    };
  }, []);

  return d;
}

/**
 * ⚠ `afficherChemin` VIVAIT ICI, ET ELLE A ÉTÉ RETIRÉE — pas oubliée. Elle
 * répondait « faut-il MONTRER cette entrée ? » et le rail s'en servait pour
 * MASQUER tout ce que le compte ne possède pas.
 *
 * C'était le défaut : un inscrit gratuit voyait une application plus petite
 * que la vraie, sans jamais apprendre ce qui manquait. On ne peut pas vouloir
 * ce qu'on ne voit pas, et on ne peut surtout pas comprendre un refus dont la
 * porte était invisible. `etatChemin` (`lib/verrous.ts`) la remplace et
 * distingue les deux cas qu'elle confondait : ce qui est à VENDRE se grise
 * avec sa raison, ce qui est à NOUS se masque.
 *
 * Elle est supprimée plutôt que laissée en place : un export que plus rien
 * n'importe est mort, et le seul destin d'une fonction morte dans ce dépôt
 * est d'être rebranchée par erreur — ce qui remasquerait tout.
 */
