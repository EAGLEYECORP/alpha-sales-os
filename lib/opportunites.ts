/**
 * ─────────────────────────────────────────────────────────────────────
 * OPPORTUNITÉS — l'argent qui ne vient pas d'un client.
 *
 * Subventions, programmes d'accompagnement, concours, sponsors : autant de
 * revenus (ou de visibilité monnayable) qui n'exigent aucune vente. C'est
 * une brique du produit, pas un usage interne : un client d'Alpha Sales OS
 * doit voir SES opportunités comme nous voyons les nôtres.
 *
 * Règle d'honnêteté : chaque opportunité porte son ÉLIGIBILITÉ RÉELLE et
 * son degré d'adéquation. Faire candidater quelqu'un à un programme qui
 * n'est pas pour lui, c'est lui faire perdre des jours — et un dossier
 * refusé coûte plus cher qu'un dossier jamais déposé.
 *
 * ⚠ Les dates et montants ci-dessous ont été vérifiés en AOÛT 2026 sur les
 * sources officielles citées. Un appel à candidatures se ferme sans
 * prévenir : re-vérifier le lien AVANT de travailler un dossier.
 * ─────────────────────────────────────────────────────────────────────
 */

export type OpportunityKind = "programme" | "subvention" | "concours" | "sponsor" | "label";
export type FitLevel = "fort" | "plausible" | "tire-par-les-cheveux" | "hors-sujet";

export interface Opportunity {
  id: string;
  name: string;
  kind: OpportunityKind;
  /** Ce que ça rapporte concrètement. */
  gain: string;
  /** Date limite de dépôt (ISO), si elle existe. */
  deadline?: string;
  url: string;
  source: string;
  /** À qui ça s'adresse vraiment. */
  eligibility: string[];
  /** Les étapes du dossier, dans l'ordre. */
  steps: string[];
  /** Adéquation pour Alpha Sales OS / EAGLEYE. */
  fit: FitLevel;
  /** Pourquoi ce niveau d'adéquation — dit franchement. */
  fitWhy: string;
  /**
   * ─────────────────────────────────────────────────────────────────────
   * LE CRITÈRE QU'ON NE REMPLIT PAS, ET QUI NE SE RATTRAPE PAS.
   *
   * ⚠ L'ADMISSIBILITÉ N'EST PAS L'ADÉQUATION, et les confondre a coûté un
   * écran menteur pendant une semaine.
   *
   * `fit` répond « ce programme nous va-t-il ? » — une question de pertinence.
   * French Tech 2030 y répondait « plausible », et c'est JUSTE : l'IA est un
   * domaine prioritaire et l'argument de souveraineté est réel.
   *
   * Mais le programme exige **3 M€ de financements et/ou de CA cumulés depuis
   * le 1er janvier 2024** (plus TRL 6). EAGLEYE CORP est à 0 €. Le seuil est
   * ÉLIMINATOIRE : aucune qualité du dossier ne le rattrape.
   *
   * Le README le savait — « NON ÉLIGIBLE, vérifié le 3 septembre 2026 » — et
   * le code ne le savait pas. `/trajectoire` affichait donc « adéquation :
   * plausible » en ambre, et le panneau de mission faisait travailler neuf
   * lots pour un dossier qui serait rejeté à la première page. C'est la
   * divergence habituelle du dépôt, appliquée cette fois à de l'argent : la
   * doc dit vrai, le code pilote l'écran.
   *
   * ⚠ Rempli = la porte est FERMÉE, quel que soit `fit`. Un blocage se lève
   * en changeant la RÉALITÉ (encaisser), jamais en réécrivant le dossier.
   * ─────────────────────────────────────────────────────────────────────
   */
  bloquant?: string;
  /** Ce qui peut faire capoter le dossier. */
  risks?: string[];
}

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "french-tech-2030",
    name: "French Tech 2030 — 3e promotion",
    kind: "programme",
    gain:
      "Accompagnement personnalisé sur 12 mois : optimisation du financement, mise en relation avec des " +
      "partenaires stratégiques, simplification administrative. Surtout : le LABEL, qui ouvre les portes.",
    deadline: "2026-09-04T23:59:00+02:00",
    url: "https://lafrenchtech.gouv.fr/fr/programme/french-tech-2030/",
    source: "lafrenchtech.gouv.fr + presse.economie.gouv.fr (vérifié août 2026)",
    eligibility: [
      "Entreprise française innovante",
      "Domaine prioritaire : IA, quantique, cybersécurité, spatial, robotique, électronique, infrastructures numériques, santé, énergie/décarbonation",
      "Contribution à la souveraineté numérique française et européenne",
      // ⚠ CE CRITÈRE MANQUAIT, et c'est le seul qui élimine.
      "⚠ SEUIL D'ENTRÉE : 3 M€ de financements et/ou de CA cumulés depuis le 1er janvier 2024, et TRL 6 minimum",
    ],
    bloquant:
      "3 M€ de financements et/ou de CA cumulés depuis 2024 — EAGLEYE CORP est à 0 €. " +
      "Vérifié le 3 septembre 2026. Le seuil est éliminatoire : la qualité du dossier ne le rattrape pas, " +
      "et la promotion suivante ne changera rien tant que rien n'est encaissé.",
    steps: [
      "Vérifier que le dépôt est toujours ouvert sur demarche.numerique.gouv.fr",
      "Écrire le pitch de souveraineté : où vivent les données, quelle dépendance étrangère on supprime",
      "Chiffrer la traction RÉELLE (clients, CA encaissé, pipeline) — pas des projections",
      "Rassembler : Kbis, statuts, comptes, présentation de l'équipe",
      "Rédiger le dossier : problème, solution, marché, différenciation technique, impact",
      "Déposer AVANT le 4 septembre 23h59 (heure de Paris) — un dossier incomplet est rejeté",
    ],
    fit: "plausible",
    fitWhy:
      "L'IA est bien un domaine prioritaire, et l'argument de souveraineté est réel : Alpha Sales OS est " +
      "sans dépendance runtime, les données peuvent rester en France, et la pile vocale est auto-hébergeable. " +
      "MAIS le programme vise plutôt la deep-tech de souveraineté que le logiciel de vente. Ce n'est pas gagné " +
      "d'avance — c'est un dossier à défendre sur l'angle « l'automatisation commerciale ne doit pas dépendre " +
      "d'acteurs américains », pas sur les fonctionnalités.",
    risks: [
      "Positionnement « SaaS de vente » perçu comme non-stratégique → l'angle souveraineté doit être central",
      "Traction encore faible : à compenser par la preuve technique et la clarté du modèle",
      "Délai court : 14 jours au 21 août",
    ],
  },
  {
    id: "bpi-innovation",
    name: "Bourse French Tech (Bpifrance)",
    kind: "subvention",
    gain: "Subvention pouvant aller jusqu'à 30 000 € pour un projet d'innovation en phase d'amorçage.",
    url: "https://www.bpifrance.fr/",
    source: "bpifrance.fr — conditions à vérifier au moment du dépôt",
    eligibility: [
      "Jeune entreprise (moins de 3 ans en général)",
      "Projet d'innovation caractérisé (technique ou d'usage)",
      "Dépenses éligibles : développement, prototypage, études de marché",
    ],
    steps: [
      "Prendre rendez-vous avec le chargé d'affaires Bpifrance de la région Auvergne-Rhône-Alpes",
      "Présenter le caractère innovant (l'IA vocale conforme art. 50, la personnalisation à l'échelle)",
      "Chiffrer le programme de dépenses sur 12 mois",
      "Déposer le dossier en ligne",
    ],
    fit: "fort",
    fitWhy:
      "C'est le dispositif le plus adapté : innovation d'usage démontrable, dépenses de développement " +
      "réelles, et aucune exigence de souveraineté stratégique. Guichet ouvert en continu — pas de course.",
    risks: ["Le rendez-vous conditionne tout : sans chargé d'affaires convaincu, le dossier n'avance pas"],
  },
  {
    id: "cir-cii",
    name: "CII — Crédit d'Impôt Innovation",
    kind: "subvention",
    gain:
      "30 % des dépenses d'innovation éligibles remboursées (plafond 400 k€ de dépenses). " +
      "Ce n'est pas un concours : c'est un droit fiscal, si les critères sont remplis.",
    url: "https://www.impots.gouv.fr/",
    source: "impots.gouv.fr — dispositif CII pour les PME",
    eligibility: [
      "PME au sens communautaire",
      "Conception de prototypes ou installations pilotes de produits nouveaux",
      "Nouveauté par rapport à l'état du marché (performance, ergonomie, fonctionnalités)",
    ],
    steps: [
      "Documenter le caractère nouveau : ce qui n'existe pas ailleurs (pile vocale conforme, escalier de routage)",
      "Tenir un journal de développement daté — c'est la preuve en cas de contrôle",
      "Faire valider l'assiette par l'expert-comptable",
      "Déclarer avec la liasse fiscale (formulaire 2069-A)",
    ],
    fit: "fort",
    fitWhy:
      "Le développement d'Alpha Sales OS coche les critères d'innovation d'usage. C'est de l'argent " +
      "auquel on a DROIT, pas une faveur à demander — et il se cumule avec le reste.",
    risks: ["Contrôle fiscal possible : sans documentation datée du développement, le crédit est repris"],
  },
  {
    id: "prescripteurs",
    name: "Réseau de prescripteurs rémunérés",
    kind: "sponsor",
    gain:
      "Commission versée à des experts-comptables, agences et consultants qui apportent des clients. " +
      "Revenu indirect : ils vendent, on livre.",
    url: "",
    source: "Modèle interne — voir lib/prescripteurs.ts",
    eligibility: ["Toute personne en contact régulier avec des dirigeants de TPE/PME"],
    steps: [
      "Identifier 10 prescripteurs crédibles dans le réseau existant",
      "Leur montrer le produit en 20 minutes, pas en 2 heures",
      "Fixer la commission par écrit avant le premier apport",
      "Leur donner un audit-cadeau à offrir : c'est leur prétexte d'approche",
    ],
    fit: "fort",
    fitWhy:
      "Le canal le plus rentable qui existe : coût d'acquisition proche de zéro, et la confiance est " +
      "déjà établie par le prescripteur. C'est ce qui scale sans embaucher de commerciaux.",
  },
];

/** Jours restants avant l'échéance (négatif = passée). */
export function daysLeft(o: Opportunity, now: Date = new Date()): number | null {
  if (!o.deadline) return null;
  return Math.ceil((new Date(o.deadline).getTime() - now.getTime()) / 86_400_000);
}

export type Urgency = "expiree" | "critique" | "urgente" | "confortable" | "permanente";

/** L'urgence d'une opportunité — ce qui décide de l'ordre de travail. */
export function urgency(o: Opportunity, now: Date = new Date()): Urgency {
  const d = daysLeft(o, now);
  if (d === null) return "permanente";
  if (d < 0) return "expiree";
  if (d <= 7) return "critique";
  if (d <= 21) return "urgente";
  return "confortable";
}

/**
 * L'ordre de travail : ce qui ferme bientôt ET qui nous correspond d'abord.
 * Une opportunité expirée sort de la liste — elle ne sert qu'à encombrer.
 */
export function prioritized(now: Date = new Date()): Opportunity[] {
  const fitRank: Record<FitLevel, number> = { fort: 0, plausible: 1, "tire-par-les-cheveux": 2, "hors-sujet": 3 };
  const urgRank: Record<Urgency, number> = { critique: 0, urgente: 1, confortable: 2, permanente: 3, expiree: 4 };
  return OPPORTUNITIES.filter((o) => urgency(o, now) !== "expiree").sort((a, b) => {
    const u = urgRank[urgency(a, now)] - urgRank[urgency(b, now)];
    return u !== 0 ? u : fitRank[a.fit] - fitRank[b.fit];
  });
}

/** Somme des gains chiffrables (quand le montant est explicite). */
export function opportunityById(id: string): Opportunity | undefined {
  return OPPORTUNITIES.find((o) => o.id === id);
}
