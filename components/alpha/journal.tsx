"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ilYa, type LigneJournal } from "@/lib/circuit-alpha";

/**
 * Le journal : ce qu'ALPHA a réellement écrit, dans l'ordre. Une ligne n'existe
 * que si quelque chose a été fait — `logActivity` est appelé par la mission,
 * l'import, les changements d'étape. Une nouvelle ligne GLISSE à son arrivée ;
 * les autres ne rejouent rien.
 *
 * ⚠ Il lit le journal du NAVIGATEUR (`activities`, plafonné à 300) : ce que
 * fait l'équipe ailleurs, ou ce que le serveur fait pour NOTRE pipe à nous, n'y
 * est pas. L'écran le dit.
 */
export function JournalAlpha({ lignes, maintenant }: { lignes: LigneJournal[]; maintenant: Date }) {
  // Au premier rendu, la série entre en cascade ; ensuite, seule une ligne NEUVE
  // s'anime (un élément déjà monté ne rejoue pas son animation d'entrée).
  const cascade = useRef(true);
  useEffect(() => {
    cascade.current = false;
  }, []);

  return (
    <section className="card p-4" aria-label="Le journal d'ALPHA">
      <h2 className="font-display text-base font-semibold text-paper">Le journal d&apos;ALPHA</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Ce qui a été écrit dans ton pipe, la trace la plus récente en haut.
      </p>

      {lignes.length === 0 ? (
        <p className="panel mt-3 p-3 text-[12px] leading-snug text-paper-dim">
          Aucune trace pour l&apos;instant. Chaque mission laisse sa ligne ici —{" "}
          <Link href="/aujourdhui#alpha" className="text-bronze-400 hover:underline">
            lance ALPHA depuis Aujourd&apos;hui
          </Link>
          .
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5" aria-live="polite">
          {lignes.map((l, i) => (
            <li
              key={l.id}
              className="panel animate-fade-up flex items-start gap-2.5 p-2.5"
              style={{ animationDelay: cascade.current ? `${Math.min(i, 8) * 55}ms` : "0ms", animationFillMode: "backwards" }}
            >
              <span className="chip mt-0.5 shrink-0 border-ink-700 text-[10px] text-paper-dim">{l.libelleKind}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug text-paper">
                  {l.prospectId ? (
                    <Link href={`/prospects/${l.prospectId}`} className="hover:text-bronze-400">
                      {l.message}
                    </Link>
                  ) : (
                    l.message
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] text-paper-faint">{ilYa(l.date, maintenant)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
