"use client";

import { useState } from "react";
import { ChevronDown, Palette, ShieldAlert, Type } from "lucide-react";
import {
  A_LA_PLACE_DE_LA_PREUVE,
  COULEURS,
  INTERDITS_DE_MARQUE,
  INTERDITS_VISUELS,
  MATERIAUX,
  PORTEE,
  REGLE_DES_ETATS,
  TYPOGRAPHIE,
  VOIX,
} from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CHARTE DE MARQUE, RENDUE — et rendue AVEC le matériau qu'elle décrit.
 *
 * ⚠ C'est le seul moyen honnête d'afficher une charte : les pastilles de
 * couleur ne portent AUCUNE valeur, elles portent la classe Tailwind qui lit
 * le jeton. Une pastille peinte avec un hexadécimal recopié montrerait une
 * couleur que le produit n'utilise plus, sans que rien ne le signale — et
 * elle mentirait deux fois, puisque le thème clair redéfinit tout.
 *
 * Conséquence voulue : basculer le thème change les pastilles. C'est la
 * démonstration, pas un effet de bord.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠ La classe est construite à partir du jeton, mais Tailwind ne peut pas
 * extraire une classe assemblée à l'exécution. Elles sont donc écrites en
 * entier, et un test croise cette table avec `COULEURS` : un jeton ajouté
 * sans sa pastille fait tomber le test au lieu de rendre un carré invisible.
 */
const PASTILLE: Record<string, string> = {
  "ink-950": "bg-ink-950",
  "ink-900": "bg-ink-900",
  "ink-700": "bg-ink-700",
  "ink-500": "bg-ink-500",
  paper: "bg-paper",
  "paper-dim": "bg-paper-dim",
  "paper-faint": "bg-paper-faint",
  "bronze-400": "bg-bronze-400",
  "bronze-500": "bg-bronze-500",
  "bronze-900": "bg-bronze-900",
  "signal-green": "bg-signal-green",
  "signal-amber": "bg-signal-amber",
  "signal-red": "bg-signal-red",
  "signal-blue": "bg-signal-blue",
};

/** Les classes d'échantillon, écrites en entier pour la même raison. */
const ECHANTILLON: Record<string, string> = {
  display: "font-display",
  body: "font-body",
  mono: "font-mono",
};

function Section({
  titre,
  icone,
  children,
  ouvertParDefaut = false,
}: {
  titre: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  ouvertParDefaut?: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  return (
    <div className="panel">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-bronze-400">{icone}</span>
        <span className="font-display text-sm font-semibold text-paper">{titre}</span>
        <ChevronDown
          className={cn("ml-auto h-4 w-4 text-paper-faint transition-transform", ouvert && "rotate-180")}
          aria-hidden
        />
      </button>
      {ouvert && <div className="border-t border-ink-700 px-3 py-3 space-y-3">{children}</div>}
    </div>
  );
}

export function CharteMarque() {
  return (
    <div className="card p-4 space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-paper">Charte de marque</h2>
        <p className="mt-1 text-xs leading-relaxed text-paper-dim">
          Elle ne définit rien : elle nomme, et dit où se trouve l'autorité. Les couleurs vivent dans la
          feuille de styles, la parole dans le module de promesse. Les pastilles ci-dessous lisent les
          jetons en direct — changez de thème, elles changent.
        </p>
      </div>

      {/* ── Ce qui est à l'outil, ce qui suit le compte ── */}
      <div className="panel px-3 py-3">
        <p className="font-display text-sm font-semibold text-paper">Deux marques, jamais mélangées</p>
        <p className="mt-1 text-xs leading-relaxed text-paper-dim">
          Le produit est white-label. Confondre les deux met notre en-tête sur un devis émis par
          quelqu'un d'autre — c'est arrivé.
        </p>
        <ul className="mt-2 space-y-1.5">
          {PORTEE.map((e) => (
            <li key={e.quoi} className="flex gap-2 text-xs leading-relaxed">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  e.portee === "plateforme"
                    ? "bg-bronze-900 text-bronze-300"
                    : "bg-ink-800 text-signal-blue"
                )}
              >
                {e.portee === "plateforme" ? "outil" : "compte"}
              </span>
              <span className="text-paper-dim">
                {e.quoi} <span className="font-mono text-[10px] text-paper-faint">— {e.source}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Section titre="Couleurs" icone={<Palette className="h-4 w-4" />} ouvertParDefaut>
        <ul className="space-y-1.5">
          {COULEURS.map((c) => (
            <li key={c.jeton} className="flex items-center gap-2.5">
              <span
                className={cn("h-6 w-6 shrink-0 rounded border border-ink-700", PASTILLE[c.jeton])}
                aria-hidden
              />
              <span className="font-mono text-[11px] text-paper">{c.jeton}</span>
              <span className="text-xs leading-snug text-paper-dim">{c.role}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-ink-700 pt-2.5 text-xs leading-relaxed text-paper-dim">
          {REGLE_DES_ETATS}
        </p>
      </Section>

      <Section titre="Typographie" icone={<Type className="h-4 w-4" />}>
        <ul className="space-y-2">
          {TYPOGRAPHIE.map((f) => (
            <li key={f.cle}>
              {/* ⚠ Même piège que les pastilles : `font-${f.cle}` ne serait pas
                  extrait par Tailwind et rendrait la police par défaut — donc
                  un échantillon qui MONTRE une typographie que le produit
                  n'utilise pas. Un test croise cette table avec `TYPOGRAPHIE`. */}
              <p className={cn("text-base text-paper", ECHANTILLON[f.cle])}>
                Les humains closent, la machine tourne.
              </p>
              <p className="text-[11px] text-paper-faint">
                <span className="font-mono">font-{f.cle}</span> — {f.usage}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Matériaux" icone={<Palette className="h-4 w-4" />}>
        <ul className="space-y-2.5">
          {MATERIAUX.map((m) => (
            <li key={m.classe}>
              <p className="font-mono text-[11px] text-bronze-400">.{m.classe}</p>
              <p className="text-xs text-paper">{m.quoi}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-paper-faint">⚠ {m.piege}</p>
            </li>
          ))}
        </ul>
        <ul className="border-t border-ink-700 pt-2.5 space-y-1.5">
          {INTERDITS_VISUELS.map((i) => (
            <li key={i} className="text-[11px] leading-relaxed text-paper-dim">
              — {i}
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Ce qu'on dit" icone={<Type className="h-4 w-4" />}>
        <p className="font-display text-sm leading-snug text-paper">{VOIX.promesseCourte}</p>
        <p className="text-xs leading-relaxed text-paper-dim">{VOIX.promesse}</p>
        <p className="text-xs leading-relaxed text-paper-dim">{VOIX.categorie}</p>
        <p className="border-t border-ink-700 pt-2.5 text-[11px] leading-relaxed text-paper-faint">
          {VOIX.identiteRefusee}
        </p>
      </Section>

      <Section titre="Ce qu'aucun artefact n'a le droit de porter" icone={<ShieldAlert className="h-4 w-4" />}>
        <ul className="space-y-2">
          {INTERDITS_DE_MARQUE.map((i) => (
            <li key={i.garde + i.regle}>
              <p className="text-xs leading-relaxed text-paper">{i.regle}</p>
              <p className="font-mono text-[10px] text-paper-faint">appliqué par {i.garde}</p>
            </li>
          ))}
        </ul>
        <div className="border-t border-ink-700 pt-2.5">
          <p className="text-xs font-semibold text-paper">Ce qui remplace la preuve, à zéro vente :</p>
          <ul className="mt-1 space-y-1">
            {A_LA_PLACE_DE_LA_PREUVE.map((p) => (
              <li key={p} className="text-[11px] leading-relaxed text-paper-dim">
                — {p}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
