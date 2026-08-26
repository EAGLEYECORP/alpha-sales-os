"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Check, CircleDot, User, Wrench } from "lucide-react";
import { offreParId } from "@/lib/offres-publiques";
import { parcours, ESSAI_JOURS } from "@/lib/client-onboarding";
import { cn, dateFr } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI SE PASSE JUSTE APRÈS LE PAIEMENT — l'étape qui n'existait pas.
 *
 * Stripe renvoyait le client sur `/compte?abonnement=ok`, et cette page ne
 * lisait AUCUN paramètre d'URL. Résultat : il payait, revenait sur un écran
 * de gestion de compte identique à celui d'avant, et devait deviner tout
 * seul ce qui venait de se passer et par où commencer.
 *
 * C'est le pire moment possible pour laisser quelqu'un sans réponse. Il vient
 * de dépenser de l'argent sur la foi d'une démo ; les dix minutes qui suivent
 * décident s'il ouvre l'app demain ou s'il attend « qu'on le rappelle ».
 *
 * Le module `parcours()` existait déjà et n'était appelé de nulle part sur ce
 * chemin : c'était encore du code juste, mal raccordé — le mode d'échec
 * dominant de ce projet.
 *
 * ⚠ CE PANNEAU NE PRÉTEND PAS QUE LE PAIEMENT EST ENCAISSÉ. L'URL de retour
 * est une redirection navigateur, pas une preuve : seul le webhook Stripe
 * confirme. On dit donc « commande envoyée » et on affiche la suite, sans
 * jamais écrire « paiement confirmé » — un message faux ici se paie en
 * confiance perdue le jour où le prélèvement échoue.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ApresAchat() {
  const params = useSearchParams();
  const achat = params.get("achat");
  const offreId = params.get("offre") ?? "";
  const offre = offreParId(offreId);

  // `now` figé au montage : sans ça, chaque rendu redécale les dates.
  const plan = useMemo(
    () => (offre ? parcours(new Date().toISOString(), offre.capacites, [], { essai: offre.id === "essai" }) : null),
    [offre]
  );

  if (!achat || !offre) return null;

  if (achat === "annule") {
    return (
      <section className="card border-signal-amber/40 p-4">
        <p className="flex items-center gap-2 text-[13px] text-signal-amber">
          <AlertTriangle size={15} className="shrink-0" />
          Paiement interrompu — rien n&apos;a été débité. L&apos;offre « {offre.nom} » est toujours disponible.
        </p>
        <p className="mt-1.5 text-[12px] text-paper-faint">
          Si quelque chose t&apos;a arrêté, dis-le : c&apos;est plus utile qu&apos;un abandon silencieux.{" "}
          <a className="text-bronze-400 hover:underline" href="mailto:contact@eagleyecorp.fr?subject=Question%20avant%20de%20payer">
            Poser la question
          </a>
        </p>
      </section>
    );
  }

  const premieres = plan?.etapes.slice(0, 4) ?? [];

  return (
    <section className="card border-signal-green/40 bg-signal-green/5 p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-signal-green">
        <Check size={16} /> Commande envoyée — {offre.nom}
      </h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-paper-dim">
        {/* Formulation exacte : la redirection n'est pas une confirmation
            d'encaissement. Le webhook Stripe l'est. */}
        Stripe traite le paiement ; la confirmation arrive par email. Pendant ce temps, voilà la mise en route —
        elle commence maintenant, pas à la confirmation.
      </p>

      {offre.appelsInclus !== null && (
        <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11.5px] leading-relaxed text-paper-dim">
          <strong className="text-paper">{offre.appelsInclus} appels inclus.</strong> {offre.auDela}
        </p>
      )}

      {plan && (
        <>
          <h3 className="mt-3.5 text-[11px] uppercase tracking-wide text-paper-faint">
            Les premières étapes — qui fait quoi
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {premieres.map((e) => (
              <li key={e.id} className="flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                <CircleDot size={12} className={cn("mt-1 shrink-0", e.bloquant ? "text-signal-amber" : "text-bronze-400")} />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-paper">
                    {e.titre}
                    <span
                      className={cn(
                        "ml-2 chip",
                        e.cote === "nous" ? "border-bronze-700/50 text-bronze-400" : "border-signal-blue/40 text-signal-blue"
                      )}
                    >
                      {e.cote === "nous" ? (
                        <>
                          <Wrench size={10} /> nous
                        </>
                      ) : (
                        <>
                          <User size={10} /> toi
                        </>
                      )}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-paper-faint">
                    <CalendarClock size={11} /> visé le {dateFr(e.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {plan.etapes.length > premieres.length && (
            <p className="mt-1.5 text-[11px] text-paper-faint">
              … et {plan.etapes.length - premieres.length} autres étapes, filtrées sur ce que tu viens de prendre.
            </p>
          )}

          {offre.id === "essai" && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-signal-amber">
              ⚠ L&apos;essai a une fin : il faut qu&apos;un résultat existe sous {ESSAI_JOURS} jours. C&apos;est court, et
              c&apos;est le but — un essai qui traîne ne prouve rien.
            </p>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="btn-bronze px-3.5 py-1.5 text-[12px]" href="/demarrage">
          Ouvrir la prise en main <ArrowRight size={13} />
        </Link>
        <Link className="btn-ghost px-3 py-1.5 text-[12px]" href="/aujourdhui">
          Voir ma journée
        </Link>
      </div>
    </section>
  );
}
