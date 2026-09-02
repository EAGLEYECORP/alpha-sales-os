"use client";

import { useMemo, useState } from "react";
import { BadgeEuro, Check, Crown, Handshake, Layers, PhoneCall, Rocket, TrendingUp } from "lucide-react";
import { cn, eur } from "@/lib/utils";
import { calc, calcSaas, defaultPricing, defaultSaasInput, type CalcInput, type SaasEconInput } from "@/lib/pricing";
import { calcTelephony, defaultTelephony, type TelephonyInput } from "@/lib/telephony";
import { useAlpha } from "@/lib/store";
import { CalculateurComplet } from "@/components/offre/calculateur-complet";
import { PageHeader } from "@/components/ui/page-header";

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

  // Mode « vendre Alpha Sales OS » (SaaS) — l'économie de TON business, pas
  // l'offre montrée au prospect. Interne, pour décider et pour la démo.
  /**
   * ⚠ « toutes » est le mode par DÉFAUT depuis qu'il existe.
   *
   * L'ancien écran d'accueil ne chiffrait qu'un seul modèle sur trois paliers
   * — les petites offres. Les deux plus grosses du portefeuille (le chantier
   * Nuwacom, l'OS personnalisé) n'étaient chiffrables nulle part. Laisser
   * l'ancien en premier revenait à continuer de ne montrer que le petit bout.
   */
  const [mode, setMode] = useState<"toutes" | "client" | "saas">("toutes");

  return (
    <div className="page">
      <PageHeader
        title={<>Offre &amp; Tarifs</>}
        subtitle={
          /* ⚠ La phrase disait « les dix offres … sur les trois comptes ». Les
             deux nombres étaient FAUX : le portefeuille n'a plus que deux
             comptes depuis le 02/09/2026, et le catalogue se modifie dans
             Réglages sans redéployer. Un compteur écrit à la main dans une
             phrase périme au commit suivant — c'est la règle que
             `tests/docs-chiffres.test.ts` applique déjà à la documentation.
             On décrit, on ne compte pas. */
          mode === "toutes"
            ? "Tout le portefeuille, compte par compte. Ce que le client paie, et ce qui nous revient — jamais confondus."
            : mode === "client"
              ? "Outreach ultra-qualifié, exécuté pour vous. On ne remplit pas une base — on remplit un agenda."
              : "L'économie de ton business : ce que rapporte de vendre Alpha Sales OS. CAC · LTV · break-even · cash-flow."
        }
        actions={
          <div className="panel flex p-0.5 text-[12px]">
            <button
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition", mode === "toutes" ? "bg-bronze-600 text-white" : "text-paper-faint hover:text-paper")}
              onClick={() => setMode("toutes")}
            >
              <Layers size={13} /> Toutes les offres
            </button>
            <button
              className={cn("rounded-md px-3 py-1.5 font-medium transition", mode === "client" ? "bg-bronze-600 text-white" : "text-paper-faint hover:text-paper")}
              onClick={() => setMode("client")}
            >
              ROI client
            </button>
            <button
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition", mode === "saas" ? "bg-bronze-600 text-white" : "text-paper-faint hover:text-paper")}
              onClick={() => setMode("saas")}
            >
              <Rocket size={13} /> Vendre Alpha Sales OS
            </button>
          </div>
        }
      />

      {mode === "toutes" && <CalculateurComplet />}

      {mode === "saas" && <SaasEconomics />}

      {mode === "client" && <>
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

      {/*
        ⚠ « CHIFFRES CALÉS SUR LES STANDARDS DU MARCHÉ » — LU EN OUVRANT L'ÉCRAN.

        Cette phrase-là est montrée à un prospect, dans l'écran qui sert à
        décider. Les « chiffres » en question sont les quatre curseurs :
        prospects, taux de RDV, taux de closing, panier moyen. Ce sont des
        HYPOTHÈSES que l'opérateur déplace — pas des moyennes constatées, ni
        chez nous (zéro vente), ni ailleurs (aucune source attachée).

        Le reste du paragraphe était honnête ; c'est ce membre de phrase qui
        transformait une projection en donnée de marché. Un prospect qui le
        vérifie ne perd pas confiance dans la ligne, il la perd dans le devis.

        Les valeurs de départ (500 · 8 % · 25 % · 6 000 €) restent — il faut
        bien poser le curseur quelque part — mais elles sont désormais dites
        pour ce qu'elles sont : un point de départ à remplacer par SES chiffres.
      */}
      <p className="mx-auto max-w-2xl text-center text-[11px] text-paper-faint">
        <strong className="text-paper-dim">Estimation, pas une garantie</strong> — les quatre curseurs sont des
        <strong className="text-paper-dim"> hypothèses</strong>, pas des moyennes constatées : remplacez-les par vos
        chiffres, c&apos;est là que le calcul devient utile. On garantit le procédé (zéro lead perdu, 24/7), jamais un
        montant de CA. Devis personnalisé selon secteur et volume.
      </p>
      </>}
    </div>
  );
}

function SaasEconomics() {
  const [i, setI] = useState<SaasEconInput>(defaultSaasInput);
  const s = useMemo(() => calcSaas(i), [i]);
  const set = (patch: Partial<SaasEconInput>) => setI((prev) => ({ ...prev, ...patch }));

  const ratioTone = s.ltvCac >= 3 ? "text-signal-green" : s.ltvCac >= 1 ? "text-bronze-400" : "text-signal-red";

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-bronze-400" />
          <h2 className="font-display text-base font-bold text-paper">Économie « je vends Alpha Sales OS »</h2>
        </div>
        <p className="mt-1 text-[12px] text-paper-faint">
          Bouge le prix et le nombre de clients : MRR, CAC, LTV, break-even et cash-flow se recalculent. Les hypothèses de
          coût (ton temps, la liste, l&apos;infra) sont ajustables — c&apos;est ton tableau de bord de décision.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Entrées */}
          <div className="space-y-4">
            <Slider label="Prix / client / mois" value={i.pricePerMonth} min={200} max={6000} step={50} onChange={(v) => set({ pricePerMonth: v })} fmt={(v) => eur(v)} />
            <Slider label="Setup / client (one-shot)" value={i.setupFee} min={0} max={30000} step={500} onChange={(v) => set({ setupFee: v })} fmt={(v) => eur(v)} />
            <Slider label="Clients visés" value={i.clients} min={1} max={100} step={1} onChange={(v) => set({ clients: v })} fmt={(v) => String(v)} />
            <Slider label="Rétention moyenne" value={i.retentionMonths} min={1} max={48} step={1} onChange={(v) => set({ retentionMonths: v })} fmt={(v) => `${v} mois`} />
            <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-paper-faint">Hypothèses de coût</p>
              <div className="space-y-3">
                <Slider label="Heures de ton temps / client signé" value={i.hoursPerClient} min={0} max={40} step={0.5} onChange={(v) => set({ hoursPerClient: v })} fmt={(v) => `${v} h`} />
                <Slider label="Valeur de ton heure" value={i.hourValue} min={0} max={300} step={5} onChange={(v) => set({ hourValue: v })} fmt={(v) => eur(v)} />
                <Slider label="Coût acquisition hors-temps / client" value={i.acqCostPerClient} min={0} max={500} step={5} onChange={(v) => set({ acqCostPerClient: v })} fmt={(v) => eur(v)} />
                <Slider label="Infra fixe / mois" value={i.fixedMonthly} min={0} max={1000} step={10} onChange={(v) => set({ fixedMonthly: v })} fmt={(v) => eur(v)} />
              </div>
            </div>
          </div>

          {/* Sorties */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="MRR" value={eur(Math.round(s.mrr))} accent />
              <Metric label="ARR" value={eur(Math.round(s.arr))} />
              <Metric label="Cash mois 1" value={eur(Math.round(s.month1Cash))} accent />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel p-4">
                <p className="font-display text-sm font-semibold text-paper">Unit economics</p>
                <table className="mt-2 w-full text-[13px]">
                  <tbody>
                    <tr><td className="py-1 text-paper-faint">CAC / client</td><td className="py-1 text-right font-mono text-paper">{eur(Math.round(s.cacPerClient))}</td></tr>
                    <tr><td className="py-1 text-paper-faint">dont ton temps</td><td className="py-1 text-right font-mono text-paper-dim">{Math.round(s.timeShareOfCac * 100)} %</td></tr>
                    <tr><td className="py-1 text-paper-faint">LTV / client</td><td className="py-1 text-right font-mono text-paper">{eur(Math.round(s.ltvPerClient))}</td></tr>
                    <tr><td className="py-1 text-paper-faint">LTV : CAC</td><td className={cn("py-1 text-right font-mono font-bold", ratioTone)}>{s.ltvCac.toFixed(1)} : 1</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="panel p-4">
                <p className="font-display text-sm font-semibold text-paper">Seuils</p>
                <table className="mt-2 w-full text-[13px]">
                  <tbody>
                    <tr><td className="py-1 text-paper-faint">Break-even infra</td><td className="py-1 text-right font-mono text-paper">{s.breakEvenClientsInfra <= 0 ? "—" : `${Math.ceil(s.breakEvenClientsInfra)} client${Math.ceil(s.breakEvenClientsInfra) > 1 ? "s" : ""}`}</td></tr>
                    <tr><td className="py-1 text-paper-faint">Investissement-temps</td><td className="py-1 text-right font-mono text-paper">{eur(Math.round(s.timeInvestTotal))}</td></tr>
                    <tr><td className="py-1 text-paper-faint">Remboursé en</td><td className="py-1 text-right font-mono text-paper">{s.timePaybackMonths <= 0 ? "—" : `${s.timePaybackMonths.toFixed(1)} mois`}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className={cn("rounded-lg border px-4 py-3 text-[13px]", s.ltvCac >= 3 ? "border-signal-green/40 bg-signal-green/5 text-paper-dim" : "border-bronze-700/50 bg-bronze-900/20 text-paper-dim")}>
              {s.ltvCac >= 3 ? (
                <>Ratio <strong className="text-paper">LTV:CAC de {s.ltvCac.toFixed(1)}:1</strong> — sain (cible &gt; 3:1). Ton CAC est à <strong className="text-paper">{Math.round(s.timeShareOfCac * 100)} %</strong> du temps : c&apos;est exactement ce qu&apos;Alpha Sales OS réduit.</>
              ) : (
                <>Ratio <strong className="text-paper">LTV:CAC de {s.ltvCac.toFixed(1)}:1</strong> — sous la cible de 3:1. Monte le prix ou la rétention, ou baisse le temps par client (ce que l&apos;OS automatise).</>
              )}
            </div>
          </div>
        </div>
      </section>

      <TelephonyBasis monthlyPrice={i.pricePerMonth} />

      <p className="mx-auto max-w-2xl text-center text-[11px] text-paper-faint">
        <strong className="text-paper-dim">Projection interne, pas une promesse</strong> — 10 clients ≈ {eur(Math.round(defaultSaasInput.setupFee * defaultSaasInput.clients))} d&apos;installation (la preuve de concept) + {eur(Math.round(defaultSaasInput.pricePerMonth * defaultSaasInput.clients))}/mois de récurrent. Le mensuel est calé sur le volume/téléphonie (ci-dessus) et remplace un commercial au téléphone. Les gros paliers viennent des revendeurs.
      </p>
    </div>
  );
}

function TelephonyBasis({ monthlyPrice }: { monthlyPrice: number }) {
  const [t, setT] = useState<TelephonyInput>(defaultTelephony);
  const r = useMemo(() => calcTelephony(t), [t]);
  const set = (patch: Partial<TelephonyInput>) => setT((prev) => ({ ...prev, ...patch }));
  const margin = monthlyPrice - r.totalCost;
  const marginPct = monthlyPrice > 0 ? margin / monthlyPrice : 0;

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <PhoneCall size={18} className="text-bronze-400" />
        <h2 className="font-display text-base font-bold text-paper">Base de prix — volume &amp; téléphonie</h2>
      </div>
      <p className="mt-1 text-[12px] text-paper-faint">
        Le mensuel n&apos;est pas au doigt mouillé : il tient sur le <strong className="text-paper-dim">coût réel des appels</strong>.
        Exemple type : <strong className="text-paper-dim">1 000 prospects en 10 jours, 5 relances</strong> = 5 000 tentatives.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Slider label="Prospects (uniques)" value={t.prospects} min={100} max={10000} step={100} onChange={(v) => set({ prospects: v })} fmt={(v) => v.toLocaleString("fr-FR")} />
          <Slider label="Fenêtre de campagne" value={t.days} min={1} max={30} step={1} onChange={(v) => set({ days: v })} fmt={(v) => `${v} jours`} />
          <Slider label="Relances par prospect" value={t.recalls} min={1} max={10} step={1} onChange={(v) => set({ recalls: v })} fmt={(v) => `${v}×`} />
          <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-paper-faint">Coûts unitaires</p>
            <Slider label="Minutes / tentative" value={t.minutesPerAttempt} min={0.3} max={4} step={0.1} onChange={(v) => set({ minutesPerAttempt: v })} fmt={(v) => `${v.toFixed(1)} min`} />
            <Slider label="VoIP / min (€)" value={t.telcoPerMin} min={0} max={0.2} step={0.005} onChange={(v) => set({ telcoPerMin: v })} fmt={(v) => `${v.toFixed(3)} €`} />
            <Slider label="IA / min (STT+TTS+LLM, 0 = humain)" value={t.aiPerMin} min={0} max={0.5} step={0.01} onChange={(v) => set({ aiPerMin: v })} fmt={(v) => `${v.toFixed(2)} €`} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Tentatives" value={Math.round(r.attempts).toLocaleString("fr-FR")} />
            <Metric label="Par jour" value={Math.round(r.attemptsPerDay).toLocaleString("fr-FR")} />
            <Metric label="Minutes" value={Math.round(r.totalMinutes).toLocaleString("fr-FR")} />
          </div>
          <div className="panel p-4">
            <p className="font-display text-sm font-semibold text-paper">Coût direct de la campagne</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                <tr><td className="py-1 text-paper-faint">Téléphonie (VoIP)</td><td className="py-1 text-right font-mono text-paper">{eur(Math.round(r.telcoCost))}</td></tr>
                <tr><td className="py-1 text-paper-faint">IA (voix)</td><td className="py-1 text-right font-mono text-paper">{eur(Math.round(r.aiCost))}</td></tr>
                <tr className="border-t border-ink-700"><td className="py-1 font-medium text-paper">Total direct</td><td className="py-1 text-right font-mono font-bold text-bronze-400">{eur(Math.round(r.totalCost))}</td></tr>
                <tr><td className="py-1 text-paper-faint">Coût / prospect</td><td className="py-1 text-right font-mono text-paper-dim">{r.costPerProspect.toFixed(2)} €</td></tr>
              </tbody>
            </table>
          </div>
          <div className={cn("rounded-lg border px-4 py-3 text-[13px]", margin > 0 ? "border-signal-green/40 bg-signal-green/5 text-paper-dim" : "border-signal-red/40 bg-signal-red/5 text-paper-dim")}>
            À <strong className="text-paper">{eur(monthlyPrice)}/mois</strong>, marge sur coût direct : <strong className={margin > 0 ? "text-signal-green" : "text-signal-red"}>{eur(Math.round(margin))}</strong> ({Math.round(marginPct * 100)} %).
            {margin > 0 && <> Et ça remplace un commercial au téléphone (~3 500 €/mois chargé) — c&apos;est l&apos;argument.</>}
          </div>
        </div>
      </div>
    </section>
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
