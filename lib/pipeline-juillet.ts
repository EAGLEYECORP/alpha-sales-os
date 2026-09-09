import type { Meeting, Prospect, Sector, Stage } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le pipeline réel de juillet 2026 — Zakaria Tazi · Lyon.
 *
 * ⚠ Cette ligne nommait le revendeur sous les couleurs duquel ces fiches ont
 * été travaillées. L'accord est mort le 02/09/2026 et cette marque n'est pas
 * la nôtre. Ce qui reste vrai — et qui est tout ce qui compte pour lire ces
 * chiffres — c'est QUI a passé les appels, QUAND et OÙ.
 *
 * Ce n'est PAS de la donnée de démonstration. Tout ce qui suit vient du
 * dossier commercial : 78 prospects travaillés, 132 appels, 18 audits,
 * 24 SMS, 7 opportunités, 5 940 € de pipeline installation, 6 RDV
 * obtenus, 0 gagné.
 *
 * Pourquoi c'est ici et pas dans seed.ts : les fiches de démo portent
 * des adresses inventées et sont bloquées à l'envoi. Celles-ci sont
 * vraies — elles ont des rendez-vous datés, des objections entendues, et
 * de l'argent réellement en jeu. Elles doivent se charger explicitement,
 * jamais par défaut.
 *
 * Les chiffres à retenir, tirés de l'activité réelle et non d'un modèle :
 *   · 51 prospects dans l'univers → 6 RDV = 11,8 %
 *   · auto-école : 3 prospects → 3 opportunités (le meilleur ratio, de loin)
 *   · immobilier : 8 prospects, 4 audits → 2 opportunités
 *   · garage : 18 prospects, 34 appels, 1 audit → 2 opportunités
 *   · dépannage/plomberie : 14 prospects, 26 appels, 0 audit → 0 opportunité
 *   · médical/dentaire : 10 prospects, 5 audits → 0 opportunité
 *
 * La lecture qui compte : là où un AUDIT est parti, le taux monte. Là où
 * il n'y a eu que des appels, il reste à zéro. 26 appels en plomberie
 * sans une seule pièce écrite n'ont rien produit.
 * ─────────────────────────────────────────────────────────────────────
 */

const iso = (d: string) => new Date(`${d}T09:00:00`).toISOString();

/**
 * Tarifs publics Alpha Voice, lus dans l'audit ***NOM-RETIRE***.
 *
 * ⚠ Ils sont DÉCLARÉS dans `lib/offres-publiques.ts` et réimportés ici. Ce
 * module porte de vraies fiches prospects : aucun composant client ne doit
 * l'atteindre, or le calculateur d'offres a besoin de ces prix. Ce qui est
 * public vit dans le module public — même arbitrage que pour le pack.
 */
export { ALPHA_VOICE_SETUP_HT as ALPHA_VOICE_SETUP, ALPHA_VOICE_PALIERS } from "./offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LES FICHES NE SONT PLUS DANS CE FICHIER, ET C'EST UN CORRECTIF DE FUITE.
 *
 * Ce module portait SEIZE FICHES RÉELLES en dur : raison sociale, ville,
 * numéro de téléphone, étape de vente, montant du deal, et les notes de ce
 * qui s'est dit au téléphone. Parmi elles, au moins une personne physique
 * IDENTIFIÉE — nom complet, MOBILE personnel, poste, employeur, et la note
 * qu'elle avait posé un lapin à un rendez-vous.
 *
 * Le dépôt a été rendu PUBLIC sur GitHub. Ces données étaient donc publiées
 * sur internet, sans base légale et sans que ces personnes en sachent rien.
 * Ce n'est pas une fuite commerciale : c'est un traitement illicite de
 * données personnelles de tiers (RGPD, art. 6).
 *
 * ⚠⚠ CE QUI PROTÉGEAIT DÉJÀ, ET POURQUOI ÇA NE SUFFISAIT PAS. Le module est
 * gardé côté SERVEUR (`tests/vitrine-fuite`), `/api/pipeline` est réservé au
 * compte maître, et `store.ts` a été purgé de son `require()`. Tout ça
 * empêchait la donnée d'atteindre un NAVIGATEUR. Rien n'empêchait le FICHIER
 * d'être lu — et un dépôt public se lit sans navigateur.
 *
 * Les fiches vivent désormais dans `donnees-privees/`, ignoré par git. Ce
 * qui reste ici : la STRUCTURE (le type `Seed`, la transformation) et les
 * CHIFFRES AGRÉGÉS (`JUILLET_REEL`), qui n'identifient personne et qui sont
 * la seule chose dont la doctrine se sert.
 *
 * ⚠ ABSENT ⇒ VIDE, JAMAIS UNE ERREUR. Sur une machine sans le fichier —
 * un contributeur, une CI, un déploiement neuf — le pipeline de juillet est
 * simplement vide. Jeter une exception ferait tomber une route pour une
 * donnée qui, par construction, n'est pas censée être partout.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface Seed {
  id: string;
  name: string;
  company: string;
  sector: Sector;
  city: string;
  phone?: string;
  stage: Stage;
  probability: number;
  trust: number;
  setupValue: number;
  monthlyValue: number;
  events: { date: string; kind: "appel" | "email" | "visite" | "demo" | "note"; summary: string }[];
  nextStep?: { date: string; action: string };
  notes: string;
  objections?: string[];
}

function chargerSeeds(): Seed[] {
  try {
    // `require` et non `import` : le chemin doit rester résolu À L'EXÉCUTION.
    // Un `import` statique ferait échouer le BUILD partout où le fichier
    // privé n'existe pas — c'est-à-dire sur toute machine autre que la
    // sienne, y compris le déploiement.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("../donnees-privees/pipeline-juillet.seeds") as { SEEDS?: Seed[] };
    return Array.isArray(m.SEEDS) ? m.SEEDS : [];
  } catch {
    return [];
  }
}

const SECTOR_FALLBACK: Sector = "autre";

export function pipelineJuillet(): { prospects: Prospect[]; meetings: Meeting[] } {
  const prospects: Prospect[] = chargerSeeds().map((s) => ({
    id: s.id,
    name: s.name,
    company: s.company,
    sector: (s.sector ?? SECTOR_FALLBACK) as Sector,
    city: s.city,
    phone: s.phone,
    stage: s.stage,
    trust: s.trust,
    likeness: 50,
    auditScore: s.events.some((e) => e.kind === "email") ? 60 : 0,
    conviction: 6,
    monthlyValue: s.monthlyValue,
    setupValue: s.setupValue,
    probability: s.probability,
    ignoranceTax: 0,
    croyances: { produit: 6, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: (s.objections ?? []).map((label, i) => ({
      id: `${s.id}-obj-${i}`,
      label,
      // Un process d'achat imposé est une objection de TEMPS, et la
      // croyance touchée est la 3e : « ça marche pour MOI, maintenant ».
      type: "temps" as const,
      croyance: 3 as const,
      status: "ouverte" as const,
    })),
    events: [...s.events]
      .reverse()
      .map((e, i) => ({ id: `${s.id}-e${i}`, date: iso(e.date), kind: e.kind, summary: e.summary })),
    demoShownBeforePrice: s.events.some((e) => e.kind === "demo" || e.kind === "visite"),
    nextStep: s.nextStep ? { date: iso(s.nextStep.date), action: s.nextStep.action } : null,
    tags: ["juillet-2026", "terrain"],
    attachments: [],
    notes: s.notes,
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    createdAt: iso("2026-07-09"),
    updatedAt: iso("2026-07-29"),
  })) as Prospect[];

  // Les rendez-vous datés du dossier — ce sont eux qui pilotent l'urgence.
  const rdv: { id: string; prospectId: string; title: string; date: string; kind: Meeting["kind"] }[] = [
    { id: "rdv-corzani", prospectId: "sc-corzani", title: "***NOM-RETIRE***", date: "2026-08-03T09:00:00", kind: "demo" },
    { id: "rdv-vauban", prospectId: "sc-vauban", title: "***NOM-RETIRE***", date: "2026-08-03T16:00:00", kind: "demo" },
    { id: "rdv-hosman", prospectId: "sc-hosman", title: "***NOM-RETIRE***", date: "2026-08-05T14:30:00", kind: "closing" },
    { id: "rdv-brotteaux-carr", prospectId: "sc-brotteaux-carrosserie", title: "***NOM-RETIRE***", date: "2026-09-02T09:00:00", kind: "closing" },
    { id: "rdv-arlim", prospectId: "sc-arlim", title: "***NOM-RETIRE***", date: "2026-09-02T14:30:00", kind: "demo" },
    { id: "rdv-brotteaux-cond", prospectId: "sc-brotteaux-conduite", title: "***NOM-RETIRE***", date: "2026-09-29T10:00:00", kind: "closing" },
  ];

  const meetings: Meeting[] = rdv.map((m) => ({
    id: m.id,
    prospectId: m.prospectId,
    title: m.title,
    date: new Date(m.date).toISOString(),
    durationMin: 45,
    kind: m.kind,
    channel: "physique",
    location: prospects.find((p) => p.id === m.prospectId)?.city ?? "Lyon",
    reminded: false,
    done: false,
  })) as Meeting[];

  return { prospects, meetings };
}

/** Ce que le mois de juillet a réellement produit — pour ne pas se raconter d'histoires. */
export const JUILLET_REEL = {
  prospectsTravailles: 78,
  univers: 51,
  appels: 132,
  audits: 18,
  sms: 24,
  rdvObtenus: 6,
  opportunites: 7,
  pipelineInstall: 5940,
  gagnes: 0,
  tauxTravaillesRdv: 0.118,
  /** Par secteur : prospects · appels · audits · opportunités obtenues. */
  parSecteur: [
    { secteur: "Auto-école", prospects: 3, appels: 7, audits: 2, opportunites: 3 },
    { secteur: "Immobilier", prospects: 8, appels: 10, audits: 4, opportunites: 2 },
    { secteur: "Garage/Carrosserie", prospects: 18, appels: 34, audits: 1, opportunites: 2 },
    { secteur: "Médical/Dentaire", prospects: 10, appels: 13, audits: 5, opportunites: 0 },
    { secteur: "Dépannage/Plomberie", prospects: 14, appels: 26, audits: 0, opportunites: 0 },
    { secteur: "Ambulance", prospects: 8, appels: 14, audits: 1, opportunites: 0 },
    { secteur: "Notaire/Avocat", prospects: 3, appels: 7, audits: 2, opportunites: 0 },
    { secteur: "Électricien", prospects: 4, appels: 6, audits: 1, opportunites: 0 },
    { secteur: "Rénovation/Artisan", prospects: 3, appels: 7, audits: 1, opportunites: 0 },
  ],
};
