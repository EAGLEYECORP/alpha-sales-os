/**
 * ─────────────────────────────────────────────────────────────────────
 * Génération vidéo — pour le contenu social (lancement, thought-leadership).
 *
 * Deux voies, toutes deux optionnelles et pilotées par l'environnement :
 *
 *  1. json2video (API REST, offre gratuite) — RENDU par gabarit : on décrit
 *     une vidéo en JSON (scènes, textes, voix, images) et l'API la rend.
 *     C'est la voie qui MARCHE aujourd'hui, sans GPU. Env : JSON2VIDEO_API_KEY.
 *
 *  2. Text-to-video générique (HunyuanVideo & co) — appel HTTP à un endpoint
 *     que TU héberges (GPU) ou un service compatible (Replicate/fal/…).
 *     ⚠ HunyuanVideo est un MODÈLE, pas une API : il exige un gros GPU. Il ne
 *     tourne pas dans l'app Next. On expose juste un connecteur : si tu as un
 *     endpoint qui prend un prompt et rend une vidéo, mets VIDEO_GEN_ENDPOINT
 *     (+ VIDEO_GEN_KEY) et Alpha l'appelle. Sinon, la voie 1 suffit au contenu.
 *
 * Zéro dépendance : tout en `fetch`.
 * ─────────────────────────────────────────────────────────────────────
 */

export function json2videoConfigured(): boolean {
  return Boolean(process.env.JSON2VIDEO_API_KEY?.trim());
}
export function textToVideoConfigured(): boolean {
  return Boolean(process.env.VIDEO_GEN_ENDPOINT?.trim());
}
export function videoGenConfigured(): boolean {
  return json2videoConfigured() || textToVideoConfigured();
}

export interface VideoJob {
  provider: "json2video" | "endpoint";
  /** Identifiant de projet à sonder (json2video) ou null si l'URL est immédiate. */
  id: string | null;
  /** URL de la vidéo si déjà disponible. */
  url: string | null;
  status: "rendering" | "done" | "error";
  error?: string;
}

/**
 * Lance un rendu json2video à partir d'un « movie » JSON (leur schéma :
 * { resolution, scenes:[{ elements:[…] }] }). Renvoie l'id de projet à sonder.
 */
export async function renderJson2Video(movie: Record<string, unknown>): Promise<VideoJob> {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) return { provider: "json2video", id: null, url: null, status: "error", error: "JSON2VIDEO_API_KEY manquant" };
  try {
    const res = await fetch("https://api.json2video.com/v2/movies", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(movie),
    });
    const json = (await res.json()) as { project?: string; success?: boolean; message?: string };
    if (!res.ok || !json.project) {
      return { provider: "json2video", id: null, url: null, status: "error", error: json.message ?? `HTTP ${res.status}` };
    }
    return { provider: "json2video", id: json.project, url: null, status: "rendering" };
  } catch (e) {
    return { provider: "json2video", id: null, url: null, status: "error", error: e instanceof Error ? e.message : "réseau" };
  }
}

/** Sonde l'état d'un rendu json2video (à appeler jusqu'à done/error). */
export async function pollJson2Video(project: string): Promise<VideoJob> {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) return { provider: "json2video", id: project, url: null, status: "error", error: "JSON2VIDEO_API_KEY manquant" };
  try {
    const res = await fetch(`https://api.json2video.com/v2/movies?project=${encodeURIComponent(project)}`, {
      headers: { "x-api-key": key },
    });
    const json = (await res.json()) as { movie?: { status?: string; url?: string; message?: string } };
    const st = json.movie?.status;
    if (st === "done") return { provider: "json2video", id: project, url: json.movie?.url ?? null, status: "done" };
    if (st === "error") return { provider: "json2video", id: project, url: null, status: "error", error: json.movie?.message };
    return { provider: "json2video", id: project, url: null, status: "rendering" };
  } catch (e) {
    return { provider: "json2video", id: project, url: null, status: "error", error: e instanceof Error ? e.message : "réseau" };
  }
}

/**
 * Appelle un endpoint text-to-video générique (HunyuanVideo hébergé, Replicate…).
 * Contrat minimal : POST { prompt } → { url } ou { id }. À adapter selon l'hôte.
 */
export async function textToVideo(prompt: string): Promise<VideoJob> {
  const endpoint = process.env.VIDEO_GEN_ENDPOINT;
  if (!endpoint) return { provider: "endpoint", id: null, url: null, status: "error", error: "VIDEO_GEN_ENDPOINT manquant" };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.VIDEO_GEN_KEY ? { Authorization: `Bearer ${process.env.VIDEO_GEN_KEY}` } : {}),
      },
      body: JSON.stringify({ prompt }),
    });
    const json = (await res.json()) as { url?: string; id?: string; error?: string };
    if (!res.ok) return { provider: "endpoint", id: null, url: null, status: "error", error: json.error ?? `HTTP ${res.status}` };
    if (json.url) return { provider: "endpoint", id: json.id ?? null, url: json.url, status: "done" };
    if (json.id) return { provider: "endpoint", id: json.id, url: null, status: "rendering" };
    return { provider: "endpoint", id: null, url: null, status: "error", error: "réponse sans url ni id" };
  } catch (e) {
    return { provider: "endpoint", id: null, url: null, status: "error", error: e instanceof Error ? e.message : "réseau" };
  }
}

/**
 * Construit un « movie » json2video minimal à partir d'un script (liste de
 * répliques) : une scène par réplique, texte à l'écran, fond sombre EAGLEYE.
 * Gabarit volontairement simple — point de départ à enrichir.
 */
export function buildSimpleMovie(lines: string[], opts?: { subtitle?: string }): Record<string, unknown> {
  const scenes = lines.slice(0, 12).map((line) => ({
    duration: 3,
    background: { color: "#0E0E0D" },
    elements: [
      {
        type: "text",
        text: line,
        settings: { "font-family": "Bricolage Grotesque", "font-size": 64, color: "#F4F2ED", "font-weight": 800 },
        position: "center-center",
      },
    ],
  }));
  return {
    resolution: "instagram-story", // 1080×1920
    quality: "high",
    scenes,
    ...(opts?.subtitle ? { comment: opts.subtitle } : {}),
  };
}
