"use client";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Synthèse vocale CÔTÉ NAVIGATEUR — pour écouter/répéter un script
 * gratuitement, sans clé et sans limite.
 *
 * Deux fournisseurs, au choix (réglage mémorisé) :
 *   · « puter »      — Puter.js (js.puter.com), gratuit et illimité, voix
 *                      correctes. Charge un script externe à la demande.
 *   · « navigateur » — Web Speech API du navigateur : zéro dépendance,
 *                      hors-ligne, mais voix système.
 *
 * ⚠ Ceci sert à ÉCOUTER dans le navigateur (aperçu, répétition). Ce n'est
 * PAS la voix de l'appel réel : dans un appel LiveKit, la voix est
 * synthétisée côté serveur (Fish Audio / OpenAI dans voice/agent.py).
 * Puter est un outil de navigateur, il ne peut pas parler dans un appel.
 * ─────────────────────────────────────────────────────────────────────
 */

export type TtsProvider = "puter" | "navigateur";

const KEY = "alpha_tts_provider";
const PUTER_SRC = "https://js.puter.com/v2/";

export function getTtsProvider(): TtsProvider {
  if (typeof window === "undefined") return "puter";
  try {
    return localStorage.getItem(KEY) === "navigateur" ? "navigateur" : "puter";
  } catch {
    return "puter";
  }
}

export function setTtsProvider(p: TtsProvider): void {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* stockage indisponible */
  }
}

interface PuterLike {
  ai: { txt2speech: (text: string, opts?: { language?: string }) => Promise<HTMLAudioElement> };
}

let puterPromise: Promise<PuterLike> | null = null;
function loadPuter(): Promise<PuterLike> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const existing = (window as unknown as { puter?: PuterLike }).puter;
  if (existing) return Promise.resolve(existing);
  if (puterPromise) return puterPromise;
  puterPromise = new Promise<PuterLike>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PUTER_SRC;
    s.async = true;
    s.onload = () => {
      const p = (window as unknown as { puter?: PuterLike }).puter;
      p ? resolve(p) : reject(new Error("Puter chargé mais indisponible"));
    };
    s.onerror = () => {
      puterPromise = null;
      reject(new Error("Puter injoignable — vérifie ta connexion, ou passe la voix sur « navigateur »."));
    };
    document.head.appendChild(s);
  });
  return puterPromise;
}

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeak(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

/**
 * Lit `text` à voix haute. Résout quand la lecture est LANCÉE (pas finie).
 * `onended` est appelé à la fin, pour remettre un bouton dans son état.
 */
export async function speak(
  text: string,
  opts: { lang?: string; provider?: TtsProvider; onended?: () => void } = {}
): Promise<void> {
  const lang = opts.lang || "fr-FR";
  const provider = opts.provider || getTtsProvider();
  const clip = text.trim().slice(0, 2800); // borne de sécurité (limites TTS)
  if (!clip) return;
  stopSpeak();

  if (provider === "puter") {
    const puter = await loadPuter();
    const audio = await puter.ai.txt2speech(clip, { language: lang });
    currentAudio = audio;
    if (opts.onended) audio.addEventListener("ended", opts.onended, { once: true });
    await audio.play();
    return;
  }

  // navigateur — Web Speech API (synthèse)
  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("Ce navigateur ne sait pas synthétiser la voix.");
  }
  const u = new SpeechSynthesisUtterance(clip);
  u.lang = lang;
  const fr = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
  if (fr) u.voice = fr;
  if (opts.onended) u.addEventListener("end", opts.onended, { once: true });
  window.speechSynthesis.speak(u);
}
