/**
 * Les deux outils des tests qui APPELLENT une route IA et lisent ce qui
 * partirait au modèle. Partagés : deux copies divergeraient, et c'est celle
 * qu'on ne relit pas qui cesserait d'intercepter.
 */

/** L'environnement d'une installation client sans comptes : `maitre: false`, prouvé par le serveur. */
export async function commeInscrit<T>(env: Record<string, string | undefined>, f: () => Promise<T>): Promise<T> {
  const avant: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    avant[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await f();
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Intercepte l'appel au modèle (branche NVIDIA, `fetch` global) et rend ce qui serait parti. */
export async function promptsEnvoyes(f: () => Promise<unknown>): Promise<string[]> {
  const envoye: string[] = [];
  const fetchReel = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/chat/completions")) {
      const corps = JSON.parse(String(init?.body ?? "{}")) as { messages: { content: string }[] };
      envoye.push(corps.messages.map((m) => m.content).join("\n\n"));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return fetchReel(url, init);
  }) as typeof fetch;
  try {
    await f();
  } finally {
    globalThis.fetch = fetchReel;
  }
  return envoye;
}
