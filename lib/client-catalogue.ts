"use client";

import { useEffect, useState } from "react";
// `import type` est EFFACÉ à la compilation : la forme des données voyage,
// pas les données. C'est ce qui permet de garder les types synchronisés avec
// le module serveur sans rien rembarquer dans le navigateur.
import type { AccountCommercial, CommissionQuote } from "./accounts-commercial";
import type { DeckPrix } from "./deck";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le volet commercial du portefeuille, côté CLIENT — récupéré, jamais compilé.
 *
 * Les montants par offre et les coordonnées de closing partenaires vivent
 * dans `lib/accounts-commercial.ts`, qui ne doit jamais entrer dans un bundle
 * (voir l'en-tête de ce module pour la raison mesurée). Les composants qui
 * les affichent passent donc par `/api/catalogue`, route INTERNE : porte
 * d'accès + même origine.
 *
 * Conséquence assumée : ces blocs s'affichent une fraction de seconde après
 * le reste. C'est le prix de ne pas publier notre économie — et un panneau de
 * réglages qui se remplit en différé ne coûte rien à personne.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Cache module : une seule requête par session, partagée par tous les appelants. */
let cache: AccountCommercial[] | null = null;
let enVol: Promise<AccountCommercial[]> | null = null;

async function charger(): Promise<AccountCommercial[]> {
  if (cache) return cache;
  if (!enVol) {
    enVol = fetch("/api/catalogue")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { accounts?: AccountCommercial[] }) => {
        cache = d.accounts ?? [];
        return cache;
      })
      .catch((e) => {
        // On relâche la promesse en vol : sans ça, une coupure réseau au
        // premier rendu condamnerait le panneau pour toute la session.
        enVol = null;
        throw e;
      });
  }
  return enVol;
}

/**
 * Le volet commercial d'un compte. `null` tant que la réponse n'est pas là ou
 * si elle a échoué — l'appelant affiche alors un état d'attente, jamais des
 * chiffres inventés.
 */
export function useAccountCommercial(accountId: string): AccountCommercial | null {
  const [all, setAll] = useState<AccountCommercial[] | null>(cache);

  useEffect(() => {
    if (cache) return;
    let vivant = true;
    charger()
      .then((d) => {
        if (vivant) setAll(d);
      })
      .catch(() => {
        /* pas de données commerciales : l'appelant le montre */
      });
    return () => {
      vivant = false;
    };
  }, []);

  return all?.find((c) => c.accountId === accountId) ?? null;
}

/**
 * L'offre de RÉFÉRENCE d'un compte pour un montant donné, calculée côté
 * serveur (elle porte les taux, les planchers et les leviers de négociation).
 *
 * `null` tant qu'elle n'est pas revenue : le calculateur affiche alors les
 * chiffres du deal sans comparaison, plutôt qu'une comparaison inventée.
 */
export function useReference(accountId: string, amountHT: number): CommissionQuote | null {
  const [q, setQ] = useState<CommissionQuote | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/catalogue/reference", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, amountHT }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { reference: CommissionQuote }) => {
        if (vivant) setQ(d.reference);
      })
      .catch(() => {
        if (vivant) setQ(null);
      });
    return () => {
      vivant = false;
    };
  }, [accountId, amountHT]);

  return q;
}

/**
 * Le chiffrage d'une liste de briques, calculé côté serveur.
 *
 * `null` tant qu'il n'est pas revenu, ou si la liste est vide. La présentation
 * qui l'utilise SAIT gérer l'absence : elle affiche alors l'omission « aucun
 * prix » à l'opérateur plutôt qu'un montant approximatif. C'est ce qui rend le
 * déport côté serveur sans risque commercial.
 */
export function useQuote(brickIds: string[]): DeckPrix | null {
  const cle = brickIds.join(",");
  const [prix, setPrix] = useState<DeckPrix | null>(null);

  useEffect(() => {
    if (!cle) {
      setPrix(null);
      return;
    }
    let vivant = true;
    fetch("/api/catalogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bricks: cle.split(",") }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { quote: { setupHT: number; monthlyHT: number; recommendation: string }; pack: { setupHT: number; monthlyHT: number } }) => {
        if (!vivant) return;
        setPrix({
          setupHT: d.quote.setupHT,
          monthlyHT: d.quote.monthlyHT,
          recommendation: d.quote.recommendation,
          packSetupHT: d.pack.setupHT,
          packMonthlyHT: d.pack.monthlyHT,
        });
      })
      .catch(() => {
        if (vivant) setPrix(null);
      });
    return () => {
      vivant = false;
    };
  }, [cle]);

  return prix;
}
