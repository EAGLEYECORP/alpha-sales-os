"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Activity,
  AppSettings,
  AuditLogEntry,
  Campaign,
  CampaignDraft,
  Competitor,
  CustomScript,
  DraftStatus,
  Meeting,
  NextStep,
  NurtureSequence,
  Prospect,
  Stage,
  TimelineEvent,
  Partner,
  PartnerIntro,
} from "./types";
import { fillTemplate } from "./templates";
import {
  seedActivities,
  seedCampaigns,
  seedCompetitors,
  seedMeetings,
  seedNurture,
  seedProspects,
  prospectDefaults,
  DEFAULT_BUSINESS_RULES,
} from "./seed";
import { stageById, signingBlockers } from "./hormozi";
import { seedKnowledge, seedScintia, type KnowledgeNote } from "./knowledge";
import { applyAccount } from "./accounts";
import type { StandardDay } from "./standard";
import { auditCompleteness } from "./deep-dive";
import { uid } from "./utils";

interface AlphaState {
  hydrated: boolean;
  prospects: Prospect[];
  campaigns: Campaign[];
  meetings: Meeting[];
  nurture: NurtureSequence[];
  competitors: Competitor[];
  activities: Activity[];
  auditLog: AuditLogEntry[];
  /** Ids de paiements dont TA part (payout) a été versée. */
  settledPayouts: string[];
  settings: AppSettings;
  /** File de brouillons de campagne en attente de relecture avant envoi. */
  drafts: CampaignDraft[];
  /** Scripts écrits à la main (mode test / manuel). */
  customScripts: CustomScript[];
  /**
   * Prescripteurs — volontairement HORS du tableau prospects : ils ne
   * doivent entrer ni dans le volume d'envoi, ni dans le pipe pondéré,
   * ni dans les taux de conversion. Les mélanger fausserait tout.
   */
  partners: Partner[];
  /** Le Cerveau — notes markdown (RAG lexical, façon Obsidian). */
  notes: KnowledgeNote[];
  /** Historique de la barre du jour — ce qui fait la série. */
  standardLog: StandardDay[];

  // prospects
  upsertProspect: (p: Prospect) => void;
  patchProspect: (id: string, patch: Partial<Prospect>) => void;
  deleteProspect: (id: string) => void;
  moveStage: (
    id: string,
    stage: Stage,
    extra?: { wonReason?: string; lostReason?: string }
  ) => { ok: boolean; blockers: string[] };
  addEvent: (id: string, ev: Omit<TimelineEvent, "id">) => void;
  setNextStep: (id: string, step: NextStep | null) => void;

  // prescripteurs
  upsertPartner: (p: Partner) => void;
  deletePartner: (id: string) => void;
  addIntro: (partnerId: string, intro: Omit<PartnerIntro, "id">) => void;
  deleteIntro: (partnerId: string, introId: string) => void;

  // modules
  upsertCampaign: (c: Campaign) => void;
  deleteCampaign: (id: string) => void;
  upsertMeeting: (m: Meeting) => void;
  deleteMeeting: (id: string) => void;
  upsertNurture: (n: NurtureSequence) => void;
  upsertCompetitor: (c: Competitor) => void;
  deleteCompetitor: (id: string) => void;
  logActivity: (a: Omit<Activity, "id" | "date">) => void;

  // campaign review (relecture avant envoi)
  /** Génère les brouillons du 1er palier de la campagne × prospects ciblés. */
  prepareCampaignDrafts: (campaignId: string) => number;
  updateDraft: (id: string, patch: Partial<CampaignDraft>) => void;
  setDraftStatus: (id: string, status: DraftStatus, error?: string) => void;
  clearCampaignDrafts: (campaignId: string) => void;

  // scripts manuels
  upsertCustomScript: (sc: CustomScript) => void;
  deleteCustomScript: (id: string) => void;

  // cerveau (knowledge base)
  /** Crée ou met à jour une note ; renvoie son id. */
  upsertNote: (note: Partial<KnowledgeNote> & { title: string; body: string }) => string;
  deleteNote: (id: string) => void;

  /** Coche/décoche un item de la barre du jour. */
  toggleStandardItem: (itemId: string, held: boolean) => void;
  /** Fige le verdict du jour (barre tenue ou non). */
  setStandardHeld: (held: boolean) => void;

  // settings / data
  patchSettings: (patch: Partial<AppSettings>) => void;
  /** Bascule le compte white-label actif (identité + offre + commission). */
  switchAccount: (accountId: string) => void;
  /** Bascule « ta part versée » sur un paiement (payout). */
  togglePayoutSettled: (paymentId: string) => void;
  importData: (json: string) => { ok: boolean; error?: string };
  /** Merge imported prospects: match by email or company (case-insensitive). */
  importProspects: (list: Prospect[]) => { added: number; updated: number };
  /** Wipe ALL business data (prospects, campaigns, meetings, activities, intel) — start real. */
  clearAllData: () => void;
  exportData: () => string;
  resetToSeed: () => void;
  /** Charge le pipeline réel de juillet 2026 (Scintia · Lyon) — remplace tout. */
  loadPipelineJuillet: () => void;
  /** Ajoute les prospects ICP Callflow (Sheets réels) — fusionne, n'efface rien. */
  loadProspectsICP: () => { added: number; updated: number };
}

const defaultSettings: AppSettings = {
  accountId: "eagleye",
  agencyName: "EAGLEYE CORP",
  closerName: "Le Closer",
  // Défaut EAGLEYE : Alpha Sales OS se vend lui-même. Un revendeur remplace.
  offer: {
    city: "Lyon",
    whatYouSell: "Alpha Sales OS — l'OS de vente terrain",
    valueProp: "On outille les forces de vente avec l'automatisation IA : zéro lead perdu, la machine tourne 24/7.",
  },
  targetMRR: 5000,
  commissionPct: 30,
  role: "solo",
  businessRules: DEFAULT_BUSINESS_RULES,
  bookingUrl: "",
  apiKeys: [],
  supabaseSync: false,
  onboarded: false,
  security: { pinHash: null, autoLock: false, requireAuth: false },
};

/* Normalizers: fill fields added in later schema versions so old
   localStorage snapshots and imported JSON keep working. */
const normalizeProspect = (p: Partial<Prospect>): Prospect =>
  ({ ...prospectDefaults, ...p }) as Prospect;

const normalizeCampaign = (c: Partial<Campaign>): Campaign =>
  ({
    offerInfo: "",
    cible: "",
    industries: [],
    marketInfo: "",
    leadMagnet: "",
    ...c,
    steps: (c.steps ?? []).map((s) => ({ ...s, role: s.role ?? "premiere-impression" })),
  }) as Campaign;

const normalizeMeeting = (m: Partial<Meeting>): Meeting =>
  ({ channel: "physique", ...m }) as Meeting;

const audit = (actor: string, action: string, target: string): AuditLogEntry => ({
  id: uid(),
  date: new Date().toISOString(),
  actor,
  action,
  target,
});

export const useAlpha = create<AlphaState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      prospects: seedProspects,
      campaigns: seedCampaigns,
      meetings: seedMeetings,
      nurture: seedNurture,
      competitors: seedCompetitors,
      activities: seedActivities,
      auditLog: [],
      settledPayouts: [],
      settings: defaultSettings,
      drafts: [],
      customScripts: [],
      partners: [],
      notes: [...seedKnowledge, ...seedScintia],
      standardLog: [],

      upsertProspect: (p) =>
        set((s) => {
          const exists = s.prospects.some((x) => x.id === p.id);
          const now = new Date().toISOString();
          const next = { ...p, updatedAt: now };
          return {
            prospects: exists ? s.prospects.map((x) => (x.id === p.id ? next : x)) : [{ ...next, createdAt: now }, ...s.prospects],
            activities: exists
              ? s.activities
              : [{ id: uid(), date: now, kind: "prospect" as const, message: `Nouveau prospect : ${p.company}`, prospectId: p.id }, ...s.activities],
            auditLog: [audit(s.settings.closerName, exists ? "update" : "create", `prospect:${p.company}`), ...s.auditLog].slice(0, 500),
          };
        }),

      patchProspect: (id, patch) =>
        set((s) => ({
          prospects: s.prospects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
          ),
        })),

      deleteProspect: (id) =>
        set((s) => ({
          prospects: s.prospects.filter((p) => p.id !== id),
          meetings: s.meetings.filter((m) => m.prospectId !== id),
          auditLog: [audit(s.settings.closerName, "delete", `prospect:${id}`), ...s.auditLog].slice(0, 500),
        })),

      moveStage: (id, stage, extra) => {
        const p = get().prospects.find((x) => x.id === id);
        if (!p) return { ok: false, blockers: ["Prospect introuvable"] };
        if (stage === "signe") {
          const blockers = signingBlockers(p);
          if (blockers.length) return { ok: false, blockers };
        }
        const now = new Date().toISOString();
        set((s) => ({
          prospects: s.prospects.map((x) =>
            x.id === id
              ? {
                  ...x,
                  stage,
                  probability: stageById(stage).probability,
                  wonAt: stage === "signe" ? now : x.wonAt,
                  wonReason: extra?.wonReason ?? x.wonReason,
                  lostReason: extra?.lostReason ?? x.lostReason,
                  contract: stage === "signe" && x.contract.status !== "signe" ? { ...x.contract, status: "signe" as const, signedAt: now } : x.contract,
                  events: [
                    { id: uid(), date: now, kind: "stage" as const, summary: `Étape → ${stageById(stage).label}` },
                    ...x.events,
                  ],
                  updatedAt: now,
                }
              : x
          ),
          activities: [
            {
              id: uid(),
              date: now,
              kind: stage === "signe" ? ("signe" as const) : stage === "perdu" ? ("perdu" as const) : ("stage" as const),
              message:
                stage === "signe"
                  ? `SIGNÉ ✓ ${p.company}`
                  : stage === "perdu"
                    ? `Perdu : ${p.company}`
                    : `${p.company} → ${stageById(stage).label}`,
              prospectId: id,
            },
            ...s.activities,
          ],
          auditLog: [audit(s.settings.closerName, "stage", `${p.company} → ${stage}`), ...s.auditLog].slice(0, 500),
        }));
        return { ok: true, blockers: [] };
      },

      addEvent: (id, ev) =>
        set((s) => ({
          prospects: s.prospects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  events: [{ ...ev, id: uid() }, ...p.events],
                  nextStep: ev.nextStep ?? p.nextStep,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      setNextStep: (id, step) => get().patchProspect(id, { nextStep: step }),

      upsertPartner: (p) =>
        set((s) => {
          const now = new Date().toISOString();
          const exists = s.partners.some((x) => x.id === p.id);
          const next = { ...p, updatedAt: now };
          return {
            partners: exists
              ? s.partners.map((x) => (x.id === p.id ? next : x))
              : [{ ...next, createdAt: now }, ...s.partners],
            activities: [
              {
                id: uid(),
                date: now,
                kind: "prospect" as const,
                message: exists ? `Prescripteur mis à jour — ${p.organisation}` : `Prescripteur ajouté — ${p.organisation}`,
              },
              ...s.activities,
            ],
          };
        }),

      deletePartner: (id) => set((s) => ({ partners: s.partners.filter((p) => p.id !== id) })),

      addIntro: (partnerId, intro) =>
        set((s) => {
          const now = new Date().toISOString();
          return {
            partners: s.partners.map((p) =>
              p.id === partnerId
                ? {
                    ...p,
                    intros: [{ ...intro, id: uid() }, ...p.intros],
                    // Une mise en relation prouve que le partenaire est vivant.
                    // C'est le seul signal qui vaille : un accord signé qui ne
                    // produit rien n'est pas un partenaire actif.
                    status: p.status === "dormant" || p.status === "accord" ? ("actif" as const) : p.status,
                    updatedAt: now,
                  }
                : p
            ),
            activities: [
              {
                id: uid(),
                date: now,
                kind: "prospect" as const,
                message: `Mise en relation reçue — ${intro.company}`,
                prospectId: intro.prospectId,
              },
              ...s.activities,
            ],
          };
        }),

      deleteIntro: (partnerId, introId) =>
        set((s) => ({
          partners: s.partners.map((p) =>
            p.id === partnerId ? { ...p, intros: p.intros.filter((i) => i.id !== introId) } : p
          ),
        })),

      upsertCampaign: (c) =>
        set((s) => ({
          campaigns: s.campaigns.some((x) => x.id === c.id)
            ? s.campaigns.map((x) => (x.id === c.id ? c : x))
            : [c, ...s.campaigns],
        })),
      deleteCampaign: (id) => set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),

      upsertMeeting: (m) =>
        set((s) => ({
          meetings: s.meetings.some((x) => x.id === m.id)
            ? s.meetings.map((x) => (x.id === m.id ? m : x))
            : [m, ...s.meetings],
        })),
      deleteMeeting: (id) => set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) })),

      upsertNurture: (n) =>
        set((s) => ({
          nurture: s.nurture.some((x) => x.id === n.id)
            ? s.nurture.map((x) => (x.id === n.id ? n : x))
            : [n, ...s.nurture],
        })),

      upsertCompetitor: (c) =>
        set((s) => ({
          competitors: s.competitors.some((x) => x.id === c.id)
            ? s.competitors.map((x) => (x.id === c.id ? c : x))
            : [c, ...s.competitors],
        })),
      deleteCompetitor: (id) => set((s) => ({ competitors: s.competitors.filter((c) => c.id !== id) })),

      logActivity: (a) =>
        set((s) => ({
          activities: [{ ...a, id: uid(), date: new Date().toISOString() }, ...s.activities].slice(0, 300),
        })),

      prepareCampaignDrafts: (campaignId) => {
        const s = get();
        const camp = s.campaigns.find((c) => c.id === campaignId);
        if (!camp) return 0;
        // Palier de départ : la première impression (sinon la 1re étape).
        const step = camp.steps.find((x) => x.role === "premiere-impression") ?? camp.steps[0];
        if (!step) return 0;
        const closer = s.settings.closerName;
        const recipients = s.prospects.filter(
          (p) => (camp.sector === "tous" || p.sector === camp.sector) && p.stage !== "signe" && p.stage !== "perdu"
        );
        const drafts: CampaignDraft[] = recipients.map((p) => {
          const to = step.kind === "email" ? (p.email ?? "") : (p.phone ?? "");
          return {
            id: uid(),
            campaignId,
            prospectId: p.id,
            company: p.company,
            channel: step.kind,
            to,
            subject: step.kind === "email" ? fillTemplate(step.subject, p, closer) : "",
            body: fillTemplate(step.body, p, closer),
            status: to ? "pending" : "skipped",
            error: to ? undefined : step.kind === "email" ? "pas d'email sur la fiche" : "pas de téléphone",
          };
        });
        set((st) => ({ drafts: [...st.drafts.filter((d) => d.campaignId !== campaignId), ...drafts] }));
        return drafts.length;
      },

      updateDraft: (id, patch) =>
        set((s) => ({ drafts: s.drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

      setDraftStatus: (id, status, error) =>
        set((s) => ({ drafts: s.drafts.map((d) => (d.id === id ? { ...d, status, error } : d)) })),

      clearCampaignDrafts: (campaignId) =>
        set((s) => ({ drafts: s.drafts.filter((d) => d.campaignId !== campaignId) })),

      upsertCustomScript: (sc) =>
        set((s) => ({
          customScripts: s.customScripts.some((x) => x.id === sc.id)
            ? s.customScripts.map((x) => (x.id === sc.id ? { ...sc, updatedAt: new Date().toISOString() } : x))
            : [{ ...sc }, ...s.customScripts],
        })),
      deleteCustomScript: (id) =>
        set((s) => ({ customScripts: s.customScripts.filter((x) => x.id !== id) })),

      upsertNote: (note) => {
        const now = new Date().toISOString();
        const id = note.id ?? uid();
        set((s) => {
          const exists = s.notes.some((n) => n.id === id);
          const next: KnowledgeNote = {
            id,
            title: note.title,
            body: note.body,
            tags: note.tags ?? [],
            source: note.source ?? "manuel",
            // Portée : le compte fourni, sinon celui de la note existante,
            // sinon le compte ACTIF. Une note créée depuis ScintIA reste à
            // ScintIA — sans ça, tout retomberait dans le pot commun.
            accountId: note.accountId ?? s.notes.find((n) => n.id === id)?.accountId ?? s.settings.accountId,
            createdAt: exists ? s.notes.find((n) => n.id === id)!.createdAt : now,
            updatedAt: now,
          };
          return { notes: exists ? s.notes.map((n) => (n.id === id ? next : n)) : [next, ...s.notes] };
        });
        return id;
      },
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      toggleStandardItem: (itemId, held) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          const idx = s.standardLog.findIndex((d) => d.date === today);
          const day = idx >= 0 ? s.standardLog[idx] : { date: today, checked: [] as string[] };
          const checked = day.checked.includes(itemId)
            ? day.checked.filter((x) => x !== itemId)
            : [...day.checked, itemId];
          const next = { ...day, checked, held };
          const log = idx >= 0 ? s.standardLog.map((d, i) => (i === idx ? next : d)) : [next, ...s.standardLog];
          // On garde un an d'historique : au-delà, la série n'a plus d'usage
          // et le store gonfle pour rien.
          return { standardLog: log.slice(0, 400) };
        }),

      setStandardHeld: (held) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          const idx = s.standardLog.findIndex((d) => d.date === today);
          if (idx < 0) return { standardLog: [{ date: today, checked: [], held }, ...s.standardLog] };
          return { standardLog: s.standardLog.map((d, i) => (i === idx ? { ...d, held } : d)) };
        }),

      patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      switchAccount: (accountId) =>
        set((s) => ({ settings: { ...s.settings, ...applyAccount(accountId) } })),

      togglePayoutSettled: (paymentId) =>
        set((s) => ({
          settledPayouts: s.settledPayouts.includes(paymentId)
            ? s.settledPayouts.filter((x) => x !== paymentId)
            : [...s.settledPayouts, paymentId],
        })),

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          if (!Array.isArray(data.prospects)) throw new Error("Format invalide : « prospects » manquant");
          set((s) => ({
            prospects: data.prospects.map(normalizeProspect),
            campaigns: (data.campaigns ?? s.campaigns).map(normalizeCampaign),
            meetings: (data.meetings ?? s.meetings).map(normalizeMeeting),
            nurture: data.nurture ?? s.nurture,
            competitors: data.competitors ?? s.competitors,
            activities: data.activities ?? s.activities,
            settings: { ...s.settings, ...(data.settings ?? {}) },
            auditLog: [audit(s.settings.closerName, "import", `${data.prospects.length} prospects`), ...s.auditLog].slice(0, 500),
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "JSON invalide" };
        }
      },

      importProspects: (list) => {
        let added = 0;
        let updated = 0;
        set((s) => {
          const next = [...s.prospects];
          for (const raw of list) {
            const p = normalizeProspect(raw);
            const idx = next.findIndex(
              (x) =>
                (p.email && x.email && x.email.toLowerCase() === p.email.toLowerCase()) ||
                x.company.trim().toLowerCase() === p.company.trim().toLowerCase()
            );
            if (idx >= 0) {
              // keep local pipeline state, refresh identity + audit data.
              // History du CRM (écrit par n8n) : fusionné dans la timeline, dédupliqué.
              const seen = new Set(next[idx].events.map((e) => `${e.date.slice(0, 16)}|${e.summary}`));
              const newEvents = p.events.filter((e) => !seen.has(`${e.date.slice(0, 16)}|${e.summary}`));
              next[idx] = {
                ...next[idx],
                events: newEvents.length ? [...newEvents, ...next[idx].events].sort((a, b) => b.date.localeCompare(a.date)) : next[idx].events,
                nextStep: next[idx].nextStep ?? p.nextStep,
                name: p.name || next[idx].name,
                phone: p.phone ?? next[idx].phone,
                email: p.email ?? next[idx].email,
                city: p.city || next[idx].city,
                sector: p.sector !== "autre" ? p.sector : next[idx].sector,
                monthlyValue: p.monthlyValue || next[idx].monthlyValue,
                setupValue: p.setupValue || next[idx].setupValue,
                ignoranceTax: p.ignoranceTax || next[idx].ignoranceTax,
                notes: p.notes || next[idx].notes,
                problems: p.problems.length ? p.problems : next[idx].problems,
                deepAudit: { ...next[idx].deepAudit, ...Object.fromEntries(Object.entries(p.deepAudit).filter(([, v]) => v !== undefined && v !== "")) },
                preferredChannel: p.preferredChannel ?? next[idx].preferredChannel,
                satisfaction: p.satisfaction ?? next[idx].satisfaction,
                testimonial: p.testimonial ?? next[idx].testimonial,
                upsell: p.upsell ?? next[idx].upsell,
                updatedAt: new Date().toISOString(),
              };
              // L'audit a pu s'enrichir à l'import : on recalcule sa complétude
              // (jamais à la baisse — un audit fait à la main reste acquis).
              next[idx].auditScore = Math.max(next[idx].auditScore, auditCompleteness(next[idx]));
              updated++;
            } else {
              // Score d'audit HONNÊTE : ce qu'on sait réellement de la fiche.
              // Sans ça, une fiche vide passerait pour exploitable.
              if (!p.auditScore) p.auditScore = auditCompleteness(p);
              next.unshift(p);
              added++;
            }
          }
          return {
            prospects: next,
            activities: [
              { id: uid(), date: new Date().toISOString(), kind: "systeme" as const, message: `Import : ${added} nouveau(x) prospect(s), ${updated} mis à jour` },
              ...s.activities,
            ],
            auditLog: [audit(s.settings.closerName, "import-csv", `${added} added / ${updated} updated`), ...s.auditLog].slice(0, 500),
          };
        });
        return { added, updated };
      },

      clearAllData: () =>
        set((s) => ({
          prospects: [],
          campaigns: [],
          meetings: [],
          nurture: [],
          competitors: [],
          drafts: [],
          activities: [
            { id: uid(), date: new Date().toISOString(), kind: "systeme" as const, message: "Données de démo effacées — mode données réelles" },
          ],
          auditLog: [audit(s.settings.closerName, "clear-all", "all business data"), ...s.auditLog].slice(0, 500),
        })),

      exportData: () => {
        const { prospects, campaigns, meetings, nurture, competitors, activities, settings } = get();
        return JSON.stringify({ exportedAt: new Date().toISOString(), prospects, campaigns, meetings, nurture, competitors, activities, settings }, null, 2);
      },

      loadPipelineJuillet: () => {
        const { pipelineJuillet } = require("./pipeline-juillet") as typeof import("./pipeline-juillet");
        const { prospects, meetings } = pipelineJuillet();
        set((s) => ({
          prospects,
          meetings,
          campaigns: [],
          drafts: [],
          activities: [
            {
              id: uid(),
              date: new Date().toISOString(),
              kind: "systeme" as const,
              message: `Pipeline réel de juillet 2026 chargé — ${prospects.length} fiches, ${meetings.length} rendez-vous`,
            },
            ...s.activities,
          ],
          settings: { ...s.settings, onboarded: true },
        }));
      },

      loadProspectsICP: () => {
        const { csvToProspects } = require("./csv") as typeof import("./csv");
        const { PROSPECTS_ICP_CSV } = require("./prospects-icp") as typeof import("./prospects-icp");
        const { prospects } = csvToProspects(PROSPECTS_ICP_CSV);
        // Fusionne (ajoute / met à jour) — n'efface pas le pipeline existant.
        return get().importProspects(prospects);
      },

      resetToSeed: () =>
        set({
          prospects: seedProspects,
          campaigns: seedCampaigns,
          meetings: seedMeetings,
          nurture: seedNurture,
          competitors: seedCompetitors,
          activities: seedActivities,
          settings: defaultSettings,
          drafts: [],
          partners: [],
        }),
    }),
    {
      name: "alpha-sales-os-v2",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const s = persisted as Partial<AlphaState>;
        return {
          ...s,
          prospects: (s.prospects ?? []).map(normalizeProspect),
          campaigns: (s.campaigns ?? []).map(normalizeCampaign),
          meetings: (s.meetings ?? []).map(normalizeMeeting),
          drafts: s.drafts ?? [],
          customScripts: s.customScripts ?? [],
          partners: s.partners ?? [],
          // Cerveau : socle de notes si le store précède la v5.
          notes: s.notes ?? [...seedKnowledge, ...seedScintia],
          standardLog: s.standardLog ?? [],
          settledPayouts: s.settledPayouts ?? [],
          settings: { ...defaultSettings, ...s.settings, security: { ...defaultSettings.security, ...s.settings?.security } },
        } as AlphaState;
      },
    }
  )
);

// Flip the flag via the persist API — never inside onRehydrateStorage, which
// fires during create() while `useAlpha` is still in its temporal dead zone.
if (typeof window !== "undefined") {
  if (useAlpha.persist.hasHydrated()) useAlpha.setState({ hydrated: true });
  useAlpha.persist.onFinishHydration(() => useAlpha.setState({ hydrated: true }));
}

/** SSR-safe hydration gate — render seed data until localStorage is read. */
export const useHydrated = () => useAlpha((s) => s.hydrated);
