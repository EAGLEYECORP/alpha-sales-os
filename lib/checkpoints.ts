import type { Prospect, Stage } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CHECKPOINTS HUMAINS — les portes que la machine ne franchit pas seule.
 *
 * Alpha peut appeler, relancer, transcrire, router. Il y a pourtant des
 * moments où un HUMAIN doit valider, et où avancer sans lui coûte le deal
 * ou la livraison. Ce module les nomme, étape par étape.
 *
 * Deux natures de checkpoint, jamais mélangées :
 *   · VÉRIFIABLE — la donnée existe, on peut trancher (un RDV daté, une démo
 *     faite avant le prix, un déblocage confirmé) ;
 *   · DÉCLARATIF — Alpha ne peut pas savoir (« as-tu compris sa contrainte
 *     réelle ? »). On le dit, et c'est toi qui coches.
 *
 * Confondre les deux fabrique un tableau vert qui ment. Un checkpoint
 * déclaratif coché sans avoir été fait, c'est un mensonge qu'on se raconte —
 * mais au moins on sait que c'est une déclaration, pas une mesure.
 *
 * Le BLOQUANT est la notion clé : certains checkpoints interdisent de passer
 * à l'étape suivante. Les franchir quand même, c'est ce qui produit les deals
 * perdus au dernier mètre et les livraisons impossibles.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CheckpointDef {
  id: string;
  /** L'étape où ce checkpoint doit être franchi. */
  stage: Stage;
  label: string;
  /** La conséquence de passer outre — pas une consigne, une conséquence. */
  why: string;
  /** Empêche-t-il de passer à l'étape suivante ? */
  blocking: boolean;
  /**
   * Vérification automatique. `null` = Alpha ne peut pas savoir, c'est
   * déclaratif. Ne JAMAIS renvoyer `false` faute de donnée : « non vérifiable »
   * et « non fait » ne sont pas la même chose.
   */
  check: (p: Prospect) => boolean | null;
}

const filled = (v: string | undefined | null) => Boolean((v ?? "").trim());
const isRealName = (n: string | undefined) =>
  filled(n) && !/^(g[ée]rant|cabinet|accueil|contact|standard|direction)$/i.test((n ?? "").trim());

export const CHECKPOINTS: CheckpointDef[] = [
  // ── prospect → contact ──
  {
    id: "decideur",
    stage: "prospect",
    label: "Le décideur est nommé",
    why: "Une fonction ne signe pas. Sans nom, tout le travail suivant s'adresse à personne.",
    blocking: true,
    check: (p) => isRealName(p.name),
  },
  {
    id: "joignable",
    stage: "prospect",
    label: "Un contact direct existe",
    why: "Sans téléphone ni email, aucune action automatique n'est possible — la fiche dort.",
    blocking: true,
    check: (p) => filled(p.phone) || filled(p.email),
  },

  // ── contact → audit ──
  {
    id: "accord-audit",
    stage: "contact",
    label: "Accord obtenu pour envoyer l'audit",
    why: "Un audit envoyé sans accord est un spam. Avec accord, c'est un rendez-vous en préparation.",
    blocking: false,
    check: () => null,
  },
  {
    id: "volume",
    stage: "contact",
    label: "Le volume de demandes est chiffré",
    why: "C'est LE chiffre qui fait mal. Sans lui, l'argumentaire n'a pas de point d'appui.",
    blocking: true,
    check: (p) => p.deepAudit?.missedCallsPerWeek !== undefined,
  },
  {
    id: "process-actuel",
    stage: "contact",
    label: "On sait comment ils font aujourd'hui",
    why: "On ne remplace pas un process qu'on n'a pas compris — et la livraison s'y casse les dents.",
    blocking: false,
    check: (p) => filled(p.deepAudit?.currentProcess),
  },

  // ── audit → demo ──
  {
    id: "audit-livre",
    stage: "audit",
    label: "L'audit écrit est parti",
    why: "Là où un audit part, le taux de rendez-vous monte. Sans pièce écrite, il reste à zéro.",
    blocking: true,
    check: (p) => (p.auditScore ?? 0) >= 50,
  },
  {
    id: "rdv-date",
    stage: "audit",
    label: "Un rendez-vous est DATÉ",
    why: "Un échange sans date de suite est un échange perdu. Le dossier va dormir.",
    blocking: true,
    check: (p) => Boolean(p.nextStep?.date),
  },

  // ── demo → offre ──
  {
    id: "demo-avant-prix",
    stage: "demo",
    label: "La démo a été montrée AVANT le prix",
    why: "Un prix annoncé sans démo transforme la conversation en négociation. Après la valeur, il devient une évidence.",
    blocking: true,
    check: (p) => Boolean(p.demoShownBeforePrice),
  },
  {
    id: "irritants",
    stage: "demo",
    label: "Ses vrais irritants sont écrits",
    why: "Sans ses mots à lui, la proposition parlera de nous. Elle doit parler de lui.",
    blocking: false,
    check: (p) => (p.problems ?? []).length > 0,
  },
  {
    id: "co-decideurs",
    stage: "demo",
    label: "On sait qui décide avec lui",
    why: "Un décideur caché découvert au closing fait sauter le deal à la dernière minute.",
    blocking: false,
    check: () => null,
  },

  // ── offre → signe ──
  {
    id: "valeur-connue",
    stage: "offre",
    label: "Le montant du deal est fixé",
    why: "Sans montant, il n'y a ni devis, ni décision possible.",
    blocking: true,
    check: (p) => (p.setupValue ?? 0) > 0 || (p.monthlyValue ?? 0) > 0,
  },
  {
    id: "objections-levees",
    stage: "offre",
    label: "Aucune objection bloquante ouverte",
    why: "Closer sur une objection bloquante, c'est demander un « non » ferme au lieu d'un « oui » différé.",
    blocking: true,
    check: (p) => (p.objections ?? []).every((o) => o.status !== "bloquante"),
  },
  {
    id: "deblocage",
    stage: "offre",
    label: "Le déblocage des fonds est CONFIRMÉ par lui",
    why: "Un « oui » sans date de déblocage n'est pas une vente : c'est une intention.",
    blocking: true,
    check: (p) => Boolean(p.funding?.availableAt && p.funding?.confirmed),
  },
  {
    id: "date-demarrage",
    stage: "offre",
    label: "Une date de démarrage est convenue",
    why: "Un accord sans date de démarrage glisse de semaine en semaine jusqu'à disparaître.",
    blocking: false,
    check: () => null,
  },

  // ── signe → livraison ──
  {
    id: "acces",
    stage: "signe",
    label: "Les accès techniques sont récupérés",
    why: "La livraison s'arrête net faute d'accès, et c'est nous qui passons pour lents.",
    blocking: true,
    check: () => null,
  },
  {
    id: "interlocuteur-ops",
    stage: "signe",
    label: "L'interlocuteur opérationnel est identifié",
    why: "Celui qui signe n'est presque jamais celui qui utilise. Sans lui, la mise en route patine.",
    blocking: true,
    check: () => null,
  },
  {
    id: "critere-reussite",
    stage: "signe",
    label: "Le critère de réussite à 30 jours est écrit",
    why: "Sans critère convenu, la satisfaction devient une opinion — et le témoignage n'arrive jamais.",
    blocking: false,
    check: () => null,
  },
];

export type CheckpointState = "fait" | "manquant" | "a-declarer";

export interface CheckpointStatus {
  def: CheckpointDef;
  state: CheckpointState;
  /** Vrai si Alpha a pu trancher tout seul. */
  measured: boolean;
}

export interface CheckpointReport {
  stage: Stage;
  items: CheckpointStatus[];
  /** Ceux qui empêchent de passer à l'étape suivante. */
  blockers: CheckpointStatus[];
  /** 0-100 sur les checkpoints de l'étape courante. */
  progress: number;
  /** Peut-on avancer d'une étape ? */
  canAdvance: boolean;
  summary: string;
}

/** L'ordre des étapes — sert à savoir ce qui est « déjà derrière ». */
const ORDER: Stage[] = ["prospect", "contact", "audit", "demo", "offre", "signe"];

/**
 * L'état des checkpoints d'un prospect à SON étape courante.
 * `declared` : ids cochés à la main (persistés sur la fiche via ses tags).
 */
export function checkpointsFor(p: Prospect, declared: string[] = []): CheckpointReport {
  const stage = p.stage;
  const defs = CHECKPOINTS.filter((c) => c.stage === stage);

  const items: CheckpointStatus[] = defs.map((def) => {
    const auto = def.check(p);
    if (auto === true) return { def, state: "fait", measured: true };
    if (auto === false) return { def, state: "manquant", measured: true };
    // Non vérifiable : c'est une déclaration, et on l'affiche comme telle.
    return { def, state: declared.includes(def.id) ? "fait" : "a-declarer", measured: false };
  });

  const blockers = items.filter((i) => i.def.blocking && i.state !== "fait");
  const done = items.filter((i) => i.state === "fait").length;
  const progress = items.length === 0 ? 100 : Math.round((done / items.length) * 100);
  const canAdvance = blockers.length === 0;

  const summary =
    items.length === 0
      ? "Aucun checkpoint à cette étape."
      : canAdvance
        ? `Prêt à avancer — ${done}/${items.length} validés.`
        : `${blockers.length} point(s) bloquant(s) : ${blockers[0].def.label}.`;

  return { stage, items, blockers, progress, canAdvance, summary };
}

export interface PipelineCoverage {
  /** Prospects actifs analysés. */
  total: number;
  /** Ceux qui peuvent avancer tout de suite. */
  ready: number;
  /** Ceux bloqués par au moins un checkpoint. */
  blocked: number;
  /** Le checkpoint qui bloque le plus de fiches — la correction la plus rentable. */
  topBlocker?: { label: string; count: number; why: string };
  /** Complétude moyenne sur tout le pipe (0-100). */
  coverage: number;
}

/**
 * La vue d'ensemble : où le pipeline est troué.
 *
 * Le `topBlocker` est l'information la plus utile du module : corriger le
 * point qui bloque 40 fiches vaut mieux que traiter 40 fiches une par une.
 */
export function pipelineCoverage(prospects: Prospect[], declaredByProspect: Record<string, string[]> = {}): PipelineCoverage {
  const actifs = prospects.filter((p) => p.stage !== "perdu" && ORDER.includes(p.stage));
  if (actifs.length === 0) return { total: 0, ready: 0, blocked: 0, coverage: 100 };

  const counts = new Map<string, { count: number; why: string; label: string }>();
  let ready = 0;
  let sum = 0;

  for (const p of actifs) {
    const r = checkpointsFor(p, declaredByProspect[p.id] ?? []);
    sum += r.progress;
    if (r.canAdvance) ready += 1;
    for (const b of r.blockers) {
      const cur = counts.get(b.def.id) ?? { count: 0, why: b.def.why, label: b.def.label };
      counts.set(b.def.id, { ...cur, count: cur.count + 1 });
    }
  }

  const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];

  return {
    total: actifs.length,
    ready,
    blocked: actifs.length - ready,
    topBlocker: top ? { label: top.label, count: top.count, why: top.why } : undefined,
    coverage: Math.round(sum / actifs.length),
  };
}
