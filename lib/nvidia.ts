/**
 * ─────────────────────────────────────────────────────────────────────
 * NVIDIA NIM — 100+ modèles hébergés, API compatible OpenAI.
 *
 * Pourquoi c'est le bon moteur pour ALPHA, entre Ollama et Anthropic :
 *  · gratuit sur le programme développeur NVIDIA (crédits qui n'expirent
 *    pas), donc pas de coût variable qui grimpe avec le volume ;
 *  · des modèles bien plus capables qu'un 3B local — le playbook et la
 *    doctrine prescripteurs demandent du raisonnement, pas de
 *    l'autocomplétion ;
 *  · aucune dépendance nouvelle : l'API parle OpenAI, donc un simple
 *    fetch suffit.
 *
 * La contrepartie, et elle est réelle : les messages partent chez NVIDIA.
 * Ollama en local reste prioritaire quand il est configuré — c'est le
 * seul des trois où rien ne sort de la machine. NVIDIA vient ensuite,
 * Anthropic en dernier (payant), et le moteur de templates ferme la
 * marche pour que l'app fonctionne toujours.
 *
 *   NVIDIA_API_KEY   clé nvapi-… depuis build.nvidia.com
 *   NVIDIA_MODEL     défaut : voir MODELE_NIM_DEFAUT (lib/modeles.ts)
 *   NVIDIA_BASE_URL  défaut : https://integrate.api.nvidia.com/v1
 *
 * Limite du palier gratuit : 40 requêtes/minute. ALPHA n'en approche pas
 * — les générations sont déclenchées à la main, une par une.
 * ─────────────────────────────────────────────────────────────────────
 */

import { MODELE_NIM_DEFAUT, expliquerModele } from "./modeles";

export function nvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}

/**
 * ⚠ LE DÉFAUT ÉTAIT `meta/llama-3.3-70b-instruct`, MORT LE 26 AOÛT 2026.
 *
 * Toute l'IA de l'app tournait donc sur un modèle que le fournisseur avait
 * retiré : 410 Gone sur /api/ai, /api/agent, /api/debrief. Trouvé parce que
 * l'agent vocal est tombé, pas parce qu'un test l'a vu — aucun test ne peut
 * connaître la date de fin de vie d'un modèle tiers.
 *
 * L'identifiant vient maintenant de `lib/modeles.ts`, où il n'est écrit
 * qu'une fois et où les modèles morts sont NOTÉS.
 */
export function nvidiaModel(): string {
  return process.env.NVIDIA_MODEL?.trim() || MODELE_NIM_DEFAUT;
}

function baseUrl(): string {
  return (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
}

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Appel chat non-streamé, format OpenAI.
 *
 * On ne demande PAS de mode JSON ici : tous les fournisseurs NIM ne le
 * supportent pas de la même façon, et un refus silencieux rendrait du
 * texte libre là où le code attend un objet. Les appelants qui ont besoin
 * de JSON valident eux-mêmes ce qu'ils reçoivent.
 */
export async function nvidiaChat(
  messages: NvidiaMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const key = process.env.NVIDIA_API_KEY?.trim();
  if (!key) throw new Error("NVIDIA_API_KEY absente");

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: nvidiaModel(),
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1200,
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    // Le corps d'erreur porte la vraie cause (clé invalide, modèle
    // inconnu, quota) — la renvoyer évite une heure de devinette.
    const detail = await res.text().catch(() => "");
    throw new Error(
      `NVIDIA ${res.status} — ${detail.slice(0, 300) || "réponse sans détail"}${
        res.status === 401 ? " · vérifie NVIDIA_API_KEY (elle commence par nvapi-)" : ""
      }${res.status === 429 ? " · palier gratuit à 40 requêtes/minute, attends une minute" : ""}${
        expliquerModele(nvidiaModel(), res.status) ? ` · ${expliquerModele(nvidiaModel(), res.status)}` : ""
      }`
    );
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("NVIDIA a renvoyé une réponse vide.");
  return text;
}

/** Modèles conseillés, du plus capable au plus rapide. */
export const NVIDIA_MODELS = [
  {
    id: MODELE_NIM_DEFAUT,
    label: "GPT-OSS 20B",
    note:
      "Le défaut. Petit et vif — c'est celui que l'agent vocal utilise, donc le seul dont on ait la preuve " +
      "opérationnelle qu'il répond. Sur des consignes très longues, un plus gros suit mieux : essaie les suivants.",
  },
  {
    id: "qwen/qwen2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    note: "Très bon en français et en extraction structurée — utile pour le débrief vocal.",
  },
  {
    id: "mistralai/mistral-large-2-instruct",
    label: "Mistral Large 2",
    note: "Modèle français : le registre et les tournures sonnent plus juste dans un email.",
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    label: "Nemotron 70B",
    note: "Réglé par NVIDIA pour suivre les instructions à la lettre. Le plus discipliné.",
  },
];
