"use client";

import { useEffect, useState } from "react";
import { Lock, PackageCheck, ShoppingCart, TimerReset } from "lucide-react";
import { useDroits } from "@/lib/use-droits";
import { CAPACITES } from "@/lib/public-catalogue";
import { briquesPourChemin } from "@/lib/bricks-access";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * MON OFFRE — ce que ce compte possède, et ce qui manque.
 *
 * Deux raisons d'exister, et la seconde compte plus que la première :
 *
 *  1. Un client doit voir ce qu'il a payé. Évident.
 *  2. **Un client REFUSÉ doit comprendre pourquoi.** Le middleware le renvoie
 *     ici avec `?bloque=/cerveau`. Sans explication, il tombe sur une page de
 *     compte muette après avoir cliqué sur un lien, croit à un bug, et écrit
 *     au support. Un refus qui ne s'explique pas coûte plus cher que la
 *     fonctionnalité refusée.
 *
 * C'est aussi la seule surface de VENTE à l'intérieur du produit : le moment
 * où quelqu'un se heurte à une brique absente est le moment où il a le plus
 * envie de l'acheter. On ne le gaspille pas avec une erreur 403 sèche.
 *
 * Les libellés viennent de la vue PUBLIQUE du catalogue : aucun montant ne
 * descend ici (voir lib/public-catalogue.ts).
 * ─────────────────────────────────────────────────────────────────────
 */
export function MonOffre() {
  const d = useDroits();
  const [bloque, setBloque] = useState<string | null>(null);

  useEffect(() => {
    // Lu au montage plutôt que par un hook de routeur : le paramètre est
    // informatif, il ne doit pas provoquer de re-rendu à chaque navigation.
    const p = new URLSearchParams(window.location.search).get("bloque");
    setBloque(p);
  }, []);

  // En mode solo (notre usage), il n'y a pas d'offre à afficher : tout est là.
  if (d.solo) return null;

  const possede = (id: string) => d.maitre || d.bricks.includes(id);
  const briquesDuBloc = bloque ? briquesPourChemin(bloque) : undefined;
  const manquantes = CAPACITES.filter((c) => !possede(c.id));

  const fin = d.essaiJusquA ? new Date(d.essaiJusquA) : null;
  const joursRestants = fin ? Math.ceil((fin.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <PackageCheck size={15} className="text-bronze-400" /> Mon offre
      </h2>

      {/*
        ⚠ SANS SESSION, LA RAISON DU REFUS N'EST PAS L'OFFRE — C'EST L'ABSENCE
        DE COMPTE, et c'était le premier écran vu par les visiteurs du
        lancement.

        Quelqu'un qui arrive sans compte reçoit `DROIT_REFUSE`, donc
        `statut: "suspendu"`, donc zéro brique. L'écran en concluait trois
        choses fausses à la fois : « compte suspendu », « régularise »,
        « cette brique n'est pas dans ton offre ». Il n'a pas d'offre, il n'a
        pas de compte, et il ne doit rien à personne.

        Le serveur a raison de rendre « suspendu » (c'est son discriminant :
        pas de session, pas de plancher gratuit) ; c'est ici qu'il fallait
        traduire.
      */}
      {!d.session && (
        <div className="mt-3 rounded-lg border border-bronze-700/40 bg-bronze-900/20 px-3 py-2 text-[12px] text-paper">
          <p className="font-medium">Tu n&apos;as pas encore de compte sur cette installation.</p>
          <p className="mt-1 text-paper-dim">
            Ce que tu vois est une démonstration. Crée ton compte — c&apos;est gratuit et sans limite de durée : le
            CRM, le Closer OS, le Cerveau et le pilotage s&apos;ouvrent immédiatement, avec TES données.
          </p>
          <a href="/compte" className="btn-bronze mt-2.5 inline-flex">
            Créer mon compte
          </a>
        </div>
      )}

      {/* Le refus, expliqué. C'est le point important de ce composant. */}
      {bloque && d.session && (
        <div className="mt-3 rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-[12px] text-paper">
          <p className="flex items-start gap-2">
            <Lock size={14} className="mt-0.5 shrink-0 text-signal-amber" />
            <span>
              <strong>{bloque}</strong> n&apos;est pas inclus dans ton offre.
              {briquesDuBloc && briquesDuBloc.length > 0 && (
                <>
                  {" "}Il faut{" "}
                  {briquesDuBloc
                    .map((b) => CAPACITES.find((c) => c.id === b)?.label ?? b)
                    .join(" ou ")}
                  .
                </>
              )}
              {briquesDuBloc?.length === 0 && <> Cette page est réservée à l&apos;équipe.</>}
            </span>
          </p>
        </div>
      )}

      {/* Statut : un essai qui court doit se voir sans avoir à chercher. */}
      {d.statut === "essai" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-bronze-700/40 bg-bronze-900/20 px-3 py-2 text-[12px] text-paper-dim">
          <TimerReset size={14} className="text-bronze-400" />
          Essai en cours{joursRestants != null && <> — il reste {Math.max(0, joursRestants)} jour(s).</>}
        </p>
      )}
      {/* ⚠ `d.session` en plus du statut : sans lui, cette phrase s'adressait à
          des inconnus. Voir le bloc du dessus. */}
      {d.session && d.statut === "suspendu" && (
        <p className="mt-3 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-[12px] text-paper">
          Compte suspendu. Tes données sont intactes — l&apos;accès revient dès la régularisation.
        </p>
      )}

      {/* Ce qui est actif */}
      <ul className="mt-3 space-y-1.5">
        {CAPACITES.filter((c) => possede(c.id)).map((c) => (
          <li key={c.id} className="rounded-lg border border-signal-green/30 bg-signal-green/5 px-3 py-2 text-[12px]">
            <span className="text-paper">{c.label}</span>
            <p className="mt-0.5 text-[11px] text-paper-faint">{c.what}</p>
          </li>
        ))}
        {!d.maitre && d.session && d.bricks.length === 0 && (
          <li className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[12px] text-paper-faint">
            Aucune brique active sur ce compte.
          </li>
        )}
      </ul>

      {/* Ce qui manque — la vente, sans en faire trop */}
      {/* ⚠ On ne VEND pas à quelqu'un qui n'a pas encore de compte : la marche
          suivante est l'inscription gratuite, pas un abonnement. Lui présenter
          la liste des briques payantes avant qu'il ait vu la sienne, c'est
          demander de l'argent avant d'avoir rendu un service. */}
      {!d.maitre && d.session && manquantes.length > 0 && (
        <>
          <h3 className="mt-4 flex items-center gap-2 font-display text-[12.5px] font-semibold text-paper">
            <ShoppingCart size={13} className="text-bronze-400" /> Ce qu&apos;on peut activer en plus
          </h3>
          <ul className="mt-2 space-y-1">
            {manquantes.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[12px]",
                  briquesDuBloc?.includes(c.id as never) && "border-signal-amber/40"
                )}
              >
                <span className="text-paper-dim">{c.label}</span>
                <p className="mt-0.5 text-[11px] text-paper-faint">{c.what}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-paper-faint">
            L&apos;activation se fait au cadrage — on regarde d&apos;abord si tu en as vraiment besoin.
          </p>
        </>
      )}
    </section>
  );
}
