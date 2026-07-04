"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Activity,
  AppSettings,
  AuditLogEntry,
  Campaign,
  Competitor,
  Meeting,
  NextStep,
  NurtureSequence,
  Prospect,
  Stage,
  TimelineEvent,
} from "./types";
import {
  seedActivities,
  seedCampaigns,
  seedCompetitors,
  seedMeetings,
  seedNurture,
  seedProspects,
  DEFAULT_BUSINESS_RULES,
} from "./seed";
import { stageById, signingBlockers } from "./hormozi";
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
  settings: AppSettings;

  // prospects
  upsertProspect: (p: Prospect) => void;
  patchProspect: (id: string, patch: Partial<Prospect>) => void;
  deleteProspect: (id: string) => void;
  moveStage: (id: string, stage: Stage) => { ok: boolean; blockers: string[] };
  addEvent: (id: string, ev: Omit<TimelineEvent, "id">) => void;
  setNextStep: (id: string, step: NextStep | null) => void;

  // modules
  upsertCampaign: (c: Campaign) => void;
  deleteCampaign: (id: string) => void;
  upsertMeeting: (m: Meeting) => void;
  deleteMeeting: (id: string) => void;
  upsertNurture: (n: NurtureSequence) => void;
  upsertCompetitor: (c: Competitor) => void;
  deleteCompetitor: (id: string) => void;
  logActivity: (a: Omit<Activity, "id" | "date">) => void;

  // settings / data
  patchSettings: (patch: Partial<AppSettings>) => void;
  importData: (json: string) => { ok: boolean; error?: string };
  exportData: () => string;
  resetToSeed: () => void;
}

const defaultSettings: AppSettings = {
  agencyName: "EAGLEYE CORP",
  closerName: "Le Closer",
  targetMRR: 5000,
  commissionPct: 30,
  role: "solo",
  businessRules: DEFAULT_BUSINESS_RULES,
  apiKeys: [],
  supabaseSync: false,
};

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
      settings: defaultSettings,

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

      moveStage: (id, stage) => {
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

      patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          if (!Array.isArray(data.prospects)) throw new Error("Format invalide : « prospects » manquant");
          set((s) => ({
            prospects: data.prospects,
            campaigns: data.campaigns ?? s.campaigns,
            meetings: data.meetings ?? s.meetings,
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

      exportData: () => {
        const { prospects, campaigns, meetings, nurture, competitors, activities, settings } = get();
        return JSON.stringify({ exportedAt: new Date().toISOString(), prospects, campaigns, meetings, nurture, competitors, activities, settings }, null, 2);
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
        }),
    }),
    {
      name: "alpha-sales-os-v2",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state && useAlpha.setState({ hydrated: true });
      },
    }
  )
);

/** SSR-safe hydration gate — render seed data until localStorage is read. */
export const useHydrated = () => useAlpha((s) => s.hydrated);
