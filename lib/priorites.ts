import type { Meeting, Prospect } from "./types";
import { weightedValue } from "./hormozi";
import { fenetreOuverte, type Canal } from "./conformite";
import { vitalSigns } from "./vital-signs";
import { masterRappel, type Channel } from "./master-rappel";
import { aRefuseTouteRelance } from "./voice-script";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le calculateur urgent / important.
 *
 * Eisenhower appliqué à un pipeline réel, avec une différence : ici
 * l'urgence et l'importance ne sont pas déclarées, elles sont CALCULÉES.
 *
 *   URGENT     = la fenêtre se ferme. Un RDV demain matin, une décision
 *                attendue mercredi, une fiche chaude qui refroidit. Ce
 *                qui perd de la valeur si on ne le fait pas aujourd'hui.
 *
 *   IMPORTANT  = l'argent en jeu, pondéré par la probabilité réelle.
 *                Un deal à 990 € en proposition pèse plus qu'un premier
 *                appel, même si le premier appel est plus facile.
 *
 * La faute que ça corrige : passer sa journée dans le cadran « urgent et
 * pas important » — les relances faciles, les fiches froides qu'on
 * rappelle parce qu'elles sont en haut de la liste — pendant qu'un
 * closing à 990 € se prépare mal la veille au soir.
 *
 * Règle de conception : une tâche sans échéance n'est jamais urgente, et
 * une tâche sans argent derrière n'est jamais importante. On ne gonfle
 * ni l'un ni l'autre pour remplir l'écran.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Quadrant = "faire" | "planifier" | "deleguer" | "abandonner";

export interface Tache {
  id: string;
  prospectId?: string;
  /** Ce qu'il faut faire, à l'impératif. */
  action: string;
  /** Pourquoi maintenant — la raison, pas la catégorie. */
  why: string;
  urgence: number; // 0–100
  importance: number; // 0–100
  quadrant: Quadrant;
  canal: Canal;
  /** Minutes à prévoir. Une journée se planifie en minutes, pas en tâches. */
  minutes: number;
  /** Échéance réelle s'il y en a une. */
  due?: string;
  /** Valeur pondérée en jeu, quand il y en a. */
  value?: number;
  href: string;
}

/**
 * Le canal du plan de comms, traduit dans le vocabulaire de la journée.
 *
 * Les deux vocabulaires existent pour de bonnes raisons — `Canal` porte le
 * régime juridique (lib/conformite.ts), `Channel` porte le registre commercial
 * — mais ils doivent se rejoindre, sinon la journée réinvente un canal que le
 * plan a déjà choisi.
 */
function canalTache(c: Channel): Canal {
  switch (c) {
    case "terrain":
      return "visite";
    case "visio":
    case "systeme":
      return "appel";
    case "dm":
      return "linkedin";
    default:
      return c;
  }
}

export const QUADRANT_META: Record<Quadrant, { label: string; sub: string; tone: string }> = {
  faire: {
    label: "Urgent ET important",
    sub: "Aujourd'hui, avant tout le reste. Si tu ne fais que ça, la journée est réussie.",
    tone: "border-signal-red/50 text-signal-red",
  },
  planifier: {
    label: "Important, pas urgent",
    sub: "C'est ici que se construit le mois prochain. Bloque du temps, sinon ça ne se fera jamais.",
    tone: "border-bronze-700 text-bronze-400",
  },
  deleguer: {
    label: "Urgent, pas important",
    sub: "Le piège : ça remplit la journée et ça ne fait rien avancer. Groupe-le, expédie-le.",
    tone: "border-signal-amber/50 text-signal-amber",
  },
  abandonner: {
    label: "Ni l'un ni l'autre",
    sub: "À ne pas faire aujourd'hui. Le dire est aussi une décision.",
    tone: "border-ink-600 text-paper-faint",
  },
};

/** Seuils de bascule. Volontairement hauts : un écran où tout est urgent ne priorise rien. */
export const SEUIL_URGENCE = 60;
export const SEUIL_IMPORTANCE = 55;

const quadrantOf = (u: number, i: number): Quadrant =>
  u >= SEUIL_URGENCE && i >= SEUIL_IMPORTANCE
    ? "faire"
    : i >= SEUIL_IMPORTANCE
      ? "planifier"
      : u >= SEUIL_URGENCE
        ? "deleguer"
        : "abandonner";

/**
 * Écart en JOURS CALENDAIRES, pas en tranches de 24 h.
 *
 * Le piège : un rendez-vous demain 9 h, consulté ce soir à 20 h, n'est
 * qu'à 13 heures — donc « 0 jour » si on divise le temps écoulé. L'écran
 * annonçait « aujourd'hui 09:00 » pour un rendez-vous du lendemain. On
 * compare des dates, pas des durées.
 */
const atMidnight = (d: Date | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const daysUntil = (iso: string, now: Date) =>
  Math.round((atMidnight(iso) - atMidnight(now)) / 86_400_000);

const daysSince = (iso: string, now: Date) =>
  Math.round((atMidnight(now) - atMidnight(iso)) / 86_400_000);

/**
 * Importance — l'AVANCEMENT d'abord, l'argent en modulation.
 *
 * Première version : importance = valeur pondérée rapportée au plus gros
 * deal du pipe. Résultat observé sur le pipeline réel — une démo du
 * lendemain sur un deal à 990 € tombait dans « urgent, PAS important »,
 * c'est-à-dire dans le cadran étiqueté « le piège qui remplit la journée
 * sans faire avancer le pipe ». Faux, et activement trompeur.
 *
 * La cause : un seul deal à fort récurrent (***NOM-RETIRE***, 319 €/mois) écrasait
 * tous les autres. Dans un pipe homogène — ici tout le monde à 990 € —
 * normaliser sur le maximum rend invisible ce qui compte.
 *
 * Ce qui décide vraiment de l'importance d'une action commerciale, c'est
 * l'étape : une démo demain vaut plus qu'un premier appel, quel que soit
 * le montant. L'argent module, il ne décide pas.
 */
const IMPORTANCE_ETAPE: Record<string, number> = {
  offre: 90,
  redzone: 90, // une objection non traitée tue les deals les plus avancés
  demo: 78,
  audit: 62,
  contact: 45,
  prospect: 32,
};

function importanceOf(p: Prospect, refValue: number): number {
  const base = IMPORTANCE_ETAPE[p.stage] ?? 40;
  const w = weightedValue(p);
  // Modulation ±12 points selon la valeur relative — assez pour départager
  // deux fiches à la même étape, pas assez pour écraser l'avancement.
  const modulation = refValue > 0 ? Math.round((w / refValue) * 12) : 0;
  return Math.max(0, Math.min(100, base + modulation));
}

export interface PrioritesInput {
  prospects: Prospect[];
  meetings: Meeting[];
  now?: Date;
}

export interface Journee {
  taches: Tache[];
  /** Minutes du cadran « faire » — le seul engagement de la journée. */
  minutesCritiques: number;
  minutesTotal: number;
  /** La fenêtre d'appel est-elle ouverte à cette heure ? */
  fenetre: ReturnType<typeof fenetreOuverte>;
  /** Ce que la journée met en jeu, en euros pondérés. */
  valeurEnJeu: number;
}

export function construireJournee({ prospects, meetings, now = new Date() }: PrioritesInput): Journee {
  const taches: Tache[] = [];
  // Référence d'importance : le plus gros deal du pipe. Tout se compare à lui.
  const refValue = Math.max(1, ...prospects.map(weightedValue));

  // ── 1. Les rendez-vous : l'échéance la plus dure qui existe ──
  for (const m of meetings) {
    if (m.done) continue;
    const d = daysUntil(m.date, now);
    if (d < 0 || d > 7) continue;
    const p = prospects.find((x) => x.id === m.prospectId);
    const imp = p ? importanceOf(p, refValue) : 60;
    // Un RDV demain se prépare CE SOIR. Le préparer le matin même, c'est
    // arriver avec ce qu'on avait déjà — donc rien de neuf.
    const urgence = d <= 0 ? 100 : d === 1 ? 95 : d <= 3 ? 75 : 55;
    const heure = new Date(m.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    taches.push({
      id: `m-${m.id}`,
      prospectId: m.prospectId,
      action: d <= 0 ? `${m.title} — aujourd'hui ${heure}` : `Préparer : ${m.title} (${heure})`,
      why:
        d <= 0
          ? "C'est aujourd'hui. Rien d'autre ne passe devant."
          : d === 1
            ? "C'est demain. Un rendez-vous se prépare la veille, pas le matin même — sinon tu arrives avec ce que tu avais déjà."
            : `Dans ${d} jours. Prépare l'angle et les chiffres pendant que tu as le temps.`,
      urgence,
      importance: imp,
      quadrant: quadrantOf(urgence, imp),
      canal: m.channel === "physique" ? "visite" : "appel",
      minutes: d <= 0 ? 60 : 25,
      due: m.date,
      value: p ? weightedValue(p) : undefined,
      href: m.prospectId ? `/prospects/${m.prospectId}` : "/meetings",
    });
  }

  /**
   * ⚠ L'OPPOSITION SORT AVANT TOUT LE RESTE.
   *
   * Une fiche marquée « ne plus appeler » produisait quand même une tâche
   * « Relancer — X · canal appel » au bout de sept jours de silence. Le robot,
   * lui, s'arrêtait (`cadenceFor` → `stop-definitif`). L'écran du matin
   * demandait donc à l'humain exactement ce qu'on avait interdit à la machine.
   *
   * Le tag et la timeline sont lus tous les deux : le tag vient du bouton
   * « Ne plus appeler », l'opposition dans les événements peut venir d'une
   * session vocale ou d'un import.
   */

  /** Jamais appelées, joignables : la file d'appels, pas encore entamée. */
  const aAppeler: Prospect[] = [];

  for (const p of prospects) {
    if (p.stage === "signe" || p.stage === "perdu") continue;
    if (aRefuseTouteRelance(p)) continue;
    const imp = importanceOf(p, refValue);
    const events = p.events ?? [];
    const lastTouch = events[0]?.date;

    // Fiche sourcée, joignable, jamais touchée : elle n'a AUCUNE échéance,
    // donc aucune des règles ci-dessous ne la voit. Elle est mise de côté et
    // regroupée en une seule tâche — mille lignes « appeler X » ne sont pas
    // une journée, c'est une liste.
    if (!lastTouch && !p.nextStep && p.phone?.trim() && (p.stage === "prospect" || p.stage === "contact")) {
      aAppeler.push(p);
      continue;
    }

    // ── 2. Prochaine étape datée : la promesse qu'on s'est faite ──
    if (p.nextStep) {
      const d = daysUntil(p.nextStep.date, now);
      if (d <= 3) {
        // Une étape en retard est plus urgente qu'une étape du jour : le
        // retard, lui, s'aggrave tout seul.
        const urgence = d < 0 ? 100 : d === 0 ? 90 : 70;
        taches.push({
          id: `n-${p.id}`,
          prospectId: p.id,
          action: `${p.nextStep.action} — ${p.company}`,
          why:
            d < 0
              ? `En retard de ${Math.abs(d)} jour${Math.abs(d) > 1 ? "s" : ""}. Une étape qu'on repousse est une étape qu'on n'a pas faite.`
              : d === 0
                ? "C'est daté aujourd'hui. Tu t'es engagé sur cette date."
                : `Prévu dans ${d} jour${d > 1 ? "s" : ""}.`,
          urgence,
          importance: imp,
          quadrant: quadrantOf(urgence, imp),
          canal: /mail|audit|devis|envoy/i.test(p.nextStep.action) ? "email" : "appel",
          minutes: 10,
          due: p.nextStep.date,
          value: weightedValue(p),
          href: `/prospects/${p.id}`,
        });
        continue; // une fiche ne produit qu'une tâche : l'écran doit rester lisible
      }
    }

    // ── 3. Red Zone : une objection posée bloque tout le reste ──
    const openObjection = (p.objections ?? []).find((o) => o.status !== "traitee");
    if (p.stage === "redzone" || openObjection) {
      taches.push({
        id: `o-${p.id}`,
        prospectId: p.id,
        action: `Traiter l'objection — ${p.company}`,
        why: `« ${openObjection?.label ?? "objection ouverte"} ». Tant qu'elle est là, aucun autre contact ne sert : il glissera dessus.`,
        urgence: 80,
        importance: imp,
        quadrant: quadrantOf(80, imp),
        canal: "appel",
        minutes: 15,
        value: weightedValue(p),
        href: `/prospects/${p.id}`,
      });
      continue;
    }

    // ── 4. Refroidissement : le coût invisible ──
    if (lastTouch) {
      const age = daysSince(lastTouch, now);
      if (age >= 7) {
        /**
         * ⚠ LA FATIGUE PASSE AVANT L'ÂGE — sinon les deux écrans se contredisent.
         *
         * Cas mesuré : cinq relances sans réponse, huit jours de silence. La
         * journée disait « Relancer — 8 jours sans contact » ; MASTER RAPPEL
         * disait, sur la MÊME fiche, « saturé · silence 21 jours · toute
         * relance commerciale interdite ». Deux ordres opposés, et c'est
         * l'écran du matin que l'opérateur suit.
         *
         * `vitalSigns` est la source unique : tant que la fenêtre n'est pas
         * ouverte, il n'y a pas de tâche. Et quand elle s'ouvre, la tâche ne
         * dit pas « relancer » mais « revenir avec une raison NEUVE » — la
         * doctrine ne tolère pas le « je me permets de relancer ».
         */
        const s = vitalSigns(p, now);
        const fenetre = new Date(s.bestWindow.at);
        if (s.fatigueLevel === "sature" && fenetre.getTime() > now.getTime()) continue;

        // Plus le deal est avancé, plus le silence coûte cher.
        const avance = p.stage === "offre" || p.stage === "demo" || p.stage === "audit";
        const urgence = Math.min(90, 40 + age * (avance ? 3 : 1.5));
        // Le canal vient du plan de comms, pas d'un littéral : c'est lui qui
        // sait qu'il OUVRE les emails, ou que le canal écrit a déjà échoué.
        const comms = masterRappel(p, { now }).comms;
        const neuve = s.fatigueLevel !== "ok";
        taches.push({
          id: `c-${p.id}`,
          prospectId: p.id,
          action: `${neuve ? "Revenir avec une raison NEUVE" : "Relancer"} — ${p.company}`,
          why: neuve
            ? `${age} jours sans contact, et ${s.unansweredTouches} touche(s) déjà ignorée(s). ${s.bestWindow.why} Une relance sans raison neuve brûle la fiche.`
            : `${age} jours sans contact${avance ? ", et le deal est avancé. C'est là que le silence coûte le plus cher." : "."}`,
          urgence: Math.round(urgence),
          importance: imp,
          quadrant: quadrantOf(Math.round(urgence), imp),
          canal: canalTache(comms.channel),
          minutes: 8,
          value: weightedValue(p),
          href: `/prospects/${p.id}`,
        });
      }
    }
  }

  /**
   * ── 5. LA FILE D'APPELS — ce qui manquait complètement ──
   *
   * Mille numéros sourcés produisaient ZÉRO tâche : sans échéance, sans
   * événement et sans next step, aucune des règles ci-dessus ne les voit.
   * L'écran du matin ignorait donc la seule source de nouveaux deals, et
   * l'opérateur devait se souvenir tout seul d'aller sur /appels.
   *
   * UNE tâche pour tout le lot, jamais une par fiche : mille lignes
   * « appeler X » ne sont pas une journée, c'est une liste. La durée annoncée
   * est celle d'une SESSION, pas celle du lot — on ne promet pas de vider
   * mille numéros dans la matinée.
   */
  if (aAppeler.length > 0) {
    const parVerticale = new Map<string, number>();
    for (const p of aAppeler) {
      const v = (p.tags ?? []).find((t) => t !== "terrain" && t !== "injoignable") ?? p.sector;
      parVerticale.set(v, (parVerticale.get(v) ?? 0) + 1);
    }
    const tete = [...parVerticale.entries()].sort((a, b) => b[1] - a[1])[0];

    taches.push({
      id: "file-appels",
      action: `Session d'appels — ${aAppeler.length} numéro(s) jamais appelé(s)`,
      why:
        `Ces fiches sont sourcées, joignables, et personne ne les a encore appelées. ` +
        (tete ? `Le plus gros bloc : ${tete[1]} en ${tete[0]} — une verticale à la fois, un seul script. ` : "") +
        `C'est la seule ligne de l'écran qui fabrique de NOUVEAUX deals ; toutes les autres entretiennent l'existant.`,
      // Important par construction (le pipe se vide sans elle), jamais urgent :
      // rien ne se ferme aujourd'hui. C'est le cadran « planifier », et c'est
      // exactement celui qu'on saute quand on ne l'écrit pas.
      urgence: 45,
      importance: 78,
      quadrant: quadrantOf(45, 78),
      canal: "appel",
      minutes: 45,
      href: "/appels",
    });
  }

  const ordre: Record<Quadrant, number> = { faire: 0, planifier: 1, deleguer: 2, abandonner: 3 };
  taches.sort(
    (a, b) =>
      ordre[a.quadrant] - ordre[b.quadrant] ||
      b.urgence + b.importance - (a.urgence + a.importance) ||
      (b.value ?? 0) - (a.value ?? 0)
  );

  const critiques = taches.filter((t) => t.quadrant === "faire");

  return {
    taches,
    minutesCritiques: critiques.reduce((s, t) => s + t.minutes, 0),
    minutesTotal: taches.reduce((s, t) => s + t.minutes, 0),
    fenetre: fenetreOuverte(now),
    valeurEnJeu: critiques.reduce((s, t) => s + (t.value ?? 0), 0),
  };
}

export const parQuadrant = (j: Journee, q: Quadrant): Tache[] => j.taches.filter((t) => t.quadrant === q);

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI S'AFFICHE — et pourquoi une journée se PLAFONNE.
 *
 * Mesuré : 1 000 fiches refroidies produisent 1 000 tâches. La page affichait
 * les mille, sous un pied de page qui promettait que « l'écran doit rester
 * lisible ». Une liste de mille lignes n'est pas un plan de journée, c'est
 * l'export du CRM — et elle détruit exactement ce que l'écran promet : « si
 * tu ne fais que ça, la journée est réussie ».
 *
 * Deux règles :
 *
 *  · RIEN N'EST CACHÉ EN SILENCE. Le reste est résumé sur une ligne qui porte
 *    le nombre, les minutes et l'argent laissés de côté. Un plafond muet
 *    ferait disparaître un deal ; celui-ci le compte à voix haute.
 *  · LE CADRAN « URGENT ET IMPORTANT » A UN PLAFOND PLUS HAUT, et quand il
 *    déborde, ce débordement EST l'information : une journée à quinze urgences
 *    n'est pas une journée chargée, c'est un pipe mal tenu. On le dit.
 * ─────────────────────────────────────────────────────────────────────
 */
export const PLAFOND_FAIRE = 12;
export const PLAFOND_AUTRES = 8;

export interface QuadrantAffiche {
  quadrant: Quadrant;
  /** Les tâches réellement listées, dans l'ordre. */
  visibles: Tache[];
  /** Nombre de tâches repliées. 0 = tout est affiché. */
  reste: number;
  /** Minutes et argent pondéré du repli — comptés, jamais perdus. */
  resteMinutes: number;
  resteValeur: number;
  /** La ligne à afficher sous la liste, ou null s'il n'y a pas de repli. */
  note: string | null;
}

export function pourEcran(j: Journee, q: Quadrant): QuadrantAffiche {
  const list = parQuadrant(j, q);
  const plafond = q === "faire" ? PLAFOND_FAIRE : PLAFOND_AUTRES;
  const visibles = list.slice(0, plafond);
  const replies = list.slice(plafond);

  const resteMinutes = replies.reduce((s, t) => s + t.minutes, 0);
  const resteValeur = replies.reduce((s, t) => s + (t.value ?? 0), 0);

  let note: string | null = null;
  if (replies.length > 0) {
    const heures = Math.round((resteMinutes / 60) * 10) / 10;
    note =
      q === "faire"
        ? `+ ${replies.length} autres urgences importantes (${heures} h, ${Math.round(resteValeur)} € pondérés). ` +
          `Une journée à plus de ${PLAFOND_FAIRE} urgences n'est pas une journée chargée : c'est un pipe qu'on a laissé s'accumuler. ` +
          `Traite ces ${PLAFOND_FAIRE}-là, puis va vider le reste depuis le pipeline.`
        : `+ ${replies.length} autres (${heures} h, ${Math.round(resteValeur)} € pondérés) — repliées pour garder l'écran lisible, pas supprimées. Elles sont dans le pipeline.`;
  }

  return { quadrant: q, visibles, reste: replies.length, resteMinutes, resteValeur, note };
}
