import type { Prospect } from "./types";
import { NUWACOM_THRESHOLD_HT } from "./accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ESCALIER — le check que subit CHAQUE prospect, dans cet ordre.
 *
 * Ce n'est pas un aiguillage (« une seule offre gagne »), c'est une
 * CASCADE : un même prospect peut déclencher plusieurs marches, et chaque
 * marche revient au compte qui sait la porter.
 *
 *   1. VISIBILITÉ ........... besoin détecté → EAGLEYE le gère (100 % : c'est
 *        notre société, il n'y a personne à qui reverser).
 *   2. VOLUME DE DEMANDES ... très élevé → CALLFLOW (ScintIA), 30 % + 10 %.
 *   3. AUTOMATISATION ....... demande en plus → EAGLEYE (100 %).
 *        └─ argument de vente : Callflow est le POINT D'ENTRÉE. Il capte
 *           l'information exacte sur chaque personne qui appelle. Quand on
 *           automatise ensuite, les données sont déjà là → moins de setup à
 *           payer. C'est ce qui rend l'ordre des marches vendable.
 *   4. TROP GROS ............ parties qu'EAGLEYE ne peut pas porter →
 *        NUWACOM. Le gros devis justifie les 15 %, et la maintenance
 *        mensuelle qui suit revient à 100 % chez nous.
 *
 * Déterministe, sans clé, sans réseau : ça tourne à l'import sur tout un lot.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Marches, dans l'ordre imposé. */
export type RungId = "visibilite" | "callflow" | "automatisation" | "gros-chantier";

/**
 * Seuil « volume de demandes très élevé » qui déclenche Callflow
 * (appels/demandes manqués par semaine). Ajustable : c'est un curseur
 * commercial, pas une vérité — remonte-le si tu veux être plus sélectif.
 */
export const HIGH_DEMAND_PER_WEEK = 5;

export interface Rung {
  id: RungId;
  label: string;
  /** Compte qui porte CETTE marche. */
  accountId: string;
  accountName: string;
  /** Pourquoi elle s'est déclenchée — des faits, pas des adjectifs. */
  evidence: string[];
  /** L'argument à dire au prospect pour cette marche. */
  pitch: string;
  /**
   * Ce qui NOUS revient sur le one-shot / setup (%).
   * 100 % sur les marches EAGLEYE : c'est notre société. En dessous seulement
   * là où nous sommes intermédiaires (ScintIA 30 %, Nuwacom 15 %).
   */
  commissionPct: number;
  /** Ce qui nous revient sur le récurrent mensuel (%), si applicable. */
  recurringPct?: number;
}

export interface LadderResult {
  /** Les marches déclenchées, DANS L'ORDRE de l'escalier. */
  rungs: Rung[];
  /** La marche par laquelle on ENTRE (la première déclenchée). */
  entry: Rung | null;
  /** Comptes concernés par ce prospect (souvent plusieurs). */
  accountIds: string[];
  /** Récit d'une ligne pour la fiche / la salle de contrôle. */
  summary: string;
}

const filled = (v: string | undefined | null): boolean => {
  const t = (v ?? "").trim().toLowerCase();
  return t.length > 0 && t !== "n/a" && t !== "na" && t !== "-" && t !== "inconnu";
};

/** Site absent / obsolète, peu d'avis, réseaux morts → trou de visibilité. */
function visibilityEvidence(p: Prospect): string[] {
  const a = p.deepAudit ?? {};
  const out: string[] = [];
  const site = (a.websiteState ?? "").trim().toLowerCase();
  if (filled(a.websiteState)) {
    if (site === "aucun" || site === "aucune" || site === "non") out.push("aucun site");
    else if (/obsol|2014|vieux|datant/.test(site)) out.push(`site ${a.websiteState}`);
  }
  if (a.googleReviews !== undefined && a.googleReviews < 10) out.push(`${a.googleReviews} avis Google seulement`);
  if (a.googleRating !== undefined && a.googleRating < 4) out.push(`note Google ${a.googleRating}/5`);
  const social = (a.socialState ?? "").trim().toLowerCase();
  if (filled(a.socialState) && /aucun|faible|inactif|abandon/.test(social)) out.push("réseaux inactifs");
  return out;
}

/** Le prospect croule-t-il sous les demandes ? (le déclencheur Callflow) */
function demandEvidence(p: Prospect): string[] {
  const a = p.deepAudit ?? {};
  const out: string[] = [];
  const missed = a.missedCallsPerWeek ?? 0;
  if (missed >= HIGH_DEMAND_PER_WEEK) out.push(`${missed} appels manqués/semaine`);
  if (filled(a.currentProcess) && /d[ée]croche|standard|accueil|entre deux|seul/i.test(a.currentProcess))
    out.push(`process actuel : ${a.currentProcess}`);
  return out;
}

/**
 * L'escalier complet pour un prospect.
 * `automationWanted` : le prospect a exprimé un besoin d'automatisation en
 * plus (détecté au cadrage / à l'appel). On ne l'invente pas depuis des
 * signaux — c'est une DEMANDE, elle vient de la conversation.
 */
export function buildLadder(p: Prospect, opts: { automationWanted?: boolean } = {}): LadderResult {
  const rungs: Rung[] = [];

  // ── Marche 1 : visibilité → EAGLEYE ──
  const vis = visibilityEvidence(p);
  if (vis.length) {
    rungs.push({
      id: "visibilite",
      label: "Visibilité (site, présence, avis)",
      accountId: "eagleye",
      accountName: "EAGLEYE CORP",
      evidence: vis,
      pitch: "« On vous rend visible là où vos clients cherchent — puis on transforme ce trafic. »",
      // 100 % : EAGLEYE, c'est nous. On ne reverse à personne sur nos offres.
      commissionPct: 100,
      recurringPct: 100,
    });
  }

  // ── Marche 2 : volume de demandes très élevé → Callflow (ScintIA) ──
  const dem = demandEvidence(p);
  if (dem.length) {
    rungs.push({
      id: "callflow",
      label: "ScintIA Callflow (accueil & relance téléphone)",
      accountId: "scintia",
      accountName: "ScintIA",
      evidence: dem,
      pitch: "« Chaque appel manqué est un client qui appelle le concurrent. On répond à votre place, 24/7. »",
      commissionPct: 30,
      recurringPct: 10,
    });
  }

  // ── Marche 3 : automatisation en plus → EAGLEYE ──
  // L'argument dépend de la présence de Callflow en amont : s'il est là, le
  // setup coûte MOINS cher parce que la donnée d'entrée est déjà captée.
  if (opts.automationWanted) {
    const hasCallflow = rungs.some((r) => r.id === "callflow");
    rungs.push({
      id: "automatisation",
      label: "Automatisation / digitalisation",
      accountId: "eagleye",
      accountName: "EAGLEYE CORP",
      evidence: ["demande d'automatisation exprimée"],
      pitch: hasCallflow
        ? "« Callflow est votre point d'entrée : il capte l'information exacte sur chaque personne qui vous " +
          "appelle. Quand on automatise ensuite, on a déjà toutes les données et le process est cartographié — " +
          "vous payez donc MOINS de setup que si on partait de zéro. »"
        : "« On automatise le process là où il vous coûte du temps — en partant de vos vraies données, pas d'un modèle. »",
      commissionPct: 100,
      recurringPct: 100,
    });
  }

  // ── Marche 4 : trop gros pour nous → Nuwacom ──
  const dealValue = (p.setupValue ?? 0) + (p.monthlyValue ?? 0) * 12;
  if (dealValue > NUWACOM_THRESHOLD_HT) {
    rungs.push({
      id: "gros-chantier",
      label: `Gros chantier (> ${NUWACOM_THRESHOLD_HT.toLocaleString("fr-FR")} €) — plateforme Nuwacom`,
      accountId: "nuwacom",
      accountName: "Nuwacom",
      evidence: [`volume du deal estimé ${dealValue.toLocaleString("fr-FR")} € — trop lourd pour nous`],
      pitch:
        "« Sur un chantier de cette taille, on s'appuie sur une plateforme éprouvée — et on reste votre " +
        "interlocuteur unique sur la maintenance. »",
      commissionPct: 15,
      // Le gros devis justifie les 15 % ; la maintenance mensuelle est à 100 %.
      recurringPct: 100,
    });
  }

  const accountIds = Array.from(new Set(rungs.map((r) => r.accountId)));
  const entry = rungs[0] ?? null;
  const summary = rungs.length
    ? `${rungs.length} marche(s) : ${rungs.map((r) => `${r.label} → ${r.accountName}`).join(" · ")}`
    : "Aucune marche déclenchée — fiche trop pauvre, il faut d'abord la qualifier.";

  return { rungs, entry, accountIds, summary };
}

/** Le bloc d'argumentaire à injecter dans un script (vocal ou écrit). */
export function ladderPitch(l: LadderResult): string {
  if (!l.rungs.length) return "";
  return l.rungs
    .map((r, i) => `${i + 1}. ${r.label} — ${r.evidence.join(", ")}\n   ${r.pitch}`)
    .join("\n");
}
