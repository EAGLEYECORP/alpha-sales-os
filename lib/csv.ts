import type { Prospect, Sector, Stage } from "./types";
import { prospectDefaults } from "./seed";
import { daysAhead, uid } from "./utils";
import { STAGES } from "./hormozi";

/**
 * CSV parsing + prospect mapping for real-data import.
 * Accepts exports from Google Sheets / Excel / Airtable — delimiter is
 * sniffed (`,` or `;`), quotes and embedded newlines are handled.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** header aliases → canonical field */
const HEADER_MAP: Record<string, string> = {
  company: "company", commerce: "company", entreprise: "company", societe: "company", business: "company",
  name: "name", nom: "name", decideur: "name", contact: "name", gerant: "name",
  sector: "sector", secteur: "sector", industrie: "sector", industry: "sector",
  city: "city", ville: "city", quartier: "city", adresse: "city",
  phone: "phone", telephone: "phone", tel: "phone",
  email: "email", mail: "email", courriel: "email",
  stage: "stage", etape: "stage", statut: "stage", status: "stage",
  monthlyvalue: "monthlyValue", abonnement: "monthlyValue", mrr: "monthlyValue", mensuel: "monthlyValue",
  setupvalue: "setupValue", setup: "setupValue",
  ignorancetax: "ignoranceTax", taxe: "ignoranceTax", taxeignorance: "ignoranceTax", perte: "ignoranceTax",
  notes: "notes", note: "notes", commentaire: "notes",
  problems: "problems", problemes: "problems",
  tags: "tags",
  // deep audit
  googlerating: "googleRating", notegoogle: "googleRating",
  googlereviews: "googleReviews", avisgoogle: "googleReviews", avis: "googleReviews",
  missedcalls: "missedCallsPerWeek", missedcallsperweek: "missedCallsPerWeek", appelsrates: "missedCallsPerWeek", appelsmanques: "missedCallsPerWeek",
  avgticket: "avgTicket", panier: "avgTicket", panierMoyen: "avgTicket", ticketmoyen: "avgTicket",
  conversionrate: "conversionRate", conversion: "conversionRate",
  website: "websiteState", siteweb: "websiteState", site: "websiteState",
  social: "socialState", reseaux: "socialState", reseauxsociaux: "socialState",
  competition: "localCompetition", concurrence: "localCompetition",
  process: "currentProcess", processus: "currentProcess",
};

const SECTOR_ALIASES: Record<string, Sector> = {
  restaurant: "restaurant", resto: "restaurant", restauration: "restaurant", bouchon: "restaurant",
  pub: "pub", bar: "pub", brasserie: "pub",
  ambulance: "ambulance", ambulances: "ambulance", transportsanitaire: "ambulance", vsl: "ambulance",
  artisan: "artisan", artisanat: "artisan", plomberie: "artisan", menuiserie: "artisan", electricite: "artisan", batiment: "artisan",
};

const num = (v: string): number | undefined => {
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

export interface CsvImportResult {
  prospects: Prospect[];
  skipped: number;
  headersFound: string[];
}

/** Map CSV text → Prospect[]. Rows without a company name are skipped. */
export function csvToProspects(text: string): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { prospects: [], skipped: 0, headersFound: [] };

  const headers = rows[0].map((h) => HEADER_MAP[strip(h)] ?? null);
  const headersFound = headers.filter(Boolean) as string[];
  const prospects: Prospect[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h && row[i] !== undefined) rec[h] = row[i].trim();
    });
    if (!rec.company) {
      skipped++;
      continue;
    }
    const sector = SECTOR_ALIASES[strip(rec.sector ?? "")] ?? "autre";
    const stage = (STAGES.find((s) => s.id === strip(rec.stage ?? "") || strip(s.label) === strip(rec.stage ?? ""))?.id ?? "prospect") as Stage;
    const now = new Date().toISOString();

    prospects.push({
      ...prospectDefaults,
      id: uid(),
      company: rec.company,
      name: rec.name ?? "",
      sector,
      city: rec.city ?? "",
      phone: rec.phone || undefined,
      email: rec.email || undefined,
      stage,
      trust: 10,
      auditScore: 0,
      conviction: 8,
      monthlyValue: num(rec.monthlyValue ?? "") ?? 0,
      setupValue: num(rec.setupValue ?? "") ?? 0,
      probability: STAGES.find((s) => s.id === stage)?.probability ?? 5,
      ignoranceTax: num(rec.ignoranceTax ?? "") ?? 0,
      croyances: { produit: 5, soutien: 5, pourLui: 3 },
      obstacles: [],
      objections: [],
      events: [],
      demoShownBeforePrice: false,
      nextStep: { date: daysAhead(3), action: "Premier contact terrain" },
      tags: (rec.tags ?? "").split(/[|,]/).map((t) => t.trim()).filter(Boolean),
      attachments: [],
      notes: rec.notes ?? "",
      problems: (rec.problems ?? "").split("|").map((t) => t.trim()).filter(Boolean),
      deepAudit: {
        googleRating: num(rec.googleRating ?? ""),
        googleReviews: num(rec.googleReviews ?? ""),
        websiteState: rec.websiteState ?? "",
        socialState: rec.socialState ?? "",
        missedCallsPerWeek: num(rec.missedCallsPerWeek ?? ""),
        avgTicket: num(rec.avgTicket ?? ""),
        conversionRate: num(rec.conversionRate ?? ""),
        localCompetition: rec.localCompetition ?? "",
        currentProcess: rec.currentProcess ?? "",
        updatedAt: rec.googleRating || rec.missedCallsPerWeek ? now : undefined,
      },
      createdAt: now,
      updatedAt: now,
    });
  }
  return { prospects, skipped, headersFound };
}

/** Template the business can copy into a Google Sheet (first row). */
export const CSV_TEMPLATE_HEADER =
  "company;name;sector;city;phone;email;stage;monthlyValue;setupValue;ignoranceTax;googleRating;googleReviews;missedCallsPerWeek;avgTicket;conversionRate;website;social;concurrence;process;problems;notes";
