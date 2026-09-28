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
        code === "not-allowed" || code === "service-not-allowed"
          ? "Micro refusé. Touche le cadenas (ou « aA ») à côté de l'adresse → Autorisations du site → Microphone → Autoriser."
          : code === "network"
            ? "Ce navigateur n'a pas le service vocal de Google (le cas de Chromium et de Brave, qui n'embarquent pas la clé). Utilise Google Chrome, Edge ou Safari — ou « Écrire au clavier », le résultat est identique."
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

  /**
   * Démarre l'écoute. Deux garde-fous AVANT de lancer la reconnaissance,
   * parce que « Micro refusé » cache presque toujours l'une de ces causes :
   *
   *  1. Contexte non sécurisé. La Web Speech API n'existe QUE sur HTTPS
   *     (ou localhost). Sur téléphone via une IP `http://…:3000`, le micro
   *     est refusé sans explication utile. C'est exactement le « ça marche
   *     pas en local » : il faut l'app EN LIGNE (HTTPS), pas l'IP locale.
   *
   *  2. Permission micro. On la demande explicitement via getUserMedia —
   *     ça déclenche une vraie invite système, fiable sur Android, là où
   *     un simple `recognition.start()` échoue en silence. On relâche le
   *     flux aussitôt : la reconnaissance gère son propre micro.
   */
  const start = useCallback(async () => {
    setError("");

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError(
        "Le micro exige une connexion sécurisée (HTTPS). Ouvre l'app EN LIGNE (l'adresse en https://…), pas l'adresse locale du téléphone."
      );
      return;
    }

    // Invite de permission fiable (surtout sur mobile). Absente en HTTP.
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (md?.getUserMedia) {
      try {
        const stream = await md.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        const name = (e as { name?: string })?.name ?? "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Micro refusé. Touche le cadenas (ou « aA ») à côté de l'adresse → Autorisations du site → Microphone → Autoriser, puis réessaie."
            : name === "NotFoundError"
              ? "Aucun micro détecté sur cet appareil."
              : "Micro indisponible — vérifie les autorisations du navigateur, ou tape ton débrief."
        );
        wanted.current = false;
        setListening(false);
        return;
      }
    }

    if (!ref.current) ref.current = build();
    if (!ref.current) {
      setError("Ce navigateur ne sait pas transcrire (Firefox notamment). Utilise Chrome/Edge, ou tape ton débrief.");
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
