/**
 * ─────────────────────────────────────────────────────────────────────
 * LE JOINT DE DÉCISION TYPÉE — « où on branche Jev ».
 *
 * Une DÉCISION TYPÉE, c'est : ranger une entrée en langage libre dans UNE valeur
 * d'un ensemble connu d'avance (l'intention d'une réponse, un intent Telegram).
 * Deux moteurs savent la rendre, et ce module choisit lequel, à UN seul endroit :
 *  · Jev (`lib/jev.ts`) — bâti pour ça : typé, rapide, un score de confiance.
 *    Sa raison d'être. On le prend s'il est configuré.
 *  · le LLM (cascade `runAIJson`) — le défaut ÉPROUVÉ. Il émet du JSON qu'on
 *    valide ; il ne rend pas de confiance calibrée (→ `null`).
 *
 * ⚠ POURQUOI CE JOINT EXISTE. Sans lui, « adopter Jev » voudrait dire toucher
 * chaque site de classement (le tri des réponses, l'intent Telegram, un futur
 * triage de leads). Avec lui, c'est UN adaptateur : le jour où Jev a une clé et
 * une doc, on remplit `deciderViaJev` et tous les classements en profitent, sans
 * qu'aucun appelant ne bouge. C'est la parade au défaut n°1 du dépôt (un
 * mécanisme branché à trente endroits qui divergent).
 *
 * ⚠ Le LLM reste le FILET. Jev indisponible, en échec, ou rendant une forme
 * inattendue → on retombe sur le LLM sans rien casser. On n'échange jamais un
 * moteur éprouvé contre un neuf sans repli.
 * ─────────────────────────────────────────────────────────────────────
 */

import { runAIJson, type AiMessage } from "@/lib/ai-engine";
import type { MoteurIA } from "@/lib/credentials";
import { layaDisponible, deciderViaLaya } from "@/lib/laya";
import { jevDisponible, deciderViaJev } from "@/lib/jev";

export interface DecisionTypee<T extends string> {
  /** La valeur retenue — toujours du domaine, le `valider` garantit un repli sûr. */
  valeur: T;
  /** Le score de confiance (0..1) si un modèle de décision a tranché ; `null` pour le LLM. */
  confiance: number | null;
  /** Qui a décidé — utile pour l'affichage et pour savoir ce qui tourne vraiment. */
  source: "laya" | "jev" | "llm";
}

export interface OptionsDecision<T extends string> {
  /** Le texte à classer (déjà encadré si c'est du contenu externe hostile). */
  texteEntrant: string;
  /** Le prompt système du classement, pour le chemin LLM. */
  promptSysteme: string;
  /** Le domaine des valeurs possibles, connu d'avance — l'entrée de Jev. */
  valeurs: readonly T[];
  /**
   * Ramène une sortie BRUTE (JSON du LLM, ou valeur de Jev) à une valeur SÛRE,
   * repli inclus. C'est le module qui POSSÈDE l'enum qui valide — une seule
   * définition de « qu'est-ce qu'une valeur acceptable ? ».
   */
  valider: (brut: unknown) => T;
  moteur: MoteurIA;
}

/**
 * Le runner LLM est INJECTABLE — pour tester le joint (routage + repli) sans
 * réseau ni modèle. Le défaut appelle la vraie cascade.
 */
export type RunnerLLM = (messages: AiMessage[], moteur: MoteurIA) => Promise<{ data: unknown }>;

const runnerParDefaut: RunnerLLM = (messages, moteur) =>
  runAIJson<unknown>(messages, moteur, { maxTokens: 200, temperature: 0.1 });

export async function deciderTypee<T extends string>(
  opts: OptionsDecision<T>,
  runner: RunnerLLM = runnerParDefaut,
): Promise<DecisionTypee<T>> {
  // 1. Laya d'abord — le modèle de décision SOUVERAIN (local, poids ouverts).
  //    Préféré à Jev : rien de la donnée métier ne sort, ce qui tient l'argument
  //    de vitrine au lieu de le contredire. Tout échec tombe sur le repli.
  if (layaDisponible()) {
    try {
      const brut = await deciderViaLaya({ texteEntrant: opts.texteEntrant, valeurs: opts.valeurs });
      return { valeur: opts.valider(brut.valeur), confiance: brut.confiance, source: "laya" };
    } catch {
      /* repli ci-dessous */
    }
  }

  // 2. Jev, si quelqu'un l'a explicitement configuré (API propriétaire — à
  //    n'utiliser qu'en connaissance de la tension avec la souveraineté).
  if (jevDisponible()) {
    try {
      const brut = await deciderViaJev({ texteEntrant: opts.texteEntrant, valeurs: opts.valeurs });
      return { valeur: opts.valider(brut.valeur), confiance: brut.confiance, source: "jev" };
    } catch {
      /* repli LLM ci-dessous */
    }
  }

  // 3. LLM par défaut : il émet du JSON, `valider` le ramène à une valeur sûre.
  const { data } = await runner(
    [
      { role: "system", content: opts.promptSysteme },
      { role: "user", content: opts.texteEntrant },
    ],
    opts.moteur,
  );
  return { valeur: opts.valider(data), confiance: null, source: "llm" };
}
