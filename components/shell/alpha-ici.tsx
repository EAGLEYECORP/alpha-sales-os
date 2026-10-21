"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Ban, Check, ChevronDown, Workflow } from "lucide-react";
import { pageAlphaPour } from "@/lib/alpha-ici";
import { cn } from "@/lib/utils";

/**
 * « Ce qu'ALPHA fait ici » — sous la bande de présence, sur les écrans que le
 * registre (`lib/alpha-ici.ts`) a lus. Fermé par défaut : c'est une ligne, pas
 * un encart. Ouvert, chaque étape arrive l'une après l'autre, avec le fichier
 * qui applique la règle.
 *
 * ⚠ Un écran absent du registre n'affiche RIEN — pas un texte générique : on ne
 * décrit pas ce qu'on n'a pas lu.
 */
export function AlphaIci() {
  const pathname = usePathname();
  const page = pageAlphaPour(pathname);
  const [ouvert, setOuvert] = useState(false);

  if (!page) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-2 md:px-8" data-alpha-ici={page.route}>
      <button
        type="button"
        className="flex items-center gap-1.5 px-1 text-[12px] text-paper-faint transition-colors hover:text-paper"
        aria-expanded={ouvert}
        aria-controls="alpha-ici-corps"
        onClick={() => setOuvert((o) => !o)}
      >
        <Workflow size={13} aria-hidden="true" className="text-bronze-400" />
        Ce qu&apos;ALPHA fait ici
        <ChevronDown size={13} aria-hidden="true" className={cn("transition-transform duration-300", ouvert && "rotate-180")} />
      </button>

      {ouvert && (
        <div id="alpha-ici-corps" className="card animate-fade-up mt-2 p-3">
          <p className="font-display text-[13px] font-semibold text-paper">{page.titre}</p>
          <ul className="mt-2 space-y-2.5">
            {page.etapes.map((e, i) => (
              <li
                key={`${e.fichier}-${e.symbole}`}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
              >
                <p className="flex gap-2 text-[12.5px] leading-snug text-paper">
                  <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-signal-green" />
                  {e.quoi}
                </p>
                <p
                  className="ml-6 mt-0.5 break-all font-mono text-[10.5px] text-paper-faint"
                  title="Le fichier du dépôt qui applique cette règle, et le nom qui la porte"
                >
                  {e.fichier} · {e.symbole}
                </p>
              </li>
            ))}
          </ul>
          <p
            className="animate-fade-up mt-2.5 flex gap-2 text-[12px] leading-snug text-paper-dim"
            style={{ animationDelay: `${page.etapes.length * 80}ms`, animationFillMode: "backwards" }}
          >
            <Ban size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-paper-faint" />
            {page.nePasFaire}
          </p>
          <Link href="/travail" className="btn-ghost mt-3 px-3 py-1.5 text-[12px]">
            Voir tout le circuit <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
