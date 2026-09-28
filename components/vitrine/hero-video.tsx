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
 *
 * ── LE BLOC MÈNE QUELQUE PART, MAIS PAS EN TRAHISSANT LE CLIC ──
 *
 * ⚠ La tentation est de rendre la VIDÉO elle-même cliquable vers une page.
 * C'est hostile : on clique une vidéo pour la lire ou la mettre en pause, et
 * une surface qui quitte la page à la place fait exactement ce que
 * l'utilisateur n'a pas demandé. La surface garde donc son geste naturel.
 *
 * Le lien apparaît aux deux endroits où il ne prend la place de rien :
 *  · sous la vidéo, à côté de la légende — toujours visible, discret ;
 *  · EN GRAND quand le film est FINI. C'est le moment de l'intention maximale :
 *    la personne vient de regarder dix secondes de produit et n'a plus rien à
 *    faire de cet écran. Un bloc qui se termine sans issue est un cul-de-sac.
 *
 * La destination est passée par la PAGE (`href`, `cta`), pas écrite ici : ce
 * composant ne doit pas décider où va la vitrine.
 */
export function HeroVideo({
  line,
  muted: MUTED_LINE,
  href,
  cta,
}: {
  line: string;
  muted: string;
  /** Où mène le bloc. Décidé par la page, pas par le composant. */
  href: string;
  cta: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [withSound, setWithSound] = useState(false);
  const [started, setStarted] = useState(false);
  /** Le film est allé au bout : on propose la suite par-dessus l'image de fin. */
  const [fini, setFini] = useState(false);

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
    setFini(false);
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
          onPlay={() => {
            setStarted(true);
            setFini(false);
          }}
          onEnded={() => {
            setStarted(false);
            setFini(true);
          }}
        >
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>

        {/* Un seul bouton, qui dit ce qu'il fait maintenant. */}
        {(!started || !withSound) && !fini && (
          <button
            onClick={() => lire(true)}
            className="absolute bottom-4 right-4 rounded-full bg-black/55 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            {started ? "Réécouter avec le son" : "Lire avec le son"}
          </button>
        )}

        {/*
          LE FILM EST FINI — c'est le moment de l'intention maximale, et le bloc
          n'avait aucune issue. On propose la suite, et on laisse revoir : un
          écran de fin sans retour en arrière est aussi un cul-de-sac.
        */}
        {fini && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-4 backdrop-blur-[2px]">
            <a
              href={href}
              className="rounded-full bg-white px-6 py-3 text-[15px] font-medium text-[#191919] transition-opacity hover:opacity-90"
            >
              {cta}
            </a>
            <button
              onClick={() => lire(withSound)}
              className="text-[13px] text-white/80 underline underline-offset-4 hover:text-white"
            >
              Revoir
            </button>
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: "#6B6862" }}>
        <span>{reduced ? MUTED_LINE : line}</span>
        {/*
          Toujours visible, y compris en mouvement réduit — où la vidéo ne se
          lance pas, donc où le voile de fin n'apparaîtra jamais. Sans ce lien,
          ces personnes-là n'auraient aucune sortie depuis ce bloc.
        */}
        <a href={href} className="underline underline-offset-4" style={{ color: "#191919" }}>
          {cta}
        </a>
      </figcaption>
    </figure>
  );
}
