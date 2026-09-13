"use client";

import { useMemo } from "react";
import { Target } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { etatTraction, prochaineAction } from "@/lib/plan-traction";
import { rhythmDays } from "@/lib/onboarding-path";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * OÙ TU EN ES — la seule chose qui manquait à la journée.
 *
 * ⚠⚠ CE BANDEAU EXISTE POUR QUE `lib/plan-traction.ts` SOIT ATTEIGNABLE.
 * Sans lui, le plan serait un module juste, testé, que rien n'appelle : le
 * défaut le plus fréquent de ce dépôt. On pouvait faire une excellente journée
 * sans jamais savoir si elle comptait.
 *
 * ⚠ UNE SEULE action servie, jamais quatre. Un tableau de bord qui affiche
 * quatre retards à la fois se lit comme un reproche et se referme. On sert
 * celle qui DÉBLOQUE les autres — sans fiches, le rythme ne veut rien dire.
 *
 * ⚠ LE TAUX ENTRE EN PARAMÈTRE. `JUILLET_REEL` vit dans un module SERVEUR (il
 * sait charger de vraies fiches) et cet écran s'affiche sur un téléphone.
 * Les deux nombres passés ici sont les AGRÉGATS de juillet — 6 RDV sur 78
 * prospects travaillés — qui n'identifient personne. Importer le module aurait
 * fait descendre de vraies fiches dans le bundle.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les agrégats de juillet, recopiés ICI et nulle part ailleurs.
 *
 * ⚠ Ce sont les deux seuls nombres du dépôt qui décrivent une conversion
 * MESURÉE. Ils sont publics par nature (ils n'identifient personne) et le
 * dépôt les expose déjà dans sa doctrine. Les recopier est un moindre mal
 * assumé face à l'alternative : faire descendre `lib/pipeline-juillet.ts`,
 * donc le chargeur de vraies fiches, dans le navigateur.
 */
const JUILLET_MESURE = { succes: 6, n: 78 };

export function BandeauTraction() {
  const prospects = useAlpha((s) => s.prospects);

  const etat = useMemo(
    () =>
      etatTraction(
        {
          fiches: prospects.length,
          joursAuRythme: rhythmDays(prospects),
          // ⚠ Les événements vivent dans `events`, jamais `timeline` — j'ai
          // supposé le second et `tsc` l'a refusé. Un champ deviné compile
          // parfois (si le type est large) et rend alors zéro en silence.
          audits: prospects.filter((p) => (p.events ?? []).some((e) => /audit/i.test(e.summary ?? ""))).length,
          appelsPasses: prospects.reduce((n, p) => n + (p.events ?? []).filter((e) => e.kind === "appel").length, 0),
          appelsConsignes: prospects.reduce(
            (n, p) => n + (p.events ?? []).filter((e) => e.kind === "appel" && (e.summary ?? "").trim().length > 0).length,
            0,
          ),
          /**
           * ⚠ « RDV » n'est PAS un stade — `tsc` a refusé `stage === "rdv"`,
           * que j'avais inventé. Le rendez-vous est un ÉVÉNEMENT, pas une
           * colonne du pipeline. On compte donc les fiches qui ont dépassé le
           * premier contact : `demo` est le stade où une rencontre a eu lieu,
           * et tout ce qui suit en découle. Compter `contact` aurait gonflé le
           * chiffre avec des fiches simplement appelées.
           */
          rdvObtenus: prospects.filter((p) => ["demo", "offre", "signe"].includes(p.stage)).length,
        },
        JUILLET_MESURE,
      ),
    [prospects],
  );

  const suivante = prochaineAction(etat);

  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <Target size={15} className="text-bronze-400" /> Où tu en es — {etat.segment.label}
      </p>

      {suivante ? (
        <p className="mt-1 text-[13px] leading-relaxed text-paper-dim">
          Prochaine chose qui compte : <span className="text-paper">{suivante.action.label}</span> —{" "}
          <span className="font-mono text-bronze-400">
            {suivante.fait} / {suivante.action.cible}
          </span>{" "}
          <span className="text-paper-faint">({suivante.reste} restants)</span>
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-signal-green">
          Toutes les cibles sont tenues. C&apos;est le volume qui produit le résultat — continue.
        </p>
      )}

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {etat.lignes.map((l) => (
          <li key={l.action.id} className="panel flex items-baseline justify-between gap-2 p-2.5">
            <span className="min-w-0 truncate text-[11.5px] text-paper-dim">
              {l.action.label}
              {/* ⚠ Le seul levier dont l'effet soit CONSTATÉ porte sa marque.
                  Les autres sont des intuitions raisonnables, et les afficher
                  à l'identique ferait croire qu'on sait. */}
              {l.action.effet === "mesure" && <span className="ml-1 text-bronze-400" title="effet mesuré en juillet">•</span>}
            </span>
            <span className={cn("shrink-0 font-mono text-[11.5px]", l.atteinte ? "text-signal-green" : "text-paper-faint")}>
              {l.fait}/{l.action.cible}
            </span>
          </li>
        ))}
      </ul>

      {/* ⚠ Le RDV projeté ne sort JAMAIS seul : tout repose sur 6 observations,
          et un nombre nu se lirait comme une promesse. */}
      {etat.rdvFourchette && (
        <p className="mt-3 text-[11px] leading-snug text-paper-faint">
          Sur {etat.lignes[0].action.cible} fiches, le taux mesuré en juillet donne{" "}
          <span className="text-paper-dim">
            {etat.rdvFourchette.bas} à {etat.rdvFourchette.haut} rendez-vous
          </span>{" "}
          {/* ⚠ VU AU RENDU : `phrase` porte DÉJÀ ses parenthèses et son point.
              L'envelopper donnait « (… 3,6 %–15,8 %).) » — une faute invisible
              dans le code et évidente à l'écran. */}
          — {etat.rdvAttendus.phrase} Obtenus à ce jour : {etat.rdvObtenus}.
        </p>
      )}

      {/* ⚠⚠ LA PHRASE QUI EMPÊCHE CET ÉCRAN DE MENTIR. Sans elle, quatre
          compteurs et une projection de RDV se lisent comme un prévisionnel. */}
      <p className="mt-2 text-[11px] leading-snug text-paper-faint">{etat.motifSansEuros}</p>
    </section>
  );
}
