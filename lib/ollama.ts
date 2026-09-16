/**
 * Ollama — IA 100 % locale (ex. qwen2.5:3b), zéro clé API, zéro coût.
 * Priorité des moteurs dans les routes : Ollama (si OLLAMA_MODEL) → Anthropic
 * (si ANTHROPIC_API_KEY) → moteur de templates hors-ligne.
 *
 *   OLLAMA_URL    (défaut http://localhost:11434)
 *   OLLAMA_MODEL  (ex. qwen2.5:3b — doit être `ollama pull`é)
 */

export function ollamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_MODEL?.trim());
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() ?? "";
}

function baseUrl(): string {
  return (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/+$/, "");
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Appel chat non-streamé. Un petit modèle (3B) répond mieux avec une
 * température basse et des consignes courtes — les appelants adaptent.
 */
export async function ollamaChat(
  messages: OllamaMessage[],
  cfg: { url: string; model: string },
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}
): Promise<string> {
  const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
      ...(opts.json ? { format: "json" } : {}),
      options: {
        temperature: opts.temperature ?? 0.3,
        num_predict: opts.maxTokens ?? 1200,
      },
    }),
    // un 3B local peut mettre du temps à charger au premier appel
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status} — le modèle ${ollamaModel()} est-il pull ? (ollama pull ${ollamaModel()})`);
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content?.trim();
  if (!text) throw new Error("Ollama a renvoyé une réponse vide.");
  return text;
}
