"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Clock, Minus, Phone, ShieldCheck, X } from "lucide-react";
import { BRICKS, PACK_SETUP_HT, PACK_MONTHLY_HT, quoteBricks } from "@/lib/bricks";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * VITRINE PUBLIQUE — la page qui vend.
 *
 * L'ordre est imposé et c'est lui qui fait signer :
 *   1. la LIBERTÉ (ce que ça change dans sa vie), pas la feature ;
 *   2. « est-ce qu'on matche ? » — l'auto-disqualification AVANT le prix.
 *      Une page qui n'écarte personne ne convainc personne ;
 *   3. pourquoi son cerveau doit acheter (le coût de l'inaction, pas la
 *      promesse de gain) ;
 *   4. le prix — seulement ici ;
 *   5. le cadrage OBLIGATOIRE : on ne vend pas sans avoir regardé son cas.
 *
 * Publique = hors porte SITE_PASSWORD (voir middleware PUBLIC_PREFIXES).
 * Aucune donnée client ne transite ici : c'est une page de vente, pas l'app.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function VitrinePage() {
  const [picked, setPicked] = useState<string[]>([]);
  const quote = useMemo(() => quoteBricks(picked), [picked]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <main className="mx-auto max-w-4xl space-y-16 px-5 py-16">
      {/* ── 1. LA LIBERTÉ ── */}
      <section className="space-y-5">
        <p className="text-[12px] uppercase tracking-[0.2em] text-bronze-400">EAGLEYE CORP · Lyon</p>
        <h1 className="font-display text-4xl font-bold leading-tight text-paper sm:text-5xl">
          Votre machine de vente tourne.
          <br />
          <span className="text-bronze-400">Vous, vous vivez.</span>
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-paper-dim">
          Pas un logiciel de plus à apprendre. Une machine qui trouve vos clients, les appelle, les
          relance, remplit votre agenda — pendant que vous êtes sur le terrain, en famille, ou en
          train de dormir. Vous ne récupérez pas du temps : vous récupérez le choix de ce que vous en
          faites.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            "Plus une seule demande qui tombe dans le vide",
            "Le suivi ne dépend plus de votre mémoire",
            "Vous arrivez au rendez-vous en sachant tout",
          ].map((x) => (
            <li key={x} className="flex items-start gap-2 text-[13px] text-paper-dim">
              <Check size={15} className="mt-0.5 shrink-0 text-signal-green" />
              {x}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 2. EST-CE QU'ON MATCHE ? (avant le prix) ── */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-paper">D&apos;abord : est-ce qu&apos;on matche ?</h2>
        <p className="text-[14px] text-paper-dim">
          On ne travaille pas avec tout le monde, et ce n&apos;est pas une posture. Si vous n&apos;êtes pas
          dans la colonne de gauche, on vous le dira au premier appel — ça nous évitera de vous faire
          perdre votre temps.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-signal-green/30 bg-signal-green/5 p-5">
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-signal-green">
              <Check size={16} /> C&apos;est pour vous si
            </p>
            <ul className="mt-3 space-y-2 text-[13px] text-paper-dim">
              {[
                "Vous avez déjà des clients — on amplifie, on ne part pas de zéro.",
                "Des demandes arrivent et vous n'arrivez pas à toutes les traiter.",
                "Votre suivi tient sur votre tête, un carnet, ou rien.",
                "Vous pouvez décider seul, ou avec une personne.",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <Minus size={13} className="mt-1 shrink-0 text-signal-green" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-signal-red/30 bg-signal-red/5 p-5">
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-signal-red">
              <X size={16} /> Ce n&apos;est pas pour vous si
            </p>
            <ul className="mt-3 space-y-2 text-[13px] text-paper-dim">
              {[
                "Vous cherchez le moins cher du marché — ce ne sera jamais nous.",
                "Vous voulez « tester » sans changer votre façon de travailler.",
                "Vous êtes déjà plein et vous refusez du monde.",
                "Vous attendez des clients sans jamais décrocher le téléphone.",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <Minus size={13} className="mt-1 shrink-0 text-signal-red" /> {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 3. POURQUOI ACHETER (le coût de l'inaction) ── */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-paper">
          Ce que ça coûte de ne rien changer
        </h2>
        <p className="max-w-2xl text-[14px] leading-relaxed text-paper-dim">
          Un client qui n&apos;obtient pas de réponse appelle le suivant dans les cinq minutes. Il ne
          rappelle pas, il ne vous en veut pas, et vous ne saurez jamais qu&apos;il a existé. C&apos;est
          la perte la plus chère qui soit : celle qu&apos;on ne voit pas passer.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Aujourd'hui", d: "Vous décrochez quand vous pouvez. Le reste part chez le concurrent." },
            { t: "Dans 6 mois", d: "Le même volume, la même fatigue, et un concurrent équipé qui répond 24/7." },
            { t: "Avec la machine", d: "Chaque demande est prise, qualifiée, relancée. Vous ne traitez que ce qui mérite votre voix." },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-line/50 bg-surface/30 p-4">
              <p className="font-display text-[13px] font-semibold text-bronze-400">{x.t}</p>
              <p className="mt-1 text-[13px] text-paper-dim">{x.d}</p>
            </div>
          ))}
        </div>
        <p className="text-[13px] italic text-paper-faint">
          On ne vous promet pas un chiffre. On mesure le vôtre pendant le cadrage — et si la perte est
          négligeable, on vous le dira.
        </p>
      </section>

      {/* ── 4. LE PRIX ── */}
      <section className="space-y-5">
        <h2 className="font-display text-2xl font-bold text-paper">Le prix</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-bronze-500/60 bg-bronze-900/15 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-bronze-400">Le pack complet</p>
            <p className="mt-2 font-display text-4xl font-bold text-paper">
              10 000 <span className="text-2xl">€ HT</span>
            </p>
            <p className="text-[13px] text-paper-dim">
              d&apos;installation, puis {PACK_MONTHLY_HT.toLocaleString("fr-FR")} € HT/mois
            </p>
            <p className="mt-3 text-[13px] text-paper-dim">
              Toutes les briques. Installées, paramétrées, avec vos équipes formées. C&apos;est
              l&apos;offre qui va le plus loin, et la seule où l&apos;on prend tout en charge.
            </p>
          </div>

          <div className="rounded-2xl border border-line/50 bg-surface/30 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-paper-faint">Ou en partenariat</p>
            <p className="mt-2 font-display text-4xl font-bold text-paper">
              30 <span className="text-2xl">%</span>
            </p>
            <p className="text-[13px] text-paper-dim">+ les frais d&apos;installation, sur devis</p>
            <p className="mt-3 text-[13px] text-paper-dim">
              On se rémunère sur ce que la machine vous rapporte. Installation locale ou cloud, chiffrée
              après le cadrage — jamais un forfait sorti d&apos;un catalogue.
            </p>
          </div>
        </div>

        {/* Prix à la carte — le sélecteur qui fait l'addition */}
        <div className="rounded-2xl border border-line/50 p-5">
          <h3 className="font-display text-sm font-semibold text-paper">
            Ou seulement ce dont vous avez besoin
          </h3>
          <p className="mt-1 text-[13px] text-paper-dim">
            Chaque brique se prend seule. Cochez ce qui vous parle — l&apos;addition se fait toute seule.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {BRICKS.map((b) => {
              const on = picked.includes(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    on ? "border-bronze-500/70 bg-bronze-900/20" : "border-line/50 hover:border-bronze-700/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-[13px] font-semibold text-paper">{b.label}</span>
                    {on && <Check size={14} className="shrink-0 text-signal-green" />}
                  </div>
                  <p className="mt-1 text-[12px] text-paper-faint">{b.what}</p>
                  <p className="mt-1.5 text-[12px] text-bronze-400">
                    {b.setupHT.toLocaleString("fr-FR")} € HT + {b.monthlyHT} € HT/mois
                  </p>
                </button>
              );
            })}
          </div>

          {picked.length > 0 && (
            <div className="mt-4 rounded-xl border border-bronze-700/40 bg-bronze-900/10 p-4">
              <p className="text-[14px] text-paper">
                <strong>{quote.setupHT.toLocaleString("fr-FR")} € HT</strong> d&apos;installation, puis{" "}
                <strong>{quote.monthlyHT.toLocaleString("fr-FR")} € HT</strong>/mois
              </p>
              <p className="mt-1.5 text-[13px] text-paper-dim">{quote.recommendation}</p>
              {quote.recommendPack && (
                <p className="mt-2 text-[13px] text-bronze-400">
                  Le pack complet est à {PACK_SETUP_HT.toLocaleString("fr-FR")} € HT.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. LE CADRAGE OBLIGATOIRE ── */}
      <section className="space-y-4 rounded-2xl border border-bronze-700/40 bg-bronze-900/10 p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-paper">
          <ShieldCheck size={22} className="text-bronze-400" /> Le cadrage est obligatoire
        </h2>
        <p className="text-[14px] leading-relaxed text-paper-dim">
          On ne vend pas un devis à l&apos;aveugle. Avant tout chiffrage, on regarde votre situation
          réelle : combien de demandes vous perdez, comment vous les traitez aujourd&apos;hui, et ce
          qu&apos;une machine changerait vraiment chez vous. Visio, appel ou SMS — vous choisissez.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            { i: <Clock size={15} />, t: "Une date et une heure décidées ensemble — pas un « on se rappelle »." },
            { i: <Phone size={15} />, t: "Visio, téléphone ou SMS : le canal qui vous arrange." },
            { i: <ShieldCheck size={15} />, t: "À la fin, on vous dit si c'est pertinent. Y compris quand ça ne l'est pas." },
          ].map((x) => (
            <li key={x.t} className="flex items-start gap-2 text-[13px] text-paper-dim">
              <span className="mt-0.5 shrink-0 text-bronze-400">{x.i}</span>
              {x.t}
            </li>
          ))}
        </ul>
        <a
          href="mailto:contact@eagleyecorp.fr?subject=Cadrage%20Alpha%20Sales%20OS&body=Bonjour%2C%0A%0AJe%20souhaite%20caler%20un%20cadrage.%0A%0AMon%20activit%C3%A9%20%3A%0AMa%20ville%20%3A%0ACe%20qui%20me%20fait%20perdre%20le%20plus%20de%20clients%20aujourd%27hui%20%3A%0AMes%20disponibilit%C3%A9s%20%3A%0A%0AMerci."
          className="inline-flex items-center gap-2 rounded-xl bg-bronze-600 px-5 py-3 font-display text-[14px] font-semibold text-paper transition-colors hover:bg-bronze-500"
        >
          Demander un cadrage <ArrowRight size={16} />
        </a>
        <p className="text-[12px] text-paper-faint">
          contact@eagleyecorp.fr — réponse sous 24 h ouvrées.
        </p>
      </section>

      <footer className="border-t border-line/40 pt-6 text-[12px] text-paper-faint">
        EAGLEYE CORP · Lyon · Tous les prix sont indiqués hors taxes. Les estimations de gain ne sont
        jamais des garanties : elles sont calculées sur vos propres chiffres, pendant le cadrage.
      </footer>
    </main>
  );
}
