/**
 * ─────────────────────────────────────────────────────────────────────
 * Le Cerveau — RAG lexical, zéro dépendance, hors-ligne.
 *
 * « Obsidian + RAG » sans vector DB ni clé : les notes vivent en markdown
 * dans le store ; la récupération se fait par score lexical (BM25) sur les
 * mots. Rien ne sort de la machine. L'IA (optionnelle) ne fait que
 * SYNTHÉTISER les notes récupérées — la vérité reste tes notes.
 *
 * Upgrade prévu (v2) : brancher des embeddings (Ollama `nomic-embed-text`)
 * derrière la même interface `search()` — comme la cascade IA, mieux avec
 * une clé, mais déjà utile sans.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface KnowledgeNote {
  id: string;
  title: string;
  /** Corps markdown. Les [[liens]] tissent le graphe (façon Obsidian). */
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** D'où vient la note : saisie, aspirée d'un prospect, d'un débrief… */
  /**
   * `terrain` : écrite AUTOMATIQUEMENT depuis un événement réel (débrief,
   * objection traitée, perte). C'est la mémoire qui s'accumule — elle ne pèse
   * pas comme la doctrine (`playbook`), et l'opérateur doit pouvoir faire le
   * tri d'un coup d'œil : une leçon tirée d'un cas n'est pas une règle.
   */
  /**
   * `reference` : extraite d'une SOURCE EXTÉRIEURE (livre, vidéo, cours). Elle
   * porte toujours son en-tête de provenance et son niveau de preuve dans le
   * corps — voir `lib/references.ts`. C'est la seule source qui n'est pas de
   * nous : elle ne se cite jamais comme un fait maison.
   */
  source: "manuel" | "intel" | "debrief" | "playbook" | "auto" | "terrain" | "reference";
  /**
   * Compte propriétaire de la note. ABSENT = note COMMUNE, visible depuis
   * tous les comptes (la doctrine, les chiffres maison, le routage).
   *
   * Pourquoi cloisonner : le contexte d'un appel partenaire ne doit pas être
   * pollué par les notes Nuwacom — sinon l'agent mélange deux marques dans
   * la même phrase. C'est une frontière d'IDENTITÉ COMMERCIALE, pas de
   * sécurité (le vrai cloisonnement des données reste la RLS + le JWT).
   */
  accountId?: string;
}

/**
 * Les notes visibles depuis un compte : les siennes + les communes.
 * Depuis le compte MAÎTRE, on voit tout — c'est lui qui pilote le portefeuille
 * et qui doit pouvoir relire n'importe quelle marque.
 */
export function notesForAccount(
  notes: KnowledgeNote[],
  accountId: string | undefined,
  isMaster = false
): KnowledgeNote[] {
  if (isMaster) return notes;
  return notes.filter((n) => !n.accountId || n.accountId === (accountId ?? "eagleye"));
}

// Mots vides FR + EN : ils n'apportent aucun signal de pertinence.
const STOP = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "a", "au", "aux", "en", "dans", "sur", "pour", "par", "avec", "sans",
  "ce", "cet", "cette", "ces", "son", "sa", "ses", "est", "sont", "etre", "avoir", "que", "qui", "quoi", "ne", "pas", "plus", "on",
  "nous", "vous", "ils", "elles", "je", "tu", "il", "elle", "se", "si", "mais", "donc", "car", "ni", "y", "l", "d", "c", "s", "n", "j", "t", "m",
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "be", "it", "this", "that", "with", "as", "at", "by",
]);

/** Minuscule + sans accents + découpage en mots utiles (≥ 2 lettres, hors stopwords). */
export function tokenize(text: string): string[] {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

const WIKILINK = /\[\[([^\]]+)\]\]/g;

/** Titres cités en [[lien]] dans un corps. */
export function extractLinks(body: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  WIKILINK.lastIndex = 0;
  while ((m = WIKILINK.exec(body ?? "")) !== null) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return Array.from(new Set(out));
}

/** Notes qui pointent vers `title` via un [[lien]] (rétroliens Obsidian). */
export function backlinks(title: string, notes: KnowledgeNote[]): KnowledgeNote[] {
  const norm = title.trim().toLowerCase();
  return notes.filter((n) => extractLinks(n.body).some((l) => l.toLowerCase() === norm));
}

export interface Scored {
  note: KnowledgeNote;
  score: number;
}

const K1 = 1.5;
const B = 0.75;
const TITLE_BOOST = 2.5; // un terme dans le titre pèse plus que dans le corps.

/**
 * Recherche BM25 lexical. Retourne les notes les plus pertinentes (score > 0),
 * triées. `k` limite le nombre de résultats.
 */
export function search(query: string, notes: KnowledgeNote[], k = 6): Scored[] {
  const q = tokenize(query);
  if (q.length === 0 || notes.length === 0) return [];

  // Corpus : tokens par note (titre compté TITLE_BOOST fois) + longueurs.
  const docs = notes.map((n) => {
    const bodyTokens = tokenize(n.body);
    const titleTokens = tokenize(n.title);
    const tf = new Map<string, number>();
    for (const t of bodyTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of titleTokens) tf.set(t, (tf.get(t) ?? 0) + TITLE_BOOST);
    const len = bodyTokens.length + titleTokens.length * TITLE_BOOST;
    return { note: n, tf, len };
  });

  const N = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / N || 1;
  const qTerms = Array.from(new Set(q));

  // df par terme de requête.
  const df = new Map<string, number>();
  for (const t of qTerms) {
    let c = 0;
    for (const d of docs) if (d.tf.has(t)) c += 1;
    df.set(t, c);
  }

  const scored: Scored[] = docs.map((d) => {
    let score = 0;
    for (const t of qTerms) {
      const f = d.tf.get(t) ?? 0;
      if (f === 0) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avgdl)));
    }
    return { note: d.note, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Notes de départ — le socle du Cerveau (offre, chiffres, doctrine de routage). */
/**
 * L'étiquette que porte un bloc dans le contexte IA.
 *
 * ⚠ CE N'EST PAS DÉCORATIF, et la nuance entre les deux marques compte.
 *
 * `contextFromNotes` alimente `brainContext`, qui part dans les prompts de la
 * boîte de réception, du dossier prospect et de l'agent — c'est-à-dire dans
 * des messages RÉELLEMENT envoyés sous le nom de l'opérateur.
 *
 * Or la recherche est lexicale : une leçon marquée `bloque` (« montre tes
 * témoignages », « associe-toi à des célébrités ») remonte comme n'importe
 * quelle autre dès que le message du prospect parle de références ou d'avis.
 * Dire « non vérifiée chez nous » ne suffit alors pas — ça se lit comme une
 * réserve, pas comme une interdiction, et le modèle applique quand même.
 *
 * Une leçon bloquée ou en conflit part donc avec une INTERDICTION explicite.
 * On ne la retire pas du contexte : la laisser dedans, interdite et motivée,
 * vaut mieux que l'absence — sinon le modèle réinvente le conseil tout seul,
 * depuis son propre entraînement, et sans la réserve qui va avec.
 */
function etiquette(note: KnowledgeNote): string {
  if (note.source !== "reference") return "";
  if (note.tags.includes("bloque") || note.tags.includes("conflit-doctrine")) {
    return " [NE PAS APPLIQUER — contredit la doctrine ou exige une preuve qu'on n'a pas. Lire la réserve ci-dessous.]";
  }
  return " [SOURCE EXTERNE — non vérifiée chez nous]";
}

/** Contexte compact des notes récupérées, à injecter dans un prompt IA. */
export function contextFromNotes(scored: Scored[], maxChars = 3000): string {
  const blocks: string[] = [];
  let used = 0;
  for (const { note } of scored) {
    const block = `## ${note.title}${etiquette(note)}\n${note.body.trim()}`;
    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n");
}
