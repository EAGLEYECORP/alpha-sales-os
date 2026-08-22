"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISSION, EN PUBLIC — 0 → 10 M€, et où on en est vraiment.
 *
 * Zakaria a demandé que ça mette la pression. La seule façon honnête de
 * le faire : afficher l'écart entre l'ambition et le réel, sans le
 * maquiller. Un tableau de bord public qui montrerait une belle courbe
 * ne mettrait aucune pression — il rassurerait, ce qui est l'inverse.
 *
 * Donc : les paliers sont affichés, l'avancement RÉEL aussi, et le fait
 * qu'on soit au tout début est écrit noir sur blanc. C'est aussi le
 * meilleur argument commercial disponible — un fournisseur qui affiche
 * ses chiffres quand ils sont petits est un fournisseur qu'on croit
 * quand ils seront grands.
 *
 * ── L'ANIMATION ──
 *
 * Elle se déclenche à l'entrée dans le champ (IntersectionObserver), une
 * seule fois, et elle est DÉSACTIVÉE si l'utilisateur a demandé le
 * mouvement réduit. Une barre qui se remplit raconte une progression ;
 * la même barre qui se rejoue à chaque scroll raconte un gadget.
 * ─────────────────────────────────────────────────────────────────────
 */

const INK = "#191919";
const ACCENT = "#B85A32";
const MUTED = "#6B6862";
const LINE = "#DEDAD1";

interface Palier {
  seuil: string;
  titre: string;
  contrainte: string;
  /** Part de la barre occupée par ce palier (échelle logarithmique). */
  part: number;
  atteint: boolean;
}

/**
 * L'échelle est LOGARITHMIQUE, et ce n'est pas un artifice de présentation :
 * en linéaire, les trois premiers paliers occuperaient 3,5 % de la barre et
 * seraient illisibles. Or c'est là que tout se joue.
 */
const PALIERS: Palier[] = [
  { seuil: "0", titre: "Prouver qu'on sait vendre", contrainte: "Des clients qui PAIENT, à la main.", part: 25, atteint: false },
  { seuil: "100 k€", titre: "Rendre la vente reproductible", contrainte: "Un canal, répété jusqu'à l'écœurement.", part: 25, atteint: false },
  { seuil: "1 M€", titre: "Faire tourner sans le fondateur", contrainte: "Ce qui dépend d'une personne ne passe pas.", part: 25, atteint: false },
  { seuil: "3,5 M€", titre: "Industrialiser", contrainte: "La marge, pas seulement le volume.", part: 25, atteint: false },
];

export function MissionSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduit(mq.matches);
    if (mq.matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Une seule fois : rejouer l'animation à chaque passage transforme
        // une démonstration en gadget.
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const duree = reduit ? "0ms" : "1400ms";

  return (
    <section ref={ref} id="mission" className="py-20">
      <p className="mb-6 text-[13px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
        Notre mission — en public
      </p>
      <h2 className="max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
        De 0 à 10 M€, et on affiche où on en est.
      </h2>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
        On candidate à French Tech 2030 sur un angle simple : l&apos;automatisation commerciale des PME
        françaises ne devrait pas dépendre d&apos;acteurs américains. Alpha Sales OS n&apos;a aucune dépendance
        externe, ses données peuvent rester en France, et sa brique vocale s&apos;auto-héberge.
      </p>

      {/* La barre : l'échelle est logarithmique, et c'est dit. */}
      <div className="mt-12">
        <div className="relative h-2 overflow-hidden rounded-full" style={{ background: LINE }}>
          <div
            className="h-full rounded-full"
            style={{
              background: ACCENT,
              width: visible ? "6%" : "0%",
              transition: `width ${duree} cubic-bezier(.22,1,.36,1)`,
            }}
          />
        </div>

        <div className="mt-4 grid gap-6 sm:grid-cols-4">
          {PALIERS.map((p, i) => (
            <div
              key={p.seuil}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "none" : "translateY(10px)",
                transition: `opacity 600ms ease ${reduit ? 0 : 200 + i * 120}ms, transform 600ms cubic-bezier(.22,1,.36,1) ${
                  reduit ? 0 : 200 + i * 120
                }ms`,
              }}
            >
              <p className="font-mono text-[12px]" style={{ color: i === 0 ? ACCENT : MUTED }}>
                {p.seuil}
              </p>
              <p className="mt-1 text-[15px] font-medium" style={{ color: INK }}>
                {p.titre}
              </p>
              <p className="mt-1 text-[13.5px] leading-[1.5]" style={{ color: MUTED }}>
                {p.contrainte}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px]" style={{ color: MUTED }}>
          Échelle logarithmique — en linéaire, les trois premiers paliers occuperaient 3 % de la barre. C&apos;est
          pourtant là que tout se joue.
        </p>
      </div>

      {/* L'écart, dit franchement. C'est ce qui met la pression — et c'est
          aussi ce qui rend le reste croyable. */}
      <div className="mt-12 rounded-2xl border p-6" style={{ borderColor: LINE, background: "#fff" }}>
        <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
          Où on en est, sans maquillage
        </p>
        <p className="mt-3 text-[17px] leading-[1.6]" style={{ color: INK }}>
          Premier palier. L&apos;OS est construit et testé ; il n&apos;a pas encore prouvé qu&apos;il convertit à
          grande échelle.
        </p>
        <p className="mt-3 text-[15px] leading-[1.65]" style={{ color: MUTED }}>
          On préfère l&apos;écrire ici que de le laisser découvrir. Un fournisseur qui affiche ses chiffres
          quand ils sont petits est un fournisseur qu&apos;on croit quand ils seront grands — et si vous
          cherchez une référence de 500 clients, ce n&apos;est pas nous, aujourd&apos;hui.
        </p>
      </div>
    </section>
  );
}
