import { ollamaChat } from "./ollama";
import { nvidiaChat } from "./nvidia";
import { compressMessages, estimateTokens, type CompressOptions } from "./ai-context";
import { moteurUtilisable, type MoteurIA } from "./credentials";

/**
 * ─────────────────────────────────────────────────────────────────────
 * La cascade des moteurs IA — un seul endroit.
 *
 * Avant : cinq routes avec chacune sa propre cascade, écrites à des
 * moments différents et déjà divergentes (l'une repliait sur les
 * templates après un échec Ollama, l'autre non). Ajouter un moteur
 * demandait cinq modifications, et il suffisait d'en oublier une pour
 * qu'un écran reste bête sans que personne ne s'en aperçoive.
 *
 * L'ordre, et sa raison :
 *
 *   1. OLLAMA — local. Le seul où rien ne sort de la machine. Quand il
 *      est là, il gagne, même s'il est moins capable : la donnée
 *      prospect vaut plus que quelques points de qualité.
 *   2. NVIDIA NIM — gratuit, modèles 70B, compatible OpenAI. Le bon
 *      compromis quand Ollama n'est pas installé.
 *   3. ANTHROPIC — payant, excellent. En dernier parce qu'il coûte à
 *      chaque appel.
 *   4. Rien — l'appelant retombe sur son moteur de templates. L'app doit
 *      fonctionner sans IA, c'est une règle, pas une politesse.
 *
 * Un moteur qui échoue ne bloque pas : on passe au suivant et on le dit
 * dans `engine`, pour que l'écran affiche ce qui a RÉELLEMENT répondu.
 *
 * ══ ⚠⚠ CE FICHIER NE LIT PLUS L'ENVIRONNEMENT — 16/09/2026 ══
 *
 * Il lisait `process.env.ANTHROPIC_API_KEY` lui-même, et il n'était pas seul :
 * `/api/agent` et `/api/sparring` le CONTOURNAIENT et lisaient la même
 * variable de leur côté, en appelant `streamText` en direct. Trois
 * définitions de « comment on joint le modèle », dont deux invisibles depuis
 * ici — le défaut récurrent du dépôt, à l'endroit le plus cher.
 *
 * Tant que la clé était la nôtre, ça ne coûtait que de la dette. Avec le BYOK
 * (`lib/credentials.ts`), ça deviendrait une FUITE : un chemin qui lit encore
 * l'environnement facture à NOUS un appel qu'un locataire devait payer, et
 * ça ne se voit que sur la facture, un mois plus tard.
 *
 * Le moteur est donc REÇU, jamais deviné. `MoteurIA` porte les clés ET
 * `origine` — qui paie. Un test interdit `process.env` dans ce fichier.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResult {
  text: string;
  /** Le moteur qui a effectivement répondu — jamais celui qu'on espérait. */
  engine: string;
  /** Tokens d'entrée estimés (après compression éventuelle) — indicatif, pour le suivi de coût. */
  promptTokens?: number;
}

export interface AiOptions {
  temperature?: number;
  maxTokens?: number;
  /** Demande une sortie JSON quand le moteur sait le faire. */
  json?: boolean;
  /**
   * Compression opt-in du contexte avant l'appel (économie de tokens sur le
   * palier payant). Absent = aucun changement. Idéal quand on injecte un gros
   * dossier prospect + doctrine (agent, sparring).
   */
  compress?: CompressOptions;
}

/** Au moins un moteur est-il joignable pour CE demandeur ? */
export function aiAvailable(moteur: MoteurIA): boolean {
  return moteurUtilisable(moteur);
}

/** Nom du moteur qui répondra en premier — pour l'affichage d'état. */
export function aiEngineName(moteur: MoteurIA): string {
  if (moteur.ollama) return `ollama (${moteur.ollama.model})`;
  if (moteur.nvidia) return `nvidia (${moteur.nvidia.model})`;
  if (moteur.anthropic) return `claude (${moteur.anthropic.model})`;
  return "moteur de templates (hors-ligne)";
}

/** Tous les moteurs disponibles, dans l'ordre d'essai. */
export function aiEngines(moteur: MoteurIA): string[] {
  const out: string[] = [];
  if (moteur.ollama) out.push(`ollama (${moteur.ollama.model})`);
  if (moteur.nvidia) out.push(`nvidia (${moteur.nvidia.model})`);
  if (moteur.anthropic) out.push("claude");
  return out;
}

/**
 * Exécute la cascade. Lève seulement si AUCUN moteur n'a répondu —
 * l'appelant retombe alors sur ses templates.
 */
export async function runAI(
  messages: AiMessage[],
  moteur: MoteurIA,
  opts: AiOptions = {}
): Promise<AiResult> {
  const errors: string[] = [];

  // Compression opt-in du contexte AVANT tout appel (économie de tokens). Sans
  // opts.compress, `msgs` est exactement `messages` — aucun changement.
  const msgs = opts.compress ? compressMessages(messages, opts.compress) : messages;
  const promptTokens = msgs.reduce((n, m) => n + estimateTokens(m.content), 0);

  if (moteur.ollama) {
    try {
      const text = await ollamaChat(msgs, moteur.ollama, opts);
      return { text, engine: `ollama (${moteur.ollama.model})`, promptTokens };
    } catch (e) {
      errors.push(`ollama: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (moteur.nvidia) {
    try {
      const text = await nvidiaChat(msgs, moteur.nvidia, {
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
      return { text, engine: `nvidia (${moteur.nvidia.model})`, promptTokens };
    } catch (e) {
      errors.push(`nvidia: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (moteur.anthropic) {
    try {
      const { generateText } = await import("ai");
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      // ⚠ `createAnthropic({ apiKey })` et non `anthropic(...)` : le second
      // lit ANTHROPIC_API_KEY dans l'environnement, donc il facturerait à NOUS
      // l'appel d'un locataire qui a pourtant collé sa clé. C'est la fuite
      // exacte que ce refactor existe pour fermer.
      const fournisseur = createAnthropic({ apiKey: moteur.anthropic.key });
      // L'API Anthropic sépare le message système du reste.
      const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const prompt = msgs.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
      const { text } = await generateText({
        model: fournisseur(moteur.anthropic.model),
        system: system || undefined,
        prompt,
        maxTokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature,
      });
      return { text, engine: "claude", promptTokens };
    } catch (e) {
      errors.push(`claude: ${e instanceof Error ? e.message : e}`);
    }
  }

  throw new Error(errors.length ? `Aucun moteur n'a répondu — ${errors.join(" | ")}` : "Aucun moteur IA configuré");
}

/**
 * Variante JSON : exécute la cascade et parse. Un modèle qui rend du
 * JSON invalide ne doit pas casser l'appelant — il reçoit null et
 * retombe sur son moteur déterministe.
 */
export async function runAIJson<T>(
  messages: AiMessage[],
  moteur: MoteurIA,
  opts: AiOptions = {}
): Promise<{ data: T | null; engine: string }> {
  const { text, engine } = await runAI(messages, moteur, { ...opts, json: true });
  try {
    // Certains modèles encadrent le JSON de texte ou de balises ```json.
    const cleaned = text.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, "").trim();
    const candidate = cleaned.startsWith("{") || cleaned.startsWith("[") ? cleaned : text;
    return { data: JSON.parse(candidate) as T, engine };
  } catch {
    return { data: null, engine };
  }
}
