"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISSION, EN PUBLIC — 0 → 10 M€.
 *
 * ⚠ CETTE PAGE VEND. Le tableau de bord qui met la pression est dans
 * l'app (`/trajectoire`) : c'est là qu'on affiche l'écart réel, le
 * compte à rebours et les lots en retard. Ici, on montre le CAP.
 *
 * La distinction n'est pas cosmétique. La version précédente écrivait
 * « on n'a pas encore prouvé qu'on convertit » et « si vous cherchez une
 * référence de 500 clients, ce n'est pas nous ». C'est vrai, et ça n'a
 * rien à faire sur une page dont le seul travail est d'obtenir un
 * cadrage : on ne demande pas à un prospect d'assumer nos doutes.
 *
 * La règle tenue ici : ON NE MENT PAS, ON NE SE SABORDE PAS. Aucune
 * référence inventée, aucun chiffre client qu'on n'a pas — et aucune
 * confession spontanée non plus. Ce qui est dit est vrai et vérifiable :
 * l'ambition, la souveraineté technique, et le fait qu'on choisisse nos
 * clients plutôt que l'inverse.
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
        Notre mission
      </p>
      <h2 className="max-w-2xl font-serif text-[34px] leading-[1.15] tracking-[-0.02em] sm:text-[42px]">
        Une machine de vente française, de 0 à 10 M€.
      </h2>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.65]" style={{ color: MUTED }}>
        Un angle simple : l&apos;automatisation commerciale des PME françaises ne devrait pas dépendre
        d&apos;acteurs américains. Vos données peuvent rester en France, et la brique vocale
        s&apos;héberge chez vous si vous le voulez. C&apos;est aussi ce qui nous vaut de candidater à
        French Tech 2030.
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

      {/* Ce qui est VRAI et qui fait signer : on choisit nos clients. C'est le
          même fait que « on n'en a pas des centaines », dit du bon côté — et
          c'est littéralement vrai : le cadrage est obligatoire et on refuse. */}
      <div className="mt-12 rounded-2xl border p-6" style={{ borderColor: ACCENT, background: "#fff" }}>
        <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
          Ce que ça veut dire pour vous
        </p>
        <p className="mt-3 text-[17px] leading-[1.6]" style={{ color: INK }}>
          On installe peu de clients à la fois, et on les choisit.
        </p>
        <p className="mt-3 text-[15px] leading-[1.65]" style={{ color: MUTED }}>
          Concrètement : le cadrage est obligatoire, on dit non quand ça ne matche pas, et celui qui
          installe chez vous est celui qui a construit l&apos;outil. Ce n&apos;est pas tenable à mille
          clients — c&apos;est exactement pour ça que ça vaut le coup d&apos;en être maintenant.
        </p>
        <a
          href="#cadrage"
          className="mt-5 inline-block rounded-full px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: INK }}
        >
          Demander un cadrage
        </a>
      </div>
    </section>
  );
}
