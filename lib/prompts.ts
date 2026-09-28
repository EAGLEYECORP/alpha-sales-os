
/**
 * ─────────────────────────────────────────────────────────────────────
 * LE REGISTRE DES PROMPTS — ce qu'on modifie, et ce qu'on n'a pas le droit
 * de retirer en le modifiant.
 *
 * Un prompt n'est pas un texte libre : c'est un CONTRAT. Il reçoit des
 * variables nommées, il doit rendre une forme précise, et il porte des règles
 * qui ne sont pas des préférences de style — l'annonce IA de l'article 50, la
 * clause anti-injection, « jamais de prix avant la démo ».
 *
 * ── CE QUE CE MODULE PERMET, ET POURQUOI ÇA MANQUAIT ──
 *
 * Avant : la doctrine était écrite à sept endroits (voir
 * `lib/prompts-textes.ts`), un seul était éditable, et les nœuds IA de n8n
 * portaient une COPIE COLLÉE À LA MAIN. Modifier une règle voulait dire la
 * retrouver dans six fichiers puis rouvrir n8n. En pratique : on ne la
 * modifiait pas, et les copies divergeaient sans que rien ne le dise.
 *
 * Maintenant : un prompt s'édite à un endroit, se VALIDE contre ses
 * invariants, puis s'applique — aux routes de l'app immédiatement, et à n8n
 * quand on le pousse.
 *
 * ⚠ LA VALIDATION N'EST PAS UNE POLITESSE. `audit_script` (Alpha Voice) refuse
 * déjà un script non conforme à l'article 50 ; c'est le même principe étendu à
 * l'écrit. Un prompt d'où l'on a retiré la clause anti-injection accepte qu'un
 * email de prospect lui dicte sa conduite — et ça ne se voit pas dans la
 * sortie, ça se voit le jour où quelqu'un l'exploite.
 *
 * ⚠⚠ CE QUE CE MODULE NE FAIT PAS : il ne pousse rien tout seul. La bascule
 * app → n8n est un GESTE (voir `pousserPrompts`, lib/n8n.ts) et elle exige
 * que la validation soit passée. Un prompt qui part en silence vers douze
 * workflows est exactement ce qu'on ne veut pas.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Où tourne un prompt — ça décide de ce qui l'atteint quand on le modifie. */
export type LieuPrompt =
  /** Une route de l'app : la modification s'applique au prochain appel. */
  | { ou: "app"; route: string }
  /** Un nœud IA de n8n : la modification exige d'être POUSSÉE. */
  | { ou: "n8n"; workflow: string; noeud: string };

export interface PromptDef {
  id: string;
  label: string;
  /** À quoi il sert, en une phrase que l'opérateur comprend. */
  aQuoiCaSert: string;
  lieu: LieuPrompt;
  /** Les variables que le prompt reçoit, telles qu'elles arrivent. */
  variables: string[];
  /** La forme attendue en sortie — texte libre, ou JSON strict. */
  sortie: "texte" | "json";
  /**
   * Ce que le texte DOIT continuer à porter. Chaque entrée est vérifiée par
   * `validerPrompt` : si elle disparaît, la modification est refusée.
   */
  invariants: InvariantPrompt[];
}

export interface InvariantPrompt {
  /** Identifiant court, pour les messages et les tests. */
  cle: string;
  /** Ce qu'on exige, dit à l'opérateur qui vient de casser la règle. */
  exige: string;
  /** Pourquoi — la conséquence concrète, pas la règle abstraite. */
  pourquoi: string;
  /** Le motif qui atteste la présence de la règle dans le texte. */
  motif: RegExp;
}

/**
 * Les invariants partagés. Ils sont nommés une fois : deux formulations de la
 * même exigence finiraient par diverger, et c'est justement le défaut que ce
 * module corrige.
 */
export const INVARIANTS = {
  antiInjection: {
    cle: "anti-injection",
    exige: "La clause qui traite le contenu du prospect comme de la DONNÉE, jamais comme une instruction.",
    pourquoi:
      "Sans elle, un email de prospect peut dicter sa conduite à l'agent : lui faire ignorer ses règles, " +
      "révéler des informations internes, ou écrire à quelqu'un d'autre. Ça ne se voit pas dans la sortie.",
    motif: /DONNÉE, pas une instruction|donnée, pas une instruction/i,
  },
  jsonStrict: {
    cle: "json-strict",
    exige: "L'exigence d'une sortie en JSON valide, sans texte autour.",
    pourquoi:
      "Un nœud Code parse cette sortie. Une phrase d'introduction polie fait tomber le workflow entier, " +
      "et l'erreur remonte des heures plus tard sur une fiche au hasard.",
    motif: /JSON (?:strictement |valide|$)|STRICTEMENT en JSON|UNIQUEMENT par un objet JSON|réponds.{0,20}JSON/i,
  },
  prixApresDemo: {
    cle: "prix-apres-demo",
    exige: "La règle « jamais de prix avant la démo ».",
    pourquoi:
      "Un chiffre lâché trop tôt transforme la conversation en négociation. C'est la règle qui a coûté " +
      "le deal perdu inscrit dans le jeu de démonstration (« offre présentée avant la démo »).",
    /**
     * ⚠ Le motif ne doit pas coller à UNE formulation. `tests/prompts.test.ts`
     * l'a montré : le prompt `agent` porte bien la règle, écrite « démo mobile
     * avant prix » (sans article), et l'invariant la déclarait absente. Un
     * garde qui n'accepte qu'une tournure ne garde que le fichier où il a été
     * écrit.
     */
    motif: /avant la démo|AVANT le prix|avant prix|démo\/preuve AVANT le prix/i,
  },
  nextStepDate: {
    cle: "next-step-date",
    exige: "L'obligation de terminer chaque contact par un next step DATÉ.",
    pourquoi: "Un échange sans date de suite est un échange perdu : le dossier va dormir et personne ne le saura.",
    motif: /next step DATÉ|next step daté/i,
  },
  rienInventer: {
    cle: "rien-inventer",
    exige: "L'interdiction d'inventer ce qui n'a pas été dit.",
    pourquoi:
      "Un chiffre ou un nom fabriqué entre dans le CRM comme s'il avait été constaté, et plus personne " +
      "ne peut distinguer ce qui vient du terrain de ce qui vient du modèle.",
    motif: /N'invente rien|jamais un chiffre (?:inventé|générique)|sans interprétation/i,
  },
  /**
   * ── Les invariants de l'APPEL À FROID ──
   *
   * Doctrine du 28/08/2026 : Alpha Voice démarche. Une IA qui démarche n'a
   * droit à aucune improvisation — c'est la contrepartie de la décision, et
   * elle se vérifie au lieu de se recommander.
   */
  objectifUnique: {
    cle: "objectif-unique",
    exige: "La ligne « OBJECTIF UNIQUE » : obtenir un rendez-vous, rien d'autre.",
    pourquoi:
      "Un agent sans objectif unique négocie, explique, argumente — et sort du cadre validé. Au téléphone " +
      "avec un inconnu, chaque phrase de trop est une phrase qu'on ne peut plus reprendre.",
    motif: /OBJECTIF UNIQUE/i,
  },
  aucunPrix: {
    cle: "aucun-prix",
    exige: "L'interdiction explicite de parler de PRIX.",
    pourquoi:
      "Un chiffre lâché à froid transforme un premier contact en négociation, et engage la marque au nom de " +
      "laquelle l'agent parle — qui n'est pas toujours la nôtre.",
    /**
     * ⚠ « aucune modalité » NE compte PAS comme une interdiction de prix.
     *
     * Le motif l'acceptait, et les deux phrases vivent sur la même ligne de la
     * trame. Retirer « aucun prix — jamais » laissait donc l'invariant au vert
     * derrière « aucune modalité » : le test qui ampute ligne par ligne l'a
     * montré. Deux obligations distinctes — le périmètre et le tarif — ne
     * peuvent pas se couvrir l'une l'autre.
     */
    motif: /aucun prix|jamais de prix|ne parles JAMAIS de prix/i,
  },
  nonRaccroche: {
    cle: "non-raccroche",
    exige: "La consigne qui traite le NON : remercier, noter, raccrocher.",
    pourquoi:
      "Sans elle, l'agent insiste. C'est ce qui transforme un prospect tiède en détracteur, et c'est le " +
      "comportement qui fait perdre un compte partenaire.",
    motif: /si c'est NON/i,
  },
  ouiPasseLaMain: {
    cle: "oui-passe-la-main",
    exige: "La consigne qui traite le OUI : confirmer le créneau et passer la main.",
    pourquoi:
      "C'est le seul cas qui vaut le temps d'un closer. Sans la règle, l'agent continue à parler et dilue " +
      "l'accord qu'il vient d'obtenir.",
    motif: /si c'est OUI/i,
  },
  droitOpposition: {
    cle: "droit-opposition",
    exige: "Le droit d'opposition, traité immédiatement et définitivement.",
    pourquoi:
      "Ce n'est pas une politesse : c'est une condition de licéité (RGPD art. 21). Un refus ignoré est une " +
      "faute, pas une maladresse.",
    motif: /droit d'opposition/i,
  },
  chiffrerTaxe: {
    cle: "chiffrer-taxe",
    exige: "L'obligation de chiffrer la Taxe d'Ignorance avec SES chiffres à lui.",
    pourquoi: "Un montant générique se vérifie en dix secondes et détruit la crédibilité de tout le reste.",
    /**
     * ⚠ Même leçon : la doctrine écrit la règle « Chiffrer ce que coûte
     * l'inaction — avec SES chiffres à lui », sans jamais employer le mot
     * « Taxe d'Ignorance ». C'est pourtant exactement la même obligation.
     */
    motif: /Taxe d'Ignorance|ce que (?:coûte|l'inaction)|coûte l'inaction/i,
  },
} as const satisfies Record<string, InvariantPrompt>;

/**
 * Le registre.
 *
 * ⚠⚠ LE TEXTE LIVRÉ N'EST PAS ICI, ET LE GARDE DE FUITE ME L'A APPRIS.
 *
 * J'avais mis `defaut: DEFAULT_BUSINESS_RULES` dans chaque entrée. L'écran
 * `/prompts` est un composant CLIENT : `tests/vitrine-fuite.test.ts` a
 * immédiatement signalé que `lib/business-rules` repartait dans un fichier
 * JavaScript téléchargeable par n'importe qui. La doctrine récite l'offre,
 * la grille par brique et les taux de chaque compte — c'est exactement la
 * fuite que ce dépôt a déjà fermée trois fois.
 *
 * Ce module ne porte donc que ce qu'un inconnu peut lire : où le prompt
 * tourne, ce qu'il reçoit, ce qu'il doit rendre, et les règles qu'on n'a pas
 * le droit d'en retirer. Les TEXTES vivent dans `lib/prompts-textes.ts`
 * (serveur) et descendent par `/api/prompts`, une route réservée au compte
 * maître — même distinction que `/api/catalogue` : une route se garde, un
 * chunk `_next/static/**` ne se garde pas.
 */
export const PROMPTS: PromptDef[] = [
  {
    id: "doctrine",
    label: "La doctrine — les 14 règles",
    aQuoiCaSert:
      "Le socle injecté dans TOUS les prompts de l'app et de n8n. C'est ici qu'on change une règle de vente, " +
      "pas dans chaque prompt.",
    lieu: { ou: "app", route: "toutes les routes IA (doctrineOrDefault)" },
    variables: [],
    sortie: "texte",
    invariants: [INVARIANTS.prixApresDemo, INVARIANTS.nextStepDate, INVARIANTS.chiffrerTaxe],
  },
  {
    id: "socle-n8n",
    label: "Socle n8n — en tête de chaque nœud IA",
    aQuoiCaSert:
      "Le bloc commun collé en tête de tous les nœuds IA de n8n. Il porte la doctrine, la clause de sécurité " +
      "et le contrat de sortie JSON.",
    lieu: { ou: "n8n", workflow: "tous", noeud: "nœuds IA (système)" },
    variables: [],
    sortie: "json",
    invariants: [
      INVARIANTS.antiInjection,
      INVARIANTS.jsonStrict,
      INVARIANTS.prixApresDemo,
      INVARIANTS.nextStepDate,
      INVARIANTS.chiffrerTaxe,
    ],
  },
  {
    id: "copilote",
    label: "Copilote de vente",
    aQuoiCaSert:
      "Ce qui répond dans l'onglet « AI Coach » d'une fiche : scripts, notes d'audit, résumé, prochaine action.",
    lieu: { ou: "app", route: "POST /api/ai" },
    variables: ["{identité}", "{playbook du secteur}", "{extraits du Cerveau}"],
    sortie: "texte",
    invariants: [INVARIANTS.prixApresDemo, INVARIANTS.nextStepDate, INVARIANTS.chiffrerTaxe],
  },
  {
    id: "agent",
    label: "Agent ALPHA — conversation",
    aQuoiCaSert: "L'agent qui voit tout le pipeline et aide à préparer la journée, analyser un deal, décider.",
    lieu: { ou: "app", route: "POST /api/agent" },
    variables: ["{état du pipeline en JSON}", "{identité}", "{extraits du Cerveau}"],
    sortie: "texte",
    invariants: [INVARIANTS.prixApresDemo, INVARIANTS.nextStepDate, INVARIANTS.chiffrerTaxe],
  },
  {
    id: "voix-froid",
    label: "Alpha Voice — l'appel à froid",
    aQuoiCaSert:
      "La trame que l'agent vocal suit quand il appelle un inconnu. C'est le texte qui parle au téléphone — " +
      "celui qu'on ajuste le plus souvent, et le seul qui engage la marque au nom de laquelle on appelle.",
    lieu: { ou: "app", route: "POST /api/voice/call" },
    variables: ["{company}", "{onBehalfOf}", "{accroche}", "{offreLigne}", "{angleMetier}", "{marquePartenaire}"],
    sortie: "texte",
    /**
     * ⚠ `{accroche}` et `{marquePartenaire}` sont substitués par le CODE, pas
     * par l'opérateur : l'accroche vient de l'offre ROUTÉE (c'est ce qui
     * empêche l'angle Alpha Voice de partir sur un prospect routé ailleurs), et
     * la garde de marque partenaire ne s'ajoute que sur un compte partenaire.
     */
    invariants: [
      INVARIANTS.objectifUnique,
      INVARIANTS.aucunPrix,
      INVARIANTS.nonRaccroche,
      INVARIANTS.ouiPasseLaMain,
      INVARIANTS.droitOpposition,
    ],
  },
  {
    id: "debrief",
    label: "Débrief oral → CRM",
    aQuoiCaSert:
      "Transforme ce que le commercial dicte après un rendez-vous en résumé, objections et prochaine action.",
    lieu: { ou: "app", route: "POST /api/debrief" },
    variables: ["{transcript}"],
    sortie: "json",
    invariants: [INVARIANTS.jsonStrict, INVARIANTS.rienInventer],
  },
];

export const promptById = (id: string): PromptDef | undefined => PROMPTS.find((p) => p.id === id);

/** Ce qu'un prompt modifié a perdu. Vide = la modification peut s'appliquer. */
export interface VerdictPrompt {
  ok: boolean;
  /** Les invariants absents du texte proposé. */
  manques: InvariantPrompt[];
  /** Avertissements qui n'empêchent PAS d'appliquer. */
  alertes: string[];
}

/**
 * Longueur au-delà de laquelle un prompt commence à coûter plus qu'il ne
 * rapporte : chaque appel le paie en jetons, et les modèles suivent moins bien
 * une consigne noyée. Ce n'est pas un refus — c'est une alerte, parce que la
 * bonne longueur dépend du prompt.
 */
export const LONGUEUR_ALERTE = 4000;

/**
 * Valide un texte proposé contre les invariants du prompt.
 *
 * `defaut` est OPTIONNEL : il ne sert qu'à repérer une variable citée dans la
 * version livrée et disparue de la version modifiée. Le texte livré vivant
 * côté serveur (voir l'en-tête), un appelant client peut le passer une fois
 * qu'il l'a reçu — et s'en passer sinon. Les invariants, eux, se vérifient
 * toujours : ils ne dépendent que du texte proposé.
 */
export function validerPrompt(id: string, texte: string, defaut?: string): VerdictPrompt {
  const def = promptById(id);
  if (!def) {
    return {
      ok: false,
      manques: [],
      alertes: [`Prompt inconnu : « ${id} ». Le registre ne le connaît pas, on ne sait pas où il s'applique.`],
    };
  }

  const t = texte.trim();
  const alertes: string[] = [];

  if (!t) {
    return {
      ok: false,
      manques: def.invariants,
      alertes: ["Le prompt est vide. Un prompt vide ne désactive pas l'IA — il la laisse improviser."],
    };
  }

  const manques = def.invariants.filter((inv) => !inv.motif.test(t));

  if (t.length > LONGUEUR_ALERTE) {
    alertes.push(
      `${t.length} caractères : chaque appel les paie, et une consigne noyée se suit moins bien. ` +
        `Au-delà de ${LONGUEUR_ALERTE}, coupe plutôt que d'ajouter.`
    );
  }

  // Les variables annoncées doivent rester atteignables : un prompt qui cesse
  // de citer une variable qu'on lui passe la reçoit quand même, et le modèle
  // fait alors ce qu'il veut d'un bloc de contexte non introduit.
  const perdues = defaut ? def.variables.filter((v) => defaut.includes(v) && !t.includes(v)) : [];
  if (perdues.length) {
    alertes.push(
      `Variables citées dans la version d'origine et absentes de la tienne : ${perdues.join(", ")}. ` +
        `Elles seront quand même envoyées — sans phrase pour les introduire.`
    );
  }

  if (def.sortie === "json" && !INVARIANTS.jsonStrict.motif.test(t)) {
    // Déjà compté dans `manques` si l'invariant est déclaré ; sinon on le dit
    // quand même, parce que la sortie est parsée par du code.
    if (!def.invariants.some((i) => i.cle === "json-strict"))
      alertes.push("Sortie déclarée JSON mais le texte ne l'exige plus : le nœud qui la parse tombera.");
  }

  return { ok: manques.length === 0, manques, alertes };
}

/**
 * Différence ligne à ligne, pour relire AVANT d'appliquer.
 *
 * Volontairement naïf : ce n'est pas un algorithme de diff, c'est une lecture
 * côte à côte. Un vrai diff (Myers) demanderait une dépendance, et ce qu'on
 * veut ici tient en une question — « qu'est-ce que j'ai enlevé ? ».
 */
export interface LigneDiff {
  etat: "inchangee" | "ajoutee" | "retiree";
  texte: string;
}

export function diffPrompt(avant: string, apres: string): LigneDiff[] {
  const a = avant.split("\n");
  const b = apres.split("\n");
  const restantes = new Set(b);
  const out: LigneDiff[] = [];

  for (const ligne of a) {
    if (restantes.has(ligne)) out.push({ etat: "inchangee", texte: ligne });
    else out.push({ etat: "retiree", texte: ligne });
  }
  const vues = new Set(a);
  for (const ligne of b) {
    if (!vues.has(ligne)) out.push({ etat: "ajoutee", texte: ligne });
  }
  return out;
}

/** Un prompt tel qu'il est stocké après modification. */
export interface PromptModifie {
  id: string;
  texte: string;
  /** ISO — quand l'opérateur a validé la modification. */
  modifieLe: string;
  /** ISO — quand elle a été poussée à n8n. Absent = jamais poussée. */
  pousseLe?: string;
}

/**
 * Le texte effectif d'un prompt : la version modifiée si elle existe et si
 * elle est encore valide, sinon celle livrée.
 *
 * ⚠ LE « ENCORE VALIDE » N'EST PAS DE LA MÉFIANCE ENVERS L'OPÉRATEUR. Les
 * invariants évoluent : le jour où on en AJOUTE un (une nouvelle obligation
 * légale, par exemple), toutes les versions modifiées d'avant deviennent
 * non conformes. Servir une version périmée en silence serait la pire des
 * options — on retombe sur le défaut, et l'écran le dit.
 */
export function texteEffectif(
  id: string,
  defaut: string,
  modifies: PromptModifie[] = []
): { texte: string; source: "modifie" | "defaut"; raison?: string } {
  const def = promptById(id);
  if (!def) return { texte: "", source: "defaut", raison: "prompt inconnu" };

  const m = modifies.find((x) => x.id === id);
  if (!m?.texte.trim()) return { texte: defaut, source: "defaut" };

  const v = validerPrompt(id, m.texte, defaut);
  if (!v.ok) {
    return {
      texte: defaut,
      source: "defaut",
      raison: `la version modifiée ne porte plus : ${v.manques.map((x) => x.cle).join(", ")}`,
    };
  }
  return { texte: m.texte, source: "modifie" };
}

/** La modification a-t-elle été poussée à n8n depuis sa dernière écriture ? */
export function aPousser(m: PromptModifie): boolean {
  if (!m.pousseLe) return true;
  return new Date(m.modifieLe).getTime() > new Date(m.pousseLe).getTime();
}

/**
 * Ce qui doit partir vers n8n : les prompts dont le LIEU est n8n, plus la
 * doctrine (qui s'injecte dans tous les nœuds).
 *
 * ⚠ Les prompts « app » ne sont PAS poussés, et c'est volontaire : ils
 * s'appliquent au prochain appel de leur route, sans intermédiaire. Les
 * envoyer à n8n donnerait à croire qu'ils y font quelque chose.
 */
export function prompsPourN8n(): PromptDef[] {
  return PROMPTS.filter((p) => p.lieu.ou === "n8n" || p.id === "doctrine");
}
