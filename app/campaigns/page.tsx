"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, MessageSquare, Phone, Plus, Trash2, Wand2 } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Campaign, CampaignStep, CampaignStepKind, Sector, StepRole } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { InboundInbox } from "@/components/campaigns/inbox";
import { IndustryTrackingStats } from "@/components/tracking/tracking-stats";

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
  const { campaigns, upsertCampaign, deleteCampaign, logActivity } = useAlpha();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [magnetOpen, setMagnetOpen] = useState(false);

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
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Campagnes</h1>
          <p className="text-sm text-paper-faint">Séquences email / WhatsApp / appel. Objectif unique : un audit terrain daté.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setMagnetOpen(true)}>
            <Wand2 size={14} /> Lead magnet
          </button>
          <button className="btn-bronze" onClick={newCampaign}>
            <Plus size={15} /> Campagne
          </button>
        </div>
      </header>

      <InboundInbox />

      <IndustryTrackingStats />

      <div className="grid gap-4 md:grid-cols-2">
        {campaigns.map((c) => {
          const openRate = c.stats.sent ? Math.round((c.stats.opened / c.stats.sent) * 100) : 0;
          const replyRate = c.stats.sent ? Math.round((c.stats.replied / c.stats.sent) * 100) : 0;
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

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Stat label="Envoyés" value={c.stats.sent} />
                <Stat label="Ouverts" value={`${openRate}%`} />
                <Stat label="Réponses" value={`${replyRate}%`} />
                <Stat label="RDV" value={c.stats.booked} tone="bronze" />
              </div>

              <ol className="mt-3 space-y-1">
                {c.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-[12px] text-paper-dim">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink-700 text-bronze-400">{KIND_ICON[s.kind]}</span>
                    J+{s.delayDays} — {s.subject}
                    {i < c.steps.length - 1 && <span className="text-paper-faint">↓</span>}
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setEditing(c)}>Éditer la séquence</button>
                {c.status === "active" ? (
                  <button className="btn-ghost" onClick={() => upsertCampaign({ ...c, status: "pausee" })}>Pause</button>
                ) : (
                  <button
                    className="btn-bronze"
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

      <Modal open={magnetOpen} onClose={() => setMagnetOpen(false)} title="Générateur de lead magnet" wide>
        <LeadMagnet />
      </Modal>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "bronze" }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 py-2">
      <p className={cn("font-mono text-sm", tone === "bronze" ? "text-bronze-400" : "text-paper")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-paper-faint">{label}</p>
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

const MAGNETS: Record<string, { title: string; outline: string[] }> = {
  restaurant: {
    title: "Audit gratuit : « Combien vous coûtent vos mardis soirs ? »",
    outline: [
      "Checklist PDF : les 7 fuites de clients d'un resto lyonnais (fiche Google, résa, no-shows…)",
      "Calculateur de Taxe d'Ignorance : couverts perdus × ticket moyen",
      "Étude de cas anonymisée : bouchon Croix-Rousse, +40 réservations/mois",
      "CTA unique : 20 minutes d'audit sur place, créneau à réserver",
    ],
  },
  pub: {
    title: "Guide : « Remplir un pub un mardi soir (sans promo -50%) »",
    outline: [
      "3 mécaniques d'événements récurrents qui créent des habitués",
      "Template d'agenda automatisé + relances WhatsApp",
      "Cas : The Smoking Dog, mardis quiz à 80 % de remplissage",
      "CTA : audit événementiel gratuit",
    ],
  },
  ambulance: {
    title: "Rapport : « Les demandes de transport que votre standard ne voit jamais »",
    outline: [
      "Données : répartition horaire des demandes (20h–7h = 31 %)",
      "Grille d'auto-diagnostic du standard",
      "Cas : société de Villeurbanne, +12 transports programmés/mois",
      "CTA : audit de flux au dépôt, 20 minutes",
    ],
  },
  artisan: {
    title: "Checklist : « 12 appels manqués par semaine = combien de devis perdus ? »",
    outline: [
      "Calculateur simple : appels manqués × taux devis × panier moyen",
      "Le formulaire de devis intelligent : budget, délai, photos en 40 s",
      "Cas : Menuiserie Charbonnier, +9 demandes qualifiées/mois",
      "CTA : démo mobile de 10 minutes sur chantier",
    ],
  },
};

function LeadMagnet() {
  const [sector, setSector] = useState<string>("restaurant");
  const m = MAGNETS[sector];
  return (
    <div>
      <label className="label">Secteur</label>
      <select className="input" value={sector} onChange={(e) => setSector(e.target.value)}>
        {Object.keys(MAGNETS).map((s) => (
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
