"use client";

import { useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { getAccount } from "@/lib/accounts";
import { notesForAccount } from "@/lib/knowledge";
import { leconsPourAppels } from "@/lib/lecons-terrain";
import type { Prospect } from "@/lib/types";
import type { VerticalPlaybook } from "@/lib/playbook";

/**
 * Ce qu'on a appris sur CE métier — servi avant de composer.
 *
 * Le panneau ne s'affiche que s'il a quelque chose de RÉEL à dire. Un bloc
 * « aucune leçon pour l'instant » posé en permanence au-dessus de la file
 * d'appels serait du bruit tous les matins pour un contenu qui arrive une
 * fois par semaine.
 */
export function LeconsVerticale({
  vertical,
  targets,
}: {
  vertical: VerticalPlaybook | null;
  targets: Prospect[];
}) {
  const { notes, settings } = useAlpha();

  const lecons = useMemo(() => {
    const compte = getAccount(settings.accountId);
    return leconsPourAppels(
      notesForAccount(notes, settings.accountId, compte.kind === "master"),
      vertical,
      targets
    );
  }, [notes, settings.accountId, vertical, targets]);

  if (lecons.length === 0) return null;

  return (
    <section className="rounded-xl border border-bronze-700/40 bg-bronze-900/15 px-4 py-3">
      <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-bronze-400">
        <BookOpen size={12} /> Ce qu&apos;on a appris sur ce métier
      </h3>
      <ul className="mt-2 space-y-2">
        {lecons.map((l) => (
          <li key={l.id} className="border-l-2 border-bronze-700/60 pl-3">
            <p className="text-[12px] font-medium text-paper">
              {l.titre}
              {l.origine && <span className="ml-1.5 text-[11px] text-paper-faint">· {l.origine}</span>}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-dim">{l.extrait}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-paper-faint">
        <Sparkles size={11} className="mt-0.5 shrink-0 text-bronze-400" />
        Ce sont des <strong className="text-paper-dim">cas</strong>, pas des règles : chacun vient d&apos;un rendez-vous
        réel, pas d&apos;une moyenne. À reprendre comme une question, jamais comme un script.
      </p>
    </section>
  );
}
