"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lireEtatTranscription, phraseTranscription } from "@/lib/etat-transcription";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Enregistrement audio (MediaRecorder) → transcription serveur.
 *
 * Le complément de use-speech : là où la Web Speech API n'existe que sur
 * Chrome/Edge/Safari, MediaRecorder marche PARTOUT (Chromium, Brave,
 * Firefox…). On enregistre, on envoie les octets à /api/transcribe, on
 * récupère le texte. Pas de live interim — on transcrit à l'arrêt — mais
 * c'est le prix pour que ça marche sur n'importe quel navigateur.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le meilleur type supporté par CE navigateur (webm sur Chromium, mp4 sur Safari). */
function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export interface UseRecorder {
  /** Le navigateur sait-il enregistrer ? Null tant qu'on n'a pas testé (SSR). */
  supported: boolean | null;
  recording: boolean;
  /** Transcription serveur en cours (après l'arrêt). */
  transcribing: boolean;
  error: string;
  start: () => void;
  /** Arrête, envoie, et renvoie le texte transcrit (ou "" si échec). */
  stop: () => Promise<string>;
}

export function useRecorder(): UseRecorder {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSupported(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne sait pas enregistrer. Tape ton débrief.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Micro refusé. Touche le cadenas à côté de l'adresse → Microphone → Autoriser, puis réessaie."
          : name === "NotFoundError"
            ? "Aucun micro détecté."
            : "Micro indisponible — tape ton débrief."
      );
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const stop = useCallback((): Promise<string> => {
    const rec = recRef.current;
    if (!rec) return Promise.resolve("");
    return new Promise<string>((resolve) => {
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size === 0) {
          resolve("");
          return;
        }
        setTranscribing(true);
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "content-type": blob.type },
            body: blob,
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            /**
             * ⚠⚠ UN REFUS DE BRIQUE N'EST PAS UNE PANNE DE TRANSCRIPTION.
             *
             * Le middleware rend un 403 dont le message est générique
             * (« Cette fonctionnalité n'est pas incluse dans ton offre »). Le
             * recopier tel quel ici laissait l'opérateur devant un bouton
             * « Dicter (serveur) » qui échoue sans dire que c'est un ACHAT et
             * non un bug — et sans lui rappeler qu'il a déjà une alternative
             * gratuite sous la main.
             *
             * `lireEtatTranscription` traduit le statut ; `phraseTranscription`
             * porte la formulation, à un seul endroit, partagée avec l'écran.
             */
            const etat = lireEtatTranscription(res.status, data);
            const dit = phraseTranscription(etat);
            setError(
              dit ??
                (typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string"
                  ? (data as { error: string }).error
                  : "Transcription impossible.")
            );
            resolve("");
          } else {
            resolve((typeof data === "object" && data !== null ? ((data as { text?: string }).text ?? "") : ""));
          }
        } catch {
          setError("Serveur de transcription injoignable.");
          resolve("");
        } finally {
          setTranscribing(false);
        }
      };
      try {
        rec.stop();
      } catch {
        resolve("");
      }
    });
  }, []);

  return { supported, recording, transcribing, error, start, stop };
}
