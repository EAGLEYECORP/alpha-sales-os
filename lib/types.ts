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
  | "linkedin"
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

/**
 * Full deep audit — the structured field diagnosis. Every number here is
 * REAL, measured on site or from public data. Importable via CSV/Sheet.
 */
export interface DeepAudit {
  googleRating?: number;
  googleReviews?: number;
  /** State of current website: "aucun", "obsolète (2014)", url… */
  websiteState: string;
  socialState: string;
  missedCallsPerWeek?: number;
  /** average basket / ticket in € */
  avgTicket?: number;
  /** % of missed contacts that would have converted */
  conversionRate?: number;
  localCompetition: string;
  currentProcess: string;
  updatedAt?: string;
}

/** Inbound webhook event (email reply/open, WhatsApp, form…). */
export interface InboundEvent {
  id: string;
  receivedAt: string;
  type: "email.reply" | "email.open" | "whatsapp.reply" | "form.submit" | "autre";
  email: string;
  name?: string;
  campaignId?: string;
  message: string;
  processed: boolean;
}

/** Commercial follow-through: money, paper, delivery. */
export interface Payment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: "en-attente" | "paye" | "retard";
}

export interface ContractInfo {
  status: "aucun" | "brouillon" | "envoye" | "signe";
  url?: string;
  signedAt?: string;
}

export type DeliveryStatus = "non-demarre" | "en-cours" | "livre" | "maintenance";

/** Opportunité d'upsell sur un client livré. */
export type UpsellStatus = "aucun" | "identifie" | "propose" | "gagne";
export interface UpsellOpportunity {
  note: string;
  value?: number; // € additionnel /mois
  status: UpsellStatus;
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
  /** 0–100, likeness/affinity — does he LIKE us? Distinct from trust. */
  likeness: number;
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
  /** Deep audit: problems found → solution designed → offer personalized. */
  deepAudit: DeepAudit;
  problems: string[];
  solution: string;
  personalizedOffer: string;
  payments: Payment[];
  contract: ContractInfo;
  delivery: DeliveryStatus;
  /** Plateforme d'échange privilégiée (email, whatsapp, tel, linkedin…). */
  preferredChannel?: string;
  /** URL du profil LinkedIn (personne ou page entreprise) — canal de prospection. */
  linkedin?: string;
  /** Suivi de satisfaction 0–100 (post-livraison). */
  satisfaction?: number;
  /** Témoignage / avis obtenu. */
  testimonial?: string;
  testimonialAt?: string;
  /** Opportunité d'upsell. */
  upsell?: UpsellOpportunity;
  wonReason?: string;
  lostReason?: string;
  wonAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStepKind = "email" | "whatsapp" | "appel";

/**
 * Script écrit À LA MAIN par l'utilisateur (mode test / manuel) — en plus de
 * la bibliothèque doctrine. Variables : {prenom} {commerce} {ville} {taxe}
 * {taxe_semaine} {closer} {fois}, remplies via fillTemplate.
 */
export interface CustomScript {
  id: string;
  name: string;
  channel: "email" | "dm";
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type StepRole = "premiere-impression" | "relance" | "reponse";

export interface CampaignStep {
  id: string;
  kind: CampaignStepKind;
  /** Template role: first impression, follow-up, or reply handler. */
  role: StepRole;
  delayDays: number;
  subject: string;
  body: string;
}

/**
 * Brouillon de campagne — un message généré, EN ATTENTE de relecture avant
 * envoi. « Rien ne part tant que l'humain n'a pas validé. »
 */
export type DraftStatus = "pending" | "approved" | "skipped" | "sent" | "error";

export interface CampaignDraft {
  id: string;
  campaignId: string;
  prospectId: string;
  company: string;
  channel: CampaignStepKind; // email | whatsapp | appel
  /** destinataire : email (email) ou téléphone (whatsapp/appel) */
  to: string;
  subject: string;
  body: string;
  status: DraftStatus;
  error?: string;
  sentAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  sector: Sector | "tous";
  status: "brouillon" | "active" | "pausee" | "terminee";
  /** Offer & targeting intelligence */
  offerInfo: string;
  cible: string;
  industries: string[];
  marketInfo: string;
  leadMagnet: string;
  steps: CampaignStep[];
  stats: { sent: number; opened: number; replied: number; booked: number };
  createdAt: string;
}

export type MeetingKind = "audit" | "demo" | "closing" | "suivi";
export type MeetingChannel = "appel" | "visio" | "physique";

export interface Meeting {
  id: string;
  prospectId: string;
  title: string;
  date: string;
  durationMin: number;
  kind: MeetingKind;
  channel: MeetingChannel;
  location: string;
  calLink?: string;
  reminded: boolean;
  done: boolean;
  outcome?: string;
  /** Post-meeting feedback from the business — feeds the AI context. */
  feedback?: string;
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
  /**
   * Lien de réservation public (Cal.com, Calendly…). C'est LA pièce qui
   * permet à un prospect de poser un RDV sans toi — donc d'obtenir des
   * rendez-vous pendant que tu es sur le terrain. Vide = pas de bouton.
   */
  bookingUrl?: string;
  apiKeys: { id: string; name: string; masked: string }[];
  supabaseSync: boolean;
  /** First-run choice made (demo vs real data) */
  onboarded: boolean;
  security: {
    /** SHA-256 of the app-lock PIN; null = no lock */
    pinHash: string | null;
    /** Require PIN on every app open */
    autoLock: boolean;
    /** SaaS multi-locataire : exiger un compte Supabase (email + mot de passe) pour ouvrir l'app */
    requireAuth?: boolean;
  };
}

export interface AuditLogEntry {
  id: string;
  date: string;
  actor: string;
  action: string;
  target: string;
}

/**
 * Un PRESCRIPTEUR — quelqu'un qui parle déjà à tes prospects.
 *
 * Volontairement séparé de Prospect, et pas un simple tag : un
 * prescripteur ne doit JAMAIS entrer dans le volume d'envoi, ni dans le
 * pipe pondéré, ni dans les taux de conversion. Le mélanger fausserait
 * tout ce qui se calcule — et surtout, on ne lui écrit pas la même chose.
 */
export type PartnerStatus =
  | "identifie"   // repéré, jamais contacté
  | "contacte"    // approche faite, pas de réponse tranchée
  | "rdv"         // rendez-vous obtenu ou passé
  | "accord"      // il a dit oui, l'accord tient
  | "actif"       // il a présenté au moins une fois
  | "dormant";    // accord signé, mais plus rien depuis — le piège du canal

export interface PartnerIntro {
  id: string;
  date: string;
  /** Qui il a présenté. Texte libre : l'entreprise peut ne pas être en base. */
  company: string;
  /** Fiche prospect créée à partir de cette mise en relation, si elle existe. */
  prospectId?: string;
  /** Chiffre d'affaires réellement ENCAISSÉ sur cette mise en relation. */
  revenue: number;
  notes?: string;
}

export interface Partner {
  id: string;
  name: string;
  organisation: string;
  /** Identifiant d'archétype (lib/prescripteurs.ts). */
  archetype: string;
  status: PartnerStatus;
  city: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  /** Taille de portefeuille annoncée par LUI — pas une estimation. */
  portfolio?: number;
  /** Ce qui a été convenu, en clair. Un accord flou ne produit rien. */
  agreement?: string;
  /** Les mises en relation reçues. C'est la seule mesure qui compte. */
  intros: PartnerIntro[];
  nextStep: NextStep | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
