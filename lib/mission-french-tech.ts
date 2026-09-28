import { OPPORTUNITIES } from "./opportunites";
import { PALIERS } from "./paliers";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MISSION FRENCH TECH — le dossier découpé en lots livrables.
 *
 * Un dossier de candidature échoue rarement sur le fond. Il échoue parce
 * qu'il reste un bloc de travail impossible à commencer : on le repousse,
 * on le repousse, et la date tombe. Ce module le casse en LOTS qui ont
 * chacun un livrable écrit, une durée honnête, et une dépendance claire.
 *
 * Chaque lot porte un « sous-agent » : la compétence à mobiliser, et ce
 * qu'ALPHA peut préparer tout seul face à ce que Zakaria est le seul à
 * pouvoir produire. La distinction est le cœur du module — confondre les
 * deux, c'est croire qu'un lot avance alors qu'il attend.
 *
 * ── LA VÉRITÉ QUI ENCADRE TOUT ──
 *
 * Ce dossier n'est PAS gagné d'avance. French Tech 2030 vise la deep-tech
 * de souveraineté ; Alpha Sales OS est un logiciel de vente. L'angle qui
 * tient est « l'automatisation commerciale des PME françaises ne doit pas
 * dépendre d'acteurs américains » — pas la liste des fonctionnalités. Un
 * module qui laisserait croire que c'est acquis rendrait un mauvais
 * service.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Porteur =
  /** ALPHA produit un brouillon complet, à relire. */
  | "alpha"
  /** Zakaria seul peut le produire (chiffres, pièces légales, décisions). */
  | "zakaria"
  /** Les deux : ALPHA prépare, Zakaria tranche. */
  | "duo";

export interface SousAgent {
  id: string;
  /** Le rôle, dit comme on le dirait à un humain. */
  role: string;
  /** Ce qu'il produit, concrètement. */
  livrable: string;
  porteur: Porteur;
  /** Durée réaliste, en heures de travail effectif. */
  heures: number;
  /** Ce qu'il faut avoir avant de commencer. */
  depend: string[];
  /** Ce qui fait échouer ce lot précis. */
  piege: string;
  /** Où le matériau existe déjà dans l'OS. */
  source?: string;
}

/**
 * Les lots, dans l'ordre de dépendance.
 *
 * L'ordre n'est pas décoratif : commencer par la rédaction avant d'avoir
 * les chiffres produit un texte qu'il faudra réécrire entièrement.
 */
export const SOUS_AGENTS: SousAgent[] = [
  {
    id: "eligibilite",
    role: "Vérificateur d'éligibilité",
    livrable: "Une page : sommes-nous recevables, oui ou non, et sur quel domaine prioritaire.",
    porteur: "zakaria",
    heures: 1,
    depend: [],
    piege:
      "Découvrir au dépôt que le programme a changé ses critères ou fermé le guichet. Cette page se refait le jour du dépôt, pas une fois pour toutes.",
    source: "lib/opportunites.ts — critères et lien officiel",
  },
  {
    id: "souverainete",
    role: "Rédacteur de l'angle souveraineté",
    livrable:
      "Deux pages : quelle dépendance étrangère on supprime, où vivent les données, ce qui reste auto-hébergeable.",
    porteur: "duo",
    heures: 4,
    depend: ["eligibilite"],
    piege:
      "Écrire un argumentaire de produit. Le jury ne finance pas un logiciel de vente : il finance une réduction de dépendance. Si le mot « fonctionnalité » revient plus souvent que « dépendance », le texte est à jeter.",
    source: "Zéro dépendance runtime, pile vocale auto-hébergeable, données en France",
  },
  {
    id: "traction",
    role: "Comptable de la traction",
    livrable: "Le tableau des chiffres RÉELS : clients payants, CA encaissé, pipeline pondéré, à une date donnée.",
    porteur: "zakaria",
    heures: 2,
    depend: [],
    piege:
      "Mettre des projections. Un jury lit dix dossiers par jour : il repère une projection déguisée en résultat, et il arrête de croire le reste du dossier.",
    source: "/kpis et /payouts — les paiements encaissés font foi, pas le pipeline",
  },
  {
    id: "technique",
    role: "Rédacteur de la différenciation technique",
    livrable:
      "Trois pages : ce qui est fait main et pourquoi (RAG lexical, chiffrement Web Push, extraction PDF, conformité art. 50 dans le code).",
    porteur: "alpha",
    heures: 3,
    depend: ["souverainete"],
    piege:
      "Confondre « sans dépendance » et « artisanal ». Il faut montrer que c'est un CHOIX d'architecture — souveraineté, auditabilité, coût — pas une contrainte subie.",
    source: "Le repo lui-même : 95 modules, 559 tests, zéro dépendance runtime",
  },
  {
    id: "marche",
    role: "Analyste marché",
    livrable: "Deux pages : taille du marché adressable en France, concurrence, pourquoi maintenant.",
    porteur: "alpha",
    heures: 3,
    depend: ["traction"],
    piege:
      "Le marché mondial en milliards. Un chiffre invérifiable décrédibilise tout ce qui l'entoure — mieux vaut un marché français petit et sourcé.",
    source: "docs/MARCHE.md — analyse concurrentielle déjà écrite, avec ses contreparties",
  },
  {
    id: "equipe",
    role: "Rédacteur équipe & gouvernance",
    livrable: "Une page : qui fait quoi, pourquoi cette personne, et ce qui manque encore.",
    porteur: "zakaria",
    heures: 2,
    depend: [],
    piege:
      "Cacher qu'on est seul. Un dossier solo assumé, avec un plan de recrutement daté, passe mieux qu'une équipe gonflée de conseillers fantômes.",
  },
  {
    id: "pieces",
    role: "Collecteur de pièces",
    livrable: "Kbis, statuts, comptes, RIB, attestations — dans un seul dossier, à jour.",
    porteur: "zakaria",
    heures: 2,
    depend: [],
    piege:
      "Un Kbis de plus de trois mois. C'est le motif de rejet le plus bête et le plus fréquent, et il tombe APRÈS la date limite.",
  },
  {
    id: "redaction",
    role: "Rédacteur du dossier",
    livrable: "Le dossier assemblé, relu, dans le format exigé par le guichet.",
    porteur: "duo",
    heures: 6,
    depend: ["souverainete", "traction", "technique", "marche", "equipe"],
    piege:
      "Assembler la veille. Le format du guichet impose souvent des limites de caractères par champ : découper un texte écrit librement prend plus de temps que de l'écrire.",
  },
  {
    id: "depot",
    role: "Déposant",
    livrable: "Le dépôt effectué, avec l'accusé de réception archivé.",
    porteur: "zakaria",
    heures: 1,
    depend: ["redaction", "pieces"],
    piege:
      "Déposer le dernier jour. Le guichet sature, et un dossier incomplet est rejeté sans recours. La cible est J-3, pas J.",
  },
];

export interface MissionEtat {
  /** Identifiant de l'opportunité suivie. */
  id: string;
  nom: string;
  deadline: string;
  /** Jours restants, arrondis vers le bas. Négatif = dépassé. */
  joursRestants: number;
  /** Heures de travail restantes sur les lots non faits. */
  heuresRestantes: number;
  /** Heures disponibles d'ici la date limite, hypothèse explicite. */
  heuresDisponibles: number;
  /** Le verdict, sans enrobage. */
  verdict: "confortable" | "tendu" | "intenable" | "depasse";
  message: string;
  /** Les lots qu'on peut commencer MAINTENANT (dépendances satisfaites). */
  prochains: SousAgent[];
  /** Ce qui bloque le plus de lots en aval. */
  goulot?: SousAgent;
}

/** Heures de travail réellement disponibles par jour ouvré sur un dossier. */
export const HEURES_PAR_JOUR = 2;

/**
 * L'état de la mission à un instant donné.
 *
 * `faits` porte les ids des lots terminés. Le calcul ne cherche pas à
 * rassurer : si le temps ne suffit pas, il le dit, parce qu'un dossier
 * qu'on sait intenable se réduit ou s'abandonne — les deux valent mieux
 * qu'un dépôt bâclé qui grille la candidature pour l'année suivante.
 */
export function missionEtat(faits: string[] = [], now: Date = new Date()): MissionEtat {
  const opp = OPPORTUNITIES.find((o) => o.id === "french-tech-2030")!;
  const deadline = new Date(opp.deadline!);
  const restants = SOUS_AGENTS.filter((a) => !faits.includes(a.id));

  const msRestants = deadline.getTime() - now.getTime();
  const joursRestants = Math.floor(msRestants / 86_400_000);
  const heuresRestantes = restants.reduce((s, a) => s + a.heures, 0);

  // Jours ouvrés seulement : compter les week-ends serait se mentir sur la
  // capacité réelle, et c'est exactement le mensonge qui fait rater une date.
  let ouvres = 0;
  for (let i = 0; i < Math.max(0, joursRestants); i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const j = d.getDay();
    if (j !== 0 && j !== 6) ouvres += 1;
  }
  const heuresDisponibles = ouvres * HEURES_PAR_JOUR;

  const prochains = restants.filter((a) => a.depend.every((d) => faits.includes(d)));

  // Le goulot : le lot non fait dont dépendent le plus d'autres lots.
  const compteAval = (id: string) => SOUS_AGENTS.filter((a) => a.depend.includes(id)).length;
  const goulot = [...prochains].sort((a, b) => compteAval(b.id) - compteAval(a.id))[0];

  let verdict: MissionEtat["verdict"];
  let message: string;

  if (msRestants < 0) {
    verdict = "depasse";
    message = `Date limite dépassée depuis ${Math.abs(joursRestants)} jour(s). Ce guichet est fermé — la question n'est plus « comment déposer » mais « quelle est la prochaine échéance ».`;
  } else if (restants.length === 0) {
    verdict = "confortable";
    message = "Tous les lots sont faits. Le dossier est déposé ou prêt à l'être.";
  } else if (heuresRestantes > heuresDisponibles) {
    verdict = "intenable";
    message = `${heuresRestantes} h de travail restantes pour ${heuresDisponibles} h disponibles (${ouvres} jours ouvrés × ${HEURES_PAR_JOUR} h). Ça ne passe pas. Deux issues honnêtes : dégager plus de temps, ou réduire le périmètre — un dépôt bâclé grille la candidature pour l'année suivante.`;
  } else if (heuresRestantes > heuresDisponibles * 0.6) {
    verdict = "tendu";
    message = `${heuresRestantes} h restantes pour ${heuresDisponibles} h disponibles. C'est jouable, sans un jour de flottement. Commence par « ${goulot?.role ?? "le premier lot"} » — c'est lui qui débloque la suite.`;
  } else {
    verdict = "confortable";
    message = `${heuresRestantes} h restantes pour ${heuresDisponibles} h disponibles. La marge existe : sers-t'en pour faire relire, pas pour repousser.`;
  }

  return {
    id: opp.id,
    nom: opp.name,
    deadline: opp.deadline!,
    joursRestants,
    heuresRestantes,
    heuresDisponibles,
    verdict,
    message,
    prochains,
    goulot,
  };
}

/** Le palier de trajectoire visé — ce que la mission sert, au fond. */
export const MISSION_CIBLE = {
  de: PALIERS[0].fromEur,
  a: PALIERS[PALIERS.length - 1].toEur,
  /**
   * Ce que le label apporte VRAIMENT, dit sans emballage : ce n'est pas de
   * l'argent direct, c'est une porte. Confondre les deux fait construire un
   * plan de trésorerie sur une subvention qui n'existe pas.
   */
  apport:
    "French Tech 2030 n'est pas un chèque : c'est un label, un accompagnement de 12 mois et des mises en relation. " +
    "Le chiffre d'affaires vient toujours des clients — le label ouvre des portes, il ne les traverse pas à ta place.",
};
