"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { lireRapportDns, type EtatDns } from "@/lib/deliverability-dns";
import { CATEGORY_META, computeRoutines, type Routine } from "@/lib/routines";
import { n8nConnected } from "@/lib/n8n";
import { DEFAULT_DAILY_TARGET, buildDailyPlan } from "@/lib/daily-plan";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

const TARGET_KEY = "alpha_daily_target";

/**
 * Pilote automatique — la réponse à « est-ce que ça tourne tout seul ? ».
 *
 * Deux moitiés, volontairement séparées :
 *  · CE QUI TOURNE SANS TOI — les organes autonomes et leur état réel.
 *  · CE QUE LA MACHINE ATTEND DE TOI — la file de décision, chiffrée en
 *    minutes. C'est ça, les 20 % humains : approuver, décider, closer.
 *
 * Doctrine : la machine prépare tout, l'humain tranche. Ce qui engage
 * (envoi, signature, encaissement) ne part jamais seul — pas par
 * limitation technique, par choix : c'est là qu'est la valeur.
 */

interface Health {
  capabilities?: {
    ai?: { configured: boolean; model: string };
    email?: { configured: boolean };
    inboundWebhook?: { configured: boolean };
    tracking?: { baseUrl: boolean; persistence: string; maxSendsPerHour: number };
    supabase?: { serviceRole: boolean };
  };
}

/** Minutes estimées par type de décision — pour chiffrer les 20 %. */
const MINUTES: Partial<Record<Routine["category"], number>> = {
  reply: 3,
  review: 2,
  close: 8,
  "meeting-confirm": 1,
  "meeting-debrief": 3,
  relance: 2,
  "next-step": 1,
  "info-manquante": 2,
  contract: 3,
  payment: 2,
  delivery: 2,
  satisfaction: 3,
  testimonial: 3,
  upsell: 5,
};

export default function PilotePage() {
  const { prospects, meetings, campaigns, drafts } = useAlpha();
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [n8n, setN8n] = useState(false);
  /** Verdict DNS du domaine d'envoi — null tant qu'on n'a pas de réponse. */
  const [dns, setDns] = useState<EtatDns | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
    fetch("/api/deliverability/dns")
      .then((r) => (r.ok ? r.json() : null))
      // `configure: false` = pas encore de domaine d'envoi. Ce n'est pas un
      // rapport vide, c'est l'absence de configuration : on ne l'affiche pas
      // comme un résultat. Un seul lecteur pour les deux écrans : `/demarrage` avait sa propre
      // version de ce test, et elle lui manquait.
      .then((j) => setDns(j === null ? null : lireRapportDns(j)))
      .catch(() => setDns(null));
  };

  useEffect(() => {
    load();
    setN8n(n8nConnected());
  }, []);

  const routines = useMemo(
    () => computeRoutines({ prospects, meetings, campaigns, drafts }),
    [prospects, meetings, campaigns, drafts]
  );

  // Objectif de volume — réglable, gardé dans le navigateur.
  const [target, setTarget] = useState(DEFAULT_DAILY_TARGET);
  useEffect(() => {
    const raw = Number(localStorage.getItem(TARGET_KEY));
    if (Number.isFinite(raw) && raw > 0) setTarget(raw);
  }, []);
  const changeTarget = (n: number) => {
    const v = Math.max(10, Math.min(200, Math.round(n)));
    setTarget(v);
    try {
      localStorage.setItem(TARGET_KEY, String(v));
    } catch {
      /* stockage indisponible — l'objectif repart au défaut */
    }
  };

  const plan = useMemo(() => buildDailyPlan(prospects, target), [prospects, target]);
  const pct = Math.min(100, Math.round((plan.done / Math.max(1, plan.target)) * 100));

  const urgent = routines.filter((r) => r.priority === "haute");
  const minutes = routines.reduce((sum, r) => sum + (MINUTES[r.category] ?? 2), 0);

  const c = health?.capabilities;
  const organs: { label: string; ok: boolean; detail: string; autonomous: string }[] = [
    {
      label: "Envoi email",
      ok: Boolean(c?.email?.configured),
      detail: c?.email?.configured ? "SMTP configuré" : "SMTP absent — rien ne peut partir",
      autonomous: "Envoie, trace les ouvertures et les clics, applique le quota horaire.",
    },
    {
      label: "IA",
      ok: Boolean(c?.ai?.configured),
      detail: c?.ai?.configured ? c.ai.model : "moteur de templates (hors-ligne)",
      autonomous: "Rédige les brouillons, structure les recherches, joue le sparring.",
    },
    {
      label: "Cerveau n8n",
      ok: n8n,
      detail: n8n ? "connecté" : "non connecté — les automatisations dorment",
      autonomous: "Synchronise le CRM, traite les réponses entrantes, remonte le tracking, alerte en cas d'erreur.",
    },
    {
      label: "Réponses entrantes",
      ok: Boolean(c?.inboundWebhook?.configured),
      detail: c?.inboundWebhook?.configured ? "webhook armé" : "WEBHOOK_SECRET absent",
      autonomous: "Capte les réponses, détecte les STOP et désinscrit automatiquement.",
    },
    {
      label: "Tracking",
      ok: Boolean(c?.tracking?.baseUrl),
      detail: c?.tracking?.baseUrl ? `URL publique OK · ${c.tracking.persistence}` : "TRACKING_BASE_URL absente",
      autonomous: "Compte ouvertures et clics même quand l'app locale est éteinte.",
    },
    {
      label: "Délivrabilité",
      ok: dns?.etat === "mesure" && dns.manquants === 0 && dns.inconnus === 0,
      detail:
        !dns || dns.etat === "non-configure"
          ? "domaine d'envoi inconnu (SMTP_FROM)"
          : dns.etat === "illisible"
            ? "vérification illisible — relance-la"
            : dns.manquants > 0
              ? `${dns.domain} · ${dns.manquants} enregistrement(s) DNS manquant(s)`
              : dns.inconnus > 0
                ? `${dns.domain} · vérification non concluante (DNS injoignable)`
                : `${dns.domain} · ${dns.verdict}`,
      autonomous:
        "SPF, DKIM et DMARC décident si tes mails arrivent en boîte de réception. Détail et correctifs dans Réglages.",
    },
    {
      label: "Mémoire durable",
      ok: Boolean(c?.supabase?.serviceRole),
      detail: c?.supabase?.serviceRole ? "Supabase (service role)" : "mémoire volatile",
      autonomous: "Conserve tracking et anti-doublons entre les redémarrages.",
    },
  ];

  const running = organs.filter((o) => o.ok).length;
  const allGreen = running === organs.length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="La machine prépare · tu tranches"
        title="Pilote automatique"
        actions={
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualiser
          </button>
        }
      />

      {/* Le verdict */}
      <section
        className={cn(
          "card flex flex-wrap items-center justify-between gap-4 p-5",
          allGreen ? "border-signal-green/50" : "border-signal-amber/50"
        )}
      >
        <div className="flex items-center gap-3">
          {allGreen ? (
            <CheckCircle2 size={28} className="shrink-0 text-signal-green" />
          ) : (
            <AlertTriangle size={28} className="shrink-0 text-signal-amber" />
          )}
          <div>
            <p className="font-display text-lg font-extrabold text-paper">
              {allGreen ? "La machine tourne" : `${running}/${organs.length} organes actifs`}
            </p>
            <p className="text-[13px] text-paper-faint">
              {allGreen
                ? "Tout ce qui peut être autonome l'est. Le reste attend ta décision."
                : "Certains organes dorment — les automatisations correspondantes ne tournent pas."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Décisions en attente</p>
            <p className="font-display text-2xl font-extrabold text-paper">{routines.length}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Ton temps aujourd&apos;hui</p>
            <p className={cn("font-display text-2xl font-extrabold", minutes > 90 ? "text-signal-amber" : "text-bronze-400")}>
              ≈ {minutes} min
            </p>
          </div>
        </div>
      </section>

      {/* Le volume du jour — le moteur de rentabilité */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
            <Gauge size={15} className="text-bronze-400" /> Volume du jour
          </p>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">Objectif</label>
            <input
              type="number"
              className="input w-20 py-1 text-center font-mono text-[13px]"
              value={target}
              min={10}
              max={200}
              onChange={(e) => changeTarget(Number(e.target.value))}
            />
            <span className="font-mono text-[11px] text-paper-faint">touches/jour</span>
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-3xl font-extrabold text-paper">{plan.done}</span>
          <span className="font-mono text-[13px] text-paper-faint">/ {plan.target} touches</span>
          <span className={cn("chip ml-auto", plan.reachable ? "border-signal-green/40 text-signal-green" : "border-signal-amber/60 text-signal-amber")}>
            {plan.reachable ? `${plan.todo} exécutables maintenant` : `objectif hors de portée — ${plan.todo} dispo`}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
          <div
            className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-signal-green" : "bg-bronze-400")}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {plan.channels.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              className="panel p-3.5 transition-colors hover:border-bronze-700"
            >
              <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">
                {c.label}
                <span className={cn(c.done >= c.capacity ? "text-signal-red" : "text-paper-faint")}>
                  {c.done}/{c.capacity}
                </span>
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold text-bronze-400">
                {c.todo}
                <span className="ml-1 text-[12px] font-normal text-paper-faint">à faire</span>
              </p>
              <p className="mt-0.5 text-[11px] text-paper-faint">
                {c.ready} fiche(s) prête(s)
                {c.done >= c.capacity && <span className="text-signal-red"> · plafond atteint</span>}
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-paper-faint">{c.why}</p>
            </Link>
          ))}
        </div>

        {!plan.reachable && (
          <p className="mt-3 rounded-xl border border-signal-amber/50 bg-signal-amber/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-signal-amber">
            Le pipe ne contient pas assez de carburant pour ton objectif ({plan.fuel} fiche(s) active(s)).
            Le facteur limitant n&apos;est pas la machine, c&apos;est le nombre de prospects —{" "}
            <Link href="/settings" className="underline underline-offset-2">importe une nouvelle liste</Link>.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ce qui tourne sans toi */}
        <section className="card p-4">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
            <Cpu size={15} className="text-bronze-400" /> Ce qui tourne sans toi
          </p>
          <ul className="mt-3 space-y-2.5">
            {organs.map((o) => (
              <li key={o.label} className="flex items-start gap-2.5">
                {o.ok ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-green" />
                ) : (
                  <XCircle size={15} className="mt-0.5 shrink-0 text-signal-red" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-paper">
                    {o.label} <span className="font-mono text-[11px] font-normal text-paper-faint">· {o.detail}</span>
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-paper-faint">{o.autonomous}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="panel mt-3 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-paper-faint">
            <strong className="text-paper-dim">Condition matérielle :</strong> l&apos;app et n8n tournent sur ta machine.
            Portable fermé = tout s&apos;arrête, sauf le tracking (hébergé) qui continue de compter. Voir{" "}
            <code className="code">docs/AUTOPILOTE.md</code> pour le laisser tourner en continu.
          </p>
        </section>

        {/* Ce que la machine attend de toi */}
        <section className="card p-4">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
            <Bot size={15} className="text-bronze-400" /> Ce que la machine attend de toi
            {urgent.length > 0 && (
              <span className="chip border-signal-red/50 text-signal-red">{urgent.length} urgent</span>
            )}
          </p>

          {routines.length === 0 ? (
            <p className="mt-4 rounded-xl border border-signal-green/40 bg-signal-green/5 px-3.5 py-3 text-[13px] text-signal-green">
              Rien en attente. La machine a tout préparé et rien ne bloque — profite, ou va chercher du volume.
            </p>
          ) : (
            <ul className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {routines.slice(0, 20).map((r) => {
                const meta = CATEGORY_META[r.category];
                return (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      className="panel flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:border-bronze-700"
                    >
                      <span
                        className={cn(
                          "chip shrink-0",
                          meta.tone === "red"
                            ? "border-signal-red/50 text-signal-red"
                            : meta.tone === "green"
                              ? "border-signal-green/40 text-signal-green"
                              : "border-bronze-700 text-bronze-400"
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-paper">{r.title}</span>
                        <span className="block truncate text-[11.5px] text-paper-faint">{r.detail}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-paper-faint">
                        {MINUTES[r.category] ?? 2}′
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-paper-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {routines.length > 20 && (
            <p className="mt-2 text-[11.5px] text-paper-faint">+ {routines.length - 20} autres — traite d&apos;abord les urgentes.</p>
          )}
        </section>
      </div>

      {/* La règle */}
      <section className="card border-bronze-700/50 p-4" style={{ background: "linear-gradient(180deg, rgba(232,201,138,.06), transparent)" }}>
        <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
          <Clock size={15} className="text-bronze-400" /> Ce qui ne partira jamais tout seul — et pourquoi
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-paper-dim">
          <li>· <strong className="text-paper">Un envoi</strong> — tu relis avant. Un prénom faux détruit tout le travail qui précède.</li>
          <li>· <strong className="text-paper">Une signature</strong> — l&apos;IA ne marque jamais « signé ». C&apos;est un engagement, il se décide.</li>
          <li>· <strong className="text-paper">Un encaissement</strong> — l&apos;argent ne bouge que sur décision humaine.</li>
          <li>· <strong className="text-paper">Une conversation</strong> — c&apos;est ton avantage. L&apos;automatiser reviendrait à le supprimer.</li>
        </ul>
        <p className="mt-3 text-[12px] italic text-bronze-300">
          Les 80 % automatisés sont le travail ingrat. Les 20 % qui restent sont exactement ceux qui font signer.
        </p>
      </section>
    </div>
  );
}
