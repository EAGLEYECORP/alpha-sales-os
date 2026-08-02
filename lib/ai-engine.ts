import { ollamaChat, ollamaConfigured, ollamaModel } from "./ollama";
import { nvidiaChat, nvidiaConfigured, nvidiaModel } from "./nvidia";

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
}

export interface AiOptions {
  temperature?: number;
  maxTokens?: number;
  /** Demande une sortie JSON quand le moteur sait le faire. */
  json?: boolean;
}

/** Au moins un moteur est-il configuré ? */
export function aiAvailable(): boolean {
  return ollamaConfigured() || nvidiaConfigured() || Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Nom du moteur qui répondra en premier — pour l'affichage d'état. */
export function aiEngineName(): string {
  if (ollamaConfigured()) return `ollama (${ollamaModel()})`;
  if (nvidiaConfigured()) return `nvidia (${nvidiaModel()})`;
  if (process.env.ANTHROPIC_API_KEY?.trim()) return `claude (${process.env.AI_MODEL ?? "claude-opus-4-8"})`;
  return "moteur de templates (hors-ligne)";
}

/** Tous les moteurs disponibles, dans l'ordre d'essai. */
export function aiEngines(): string[] {
  const out: string[] = [];
  if (ollamaConfigured()) out.push(`ollama (${ollamaModel()})`);
  if (nvidiaConfigured()) out.push(`nvidia (${nvidiaModel()})`);
  if (process.env.ANTHROPIC_API_KEY?.trim()) out.push("claude");
  return out;
}

/**
 * Exécute la cascade. Lève seulement si AUCUN moteur n'a répondu —
 * l'appelant retombe alors sur ses templates.
 */
export async function runAI(messages: AiMessage[], opts: AiOptions = {}): Promise<AiResult> {
  const errors: string[] = [];

  if (ollamaConfigured()) {
    try {
      const text = await ollamaChat(messages, opts);
      return { text, engine: `ollama (${ollamaModel()})` };
    } catch (e) {
      errors.push(`ollama: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (nvidiaConfigured()) {
    try {
      const text = await nvidiaChat(messages, { temperature: opts.temperature, maxTokens: opts.maxTokens });
      return { text, engine: `nvidia (${nvidiaModel()})` };
    } catch (e) {
      errors.push(`nvidia: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    try {
      const { generateText } = await import("ai");
      const { anthropic } = await import("@ai-sdk/anthropic");
      // L'API Anthropic sépare le message système du reste.
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const prompt = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
      const { text } = await generateText({
        model: anthropic(process.env.AI_MODEL ?? "claude-opus-4-8"),
        system: system || undefined,
        prompt,
        maxTokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature,
      });
      return { text, engine: "claude" };
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
export async function runAIJson<T>(messages: AiMessage[], opts: AiOptions = {}): Promise<{ data: T | null; engine: string }> {
  const { text, engine } = await runAI(messages, { ...opts, json: true });
  try {
    // Certains modèles encadrent le JSON de texte ou de balises ```json.
    const cleaned = text.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, "").trim();
    const candidate = cleaned.startsWith("{") || cleaned.startsWith("[") ? cleaned : text;
    return { data: JSON.parse(candidate) as T, engine };
  } catch {
    return { data: null, engine };
  }
}
