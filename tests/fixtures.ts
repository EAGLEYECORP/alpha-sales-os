import type { Meeting, Prospect, Stage } from "../lib/types";

/**
 * Fabriques de test — une fiche minimale mais VALIDE, qu'on surcharge
 * champ par champ. Aucune donnée de démo : chaque test construit
 * exactement l'état qu'il veut mesurer.
 */
export function prospect(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p-test",
    name: "Marc Perrin",
    company: "Test SARL",
    sector: "restaurant",
    city: "Lyon 4e",
    stage: "contact" as Stage,
    trust: 50,
    likeness: 50,
    auditScore: 0,
    conviction: 5,
    monthlyValue: 200,
    setupValue: 1500,
    probability: 40,
    ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: null,
    tags: [],
    attachments: [],
    notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    ...over,
  } as Prospect;
}

export function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: "m-test",
    prospectId: "p-test",
    title: "RDV test",
    date: new Date().toISOString(),
    durationMin: 30,
    kind: "audit",
    channel: "physique",
    location: "Sur place",
    reminded: false,
    done: false,
    ...over,
  } as Meeting;
}

/** ISO d'il y a N jours (N négatif = dans le futur). */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** ISO d'aujourd'hui à l'heure dite — pour les tests de « touches du jour ». */
export function todayAt(h: number, m = 0): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
