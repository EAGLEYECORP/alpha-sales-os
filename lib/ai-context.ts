/**
 * ─────────────────────────────────────────────────────────────────────
 * Économie de contexte IA — estimation de tokens, coût, et compression.
 *
 * Inspiré de tiktoken (compter les tokens), LLMLingua / Headroom (compresser
 * le contexte avant l'appel) et CodeBurn (mesurer le coût) — mais fait maison,
 * sans dépendance, comme le reste. But : sur la cascade IA (Ollama → NVIDIA →
 * Claude), un long dossier prospect + doctrine coûte cher sur le palier payant.
 * On le dégraisse AVANT l'appel, sans en changer le sens.
 *
 * Tout est déterministe et pur → testable sans clé API. Opt-in : rien n'est
 * compressé tant qu'un appelant ne le demande pas (lib/ai-engine, opts.compress).
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Estimation du nombre de tokens d'un texte. Heuristique volontairement simple
 * (pas de vocabulaire BPE embarqué) : ~4 caractères par token, plancher par le
 * nombre de mots. Suffisant pour décider s'il faut compresser et estimer un coût
 * — jamais présenté comme exact.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(Math.ceil(chars / 4), Math.ceil(words * 0.75));
}

/** Coût estimé en euros pour un nombre de tokens, à un tarif €/million de tokens. */
export function estimateCostEUR(tokens: number, eurPerMillionTokens: number): number {
  return Math.round((tokens / 1_000_000) * eurPerMillionTokens * 10_000) / 10_000;
}

export interface CompressOptions {
  /** Budget cible en caractères. Au-delà, on dégraisse. */
  maxChars: number;
  /** Part du budget gardée en TÊTE (instructions) ; le reste en QUEUE (récent). 0.5 par défaut. */
  headRatio?: number;
}

/**
 * Compresse un texte sans réécrire le sens :
 *  1. normalise les espaces et lignes vides répétées (gain gratuit) ;
 *  2. si toujours au-dessus du budget, garde le DÉBUT (les consignes) et la FIN
 *     (le contexte récent), en élidant le milieu — là où l'info est la plus
 *     redondante. On n'invente rien, on coupe au milieu et on le signale.
 */
export function compressContext(text: string, opts: CompressOptions): string {
  const headRatio = Math.min(0.95, Math.max(0.05, opts.headRatio ?? 0.5));
  // 1. Dégraissage sans perte : espaces multiples → un seul, ≥3 sauts → 2.
  const normalized = text
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length <= opts.maxChars) return normalized;

  const marker = "\n[…coupé pour tenir dans le contexte…]\n";
  const budget = Math.max(0, opts.maxChars - marker.length);
  const headLen = Math.floor(budget * headRatio);
  const tailLen = budget - headLen;

  const head = normalized.slice(0, headLen).replace(/\s+\S*$/, ""); // coupe au dernier mot entier
  const tail = normalized.slice(normalized.length - tailLen).replace(/^\S*\s+/, "");
  return `${head}${marker}${tail}`;
}

/** Compresse le contenu d'une liste de messages {role, content}. Purement fonctionnel. */
export function compressMessages<T extends { role: string; content: string }>(
  messages: T[],
  opts: CompressOptions
): T[] {
  return messages.map((m) => ({ ...m, content: compressContext(m.content, opts) }));
}
