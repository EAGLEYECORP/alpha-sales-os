"use client";

import Link from "next/link";
import { Gauge, HeartHandshake, MailOpen, MessageCircleReply, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { STAGES } from "@/lib/hormozi";
import { CampaignRatesChart, SectorChart } from "@/components/charts";
import { cn } from "@/lib/utils";

export default function KpisPage() {
  const { prospects, campaigns } = useAlpha();

  const active = prospects.filter((p) => !["signe", "perdu"].includes(p.stage));

  // Openness & responsiveness — outbound (campaigns)
  const sent = campaigns.reduce((s, c) => s + c.stats.sent, 0);
  const opened = campaigns.reduce((s, c) => s + c.stats.opened, 0);
  const replied = campaigns.reduce((s, c) => s + c.stats.replied, 0);
  const booked = campaigns.reduce((s, c) => s + c.stats.booked, 0);
  const openRate = sent ? Math.round((opened / sent) * 100) : 0;
  const replyRate = sent ? Math.round((replied / sent) * 100) : 0;

  // Responsiveness — pipeline (freshness of contact)
  const contactedLast7d = active.filter((p) =>
    p.events.some((e) => Date.now() - new Date(e.date).getTime() < 7 * 864e5)
  ).length;
  const freshness = active.length ? Math.round((contactedLast7d / active.length) * 100) : 0;

  // Trust & likeness
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgTrust = avg(active.map((p) => p.trust));
  const avgLikeness = avg(active.map((p) => p.likeness));

  const campaignData = campaigns
    .filter((c) => c.stats.sent > 0)
    .map((c) => ({
      name: c.name.split("—")[0].trim().slice(0, 14),
      ouverture: Math.round((c.stats.opened / c.stats.sent) * 100),
      reponse: Math.round((c.stats.replied / c.stats.sent) * 100),
    }));

  const trustByStage = STAGES.filter((s) => !["signe", "perdu"].includes(s.id)).map((s) => ({
    name: s.label,
    value: avg(prospects.filter((p) => p.stage === s.id).map((p) => p.trust)),
  }));

  const whyYes = prospects.filter((p) => p.wonReason).map((p) => ({ company: p.company, reason: p.wonReason!, id: p.id }));
  const whyNo = prospects.filter((p) => p.lostReason).map((p) => ({ company: p.company, reason: p.lostReason!, id: p.id }));

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">KPIs</h1>
        <p className="text-sm text-paper-faint">
          Réactivité, ouverture, confiance — et surtout : pourquoi OUI, pourquoi NON.
        </p>
      </header>

      {/* Headline tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={<MailOpen size={16} />}
          label="Ouverture (openness)"
          value={`${openRate} %`}
          sub={`${opened}/${sent} messages ouverts`}
        />
        <Tile
          icon={<MessageCircleReply size={16} />}
          label="Réactivité (responsiveness)"
          value={`${replyRate} %`}
          sub={`${replied} réponses · ${booked} RDV décrochés`}
        />
        <Tile
          icon={<Gauge size={16} />}
          label="Fraîcheur du pipe"
          value={`${freshness} %`}
          sub={`${contactedLast7d}/${active.length} contactés < 7 j`}
          tone={freshness < 50 ? "red" : undefined}
        />
        <Tile
          icon={<HeartHandshake size={16} />}
          label="Confiance · Affinité"
          value={`${avgTrust} · ${avgLikeness}`}
          sub="moyennes sur deals actifs /100"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-paper">Ouverture & réponse par campagne</h2>
          {campaignData.length ? (
            <CampaignRatesChart data={campaignData} />
          ) : (
            <p className="py-10 text-center text-sm text-paper-faint">Aucune campagne avec envois.</p>
          )}
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-paper">Confiance moyenne par étape</h2>
          <SectorChart data={trustByStage} />
          <p className="mt-1 text-[11px] text-paper-faint">
            La confiance doit MONTER avec les étapes. Un creux = une croyance cassée quelque part.
          </p>
        </div>
      </section>

      {/* Why yes / why no */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card border-signal-green/30 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-signal-green">
            <ThumbsUp size={15} /> Pourquoi OUI
          </h2>
          <ul className="mt-3 space-y-2">
            {whyYes.map((w) => (
              <li key={w.id} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm">
                <Link href={`/prospects/${w.id}`} className="font-medium text-paper hover:text-bronze-300">
                  {w.company}
                </Link>
                <p className="text-paper-dim">{w.reason}</p>
              </li>
            ))}
            {whyYes.length === 0 && (
              <p className="text-sm text-paper-faint">Documenté à chaque signature (prompt automatique).</p>
            )}
          </ul>
        </div>
        <div className="card border-signal-red/30 p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-signal-red">
            <ThumbsDown size={15} /> Pourquoi NON
          </h2>
          <ul className="mt-3 space-y-2">
            {whyNo.map((w) => (
              <li key={w.id} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm">
                <Link href={`/prospects/${w.id}`} className="font-medium text-paper hover:text-bronze-300">
                  {w.company}
                </Link>
                <p className="text-paper-dim">{w.reason}</p>
              </li>
            ))}
            {whyNo.length === 0 && <p className="text-sm text-paper-faint">Aucune perte documentée.</p>}
          </ul>
          <p className="mt-3 text-[11px] italic text-paper-faint">
            Chaque « non » pointe la croyance qu&apos;on n&apos;a pas su réparer. C&apos;est le carburant des prochains scripts.
          </p>
        </div>
      </section>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "red";
}) {
  return (
    <div className="card card-hover p-4">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-paper-faint">
        <span className="text-bronze-500">{icon}</span> {label}
      </p>
      <p className={cn("mt-1.5 font-mono text-xl md:text-2xl", tone === "red" ? "text-signal-red" : "text-paper")}>{value}</p>
      <p className="text-[11px] text-paper-faint">{sub}</p>
    </div>
  );
}
