"use client";

import { useMemo } from "react";
import { BadgeCheck, Download, Flame, Gem, HandCoins, Quote, Target } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { eur } from "@/lib/utils";
import { proofStats, renderProofCard } from "@/lib/proof";
import { useCountUp } from "@/lib/use-count-up";

/**
 * Salle des Preuves — la valeur créée par l'OS, démontrée par ses
 * propres données. Rien d'inventé : tout sort du CRM. La « carte de
 * preuve » exportable transforme l'usage en actif marketing (posts,
 * waitlist, rendez-vous) — anonymisée, datée, honnête.
 */
export default function ProofPage() {
  const { prospects, meetings, settings } = useAlpha();
  const s = useMemo(
    () => proofStats(prospects, meetings, settings.commissionPct),
    [prospects, meetings, settings.commissionPct]
  );

  const encaisse = useCountUp(s.encaisse);
  const taxe = useCountUp(s.taxeRendueMensuelle);
  const commission = useCountUp(s.commission);

  const openCard = () => {
    const html = renderProofCard(s, "EAGLEYE CORP");
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const CHANNELS: { key: keyof typeof s.touches; label: string }[] = [
    { key: "email", label: "Emails" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "appel", label: "Appels" },
    { key: "visite", label: "Visites terrain" },
  ];
  const maxTouches = Math.max(1, ...CHANNELS.map((c) => s.touches[c.key]));

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Salle des Preuves</h1>
          <p className="text-sm text-paper-faint">
            La valeur créée, en euros, extraite du CRM. Zéro chiffre inventé — le CRM fait foi.
          </p>
        </div>
        <button className="btn-bronze" onClick={openCard} title="Document anonymisé (aucun nom de client), prêt à capturer pour LinkedIn/X ou à joindre à un email">
          <Download size={15} /> Carte de preuve publique
        </button>
      </header>

      {/* Les 4 vitaux de la preuve */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">
            <HandCoins size={13} /> CA encaissé
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-bronze-400">{eur(Math.round(encaisse))}</p>
          <p className="text-[11px] text-paper-faint">{s.enAttente > 0 ? `+ ${eur(s.enAttente)} facturés en attente` : "clients apportés"}</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">
            <Flame size={13} /> Taxe rendue
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-signal-green">{eur(Math.round(taxe))}<span className="text-sm">/mois</span></p>
          <p className="text-[11px] text-paper-faint">ce que les signés ne perdent plus</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">
            <Gem size={13} /> Commission {settings.commissionPct}%
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-paper">{eur(Math.round(commission))}</p>
          <p className="text-[11px] text-paper-faint">sur le CA encaissé</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">
            <BadgeCheck size={13} /> Clients signés
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-paper">{s.signes}</p>
          <p className="text-[11px] text-paper-faint">
            {s.closingRate !== null ? `closing ${s.closingRate} %` : "aucune issue tranchée encore"}
            {s.cycleJours !== null ? ` · cycle ${s.cycleJours} j` : ""}
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* La machine — touches par canal */}
        <section className="card p-4">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
            <Target size={15} className="text-bronze-400" /> La machine — {s.touchesTotal.toLocaleString("fr-FR")} touches consignées · {s.rdvTenus} RDV tenus
          </p>
          <div className="mt-4 space-y-2.5">
            {CHANNELS.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-[12px]">
                  <span className="text-paper-dim">{c.label}</span>
                  <span className="font-mono text-paper-faint">{s.touches[c.key]}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-bronze-400 to-signal-amber"
                    style={{ width: `${(s.touches[c.key] / maxTouches) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-paper-faint">
            Chaque touche est un contact réel consigné dans une fiche — c&apos;est ça, l&apos;actif : une
            mémoire commerciale complète que personne ne peut te reprendre.
          </p>
        </section>

        {/* Témoignages */}
        <section className="card p-4">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
            <Quote size={15} className="text-bronze-400" /> Témoignages collectés ({s.temoignages.length})
          </p>
          {s.temoignages.length === 0 ? (
            <p className="mt-3 text-[13px] text-paper-dim">
              Aucun pour l&apos;instant — chaque client livré et satisfait est une demande de témoignage à
              faire (la routine te le rappellera après livraison). Un témoignage vaut dix arguments.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {s.temoignages.slice(0, 4).map((t, i) => (
                <li key={i} className="border-l-2 border-bronze-400 pl-3">
                  <p className="text-[13px] italic leading-relaxed text-paper-dim">« {t.text} »</p>
                  <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper-faint">
                    — {t.company}
                    {t.at ? ` · ${new Date(t.at).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-3.5 py-2.5 text-[12px] leading-relaxed text-bronze-300">
            La carte de preuve publique n&apos;utilise jamais un nom de client — uniquement des agrégats
            datés, et un témoignage seulement avec accord écrit.
          </p>
        </section>
      </div>
    </div>
  );
}
