"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La vidéo d'ouverture de la vitrine.
 *
 * Choix assumés, dans l'ordre où ils comptent :
 *
 *  · MUETTE au démarrage. Aucun navigateur ne lance une vidéo sonore sans
 *    geste de l'utilisateur, et c'est tant mieux : une page qui parle toute
 *    seule fait fermer l'onglet. Le son est disponible en un clic.
 *  · PAS de boucle. Le film se termine sur la carte de marque : le laisser
 *    repartir en arrière détruirait précisément ce sur quoi il se pose.
 *  · Une AFFICHE (première image) et `preload="metadata"` : le cadre est
 *    peint tout de suite, sans le rectangle noir qui trahit une vidéo mal
 *    intégrée.
 *  · `prefers-reduced-motion` respecté : on ne lance rien tout seul chez
 *    quelqu'un qui a demandé le contraire — on montre l'affiche et un bouton.
 *    Ce n'est pas une préférence esthétique, c'est un réglage d'accessibilité
 *    que certaines personnes activent pour ne pas avoir de vertiges.
 */
export function HeroVideo({ line, muted: MUTED_LINE }: { line: string; muted: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [withSound, setWithSound] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const lire = (son: boolean) => {
    const v = ref.current;
    if (!v) return;
    v.muted = !son;
    v.currentTime = 0;
    setWithSound(son);
    setStarted(true);
    // La promesse de `play()` est rejetée si le navigateur refuse : on
    // n'affiche pas d'erreur, l'affiche reste et le bouton aussi.
    void v.play().catch(() => setStarted(false));
  };

  return (
    <figure className="mt-14">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: "#0A0807" }}>
        <video
          ref={ref}
          className="block w-full"
          poster="/media/hero-poster.jpg"
          preload="metadata"
          playsInline
          muted
          autoPlay={!reduced}
          onPlay={() => setStarted(true)}
          onEnded={() => setStarted(false)}
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>

        {/* Un seul bouton, qui dit ce qu'il fait maintenant. */}
        {(!started || !withSound) && (
          <button
            onClick={() => lire(true)}
            className="absolute bottom-4 right-4 rounded-full bg-black/55 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            {started ? "Réécouter avec le son" : "Lire avec le son"}
          </button>
        )}
      </div>
      <figcaption className="mt-3 text-[13px]" style={{ color: "#6B6862" }}>
        {reduced ? MUTED_LINE : line}
      </figcaption>
    </figure>
  );
}
