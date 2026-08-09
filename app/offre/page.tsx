"use client";

import { useMemo, useState } from "react";
import { BadgeEuro, Check, Crown, Handshake, TrendingUp } from "lucide-react";
import { cn, eur } from "@/lib/utils";
import { calc, defaultPricing, type CalcInput } from "@/lib/pricing";
import { useAlpha } from "@/lib/store";

export default function OffrePage() {
  // Tarifs du compte (white-label) — défaut = modèle EAGLEYE.
  const pricing = useAlpha((s) => s.settings.pricing) ?? defaultPricing;
  const SETUP_FEE = pricing.setupFee;
  const REV_SHARE = pricing.revSharePct / 100;
  const TIERS = pricing.tiers;
  const [input, setInput] = useState<CalcInput>({
    prospects: 500,
    replyRate: 8,
    closeRate: 25,
    avgSale: 6000,
  });
  const r = useMemo(() => calc(input, pricing), [input, pricing]);
  const set = (patch: Partial<CalcInput>) => setInput((s) => ({ ...s, ...patch }));

  return (
    <div className="space-y-6 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">Offre &amp; Tarifs</h1>
        <p className="text-sm text-paper-faint">
          Outreach ultra-qualifié, exécuté pour vous. On ne remplit pas une base — on remplit un agenda.
        </p>
      </header>

      {/* Deux modèles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card relative overflow-hidden p-5">
          <span className="absolute right-4 top-4 chip border-gold/50 bg-gold/10 text-bronze-400">Recommandé</span>
          <Handshake size={22} className="text-bronze-400" />
          <h2 className="mt-2 font-display text-lg font-bold text-paper">Performance</h2>
          <p className="mt-1 text-[13px] text-paper-dim">
            Frais de setup + <strong className="text-bronze-400">{Math.round(REV_SHARE * 100)} %</strong> du CA généré via nous.
            Incitations 100 % alignées : on gagne quand vous gagnez.
          </p>
          <p className="mt-3 font-display text-3xl font-extrabold text-paper">
            {eur(SETUP_FEE)} <span className="text-base font-normal text-paper-faint">setup</span>
            <span className="mx-2 text-paper-faint">+</span>
            {Math.round(REV_SHARE * 100)}% <span className="text-base font-normal text-paper-faint">du CA</span>
          </p>
          <ul className="mt-4 space-y-1.5">
            {["Zéro risque : payé à la performance", "Agenda rempli de RDV qualifiés", "On porte le coût de l'acquisition", "Reporting transparent du CA attribué"].map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <BadgeEuro size={22} className="text-bronze-400" />
          <h2 className="mt-2 font-display text-lg font-bold text-paper">Abonnement</h2>
          <p className="mt-1 text-[13px] text-paper-dim">
            Frais de setup + mensuel selon le volume de prospects. Coût fixe et prévisible, vous gardez 100 % de votre CA.
          </p>
          <p className="mt-3 font-display text-3xl font-extrabold text-paper">
            {eur(SETUP_FEE)} <span className="text-base font-normal text-paper-faint">setup</span>
            <span className="mx-2 text-paper-faint">+</span>
            dès {eur(TIERS[0].monthly!)}<span className="text-base font-normal text-paper-faint">/mois</span>
          </p>
          <ul className="mt-4 space-y-1.5">
            {["Budget maîtrisé, sans variable", "Vous gardez 100 % des ventes", "Montée en volume par paliers", "Idéal marges faibles / gros volumes"].map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
          </ul>
        </section>
      </div>

      {/* Paliers d'abonnement */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-paper-faint">Paliers d&apos;abonnement</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => {
            const active = t.id === r.tier.id;
            return (
              <div key={t.id} className={cn("card card-hover flex flex-col p-4", active && "ring-1 ring-gold/60")}>
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold text-paper">{t.name}</p>
                  {t.id === "enterprise" && <Crown size={16} className="text-bronze-400" />}
                  {active && <span className="chip border-gold/50 text-bronze-400">votre volume</span>}
                </div>
                <p className="mt-1 text-[11px] text-paper-faint">{t.blurb}</p>
                <p className="mt-3 font-display text-2xl font-extrabold text-paper">
                  {t.monthly === null ? "Sur devis" : <>{eur(t.monthly)}<span className="text-sm font-normal text-paper-faint">/mois</span></>}
                </p>
                <ul className="mt-3 flex-1 space-y-1">
                  {t.features.map((f) => (
                    <Feature key={f} small>{f}</Feature>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Calculateur */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-bronze-400" />
          <h2 className="font-display text-base font-bold text-paper">Calculateur de ROI</h2>
        </div>
        <p className="mt-1 text-[12px] text-paper-faint">
          Projetez le CA généré et comparez les deux modèles. À utiliser en RDV : la décision devient une évidence chiffrée.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Entrées */}
          <div className="space-y-4">
            <Slider label="Prospects contactés / mois" value={input.prospects} min={50} max={5000} step={50} onChange={(v) => set({ prospects: v })} fmt={(v) => v.toLocaleString("fr-FR")} />
            <Slider label="Taux de RDV obtenu" value={input.replyRate} min={1} max={30} step={1} onChange={(v) => set({ replyRate: v })} fmt={(v) => `${v} %`} />
            <Slider label="Taux de closing (RDV → vente)" value={input.closeRate} min={5} max={70} step={1} onChange={(v) => set({ closeRate: v })} fmt={(v) => `${v} %`} />
            <Slider label="Valeur moyenne d'une vente" value={input.avgSale} min={500} max={30000} step={500} onChange={(v) => set({ avgSale: v })} fmt={(v) => eur(v)} />
          </div>

          {/* Sorties */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="RDV / mois" value={Math.round(r.meetings).toLocaleString("fr-FR")} />
              <Metric label="Ventes / mois" value={r.sales.toFixed(1)} />
              <Metric label="CA généré / mois" value={eur(Math.round(r.revenue))} accent />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ModelCard
                title="Modèle Performance"
                highlight={r.cheaperForClient === "performance"}
                rows={[
                  ["Notre part (30 %/mois)", eur(Math.round(r.perfCut))],
                  ["Vous gardez / mois", eur(Math.round(r.clientKeepsPerf))],
                  ["Votre coût an 1", eur(Math.round(r.perfYear1))],
                ]}
                foot={`ROI client : ${(r.clientRoiPerf * 100).toFixed(0)} %`}
              />
              <ModelCard
                title={`Abonnement — ${r.tier.name}`}
                highlight={r.cheaperForClient === "abonnement"}
                rows={[
                  ["Mensuel", r.subMonthly === null ? "Sur devis" : eur(r.subMonthly)],
                  ["Vous gardez / mois", eur(Math.round(r.revenue))],
                  ["Votre coût an 1", r.subYear1 === null ? "Sur devis" : eur(Math.round(r.subYear1))],
                ]}
                foot={r.subYear1 === null ? "Volume Enterprise — sur devis" : `Vous gardez 100 % du CA`}
              />
            </div>

            <div className="rounded-lg border border-bronze-700/50 bg-bronze-900/20 px-4 py-3 text-[13px] text-paper-dim">
              {r.cheaperForClient === "devis" ? (
                <>À ce volume, on passe en <strong className="text-paper">Enterprise (sur devis)</strong> — souvent un mix setup + performance plafonnée.</>
              ) : r.cheaperForClient === "égal" ? (
                <>Les deux modèles se valent à ce volume — on choisit selon votre préférence risque/prévisibilité.</>
              ) : r.cheaperForClient === "performance" ? (
                <>À votre volume, le <strong className="text-paper">modèle Performance</strong> est le plus avantageux pour vous — et on ne gagne que si vous gagnez.</>
              ) : (
                <>À votre volume, l&apos;<strong className="text-paper">abonnement</strong> vous revient moins cher et vous gardez 100 % du CA.</>
              )}
            </div>
          </div>
        </div>
      </section>

      <p className="mx-auto max-w-2xl text-center text-[11px] text-paper-faint">
        <strong className="text-paper-dim">Estimation, pas une garantie</strong> — basée sur les hypothèses saisies, sans
        valeur d&apos;engagement. On garantit le procédé (zéro lead perdu, 24/7), jamais un montant de CA. Chiffres calés
        sur les standards du marché ; devis personnalisé selon secteur et volume.
      </p>
    </div>
  );
}

function Feature({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <li className={cn("flex items-start gap-2", small ? "text-[11px] text-paper-faint" : "text-[13px] text-paper-dim")}>
      <Check size={small ? 12 : 14} className="mt-0.5 shrink-0 text-signal-green" /> {children}
    </li>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] text-paper-dim">{label}</label>
        <span className="font-mono text-sm font-medium text-bronze-400">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-bronze-500" />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-center">
      <p className={cn("font-mono text-lg font-bold", accent ? "text-bronze-400" : "text-paper")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-paper-faint">{label}</p>
    </div>
  );
}

function ModelCard({
  title, rows, foot, highlight,
}: {
  title: string; rows: [string, string][]; foot: string; highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-4", highlight ? "border-gold/60 bg-gold/5" : "border-ink-700 bg-ink-900")}>
      <p className="font-display text-sm font-semibold text-paper">{title}</p>
      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1 text-paper-faint">{k}</td>
              <td className="py-1 text-right font-mono text-paper">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-bronze-400">{foot}</p>
    </div>
  );
}
