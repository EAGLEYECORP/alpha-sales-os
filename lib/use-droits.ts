"use client";

import { useEffect, useState } from "react";
// ⚠ Import de TYPE seulement : `lib/essai.ts` reste hors du bundle client,
// seule sa forme descend. L'écran affiche ce que le serveur a calculé, il ne
// recalcule jamais l'état d'un essai — deux définitions de « l'essai est-il
// ouvert ? » finiraient par diverger, et c'est celle du navigateur qui ment.
import type { EtatEssai } from "./essai";
import { BRIQUES_GRATUITES } from "./entitlements";

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
  /** Exploitant de sa propre installation (« chez vous ») : ALPHA CEO lui est ouvert. */
  exploitant: boolean;
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
const OPTIMISTE: Droits = { session: true, bricks: [], statut: "actif", maitre: true, solo: true, exploitant: false, essai: null };

/**
 * Le VISITEUR (27/10/2026) : le serveur a répondu 401 — ce n'est pas une panne,
 * c'est une RÉPONSE : aucune session. Depuis que l'app s'ouvre sans compte, le
 * lire comme une panne (donc `OPTIMISTE`, maître) montrait à un inconnu nos
 * entrées réservées et ouvrait l'assistant de notre pile. Il reçoit le socle
 * gratuit — la même liste que le middleware lui ouvre, importée, pas recopiée.
 */
const VISITEUR: Droits = {
  session: false,
  bricks: [...BRIQUES_GRATUITES],
  statut: "actif",
  maitre: false,
  solo: false,
  exploitant: false,
  essai: null,
};

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
      .then(async (r) => {
        if (r.status === 401) {
          // Pas mis en cache : une connexion dans la page doit pouvoir le relire.
          enCours = null;
          return VISITEUR;
        }
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Droits;
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

/**
 * La réponse vient-elle du SERVEUR, ou est-ce l'optimisme d'attente ?
 *
 * ⚠ Trouvé au rendu le 27/10/2026 : un visiteur sans compte reçoit un 401 sur
 * `/api/compte/droits`, `chargerDroits` rend alors `OPTIMISTE` (maître, solo)
 * — et l'assistant de configuration de NOTRE pile s'ouvrait en plein écran
 * sur son premier écran. Rien de ce qui BARRE l'écran ne s'ouvre sur un
 * verdict non prouvé.
 */
export function estProuve(d: Droits): boolean {
  return d !== OPTIMISTE;
}

/**
 * Le compte est-il le MAÎTRE, PROUVÉ par le serveur ?
 *
 * ⚠ L'inverse de `useDroits()` : PESSIMISTE. Faux tant que la réponse n'est pas
 * là, faux si elle échoue (`chargerDroits` rend alors `OPTIMISTE`, qu'on
 * reconnaît à son identité). Il sert aux textes qui PARTENT sans serveur pour
 * les relire — un message LinkedIn se copie à la main : dans le doute, il
 * s'écrit pour l'inscrit, jamais sous notre nom. Le maître voit son texte
 * générique une fraction de seconde ; l'inverse enverrait notre pitch.
 */
export function useMaitreProuve(): boolean {
  const [m, setM] = useState<boolean>(cache?.maitre ?? false);
  useEffect(() => {
    if (cache) {
      setM(cache.maitre);
      return;
    }
    let vivant = true;
    void chargerDroits().then((d) => vivant && setM(d !== OPTIMISTE && d.maitre));
    return () => {
      vivant = false;
    };
  }, []);
  return m;
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
