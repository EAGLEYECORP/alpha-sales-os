import type { KnowledgeNote } from "./knowledge";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES RÉFÉRENCES — les sources extérieures qu'on fait entrer dans le Cerveau.
 *
 * ── LE PROBLÈME QUE ÇA RÈGLE, ET CELUI QUE ÇA NE RÈGLE PAS ──
 *
 * Demande initiale : « pouvoir ajouter des livres ou autre comme info de
 * référence, des VÉRITÉS qui nous évitent des erreurs ».
 *
 * La première moitié est facile. La seconde est un piège, et il faut le dire
 * net : **un livre n'est pas une vérité.** Cashvertising, Hormozi, une vidéo
 * YouTube — ce sont des CLAIMS de praticiens. Certains reposent sur une étude,
 * beaucoup sur une anecdote, quelques-uns sur du folklore recopié depuis
 * quarante ans. Les verser tels quels dans la doctrine serait dangereux d'une
 * manière précise : la doctrine alimente les prompts, les prompts produisent
 * de VRAIS emails envoyés à de VRAIS prospects. Un « fait » faux devient une
 * phrase envoyée sous le nom de Zakaria.
 *
 * Ce qui évite réellement des erreurs, ce n'est donc pas d'accumuler des
 * affirmations. C'est de garder attachés à chaque affirmation :
 *
 *  1. D'OÙ elle vient (la provenance),
 *  2. CE QU'ELLE VAUT (le niveau de fiabilité),
 *  3. Et surtout : SI ELLE CONTREDIT une règle de la maison.
 *
 * Le point 3 est celui qui sauve. Une leçon de vente qui contredit le playbook
 * ne doit jamais être appliquée en silence — elle doit être ARBITRÉE. Sans ce
 * garde-fou, importer un bon livre dégrade la doctrine au lieu de l'enrichir.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Ce que vaut une affirmation. C'est une échelle de PREUVE, pas de qualité :
 * un conseil de praticien peut être excellent et rester non prouvé chez nous.
 */
export type Fiabilite = "mesure-maison" | "source-primaire" | "praticien" | "folklore";

export const FIABILITES: { id: Fiabilite; label: string; quoi: string }[] = [
  {
    id: "mesure-maison",
    label: "Mesuré chez nous",
    quoi: "Constaté sur nos propres affaires, avec les chiffres. C'est la SEULE catégorie qui mérite le mot « vérité ».",
  },
  {
    id: "source-primaire",
    label: "Source primaire",
    quoi: "Étude, donnée publiée, chiffre officiel qu'on peut aller relire. Vrai ailleurs — reste à vérifier ici.",
  },
  {
    id: "praticien",
    label: "Praticien",
    quoi: "Un professionnel affirme que ça marche. Souvent juste, jamais prouvé. La plupart des livres de vente sont ici.",
  },
  {
    id: "folklore",
    label: "Folklore",
    quoi: "Répété partout, sans source traçable. À traiter comme une hypothèse, pas comme un argument.",
  },
];

/** Le statut d'une leçon vis-à-vis de la doctrine maison. */
export type StatutLecon = "applicable" | "sous-condition" | "conflit-doctrine" | "bloque";

export const STATUTS: { id: StatutLecon; label: string; quoi: string }[] = [
  { id: "applicable", label: "Applicable", quoi: "Ne heurte aucune règle maison. Utilisable tel quel." },
  { id: "sous-condition", label: "Sous condition", quoi: "Utilisable seulement si la condition posée est remplie." },
  {
    id: "conflit-doctrine",
    label: "Contredit la doctrine",
    quoi: "S'oppose à une règle de la maison. Ne s'applique JAMAIS sans arbitrage explicite.",
  },
  {
    id: "bloque",
    label: "Bloqué",
    quoi: "Inapplicable en l'état — il manque un préalable factuel (un client, une mesure, une preuve).",
  },
];

export type TypeSource = "livre" | "video" | "cours" | "article" | "podcast" | "transcription" | "terrain";

export interface LeconSource {
  /** Identifiant court et stable, pour la citer depuis une autre note. */
  id: string;
  titre: string;
  /** Ce que la source affirme, en une à trois phrases. Fidèle, pas embelli. */
  quoi: string;
  statut: StatutLecon;
  /**
   * Pour `sous-condition` et `bloque` : ce qu'il faut avant de s'en servir.
   * Pour `conflit-doctrine` : la règle maison heurtée, mot pour mot.
   */
  reserve?: string;
  tags?: string[];
}

export interface Reference {
  id: string;
  titre: string;
  auteur?: string;
  type: TypeSource;
  annee?: number;
  url?: string;
  /** Le niveau par défaut des leçons de cette source. Une leçon peut baisser. */
  fiabilite: Fiabilite;
  /** Pourquoi cette source entre dans le Cerveau — en une phrase. */
  pourquoi: string;
  lecons: LeconSource[];
  ajouteeLe?: string;
}

export interface ErreurReference {
  champ: string;
  message: string;
}

/**
 * Une référence sans provenance ni justification n'a rien à faire là.
 *
 * Le seuil sur `pourquoi` n'est pas cosmétique : une source qu'on ne sait pas
 * justifier en une phrase est une source qu'on a ajoutée par réflexe, et elle
 * diluera les recherches du Cerveau sans rien y ajouter.
 */
export function validerReference(r: Partial<Reference>): ErreurReference[] {
  const err: ErreurReference[] = [];

  if (!(r.titre ?? "").trim()) err.push({ champ: "titre", message: "Le titre de la source est obligatoire." });
  if (!TYPES.includes((r.type ?? "") as TypeSource)) {
    err.push({ champ: "type", message: `Type inconnu. Valeurs : ${TYPES.join(", ")}.` });
  }
  if (!FIABILITES.some((f) => f.id === r.fiabilite)) {
    err.push({ champ: "fiabilite", message: "Le niveau de fiabilité est obligatoire — c'est lui qui empêche de citer un livre comme un fait maison." });
  }
  if ((r.pourquoi ?? "").trim().length < 20) {
    err.push({ champ: "pourquoi", message: "Dis en une phrase ce que cette source apporte. Moins de 20 caractères = tu ne le sais pas encore." });
  }
  if (!r.lecons?.length) {
    err.push({ champ: "lecons", message: "Une référence sans leçon extraite est un signet, pas une référence." });
  }

  (r.lecons ?? []).forEach((l, i) => {
    if (!(l.titre ?? "").trim()) err.push({ champ: `lecons[${i}].titre`, message: "Leçon sans titre." });
    if ((l.quoi ?? "").trim().length < 25) {
      err.push({ champ: `lecons[${i}].quoi`, message: "Résume l'affirmation en une phrase complète — un fragment ne se relit pas dans six mois." });
    }
    if (!STATUTS.some((s) => s.id === l.statut)) {
      err.push({ champ: `lecons[${i}].statut`, message: "Statut inconnu." });
    }
    // Le point qui sauve : un conflit ou un blocage SANS réserve écrite est
    // une bombe à retardement. On saura qu'il y a un problème, pas lequel.
    if ((l.statut === "conflit-doctrine" || l.statut === "bloque" || l.statut === "sous-condition") && !(l.reserve ?? "").trim()) {
      err.push({
        champ: `lecons[${i}].reserve`,
        message: `Statut « ${l.statut} » sans réserve écrite : personne ne saura quoi arbitrer.`,
      });
    }
  });

  return err;
}

const TYPES: TypeSource[] = ["livre", "video", "cours", "article", "podcast", "transcription", "terrain"];
export const TYPES_SOURCE = TYPES;

/** Identifiant lisible tiré d'un titre — stable, donc réimportable sans doublon. */
export function idDepuisTitre(titre: string): string {
  return (titre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * L'en-tête que porte CHAQUE note issue d'une référence.
 *
 * C'est la ligne qui empêche l'erreur : elle voyage avec la note dans le
 * contexte IA, donc l'agent lit toujours « praticien, non vérifié chez nous »
 * avant l'affirmation elle-même. Sans elle, une phrase de livre revient dans
 * un email au même rang qu'un chiffre mesuré sur nos propres affaires.
 */
export function entete(r: Reference, l: LeconSource): string {
  const f = FIABILITES.find((x) => x.id === r.fiabilite);
  const s = STATUTS.find((x) => x.id === l.statut);
  const source = [r.titre, r.auteur, r.annee].filter(Boolean).join(" · ");
  return `> **Source externe — ${f?.label ?? r.fiabilite}.** ${source}\n> **Statut : ${s?.label ?? l.statut}.**${l.reserve ? ` ${l.reserve}` : ""}`;
}

/**
 * Une référence devient N notes du Cerveau : une par leçon, plus une note
 * d'index qui les relie.
 *
 * Une note par leçon, et pas un pavé : la recherche du Cerveau est lexicale
 * (BM25). Un document de 35 leçons remonterait en entier sur n'importe quelle
 * requête, écraserait les notes courtes et pertinentes, et remplirait le
 * budget de contexte avec 34 leçons hors sujet.
 */
export function referenceVersNotes(r: Reference, maintenant = new Date()): KnowledgeNote[] {
  const iso = maintenant.toISOString();
  const base = idDepuisTitre(r.id || r.titre);

  const notes: KnowledgeNote[] = r.lecons.map((l) => ({
    id: `ref-${base}-${l.id}`,
    title: `${l.titre} — ${r.titre}`,
    body: [
      entete(r, l),
      "",
      l.quoi.trim(),
      "",
      `Voir [[Référence — ${r.titre}]].`,
    ].join("\n"),
    tags: ["reference", r.type, r.fiabilite, l.statut, ...(l.tags ?? [])],
    createdAt: iso,
    updatedAt: iso,
    source: "reference",
  }));

  const parStatut = STATUTS.map((s) => {
    const n = r.lecons.filter((l) => l.statut === s.id).length;
    return n ? `- **${s.label}** : ${n}` : null;
  }).filter(Boolean);

  notes.push({
    id: `ref-${base}-index`,
    title: `Référence — ${r.titre}`,
    body: [
      `**${[r.auteur, r.type, r.annee].filter(Boolean).join(" · ")}**${r.url ? ` — ${r.url}` : ""}`,
      "",
      `Niveau de preuve : **${FIABILITES.find((f) => f.id === r.fiabilite)?.label ?? r.fiabilite}**.`,
      "",
      r.pourquoi.trim(),
      "",
      `${r.lecons.length} leçon(s) extraite(s) :`,
      ...parStatut,
      "",
      ...r.lecons.map((l) => `- [[${l.titre} — ${r.titre}]]`),
    ].join("\n"),
    tags: ["reference", "index", r.type, r.fiabilite],
    createdAt: iso,
    updatedAt: iso,
    source: "reference",
  });

  return notes;
}

export interface AlerteReference {
  leconId: string;
  titre: string;
  statut: StatutLecon;
  reserve: string;
}

/**
 * Ce qu'il faut ARBITRER avant de se servir de cette source.
 *
 * Rendu séparément parce que c'est ce qui se lit en premier : une référence
 * s'ajoute en dix secondes, ses conflits se paient sur un vrai prospect.
 */
export function alertes(r: Reference): AlerteReference[] {
  return r.lecons
    .filter((l) => l.statut === "conflit-doctrine" || l.statut === "bloque")
    .map((l) => ({ leconId: l.id, titre: l.titre, statut: l.statut, reserve: l.reserve ?? "" }));
}

/**
 * Les leçons réellement utilisables aujourd'hui.
 *
 * `sous-condition` est INCLUS : sa condition est écrite et se vérifie au cas
 * par cas. `conflit-doctrine` et `bloque` sont exclus — les inclure « pour
 * voir » est exactement la manière dont une règle maison se perd.
 */
export function utilisables(r: Reference): LeconSource[] {
  return r.lecons.filter((l) => l.statut === "applicable" || l.statut === "sous-condition");
}

export interface ResumeReference {
  total: number;
  applicables: number;
  sousCondition: number;
  conflits: number;
  bloquees: number;
  /** La phrase à afficher au-dessus de la liste. */
  verdict: string;
}

export function resumer(r: Reference): ResumeReference {
  const c = (s: StatutLecon) => r.lecons.filter((l) => l.statut === s).length;
  const conflits = c("conflit-doctrine");
  const bloquees = c("bloque");
  const applicables = c("applicable");
  const sousCondition = c("sous-condition");

  const verdict =
    conflits + bloquees === 0
      ? `${r.lecons.length} leçon(s), aucune ne heurte la doctrine.`
      : `${applicables + sousCondition} leçon(s) utilisable(s) · ${conflits} contredisent la doctrine · ${bloquees} bloquée(s) faute de préalable. Lis les réserves avant de t'en servir.`;

  return { total: r.lecons.length, applicables, sousCondition, conflits, bloquees, verdict };
}
