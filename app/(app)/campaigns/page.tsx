"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Mail, MailCheck, MessageSquare, Phone, Plus, Trash2, Wand2 } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Campaign, CampaignStep, CampaignStepKind, Prospect, Sector, StepRole } from "@/lib/types";
import { cn, eur, uid } from "@/lib/utils";
import { computeCampaignFunnel, pct, type FunnelRecord } from "@/lib/campaign-funnel";
import { Modal } from "@/components/ui/modal";
import { InboundInbox } from "@/components/campaigns/inbox";
import { ChiffresDeCampagneDemo } from "@/components/donnees-de-demo";
import { IndustryTrackingStats } from "@/components/tracking/tracking-stats";
import { CampaignReview } from "@/components/campaigns/campaign-review";
import { PageHeader } from "@/components/ui/page-header";

const KIND_ICON: Record<CampaignStepKind, React.ReactNode> = {
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} />,
  appel: <Phone size={13} />,
};

const STATUS_TONE: Record<Campaign["status"], string> = {
  active: "border-signal-green/50 text-signal-green",
  brouillon: "border-ink-600 text-paper-faint",
  pausee: "border-bronze-700 text-bronze-400",
  terminee: "border-ink-600 text-paper-faint line-through",
};

export default function CampaignsPage() {
  const { campaigns, prospects, upsertCampaign, deleteCampaign, logActivity } = useAlpha();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [reviewing, setReviewing] = useState<Campaign | null>(null);
  const [magnetOpen, setMagnetOpen] = useState(false);

  // Tracking réel → funnel par campagne (délivré/ouvert/réponse/…/closed/LTV).
  const [records, setRecords] = useState<FunnelRecord[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/track/stats")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.records)) setRecords(d.records);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const recordsByCampaign = useMemo(() => {
    const m = new Map<string, FunnelRecord[]>();
    for (const r of records) {
      if (!r.campaignId) continue;
      const arr = m.get(r.campaignId) ?? [];
      arr.push(r);
      m.set(r.campaignId, arr);
    }
    return m;
  }, [records]);

  const newCampaign = () =>
    setEditing({
      id: uid(),
      name: "Nouvelle campagne",
      sector: "restaurant",
      status: "brouillon",
      offerInfo: "",
      cible: "",
      industries: [],
      marketInfo: "",
      leadMagnet: "",
      steps: [
        { id: uid(), kind: "email", role: "premiere-impression", delayDays: 0, subject: "Accroche douleur", body: "Bonjour {prenom},\n\n…" },
      ],
      stats: { sent: 0, opened: 0, replied: 0, booked: 0 },
      createdAt: new Date().toISOString(),
    });

  return (
    <div className="page">
      <PageHeader
        title="Campagnes"
        subtitle="Séquences email / WhatsApp / appel. Objectif unique : un audit terrain daté."
        actions={
          <>
            <button className="btn-ghost" onClick={() => setMagnetOpen(true)}>
              <Wand2 size={14} /> Lead magnet
            </button>
            <button className="btn-bronze" onClick={newCampaign}>
              <Plus size={15} /> Campagne
            </button>
          </>
        }
      />

      <InboundInbox />

      <IndustryTrackingStats />

      {/*
        Juste SOUS le panneau de tracking, et c'est délibéré : celui-ci dit
        honnêtement « MESSAGES 0 · TAUX D'OUVERTURE 0 % », les cartes du
        dessous affichent 67 %. Le bandeau doit se lire entre les deux, là où
        la contradiction se voit.
      */}
      <ChiffresDeCampagneDemo campaigns={campaigns} />

      <div className="grid gap-4 md:grid-cols-2">
        {campaigns.map((c) => {
          return (
            <div key={c.id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-paper">{c.name}</p>
                  <p className="truncate text-[11px] text-paper-faint" title={c.cible}>
                    {c.cible || <span className="capitalize">secteur : {c.sector}</span>}
                  </p>
                </div>
                <span className={cn("chip shrink-0", STATUS_TONE[c.status])}>{c.status}</span>
              </div>

              {c.industries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.industries.map((ind) => (
                    <span key={ind} className="chip border-ink-600 text-paper-faint">{ind}</span>
                  ))}
                </div>
              )}
              {c.offerInfo && (
                <p className="mt-2 rounded-lg border border-bronze-700/40 bg-bronze-900/20 px-2.5 py-1.5 text-[11px] text-paper-dim">
                  <span className="text-bronze-400">Offre :</span> {c.offerInfo}
                </p>
              )}
              {c.marketInfo && (
                <p className="mt-1.5 text-[11px] text-paper-faint" title={c.marketInfo}>
                  <span className="text-bronze-500">Marché :</span> {c.marketInfo.slice(0, 140)}{c.marketInfo.length > 140 ? "…" : ""}
                </p>
              )}
              {c.leadMagnet && (
                <p className="mt-1.5 text-[11px] text-paper-faint">
                  <span className="text-bronze-500">🧲 Lead magnet :</span> {c.leadMagnet}
                </p>
              )}

              <CampaignFunnelStrip records={recordsByCampaign.get(c.id) ?? []} prospects={prospects} fallback={c.stats} />

              <ol className="mt-3 space-y-1">
                {c.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-[12px] text-paper-dim">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink-700 text-bronze-400">{KIND_ICON[s.kind]}</span>
                    J+{s.delayDays} — {s.subject}
                    {i < c.steps.length - 1 && <span className="text-paper-faint">↓</span>}
                  </li>
                ))}
              </ol>

              <button className="btn-bronze mt-4 w-full" onClick={() => setReviewing(c)}>
                <MailCheck size={14} /> Réviser & envoyer
              </button>
              <div className="mt-2 flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setEditing(c)}>Éditer la séquence</button>
                {c.status === "active" ? (
                  <button className="btn-ghost" onClick={() => upsertCampaign({ ...c, status: "pausee" })}>Pause</button>
                ) : (
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      upsertCampaign({ ...c, status: "active" });
                      logActivity({ kind: "campagne", message: `Campagne activée : ${c.name}` });
                    }}
                  >
                    Activer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <SequenceEditor
          campaign={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            upsertCampaign(c);
            setEditing(null);
          }}
          onDelete={(id) => {
            deleteCampaign(id);
            setEditing(null);
          }}
        />
      )}

      {reviewing && <CampaignReview campaign={reviewing} onClose={() => setReviewing(null)} />}

      <Modal open={magnetOpen} onClose={() => setMagnetOpen(false)} title="Générateur de lead magnet" wide>
        <LeadMagnet />
      </Modal>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string | number; tone?: "bronze" }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 py-1.5">
      <p className={cn("font-mono text-[13px] leading-tight", tone === "bronze" ? "text-bronze-400" : "text-paper")}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-paper-faint">{label}</p>
    </div>
  );
}

/**
 * Funnel réel de la campagne : délivré(nospam)/ouvert/réponse/follow-thru/
 * follow-up/closed + LTV + satisfaction. Sans tracking (campagnes de démo),
 * retombe sur les compteurs historiques.
 */
function CampaignFunnelStrip({
  records,
  prospects,
  fallback,
}: {
  records: FunnelRecord[];
  prospects: Prospect[];
  fallback: Campaign["stats"];
}) {
  if (records.length === 0) {
    const openRate = fallback.sent ? Math.round((fallback.opened / fallback.sent) * 100) : 0;
    const replyRate = fallback.sent ? Math.round((fallback.replied / fallback.sent) * 100) : 0;
    return (
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Mini label="Envoyés" value={fallback.sent} />
        <Mini label="Ouverts" value={`${openRate}%`} />
        <Mini label="Réponses" value={`${replyRate}%`} />
        <Mini label="RDV" value={fallback.booked} tone="bronze" />
      </div>
    );
  }
  const f = computeCampaignFunnel(records, prospects);
  const b = f.people;
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
      <Mini label="Délivré" value={f.people} />
      <Mini label="Ouvert" value={`${pct(f.opened, b)}%`} />
      <Mini label="Réponse" value={`${pct(f.responded, b)}%`} />
      <Mini label="Follow-thru" value={`${pct(f.followThru, b)}%`} />
      <Mini label="Follow-up" value={`${pct(f.followUp, b)}%`} />
      <Mini label="Closed" value={f.closed} tone="bronze" />
      <Mini label="LTV" value={eur(f.ltv)} tone="bronze" />
      <Mini label="Satisf." value={f.satisfaction === null ? "—" : `${f.satisfaction}`} />
    </div>
  );
}

function SequenceEditor({
  campaign,
  onClose,
  onSave,
  onDelete,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSave: (c: Campaign) => void;
  onDelete: (id: string) => void;
}) {
  const [c, setC] = useState<Campaign>(campaign);

  const patchStep = (id: string, patch: Partial<CampaignStep>) =>
    setC((x) => ({ ...x, steps: x.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const move = (i: number, dir: -1 | 1) =>
    setC((x) => {
      const steps = [...x.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return x;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...x, steps };
    });

  return (
    <Modal open onClose={onClose} title="Éditeur de séquence" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nom</label>
          <input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Secteur cible</label>
          <select className="input" value={c.sector} onChange={(e) => setC({ ...c, sector: e.target.value as Sector | "tous" })}>
            <option value="tous">Tous</option>
            <option value="restaurant">Restaurants</option>
            <option value="pub">Pubs</option>
            <option value="ambulance">Ambulances</option>
            <option value="artisan">Artisans</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Cible précise (qui exactement ?)</label>
          <input
            className="input"
            value={c.cible}
            onChange={(e) => setC({ ...c, cible: e.target.value })}
            placeholder="Restaurateurs indépendants Lyon intra-muros, 30–90 couverts, sans module de résa…"
          />
        </div>
        <div>
          <label className="label">Offre de la campagne</label>
          <textarea
            className="input min-h-16"
            value={c.offerInfo}
            onChange={(e) => setC({ ...c, offerInfo: e.target.value })}
            placeholder="Setup X € + Y €/mois, garantie…"
          />
        </div>
        <div>
          <label className="label">Lead magnet</label>
          <textarea
            className="input min-h-16"
            value={c.leadMagnet}
            onChange={(e) => setC({ ...c, leadMagnet: e.target.value })}
            placeholder="Audit gratuit / checklist / calculateur…"
          />
        </div>
        <div>
          <label className="label">Industries (séparées par des virgules)</label>
          <input
            className="input"
            value={c.industries.join(", ")}
            onChange={(e) =>
              setC({ ...c, industries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="Bouchons lyonnais, Bistronomie…"
          />
        </div>
        <div>
          <label className="label">Info marché (vis-à-vis de cette offre)</label>
          <textarea
            className="input min-h-16"
            value={c.marketInfo}
            onChange={(e) => setC({ ...c, marketInfo: e.target.value })}
            placeholder="Taille du marché local, comportements d'achat, timing, concurrents…"
          />
        </div>
      </div>

      <p className="label mt-4">Étapes ({c.steps.length}) — variables : {"{prenom} {commerce} {taxe} {closer} {preuve}"}</p>
      <div className="space-y-3">
        {c.steps.map((s, i) => (
          <div key={s.id} className="rounded-lg border border-ink-600 bg-ink-850 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-bronze-500">#{i + 1}</span>
              <select className="input w-32" value={s.kind} onChange={(e) => patchStep(s.id, { kind: e.target.value as CampaignStepKind })}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="appel">Appel</option>
              </select>
              <select className="input w-44" value={s.role} onChange={(e) => patchStep(s.id, { role: e.target.value as StepRole })}>
                <option value="premiere-impression">Première impression</option>
                <option value="relance">Relance</option>
                <option value="reponse">Réponse</option>
              </select>
              <label className="flex items-center gap-1 text-[12px] text-paper-faint">
                J+
                <input
                  type="number"
                  className="input w-16"
                  value={s.delayDays}
                  onChange={(e) => patchStep(s.id, { delayDays: +e.target.value })}
                />
              </label>
              <input
                className="input flex-1 min-w-40"
                value={s.subject}
                onChange={(e) => patchStep(s.id, { subject: e.target.value })}
                placeholder="Objet / intention"
              />
              <div className="flex gap-1">
                <button className="btn-ghost px-2 py-1" onClick={() => move(i, -1)}><ChevronUp size={13} /></button>
                <button className="btn-ghost px-2 py-1" onClick={() => move(i, 1)}><ChevronDown size={13} /></button>
                <button
                  className="btn-danger px-2 py-1"
                  onClick={() => setC((x) => ({ ...x, steps: x.steps.filter((y) => y.id !== s.id) }))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <textarea
              className="input mt-2 min-h-20 font-mono text-[12px]"
              value={s.body}
              onChange={(e) => patchStep(s.id, { body: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        className="btn-ghost mt-3"
        onClick={() =>
          setC((x) => ({
            ...x,
            steps: [...x.steps, { id: uid(), kind: "email", role: "relance", delayDays: (x.steps.at(-1)?.delayDays ?? 0) + 3, subject: "", body: "" }],
          }))
        }
      >
        <Plus size={14} /> Étape
      </button>

      <div className="mt-5 flex justify-between">
        <button className="btn-danger" onClick={() => onDelete(c.id)}>
          <Trash2 size={14} /> Supprimer
        </button>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-bronze" onClick={() => onSave(c)}>Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES AIMANTS, PAR PHASE DE PERMIS — ET SANS UNE SEULE ÉTUDE DE CAS.
 *
 * ⚠ CE QUI ÉTAIT ÉCRIT ICI, ET QU'AUCUN GARDE N'ATTRAPAIT.
 *
 * Les quatre aimants étaient classés par secteur (restaurant, pub, ambulance,
 * artisan) — le marché d'AVANT l'avatar — et chacun dictait une étude de cas
 * chiffrée :
 *
 *   « Étude de cas anonymisée : bouchon Croix-Rousse, +40 réservations/mois »
 *   « Cas : The Smoking Dog, mardis quiz à 80 % de remplissage »
 *   « Cas : société de Villeurbanne, +12 transports programmés/mois »
 *   « Cas : Menuiserie Charbonnier, +9 demandes qualifiées/mois »
 *
 * Zéro vente à ce jour : ces quatre lignes sont des CONSIGNES à fabriquer une
 * preuve. `tests/preuve-sociale.ts` ne les a pas vues parce qu'il scanne
 * `lib/`, pas `app/` — et parce que son motif cherche des possessifs (« nos
 * clients »), qu'une référence nommée ne porte pas.
 *
 * ⚠⚠ CE QUI LES REMPLACE N'EST PAS « RIEN ». À zéro preuve sociale, ce qui
 * reste est plus fort qu'un cas inventé, et la doctrine le nomme : SES
 * chiffres à lui, relevés pendant l'audit — un nombre qu'il a donné lui-même
 * ne se conteste pas — et une démonstration EN DIRECT.
 * ─────────────────────────────────────────────────────────────────────
 */
const MAGNETS: Record<string, { title: string; outline: string[] }> = {
  "pré-commercialisation": {
    title: "Relevé : « Qui appelle votre bureau de vente pendant que l'équipe est en visite ? »",
    outline: [
      "Comptage sur SA ligne : appels entrants, appels non aboutis, répartition horaire",
      "Ce qu'il advient d'un appelant sans trace — il n'y a personne à rappeler",
      "La démonstration se fait EN DIRECT : l'agent le rappelle pendant le rendez-vous",
      "CTA unique : 20 minutes, sur place ou en visio, créneau daté",
      "⚠ Aucune étude de cas : zéro vente à ce jour. Ses chiffres à lui, ou rien.",
    ],
  },
  "lancement qui traîne": {
    title: "Relevé : « Où se perdent les contacts d'une commercialisation qui n'atteint pas son seuil »",
    outline: [
      "Combien de contacts entrants sur les douze derniers mois — chez lui, pas une moyenne de marché",
      "Combien ont eu une relance DATÉE, combien n'ont jamais été rappelés",
      "⚠ Vérifier d'abord que l'opération est vivante : un permis d'un an sans chantier peut aussi vouloir dire abandon",
      "CTA : 30 minutes pour compter, pas pour montrer un outil",
    ],
  },
  "queue de programme": {
    title: "Grille : « Les derniers lots sont les plus longs — pourquoi, et ce qui reste actionnable »",
    outline: [
      "Ce qui distingue un lot invendu d'un lot mal proposé (typologie, étage, exposition, prix)",
      "L'historique des contacts qui ont visité et ne sont jamais revenus",
      "CTA : relecture de la file sur ses propres lots restants",
    ],
  },
  "arrêté récent": {
    title: "Rien — et c'est le sujet",
    outline: [
      "⚠ Pendant le délai de recours des tiers, il n'y a rien à donner qui ne soit prématuré",
      "L'objectif de ce contact est d'EXISTER avant le lancement commercial, pas de vendre",
      "Vouloir closer ici, c'est arriver deux mois trop tôt et griller la fiche pour le moment où elle vaudra quelque chose",
      "CTA : aucun. Juste convenir de se reparler à l'ouverture de la commercialisation.",
    ],
  },
};

function LeadMagnet() {
  /**
   * ⚠ « restaurant » ÉTAIT ÉCRIT EN DUR ICI, ET C'EST CE QUI S'AFFICHAIT.
   *
   * L'état initial doit se DÉDUIRE du catalogue, sinon renommer une entrée
   * laisse l'écran sur une clé qui n'existe plus — `MAGNETS[sector]` rend
   * alors `undefined` et le panneau plante sur `m.title`.
   */
  const phases = Object.keys(MAGNETS);
  const [phase, setPhase] = useState<string>(phases[0]);
  const m = MAGNETS[phase] ?? MAGNETS[phases[0]];
  return (
    <div>
      <label className="label">Phase du permis</label>
      <select className="input" value={phase} onChange={(e) => setPhase(e.target.value)}>
        {phases.map((s) => (
          <option key={s} value={s} className="capitalize">{s}</option>
        ))}
      </select>
      <div className="mt-4 rounded-lg border border-bronze-700/50 bg-bronze-900/20 p-4">
        <p className="font-display font-semibold text-bronze-300">{m.title}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-paper-dim">
          {m.outline.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </div>
      <button
        className="btn-ghost mt-3"
        onClick={() => navigator.clipboard.writeText(`${m.title}\n\n${m.outline.map((o) => `• ${o}`).join("\n")}`)}
      >
        Copier le plan
      </button>
    </div>
  );
}
