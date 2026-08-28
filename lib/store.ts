"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isQuotaError } from "./storage-health";
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
  isDemoProspect,
} from "./seed";
import { stageById, signingBlockers } from "./hormozi";
// ⚠ Le SOCLE de notes n'est plus importé ici. Il portait le playbook en clair
// (adresses partenaires, prix de setup, taux par offre) et le store est importé
// par toutes les pages client : il partait donc dans chaque bundle. Il arrive
// maintenant par /api/knowledge/seed — voir `seedNotes` plus bas.
import type { KnowledgeNote } from "./knowledge";
import type { Lecon } from "./apprentissage";
import { OFFRES_SYSTEME, idDepuisLabel, peutSupprimer, validerOffre, type ErreurOffre, type Offre } from "./offer-catalogue";
import { elaguer } from "./apprentissage";
import { applyAccount } from "./accounts";
import { CLOSER_USINE } from "./signature";
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
  /**
   * Les offres que l'OPÉRATEUR vend à SES prospects.
   *
   * ⚠ Rien à voir avec `lib/bricks.ts`, qui est NOTRE catalogue. Un couvreur
   * qui utilise Alpha Sales OS vend des toitures, pas Alpha Voice. Ses offres
   * sont sa donnée, et il doit pouvoir les changer sans nous appeler.
   */
  offers: Offre[];
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
  /** Fusionne le socle du Cerveau servi par le serveur (une seule fois). */
  seedNotes: (socle: KnowledgeNote[]) => void;
  /** Crée ou met à jour une offre. Renvoie les erreurs de validation, ou []. */
  upsertOffre: (o: Partial<Offre>) => ErreurOffre[];
  /** Active / désactive une offre sans toucher à l'historique. */
  basculerOffre: (id: string, actif: boolean) => void;
  /** Supprime une offre — refuse si le routage en dépend. */
  supprimerOffre: (id: string) => { ok: boolean; raison?: string };
  /** Écrit une leçon de terrain dans le Cerveau. `null` = rien à apprendre. */
  apprendre: (lecon: Lecon | null) => string | null;
  deleteNote: (id: string) => void;

  /** Coche/décoche un item de la barre du jour. */
  toggleStandardItem: (itemId: string, held: boolean) => void;
  /** Fige le verdict du jour (barre tenue ou non). */
  setStandardHeld: (held: boolean) => void;

  // settings / data
  patchSettings: (patch: Partial<AppSettings>) => void;
  /**
   * Écrit (ou efface) la version modifiée d'un prompt.
   *
   * ⚠ Le texte n'est PAS validé ici : la validation appartient à l'écran, qui
   * doit pouvoir MONTRER ce qui manque avant d'écrire. Un store qui refuse en
   * silence produit un bouton qui ne fait rien. `texteEffectif` protège la
   * sortie de toute façon : une version devenue non conforme retombe sur le
   * défaut, et l'écran le dit.
   *
   * Passer une chaîne vide REVIENT AU TEXTE LIVRÉ — c'est le « annuler ma
   * modification » de l'écran, et il ne doit pas laisser d'entrée fantôme.
   */
  setPrompt: (id: string, texte: string) => void;
  /** Marque des prompts comme poussés vers n8n, à l'instant donné. */
  marquerPromptsPousses: (ids: string[], quand?: string) => void;
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
  loadPipelineJuillet: () => Promise<void>;
  /** Ajoute les prospects ICP Callflow (Sheets réels) — fusionne, n'efface rien. */
  loadProspectsICP: () => Promise<{ added: number; updated: number }>;
}

const defaultSettings: AppSettings = {
  accountId: "eagleye",
  agencyName: "EAGLEYE CORP",
  // Le nom d'usine vient de `lib/signature` : c'est LUI que les contrôles
  // reconnaissent comme « personne n'est identifié ». Une copie de la chaîne
  // ici dériverait, et le détecteur cesserait de l'attraper en silence.
  closerName: CLOSER_USINE,
  // Défaut EAGLEYE : Alpha Sales OS se vend lui-même. Un revendeur remplace.
  offer: {
    city: "Lyon",
    whatYouSell: "Alpha Sales OS — l'OS de vente terrain",
    valueProp: "On outille les forces de vente avec l'automatisation IA : zéro lead perdu, la machine tourne 24/7.",
  },
  targetMRR: 5000,
  // Le compte par défaut est EAGLEYE — notre société. Rien à reverser, donc
  // 100 %. À 30 %, un store neuf affichait dans les payouts un tiers du CA de
  // NOS propres ventes, et les deux autres tiers n'allaient nulle part.
  commissionPct: 100,
  role: "solo",
  // Vide au départ : la doctrine par défaut récite la grille tarifaire, elle
  // vient donc du serveur (voir components/cerveau/seed-loader.tsx).
  //
  // Les routes IA appliquent `doctrineOrDefault()` : une doctrine vide y est
  // remplacée par celle de la maison. Sans ce repli — qui n'existait pas —,
  // un store neuf faisait tourner l'IA sans « jamais de prix avant la démo »,
  // silencieusement.
  businessRules: "",
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

/**
 * Plafonds des journaux — ce sont des FLUX, pas des données.
 *
 * Ils vivent dans le même blob localStorage que le CRM, et le quota (~5 Mo)
 * est partagé. Un journal sans plafond finit par expulser les fiches, ce qui
 * est exactement l'inverse de la priorité.
 *
 * `addActivity` plafonnait déjà à 300. Trois autres chemins (changement
 * d'étape, ajout d'intro, ajout de partenaire) empilaient sans borne : le
 * plafond dépendait donc de PAR OÙ l'entrée arrivait. D'où ce helper unique —
 * un plafond qui se recopie à la main finit toujours par diverger.
 */
const MAX_ACTIVITES = 300;
const MAX_AUDIT = 500;
const MAX_JOURS_STANDARD = 400;

/** Empile une activité en tête, en respectant le plafond. */
const pousserActivite = (liste: Activity[], entree: Activity): Activity[] =>
  [entree, ...liste].slice(0, MAX_ACTIVITES);

const audit = (actor: string, action: string, target: string): AuditLogEntry => ({
  id: uid(),
  date: new Date().toISOString(),
  actor,
  action,
  target,
});

/**
 * `localStorage`, mais qui DIT quand il n'écrit plus.
 *
 * Le quota (~5 Mo) se remplit vite : le Cerveau y met le texte intégral des
 * PDF importés. Au dépassement, `setItem` lève et l'écriture est perdue — en
 * silence. L'opérateur continuait sa journée, saisissait des fiches, notait
 * ses appels, puis fermait l'onglet : tout ce qui suivait la première
 * écriture ratée n'avait jamais existé.
 *
 * On ne peut pas empêcher le quota d'exister. On peut refuser qu'il échoue
 * sans bruit : l'échec est mémorisé et remonté dans l'état, un écran le
 * montre, et l'opérateur sait qu'il doit synchroniser ou alléger AVANT de
 * perdre quoi que ce soit.
 */
/**
 * ── L'ÉCRITURE DIFFÉRÉE, et pourquoi elle est indispensable ──
 *
 * MESURÉ : zustand n'a pas de `partialize`, donc CHAQUE écriture sérialise
 * l'état entier. Et le champ « Notes » de la fiche prospect appelle
 * `patchProspect` à chaque frappe. Résultat : à 500 fiches, taper une note
 * réécrivait ~1,9 Mo de JSON par caractère — 10 ms de `JSON.stringify` mesurés
 * en Node, et `localStorage.setItem` est SYNCHRONE et plus lent que ça dans un
 * navigateur. La frappe devient visiblement saccadée bien avant le quota.
 *
 * On groupe donc les écritures : la dernière gagne, après un court silence.
 *
 * ⚠ LE PIÈGE DE TOUT DÉBOUNCE DE PERSISTANCE : si l'onglet se ferme pendant
 * le délai, l'écriture n'a jamais lieu et la saisie est perdue — exactement le
 * bug qu'on prétend éviter. D'où le vidage forcé sur `pagehide` et sur
 * `visibilitychange`, les deux seuls événements qu'un navigateur mobile
 * garantit avant de tuer un onglet (`beforeunload` ne se déclenche pas sur
 * iOS). `flushStorage()` est aussi exporté pour les tests.
 */
const DELAI_ECRITURE_MS = 400;
let enAttente: { cle: string; valeur: string } | null = null;
let minuterie: ReturnType<typeof setTimeout> | null = null;

/** Écrit immédiatement ce qui attend. Idempotent. */
export function flushStorage(): void {
  if (minuterie) {
    clearTimeout(minuterie);
    minuterie = null;
  }
  const p = enAttente;
  enAttente = null;
  if (p) ecrireVraiment(p.cle, p.valeur);
}

if (typeof window !== "undefined") {
  // `pagehide` couvre la fermeture ET le bfcache (iOS) ; `visibilitychange`
  // couvre le passage en arrière-plan, seul signal fiable sur mobile.
  window.addEventListener("pagehide", flushStorage);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushStorage();
  });
}

function ecrireVraiment(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
    // Une écriture qui repasse efface l'alerte : le problème est réglé.
    if (storageFailed) {
      storageFailed = false;
      notifyStorage(false);
    }
  } catch (e) {
    if (isQuotaError(e)) {
      storageFailed = true;
      notifyStorage(true);
      // On NE relance PAS : faire planter l'app par-dessus la perte de
      // données n'aide personne. L'alerte, elle, est visible.
      return;
    }
    throw e;
  }
}

const guardedLocalStorage: Storage = {
  get length() {
    return localStorage.length;
  },
  key: (i: number) => localStorage.key(i),
  getItem: (k: string) => {
    // Une lecture doit voir ce qui attend : sans ça, un rechargement de l'état
    // juste après une écriture différée renverrait la version d'avant.
    if (enAttente?.cle === k) return enAttente.valeur;
    return localStorage.getItem(k);
  },
  removeItem: (k: string) => {
    // Effacer annule ce qui attend, sinon la minuterie ressusciterait la clé.
    if (enAttente?.cle === k) enAttente = null;
    localStorage.removeItem(k);
  },
  clear: () => {
    enAttente = null;
    localStorage.clear();
  },
  setItem: (k: string, v: string) => {
    // Hors navigateur (tests), on écrit tout de suite : pas de minuterie qui
    // traîne et fait échouer un test pour une raison sans rapport.
    if (typeof window === "undefined") {
      ecrireVraiment(k, v);
      return;
    }
    enAttente = { cle: k, valeur: v };
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      minuterie = null;
      const p = enAttente;
      enAttente = null;
      if (p) ecrireVraiment(p.cle, p.valeur);
    }, DELAI_ECRITURE_MS);
  },
};

let storageFailed = false;

/**
 * Remontée de l'échec vers l'interface.
 *
 * Passe par un évènement plutôt que par `setState` : on est ici DANS
 * l'écriture du store, et déclencher une mise à jour d'état au milieu
 * provoquerait une nouvelle écriture, donc une boucle.
 */
function notifyStorage(failed: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("alpha:storage", { detail: { failed } }));
}

/** L'écriture locale est-elle en échec ? Lu par l'alerte d'interface. */
export const storageIsFailing = (): boolean => storageFailed;

/**
 * Numéro réduit à ses chiffres significatifs, pour comparer deux écritures.
 *
 * « 04 78 12 34 56 », « +33478123456 » et « 0478123456 » sont le même
 * téléphone. Comparer les chaînes brutes ferait échouer la fusion sur la seule
 * différence de mise en forme entre deux sources — et deux fiches au même
 * numéro, c'est deux appels à la même personne.
 */
function normTel(tel: string | undefined): string {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return "";
  // 0478123456 et 33478123456 pointent le même poste : on garde les 9 derniers
  // chiffres, qui suffisent à identifier une ligne française.
  return d.length >= 9 ? d.slice(-9) : d;
}

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
      notes: [],
      // Recopiées du socle : ensuite elles appartiennent à l'opérateur.
      offers: OFFRES_SYSTEME.map((o) => ({ ...o })),
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
            auditLog: [audit(s.settings.closerName, exists ? "update" : "create", `prospect:${p.company}`), ...s.auditLog].slice(0, MAX_AUDIT),
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
          auditLog: [audit(s.settings.closerName, "delete", `prospect:${id}`), ...s.auditLog].slice(0, MAX_AUDIT),
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
          activities: pousserActivite(s.activities, {
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
          }),
          auditLog: [audit(s.settings.closerName, "stage", `${p.company} → ${stage}`), ...s.auditLog].slice(0, MAX_AUDIT),
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
            activities: pousserActivite(s.activities, {
              id: uid(),
              date: now,
              kind: "prospect" as const,
              message: exists ? `Prescripteur mis à jour — ${p.organisation}` : `Prescripteur ajouté — ${p.organisation}`,
            }),
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
            activities: pousserActivite(s.activities, {
              id: uid(),
              date: now,
              kind: "prospect" as const,
              message: `Mise en relation reçue — ${intro.company}`,
              prospectId: intro.prospectId,
            }),
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
          activities: pousserActivite(s.activities, { ...a, id: uid(), date: new Date().toISOString() }),
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
          /**
           * ⚠ Une fiche de DÉMONSTRATION ne devient jamais un brouillon
           * envoyable. Son adresse est inventée : écrire dessus produit un
           * rebond dur, et les rebonds comptent contre le domaine pendant des
           * mois. `/api/send` le refuse au point de passage, mais un brouillon
           * « pending » qui échouera à l'envoi est un mensonge d'interface —
           * l'opérateur approuve quarante messages et en voit huit tomber.
           *
           * On réutilise le mécanisme qui existe déjà pour « pas d'email sur
           * la fiche » : statut `skipped` + raison écrite. L'écran de revue
           * l'affiche sans une ligne de code de plus.
           */
          const demo = isDemoProspect(p.id);
          return {
            id: uid(),
            campaignId,
            prospectId: p.id,
            company: p.company,
            channel: step.kind,
            to,
            subject: step.kind === "email" ? fillTemplate(step.subject, p, closer) : "",
            body: fillTemplate(step.body, p, closer),
            status: demo || !to ? "skipped" : "pending",
            error: demo
              ? "fiche de démonstration — adresse inventée, rebond dur garanti"
              : to
                ? undefined
                : step.kind === "email"
                  ? "pas d'email sur la fiche"
                  : "pas de téléphone",
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

      upsertOffre: (o) => {
        const existantes = get().offers;
        const erreurs = validerOffre(o, existantes);
        // On refuse AVANT d'écrire : une offre à moitié valide qui traîne dans
        // le store ressort dans un email ou un prompt, et là il est trop tard.
        if (erreurs.length) return erreurs;

        const id = o.id ?? idDepuisLabel(o.label ?? "", existantes);
        const ancienne = existantes.find((x) => x.id === id);
        const suivante: Offre = {
          id,
          label: (o.label ?? "").trim(),
          what: (o.what ?? "").trim(),
          pitch: (o.pitch ?? "").trim(),
          setupHT: Math.max(0, o.setupHT ?? 0),
          monthlyHT: Math.max(0, o.monthlyHT ?? 0),
          famille: o.famille!,
          actif: o.actif ?? true,
          // Le drapeau système ne s'invente pas : il vient de l'offre existante,
          // jamais de l'entrée. Sinon n'importe qui rendrait son offre
          // indélébile en cochant une case.
          systeme: ancienne?.systeme,
        };
        set((s) => ({
          offers: ancienne ? s.offers.map((x) => (x.id === id ? suivante : x)) : [...s.offers, suivante],
        }));
        return [];
      },

      basculerOffre: (id, actif) =>
        set((s) => ({ offers: s.offers.map((o) => (o.id === id ? { ...o, actif } : o)) })),

      supprimerOffre: (id) => {
        const toutes = get().offers;
        const o = toutes.find((x) => x.id === id);
        if (!o) return { ok: false, raison: "Offre introuvable." };
        const verdict = peutSupprimer(o, toutes);
        if (!verdict.ok) return verdict;
        set((s) => ({ offers: s.offers.filter((x) => x.id !== id) }));
        return { ok: true };
      },

      /**
       * Enregistre une LEÇON tirée du terrain dans le Cerveau.
       *
       * C'est la seule écriture automatique de la mémoire. Elle passe par
       * `upsertNote`, donc l'identifiant déterministe des leçons fait une mise
       * à jour et non un doublon : rejouer un débrief n'empile pas.
       *
       * `null` en entrée = la leçon n'avait pas de substance (voir
       * lib/apprentissage.ts, règle 2). On ne l'écrit pas, et ce n'est pas une
       * erreur — c'est le cas normal d'un débrief vide.
       */
      apprendre: (lecon) => {
        if (!lecon) return null;
        const id = get().upsertNote(lecon);
        // Élagage APRÈS écriture : la mémoire de terrain grossit à chaque
        // objection et chaque perte, sans que rien ne la borne. Sans ça, elle
        // mange le quota localStorage et fait laguer Alpha Live pendant un
        // appel réel (search() = 62 ms sur 5 000 notes, mesuré).
        set((s) => {
          const gardees = elaguer(s.notes);
          return gardees.length === s.notes.length ? {} : { notes: gardees };
        });
        return id;
      },

      /**
       * Fusionne le socle servi par le serveur, UNE seule fois.
       *
       * Deux pièges évités :
       *  · réécraser une note du socle que l'utilisateur a modifiée — on ne
       *    touche jamais un id déjà présent ;
       *  · faire réapparaître une note qu'il a supprimée — d'où le drapeau
       *    `knowledgeSeeded` : après le premier semis, on ne rajoute plus rien.
       */
      seedNotes: (socle) =>
        set((s) => {
          if (s.settings.knowledgeSeeded) return {};
          const connus = new Set(s.notes.map((n) => n.id));
          const ajouts = socle.filter((n) => !connus.has(n.id));
          return {
            notes: [...s.notes, ...ajouts],
            settings: { ...s.settings, knowledgeSeeded: true },
          };
        }),

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

      setPrompt: (id, texte) =>
        set((s) => {
          const autres = (s.settings.prompts ?? []).filter((p) => p.id !== id);
          const t = texte.trim();
          if (!t) return { settings: { ...s.settings, prompts: autres } };
          return {
            settings: {
              ...s.settings,
              prompts: [...autres, { id, texte: t, modifieLe: new Date().toISOString() }],
            },
          };
        }),

      marquerPromptsPousses: (ids, quand) =>
        set((s) => {
          const at = quand ?? new Date().toISOString();
          const set_ = new Set(ids);
          return {
            settings: {
              ...s.settings,
              prompts: (s.settings.prompts ?? []).map((p) => (set_.has(p.id) ? { ...p, pousseLe: at } : p)),
            },
          };
        }),

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
            auditLog: [audit(s.settings.closerName, "import", `${data.prospects.length} prospects`), ...s.auditLog].slice(0, MAX_AUDIT),
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
            /**
             * ⚠ LE TÉLÉPHONE AVANT LE NOM.
             *
             * La fusion se faisait sur l'email ou le NOM D'ENTREPRISE. Sur un
             * import terrain, « Carrosserie des Lilas » et « Carrosserie des
             * Lilas SARL » sont deux noms — donc deux fiches, donc DEUX APPELS
             * au même numéro. Le module de sourcing calcule pourtant un
             * identifiant stable sur le numéro : il ne servait à rien ici,
             * parce que cette fusion-ci ne regarde pas l'identifiant.
             *
             * Un numéro est unique, un nom d'entreprise ne l'est pas. Il passe
             * donc en premier — l'ordre compte, `findIndex` s'arrête au
             * premier trouvé.
             */
            const telP = normTel(p.phone);
            const idx = next.findIndex(
              (x) =>
                (telP && normTel(x.phone) === telP) ||
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
                // Les tags s'AJOUTENT au lieu d'être ignorés : une fiche
                // réimportée avec un extrait d'avis nouvellement relevé doit
                // gagner son tag « injoignable », sinon le relevé ne sert à
                // rien une fois la fiche déjà connue.
                tags: Array.from(new Set([...next[idx].tags, ...p.tags])),
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
            activities: pousserActivite(s.activities, {
              id: uid(),
              date: new Date().toISOString(),
              kind: "systeme" as const,
              message: `Import : ${added} nouveau(x) prospect(s), ${updated} mis à jour`,
            }),
            auditLog: [audit(s.settings.closerName, "import-csv", `${added} added / ${updated} updated`), ...s.auditLog].slice(0, MAX_AUDIT),
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
          auditLog: [audit(s.settings.closerName, "clear-all", "all business data"), ...s.auditLog].slice(0, MAX_AUDIT),
        })),

      exportData: () => {
        const { prospects, campaigns, meetings, nurture, competitors, activities, settings } = get();
        return JSON.stringify({ exportedAt: new Date().toISOString(), prospects, campaigns, meetings, nurture, competitors, activities, settings }, null, 2);
      },

      /**
       * Charge le pipeline réel de juillet — DEPUIS LE SERVEUR.
       *
       * C'était un `require("./pipeline-juillet")`. Un require de chemin
       * statique n'est pas paresseux pour le bundler : les seize fiches
       * (noms, adresses, TÉLÉPHONES d'entreprises réelles) partaient dans le
       * chunk client, téléchargeable sans mot de passe. Voir /api/pipeline.
       */
      loadPipelineJuillet: async () => {
        const r = await fetch("/api/pipeline?jeu=juillet");
        if (!r.ok) throw new Error("Le pipeline de juillet n'a pas pu être chargé.");
        const { prospects, meetings } = (await r.json()) as { prospects: Prospect[]; meetings: Meeting[] };
        set((s) => ({
          prospects,
          meetings,
          campaigns: [],
          drafts: [],
          activities: pousserActivite(s.activities, {
            id: uid(),
            date: new Date().toISOString(),
            kind: "systeme" as const,
            message: `Pipeline réel de juillet 2026 chargé — ${prospects.length} fiches, ${meetings.length} rendez-vous`,
          }),
          settings: { ...s.settings, onboarded: true },
        }));
      },

      /**
       * Importe les prospects ICP — le CSV vient du SERVEUR, pour la même
       * raison : il porte des coordonnées d'artisans lyonnais réels.
       * Le parsing, lui, reste local (aucune donnée sensible dans `csvToProspects`).
       */
      loadProspectsICP: async () => {
        const { csvToProspects } = await import("./csv");
        const r = await fetch("/api/pipeline?jeu=icp");
        if (!r.ok) throw new Error("Les prospects ICP n'ont pas pu être chargés.");
        const { csv } = (await r.json()) as { csv: string };
        const { prospects } = csvToProspects(csv);
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
      // Hors navigateur (tests, rendu serveur), on ne fournit AUCUN stockage :
      // zustand désactive alors la persistance. C'est ce que faisait
      // `() => localStorage` en levant une ReferenceError — en la remplaçant
      // par un objet, il fallait rendre ce cas explicite.
      storage: createJSONStorage(() => {
        // Lever ici, comme le faisait `() => localStorage`, est ce que zustand
        // attend pour désactiver la persistance : la signature exige un
        // Storage, pas un `undefined`.
        if (typeof localStorage === "undefined") throw new Error("localStorage indisponible");
        return guardedLocalStorage;
      }),
      /**
       * ⚠ `merge` TOURNE À CHAQUE RÉHYDRATATION, `migrate` seulement au
       * changement de version. C'est toute la différence.
       *
       * `prospectDefaults` a longtemps ignoré cinq tableaux (`events`,
       * `objections`, `obstacles`, `attachments`, `tags`). Les fiches
       * importées pendant cette période sont DÉJÀ dans le localStorage des
       * utilisateurs, écrites sous la version courante — `migrate` ne les
       * reverra donc jamais, et l'écran « Aujourd'hui » continuerait de
       * planter sur elles après la correction du socle.
       *
       * Normaliser ici répare le stock existant au prochain chargement, et
       * garantit qu'aucune fiche partielle ne peut atteindre l'interface,
       * quelle que soit la version qui l'a écrite. Le coût est un spread par
       * fiche, négligeable à côté du JSON.parse qui vient d'avoir lieu.
       */
      merge: (persisted, courant) => {
        const s = (persisted ?? {}) as Partial<AlphaState>;
        return {
          ...courant,
          ...s,
          prospects: (s.prospects ?? courant.prospects).map(normalizeProspect),
          campaigns: (s.campaigns ?? courant.campaigns).map(normalizeCampaign),
          meetings: (s.meetings ?? courant.meetings).map(normalizeMeeting),
        } as AlphaState;
      },
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
          // Cerveau : le socle n'est plus posé ici (il vient du serveur), mais
          // un store d'avant la v5 n'a pas de tableau du tout.
          notes: s.notes ?? [],
          // Store d'avant les offres éditables : on pose le socle.
          offers: s.offers?.length ? s.offers : OFFRES_SYSTEME.map((o) => ({ ...o })),
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
