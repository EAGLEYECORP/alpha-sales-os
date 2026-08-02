"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Reconnaissance vocale du navigateur (Web Speech API).
 *
 * Zéro dépendance, zéro serveur de transcription : Chrome et Edge
 * l'exposent nativement. Firefox non — d'où le repli obligatoire par
 * saisie clavier dans toutes les surfaces qui utilisent ce hook. Une
 * fonctionnalité qui n'existe que sur un navigateur n'est pas une
 * fonctionnalité ; c'est une démo.
 *
 * Note honnête : sur Chrome de bureau, la reconnaissance transite par
 * les serveurs de Google. Ce n'est donc pas « 100 % local ». C'est
 * acceptable ici — l'opérateur dicte SES propres notes, pas la parole
 * d'un tiers — mais ça se dit, ça ne se cache pas.
 * ─────────────────────────────────────────────────────────────────────
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

type Ctor = new () => SpeechRecognitionLike;

function ctor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeech {
  /** Le navigateur sait-il faire ? Null tant qu'on n'a pas testé (rendu serveur). */
  supported: boolean | null;
  listening: boolean;
  /** Texte confirmé depuis le démarrage. */
  transcript: string;
  /** Ce qui est en cours de reconnaissance, pas encore confirmé. */
  interim: string;
  error: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Injection manuelle (repli clavier, correction). */
  setTranscript: (s: string) => void;
}

export function useSpeech(opts: { lang?: string; continuous?: boolean } = {}): UseSpeech {
  const { lang = "fr-FR", continuous = true } = opts;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<SpeechRecognitionLike | null>(null);
  // L'utilisateur a-t-il demandé l'écoute ? Le navigateur coupe tout seul
  // après quelques secondes de silence — on relance tant qu'il n'a pas
  // cliqué « stop ».
  const wanted = useRef(false);

  useEffect(() => {
    setSupported(ctor() !== null);
    return () => {
      wanted.current = false;
      ref.current?.abort();
    };
  }, []);

  const build = useCallback(() => {
    const C = ctor();
    if (!C) return null;
    const rec = new C();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let final = "";
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else pending += r[0].transcript;
      }
      if (final) setTranscript((prev) => (prev ? `${prev} ${final.trim()}` : final.trim()));
      setInterim(pending);
    };

    rec.onerror = (e) => {
      const code = e?.error ?? "inconnue";
      if (code === "no-speech" || code === "aborted") return; // bruit normal
      setError(
        code === "not-allowed"
          ? "Micro refusé — autorise le microphone dans la barre d'adresse."
          : `Reconnaissance vocale : ${code}`
      );
      wanted.current = false;
      setListening(false);
    };

    rec.onend = () => {
      setInterim("");
      if (wanted.current) {
        // Coupure automatique après un silence : on relance.
        try {
          rec.start();
          return;
        } catch {
          /* le navigateur refuse un redémarrage immédiat — on s'arrête proprement */
        }
      }
      setListening(false);
    };

    return rec;
  }, [lang, continuous]);

  const start = useCallback(() => {
    setError("");
    if (!ref.current) ref.current = build();
    if (!ref.current) {
      setError("Ce navigateur ne sait pas transcrire. Utilise Chrome, ou tape ton débrief.");
      return;
    }
    wanted.current = true;
    try {
      ref.current.start();
      setListening(true);
    } catch {
      // start() sur une instance déjà démarrée lève — l'écoute est en cours.
      setListening(true);
    }
  }, [build]);

  const stop = useCallback(() => {
    wanted.current = false;
    ref.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError("");
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset, setTranscript };
}
