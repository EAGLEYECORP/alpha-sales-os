import type { Metadata } from "next";
import Link from "next/link";
import {
  EN_HERO,
  EN_META,
  EN_PARTAGE,
  EN_PARTAGE_TITRE,
  EN_PREUVES,
  EN_PRIX,
  EN_SOUVERAINETE,
} from "@/lib/vitrine-en";
import { PARTAGE } from "@/lib/promesse";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PAGE ANGLAISE — une SURFACE, pas une deuxième vitrine.
 *
 * ⚠ Elle n'écrit aucune phrase. Tout vient de `lib/vitrine-en.ts`, seul
 * endroit où l'anglais public a le droit de s'écrire, parce que c'est le seul
 * que `tests/vitrine-en.test.ts` garde. Une phrase tapée ici passerait à
 * travers les quatre familles d'interdits — la page anglaise échappe par
 * construction aux quarante gardes français de la vitrine.
 *
 * ⚠ Elle est volontairement COURTE. Ce n'est pas la vitrine traduite ligne à
 * ligne : deux pages longues rédigées côte à côte divergent, et c'est celle
 * qu'on ne relit pas qui finit par mentir. Elle porte ce qui décide — la
 * promesse, la souveraineté, le partage du travail, les garanties
 * vérifiables, l'ordre de grandeur — puis renvoie au cadrage, où la
 * conversation se tient de toute façon.
 * ─────────────────────────────────────────────────────────────────────
 */

export const metadata: Metadata = {
  title: EN_META.title,
  description: EN_META.description,
  robots: { index: true, follow: true },
  alternates: { canonical: "/en", languages: { "fr-FR": "/vitrine" } },
  openGraph: {
    type: "website",
    locale: "en_GB",
    title: EN_HERO.title,
    description: EN_META.description,
    images: [{ url: "/media/hero-poster.jpg", width: 1280, height: 720, alt: "Alpha Sales OS" }],
  },
};

export default function EnglishPage() {
  const alpha = PARTAGE.map((l, i) => ({ ...l, texte: EN_PARTAGE[i] })).filter((l) => l.qui === "alpha");
  const client = PARTAGE.map((l, i) => ({ ...l, texte: EN_PARTAGE[i] })).filter((l) => l.qui === "client");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <header className="space-y-3">
        <p className="font-display text-sm font-semibold uppercase tracking-wide text-bronze-400">
          {EN_HERO.kicker}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight text-paper sm:text-4xl">
          {EN_HERO.title}
        </h1>
        <p className="text-base leading-relaxed text-paper-dim">{EN_HERO.sub}</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <a href="mailto:contact@eagleyecorp.fr" className="btn-bronze inline-flex">
            {EN_HERO.cta}
          </a>
          {/* Le lecteur francophone arrivé ici par erreur repart d'un clic. */}
          <Link href="/vitrine" className="text-sm text-paper-faint underline underline-offset-4">
            Version française
          </Link>
        </div>
      </header>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-paper">Where your data lives</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">{EN_SOUVERAINETE}</p>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-paper">Who does what</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">{EN_PARTAGE_TITRE.note}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="panel px-3 py-3">
            <p className="font-display text-sm font-semibold text-bronze-400">{EN_PARTAGE_TITRE.alpha}</p>
            <ul className="mt-1.5 space-y-1">
              {alpha.map((l) => (
                <li key={l.texte} className="text-xs leading-relaxed text-paper-dim">
                  {l.texte}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel px-3 py-3">
            <p className="font-display text-sm font-semibold text-paper">{EN_PARTAGE_TITRE.client}</p>
            <ul className="mt-1.5 space-y-1">
              {client.map((l) => (
                <li key={l.texte} className="text-xs leading-relaxed text-paper-dim">
                  {l.texte}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-paper">What we guarantee, and where to read it</h2>
        {/*
          ⚠ Chaque garantie NOMME le module qui l'applique, comme du côté
          français. C'est ce qui la sépare d'un argument de vente : on peut
          l'ouvrir. Et à zéro vente, c'est tout ce qu'on a le droit d'avancer —
          une règle vérifiable aujourd'hui, jamais un résultat.
        */}
        <ul className="mt-3 space-y-2.5">
          {EN_PREUVES.map((p) => (
            <li key={p.module}>
              <p className="text-sm leading-relaxed text-paper">{p.claim}</p>
              <p className="font-mono text-[10px] text-paper-faint">{p.module}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-paper">What it costs</h2>
        <ul className="mt-2 space-y-1.5">
          <li className="text-sm text-paper">{EN_PRIX.setup}</li>
          <li className="text-sm text-paper">{EN_PRIX.monthly}</li>
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-paper-faint">{EN_PRIX.note}</p>
      </section>

      <footer className="text-xs text-paper-faint">
        <a href="https://eagleyecorp.fr" className="underline underline-offset-4">
          EAGLEYE CORP — Lyon, France
        </a>
      </footer>
    </main>
  );
}
