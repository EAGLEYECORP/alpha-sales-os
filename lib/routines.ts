import type { Campaign, CampaignDraft, Meeting, Prospect } from "./types";
import { isOverdue } from "./utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Routines — les interactions HUMAINES nécessaires pour faire avancer le
 * process. Dérivées de l'état réel (pipeline, RDV, brouillons, livraison,
 * paiements, satisfaction, upsell). Chaque routine = une action + un lien
 * pour agir. C'est la liste « qu'est-ce que je dois faire maintenant ».
 * ─────────────────────────────────────────────────────────────────────
 */

export type RoutineCategory =
  | "relance"
  | "next-step"
  | "review"
  | "reply"
  | "meeting-confirm"
  | "meeting-debrief"
  | "close"
  | "contract"
  | "payment"
  | "delivery"
  | "satisfaction"
  | "testimonial"
  | "upsell";

export type RoutinePriority = "haute" | "moyenne" | "basse";

export interface Routine {
  id: string;
  category: RoutineCategory;
  priority: RoutinePriority;
  title: string;
  detail: string;
  href: string;
  company?: string;
}

export const CATEGORY_META: Record<RoutineCategory, { label: string; tone: "red" | "bronze" | "green" }> = {
  relance: { label: "Relancer", tone: "red" },
  "next-step": { label: "Next step manquant", tone: "red" },
  review: { label: "Relire & envoyer", tone: "bronze" },
  reply: { label: "Répondre", tone: "red" },
  "meeting-confirm": { label: "Confirmer un RDV", tone: "bronze" },
  "meeting-debrief": { label: "Débriefer un RDV", tone: "red" },
  close: { label: "Closer", tone: "bronze" },
  contract: { label: "Contrat", tone: "bronze" },
  payment: { label: "Encaisser", tone: "red" },
  delivery: { label: "Suivre la livraison", tone: "bronze" },
  satisfaction: { label: "Satisfaction", tone: "green" },
  testimonial: { label: "Témoignage", tone: "green" },
  upsell: { label: "Upsell", tone: "green" },
};

const PRIORITY_RANK: Record<RoutinePriority, number> = { haute: 0, moyenne: 1, basse: 2 };

export interface RoutineInput {
  prospects: Prospect[];
  meetings: Meeting[];
  campaigns: Campaign[];
  drafts: CampaignDraft[];
}

function daysUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}

/** Calcule toutes les routines à partir de l'état local. */
export function computeRoutines(input: RoutineInput): Routine[] {
  const { prospects, meetings, campaigns, drafts } = input;
  const out: Routine[] = [];
  const active = prospects.filter((p) => p.stage !== "signe" && p.stage !== "perdu");

  // Next step en retard / manquant (violations doctrine)
  for (const p of active) {
    if (p.nextStep && isOverdue(p.nextStep.date)) {
      out.push({ id: `relance-${p.id}`, category: "relance", priority: "haute", company: p.company,
        title: `Relancer ${p.company}`, detail: `Next step en retard : ${p.nextStep.action}`, href: `/prospects/${p.id}` });
    } else if (!p.nextStep) {
      out.push({ id: `nostep-${p.id}`, category: "next-step", priority: "haute", company: p.company,
        title: `${p.company} — poser un next step daté`, detail: "Aucun next step. Interdit par la doctrine.", href: `/prospects/${p.id}` });
    }
  }

  // Closer (offre / red zone)
  for (const p of prospects) {
    if (p.stage === "redzone") {
      out.push({ id: `close-${p.id}`, category: "close", priority: "haute", company: p.company,
        title: `Closer ${p.company}`, detail: "En Red Zone — traiter l'objection et décider.", href: `/prospects/${p.id}` });
    } else if (p.stage === "offre") {
      out.push({ id: `decide-${p.id}`, category: "close", priority: "moyenne", company: p.company,
        title: `${p.company} — appel décision`, detail: "Offre présentée : obtenir le oui/non.", href: `/prospects/${p.id}` });
    }
  }

  // Brouillons de campagne à relire
  for (const c of campaigns) {
    const pending = drafts.filter((d) => d.campaignId === c.id && d.status === "pending").length;
    if (pending > 0) {
      out.push({ id: `review-${c.id}`, category: "review", priority: "moyenne",
        title: `Relire « ${c.name} »`, detail: `${pending} message(s) à valider avant envoi.`, href: `/campaigns` });
    }
  }

  // RDV : confirmer (à venir <48h) / débriefer (passés non faits)
  for (const m of meetings) {
    if (m.done) continue;
    const d = daysUntil(m.date);
    if (d < 0 && d > -30) {
      out.push({ id: `debrief-${m.id}`, category: "meeting-debrief", priority: "haute",
        title: `Débriefer : ${m.title}`, detail: "RDV passé — consigner le résultat + next step.", href: `/prospects/${m.prospectId}` });
    } else if (d >= 0 && d <= 2 && !m.reminded) {
      out.push({ id: `confirm-${m.id}`, category: "meeting-confirm", priority: "moyenne",
        title: `Confirmer : ${m.title}`, detail: "RDV dans moins de 48h — envoyer un rappel.", href: `/meetings` });
    }
  }

  // Post-signature : contrat, paiement, livraison, satisfaction, témoignage, upsell
  for (const p of prospects) {
    if (p.stage === "signe" && p.contract.status !== "signe") {
      out.push({ id: `contract-${p.id}`, category: "contract", priority: "haute", company: p.company,
        title: `${p.company} — finaliser le contrat`, detail: `Contrat : ${p.contract.status}. À faire signer.`, href: `/prospects/${p.id}` });
    }
    for (const pay of p.payments) {
      const late = pay.status === "retard" || (pay.status === "en-attente" && isOverdue(pay.dueDate));
      if (late) {
        out.push({ id: `pay-${pay.id}`, category: "payment", priority: "haute", company: p.company,
          title: `Encaisser ${p.company}`, detail: `${pay.label} en retard.`, href: `/prospects/${p.id}` });
      }
    }
    if (p.stage === "signe" && p.delivery === "en-cours") {
      out.push({ id: `deliv-${p.id}`, category: "delivery", priority: "moyenne", company: p.company,
        title: `${p.company} — suivre la livraison`, detail: "Livraison en cours : sur-communiquer (croyance n°2).", href: `/prospects/${p.id}` });
    }
    if (p.delivery === "livre" && p.satisfaction === undefined) {
      out.push({ id: `satis-${p.id}`, category: "satisfaction", priority: "moyenne", company: p.company,
        title: `${p.company} — point satisfaction`, detail: "Livré : mesurer la satisfaction (J+30).", href: `/prospects/${p.id}` });
    }
    if ((p.satisfaction ?? 0) >= 70 && !p.testimonial) {
      out.push({ id: `testi-${p.id}`, category: "testimonial", priority: "basse", company: p.company,
        title: `${p.company} — demander un témoignage`, detail: "Client satisfait : avis Google + 2 recommandations.", href: `/prospects/${p.id}` });
    }
    if (p.stage === "signe" && (p.delivery === "livre" || p.delivery === "maintenance") && (!p.upsell || p.upsell.status === "identifie")) {
      out.push({ id: `upsell-${p.id}`, category: "upsell", priority: "basse", company: p.company,
        title: `${p.company} — explorer un upsell`, detail: p.upsell?.note || "Client livré et satisfait : ouvrir la suite.", href: `/prospects/${p.id}` });
    }
  }

  return out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
