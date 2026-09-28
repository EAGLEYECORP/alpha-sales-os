/**
 * ─────────────────────────────────────────────────────────────────────
 * LES SECTEURS OÙ LE DÉMARCHAGE TÉLÉPHONIQUE EST INTERDIT OU VERROUILLÉ.
 *
 * ⚠⚠ POURQUOI CE MODULE EXISTE, ET CE QUE SON ABSENCE LAISSAIT PASSER.
 *
 * Tout le moteur de conformité du dépôt ne connaissait QU'UNE règle : le
 * décret n° 2022-1313 — jours, horaires, 4 sollicitations sur 30 jours
 * glissants. Cette règle est GÉNÉRALE : elle dit COMMENT démarcher.
 *
 * Elle ne dit jamais SI ON A LE DROIT. Et dans plusieurs secteurs français,
 * la réponse est non — pas « avec précaution », non. `auditScript` aurait
 * approuvé sans broncher un script d'appel à froid pour de la formation CPF
 * ou de la rénovation énergétique : toutes les mentions présentes, l'article
 * 50 prononcé, la cadence sous le plafond, et une infraction au bout du fil.
 *
 * C'est exactement le trou que ce dépôt paie à répétition — une règle qui
 * existe en droit, pas en code — sauf qu'ici le coût n'est pas un bug : c'est
 * notre client qui prend l'amende, avec notre outil, en ayant lu « conforme »
 * sur notre écran.
 *
 * ══ LE NIVEAU DE PREUVE VOYAGE AVEC LA RÈGLE ══
 *
 * ⚠ AUCUN de ces textes n'a été ouvert. Le proxy sortant refuse la
 * récupération de page (`EGRESS_BLOCKED`, vérifié) : ces références sont
 * restituées de mémoire. C'est la même discipline que `lib/references.ts`
 * impose aux sources extérieures — la provenance et le niveau de preuve
 * voyagent avec le contenu, ils ne se déduisent pas.
 *
 * `verification: "non-verifiee"` est donc le défaut, et il est VISIBLE dans
 * ce que le module rend. Un avocat doit confirmer avant qu'on engage quoi que
 * ce soit. Ce qui serait irresponsable, ce n'est pas d'écrire une règle non
 * vérifiée — c'est de la laisser MANQUER, ou de la présenter comme vérifiée.
 *
 * ══ ON BLOQUE, ON N'AVERTIT PAS ══
 *
 * Même raisonnement que la présence de l'agent vocal : l'inconnu vaut refus
 * quand l'erreur coûte plus cher que l'abstention. Ne pas passer un appel
 * coûte un créneau. Passer un appel interdit coûte une amende à un client qui
 * nous faisait confiance, et la seule chose qu'on avait à vendre — le fait
 * qu'on connaisse les règles.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce que la loi fait à la prospection sortante dans ce secteur. */
export type PorteeInterdiction =
  /** Interdit, point. Aucun aménagement ne le rend praticable à froid. */
  | "interdiction"
  /** Praticable seulement sur accord PRÉALABLE et explicite du prospect. */
  | "consentement-prealable";

export interface InterdictionSectorielle {
  id: string;
  label: string;
  /** Le texte invoqué — nommé, jamais « la loi » en général. */
  texte: string;
  portee: PorteeInterdiction;
  /**
   * Ce qui RESTE légal, et c'est le champ le plus important du module.
   *
   * ⚠ Une interdiction sans issue se contourne. Si le produit se contente de
   * dire « non », le client débranche le garde ou change d'outil ; s'il dit
   * « non, et voilà ce qui marche », le garde tient et il devient l'argument
   * de vente. Dans tous ces secteurs l'argent est sur le RAPPEL DE LEADS
   * CONSENTIS — comparateurs, formulaires, demandes entrantes — qui n'est pas
   * du démarchage mais du suivi de demande.
   */
  alternative: string;
  /**
   * Ce qui identifie le secteur dans un texte de script.
   *
   * ⚠ Un motif trop large refuserait des scripts corrects et finirait
   * désarmé — la leçon payée deux fois par `InterditFroid`. On vise des
   * formulations MÉTIER, jamais un mot isolé : « formation » seul apparaît
   * dans mille scripts légitimes, « CPF » et « compte personnel de formation »
   * ne désignent qu'une chose.
   */
  motif: RegExp;
  /**
   * L'état de notre vérification.
   *
   * `"non-verifiee"` = restituée de mémoire, aucun texte ouvert. C'est le
   * défaut et il doit le rester tant que personne n'a lu le Légifrance.
   */
  verification: "non-verifiee" | "verifiee-avocat";
}

export const INTERDICTIONS_SECTORIELLES: InterdictionSectorielle[] = [
  {
    id: "formation-cpf",
    label: "Formation professionnelle financée par le CPF",
    texte: "Loi n° 2022-1587 du 19 décembre 2022",
    portee: "interdiction",
    alternative:
      "Le rappel d'une personne qui a elle-même déposé une demande (formulaire, comparateur, salon) n'est pas de la prospection. C'est là qu'est le volume, et c'est là qu'Alpha Voice est le plus utile : rappeler en quelques minutes au lieu de quelques jours.",
    motif: /\bCPF\b|compte personnel de formation|mon compte formation/i,
    verification: "non-verifiee",
  },
  {
    id: "renovation-energetique",
    label: "Rénovation énergétique et CEE",
    texte: "Loi n° 2020-901 du 24 juillet 2020 (dite loi Naegelen)",
    portee: "interdiction",
    alternative:
      "Même logique : on ne démarche pas, on rappelle vite quelqu'un qui a demandé un devis. Les aides (MaPrimeRénov', CEE) génèrent des demandes entrantes en volume — le problème du secteur est de les traiter, pas d'en trouver.",
    motif:
      /rénovation énergétique|renovation energetique|isolation (à|a) 1 ?€|pompe (à|a) chaleur|MaPrimeR[ée]nov|\bCEE\b|certificats? d'économies? d'énergie/i,
    verification: "non-verifiee",
  },
  {
    id: "assurance",
    label: "Assurance (démarchage téléphonique)",
    texte: "Loi n° 2021-402 du 8 avril 2021",
    portee: "consentement-prealable",
    alternative:
      "Accord préalable et explicite du prospect, appel enregistré et conservé, délai de réflexion avant signature : le froid non sollicité est inexploitable, le rappel d'un lead consenti ne l'est pas. C'est l'un des rares secteurs où la traçabilité qu'on produit déjà vaut de l'argent en elle-même.",
    motif:
      /contrat d'assurance|assurance (auto|habitation|santé|sante|emprunteur|vie)|mutuelle santé|mutuelle sante|complémentaire santé|complementaire sante/i,
    verification: "non-verifiee",
  },
];

/** La règle qui s'applique à un secteur donné, ou `null` s'il n'y en a pas. */
export function interdictionPour(secteurId: string): InterdictionSectorielle | null {
  return INTERDICTIONS_SECTORIELLES.find((i) => i.id === secteurId) ?? null;
}

/** Ce qu'un script laisse voir du secteur qu'il vise. */
export interface AlerteSecteur {
  interdiction: InterdictionSectorielle;
  /** La phrase, telle quelle, qui a déclenché la règle. */
  extrait: string;
}

/**
 * Cherche, dans un script, la trace d'un secteur sous interdiction.
 *
 * ⚠ Le retour porte l'EXTRAIT, pas seulement le verdict. « Script refusé :
 * secteur interdit » envoie chercher à l'aveugle dans deux pages de texte ;
 * « refusé à cause de "financement CPF" ligne 12 » se corrige en dix secondes.
 * C'est la différence entre un garde qu'on répare et un garde qu'on désarme.
 */
export function secteursInterditsDans(script: string): AlerteSecteur[] {
  const out: AlerteSecteur[] = [];
  for (const interdiction of INTERDICTIONS_SECTORIELLES) {
    const m = interdiction.motif.exec(script);
    if (m) out.push({ interdiction, extrait: m[0] });
  }
  return out;
}

/**
 * La phrase servie à l'humain quand un script est refusé.
 *
 * Elle NOMME le texte et donne l'issue : un refus sans alternative se
 * contourne, un refus qui dit quoi faire à la place tient.
 */
export function motifDuRefus(a: AlerteSecteur): string {
  const { interdiction: i, extrait } = a;
  const verdict =
    i.portee === "interdiction"
      ? "la prospection commerciale y est INTERDITE"
      : "elle y exige un accord PRÉALABLE et explicite du prospect";
  const reserve =
    i.verification === "non-verifiee"
      ? " ⚠ Référence non vérifiée auprès d'un juriste — à confirmer avant d'engager."
      : "";
  return (
    `Script refusé : « ${extrait} » vise ${i.label}, où ${verdict} (${i.texte}). ` +
    `Ce qui reste possible : ${i.alternative}${reserve}`
  );
}
