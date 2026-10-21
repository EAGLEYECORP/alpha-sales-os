"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MOUVEMENT D'« ALPHA AU TRAVAIL » — trois outils, et une règle.
 *
 * La règle : **le mouvement n'accompagne que des FAITS.** Une carte qui
 * apparaît parce qu'elle entre à l'écran, un nombre qui s'anime parce qu'il
 * CHANGE, une ligne qui glisse parce qu'elle vient d'être écrite. Rien ne
 * boucle, rien ne « travaille » pour faire joli : une animation continue sur
 * un écran qui dit « ALPHA agit » est une petite preuve fabriquée — celle que
 * la lecture du site et la mission refusent déjà.
 *
 * Tout passe par `opacity` et `transform` (le compositeur, pas la mise en
 * page), et le réglage « réduire les animations » du système est respecté DEUX
 * fois : par la feuille de style globale, et ici, parce que les nombres
 * s'animent en JavaScript et qu'une feuille de style ne les atteint pas.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le visiteur a-t-il demandé moins d'animations ? Faux côté serveur, relu au montage. */
export function useReduitMouvement(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduit(m.matches);
    const surChangement = () => setReduit(m.matches);
    m.addEventListener?.("change", surChangement);
    return () => m.removeEventListener?.("change", surChangement);
  }, []);
  return reduit;
}

/**
 * Vrai à partir du moment où l'élément entre à l'écran — et le reste. Une carte
 * qui se révèle UNE fois ne se « re-joue » pas quand on remonte la page.
 * Sans `IntersectionObserver` ou en mouvement réduit : visible tout de suite, on
 * ne cache jamais du contenu derrière une animation qui ne viendra pas.
 */
export function useRevele<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [vu, setVu] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || vu) return;
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduit || typeof IntersectionObserver === "undefined") {
      setVu(true);
      return;
    }
    const io = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setVu(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [vu]);

  return [ref, vu];
}

/** Un bloc qui monte et se fond à son entrée dans l'écran. `delai` en ms décale une série. */
export function Revele({ children, delai = 0, className }: { children: ReactNode; delai?: number; className?: string }) {
  const [ref, vu] = useRevele<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(.16,1,.3,1)]",
        vu ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className
      )}
      style={{ transitionDelay: vu ? `${delai}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

const DUREE_COMPTEUR_MS = 700;

/**
 * Un nombre qui MONTE vers sa valeur quand il entre à l'écran, puis qui glisse
 * d'une valeur à l'autre quand elle change. Le lecteur d'écran lit la valeur
 * FINALE (`aria-label`), jamais les chiffres intermédiaires.
 */
export function Compteur({ valeur, className }: { valeur: number; className?: string }) {
  const [ref, vu] = useRevele<HTMLSpanElement>();
  const reduit = useReduitMouvement();
  const [affiche, setAffiche] = useState(0);
  const courant = useRef(0);
  courant.current = affiche;

  useEffect(() => {
    if (!vu) return;
    if (reduit) {
      setAffiche(valeur);
      return;
    }
    const de = courant.current;
    if (de === valeur) return;
    const t0 = performance.now();
    let image = 0;
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / DUREE_COMPTEUR_MS);
      const adouci = 1 - Math.pow(1 - k, 3);
      setAffiche(Math.round(de + (valeur - de) * adouci));
      if (k < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [valeur, vu, reduit]);

  return (
    <span ref={ref} aria-label={String(valeur)} className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{affiche}</span>
    </span>
  );
}
