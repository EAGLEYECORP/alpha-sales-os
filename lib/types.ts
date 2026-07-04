// ─────────────────────────────────────────────────────────────────────
// ALPHA SALES OS® — Domain model
// Hormozi-native: the decision IS the product. Emotion first, logic second.
// ─────────────────────────────────────────────────────────────────────

export type Sector = "restaurant" | "pub" | "ambulance" | "artisan" | "autre";

/**
 * Pipeline stages. Strict doctrine:
 *  - OBSTACLES live pre-offer (prospect → demo).
 *  - OBJECTIONS only exist post-offer, in the Red Zone.
 *  - Demo mobile BEFORE price. Always.
 */
export type Stage =
  | "prospect"
  | "contact"
  | "audit"
  | "demo"
  | "offre"
  | "redzone"
  | "signe"
  | "perdu";

/** Oignon du Blâme — the 3 layers a prospect hides behind. */
export type BlameLayer = "circonstances" | "autres" | "soi";

/** Pre-offer friction. Never call these objections. */
export interface Obstacle {
  id: string;
  label: string;
  blameLayer: BlameLayer;
  resolved: boolean;
  note?: string;
}

export type ObjectionType = "argent" | "temps" | "confiance" | "autorite" | "concurrent";

/** Post-offer resistance (Red Zone only). Each maps to one of the 3 Croyances. */
export interface Objection {
  id: string;
  label: string;
  type: ObjectionType;
  /** Which belief is broken: 1 = produit fonctionne, 2 = tu soutiens, 3 = ça marche POUR LUI */
  croyance: 1 | 2 | 3;
  status: "ouverte" | "traitee" | "bloquante";
  counter?: string;
}

/** Les 3 Croyances — all three must hit 10 to sign. */
export interface Croyances {
  produit: number; // "le produit fonctionne"
  soutien: number; // "tu me soutiens"
  pourLui: number; // "ça marche POUR MOI"
}

export type EventKind =
  | "appel"
  | "visite"
  | "email"
  | "whatsapp"
  | "demo"
  | "meeting"
  | "note"
  | "stage"
  | "offre";

export interface NextStep {
  date: string; // ISO — every contact ends with a DATED next step
  action: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  kind: EventKind;
  summary: string;
  nextStep?: NextStep;
}

export interface Attachment {
  id: string;
  name: string;
  kind: "proposition" | "audit" | "maquette" | "autre";
  size: number;
  addedAt: string;
  /** Supabase storage path when synced, data URL when local */
  url?: string;
}

export interface Prospect {
  id: string;
  name: string; // decision maker
  company: string;
  sector: Sector;
  city: string;
  phone?: string;
  email?: string;
  stage: Stage;
  /** 0–100, relationship heat */
  trust: number;
  /** 0–100, quality/completeness of the audit */
  auditScore: number;
  /** 0–10 — YOUR conviction. Signing requires 10/10. */
  conviction: number;
  /** € / month recurring (site + IA overlay) */
  monthlyValue: number;
  /** € one-shot setup */
  setupValue: number;
  /** 0–100 close probability (auto from stage, manually adjustable) */
  probability: number;
  /** € / month the prospect is losing by doing nothing */
  ignoranceTax: number;
  croyances: Croyances;
  obstacles: Obstacle[];
  objections: Objection[];
  events: TimelineEvent[];
  /** Doctrine flag: mobile demo shown before any price talk */
  demoShownBeforePrice: boolean;
  nextStep: NextStep | null;
  tags: string[];
  attachments: Attachment[];
  notes: string;
  lostReason?: string;
  wonAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStepKind = "email" | "whatsapp" | "appel";

export interface CampaignStep {
  id: string;
  kind: CampaignStepKind;
  delayDays: number;
  subject: string;
  body: string;
}

export interface Campaign {
  id: string;
  name: string;
  sector: Sector | "tous";
  status: "brouillon" | "active" | "pausee" | "terminee";
  steps: CampaignStep[];
  stats: { sent: number; opened: number; replied: number; booked: number };
  createdAt: string;
}

export type MeetingKind = "audit" | "demo" | "closing" | "suivi";

export interface Meeting {
  id: string;
  prospectId: string;
  title: string;
  date: string;
  durationMin: number;
  kind: MeetingKind;
  location: string;
  calLink?: string;
  reminded: boolean;
  done: boolean;
  outcome?: string;
}

export interface NurtureSequence {
  id: string;
  name: string;
  audience: string;
  active: boolean;
  steps: { id: string; day: number; channel: CampaignStepKind; content: string }[];
}

export interface Competitor {
  id: string;
  name: string;
  sector: Sector | "tous";
  pricing: string;
  strengths: string;
  weaknesses: string;
  counter: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  date: string;
  kind: "prospect" | "stage" | "meeting" | "campagne" | "ia" | "systeme" | "signe" | "perdu";
  message: string;
  prospectId?: string;
}

export interface AppSettings {
  agencyName: string;
  closerName: string;
  targetMRR: number;
  commissionPct: number;
  role: "solo" | "team";
  /** Free-text business rules injected into every AI prompt */
  businessRules: string;
  apiKeys: { id: string; name: string; masked: string }[];
  supabaseSync: boolean;
}

export interface AuditLogEntry {
  id: string;
  date: string;
  actor: string;
  action: string;
  target: string;
}
