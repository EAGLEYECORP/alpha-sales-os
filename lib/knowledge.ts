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
  source: "manuel" | "intel" | "debrief" | "playbook" | "auto";
  /**
   * Compte propriétaire de la note. ABSENT = note COMMUNE, visible depuis
   * tous les comptes (la doctrine, les chiffres maison, le routage).
   *
   * Pourquoi cloisonner : le contexte d'un appel ScintIA ne doit pas être
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
export const seedKnowledge: KnowledgeNote[] = [
  {
    id: "seed-offre",
    title: "Offre — Alpha Sales OS",
    body: "L'OS de vente intelligent pour forces de vente et agences. Installation 2 500 €, abonnement dès 290 €/mois.\n\nPromesse : zéro lead perdu, la machine tourne 24/7. On outille le closing, on ne remplit pas une base — on remplit un agenda.\n\nVoir [[Chiffres — preuve de concept]] et [[Routage d'offre]].",
    tags: ["offre", "alpha-sales-os"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-chiffres",
    title: "Chiffres — preuve de concept",
    body: "Preuve de concept = 2 500 € d'installation × 10 clients = **25 000 €** de cash.\n\n- MRR à 290 €/mois × 10 = 2 900 €/mois (~35 k€ ARR)\n- CAC ~275 €/client (≈ 91 % ton temps) · LTV ~5 980 € · LTV:CAC ~21:1\n- Break-even infra : 1 client\n\nLes « 5M » viennent des revendeurs white-label, pas d'une campagne à 10 signatures.",
    tags: ["chiffres", "economie"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-routage",
    title: "Routage d'offre",
    body: "Après l'audit, on route le prospect :\n\n- Appels manqués / métier téléphone → **ScintIA Callflow**\n- Leads & deals à structurer → **Alpha Sales OS**\n- Invisible en ligne (pas de site, peu d'avis) → **Visibilité / Growth** (offre personnalisée)\n\nPersonne ne sort les mains vides. Voir [[Play — Permis Lyon]].",
    tags: ["doctrine", "routage"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-permis",
    title: "Play — Permis Lyon",
    body: "ICP à déclencheur : un maître d'œuvre nommé sur un permis de construire EN COURS est en pleine activité — le bon moment pour l'approcher.\n\nn8n tire les permis (data.grandlyon.com) → pousse les MOE dans l'app → audit → [[Routage d'offre]] → séquence.",
    tags: ["play", "prospection", "lyon"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
];

/**
 * Notes propres au compte ScintIA — le pipe réel de juillet 2026.
 *
 * Ce ne sont pas des exemples : ce sont les chiffres du dossier commercial.
 * Ils servent de contexte à CHAQUE échange fait au nom de ScintIA — l'agent
 * sait ce qui a marché, ce qui a échoué, et pourquoi.
 */
export const seedScintia: KnowledgeNote[] = [
  {
    id: "sc-juillet-chiffres",
    accountId: "scintia",
    title: "Juillet 2026 — ce que le mois a réellement produit",
    body:
      "78 prospects travaillés · 51 dans l'univers · 132 appels · 18 audits · 24 SMS.\n" +
      "Résultat : 6 RDV obtenus, 7 opportunités, 5 940 € de pipeline installation, **0 gagné**.\n\n" +
      "Taux travaillés → RDV : 11,8 %.\n\n" +
      "La lecture qui compte : voir [[Juillet 2026 — l'audit fait la différence]].",
    tags: ["scintia", "chiffres", "juillet-2026"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-juillet-lecon",
    accountId: "scintia",
    title: "Juillet 2026 — l'audit fait la différence",
    body:
      "Par secteur (prospects · appels · audits · opportunités) :\n\n" +
      "- Auto-école : 3 · 7 · 2 · **3** — le meilleur ratio, de loin\n" +
      "- Immobilier : 8 · 10 · 4 · **2**\n" +
      "- Garage/Carrosserie : 18 · 34 · 1 · **2**\n" +
      "- Médical/Dentaire : 10 · 13 · 5 · 0\n" +
      "- Dépannage/Plomberie : 14 · **26** · **0** · **0**\n" +
      "- Ambulance : 8 · 14 · 1 · 0\n\n" +
      "**La leçon** : là où un AUDIT est parti, le taux monte. Là où il n'y a eu que " +
      "des appels, il reste à zéro. 26 appels en plomberie sans une seule pièce écrite " +
      "n'ont rien produit.\n\n" +
      "Conséquence opérationnelle : aucun prospect ne va en séquence sans audit écrit.",
    tags: ["scintia", "doctrine", "audit"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-callflow-tarifs",
    accountId: "scintia",
    title: "Callflow — tarifs publics",
    body:
      "Installation : **990 € HT**.\n\n" +
      "Paliers minutes (abonnement mensuel) :\n" +
      "- 250 min — 59 € (~100 appels courts)\n" +
      "- 500 min — 115 € (~200 appels)\n" +
      "- 750 min — 169 € (~300 appels)\n" +
      "- 1 000 min — 219 € (~400 appels)\n" +
      "- 1 500 min — 319 € (~600 appels)\n\n" +
      "Commission EAGLEYE : 30 % du setup + 10 % du mensuel.\n" +
      "Jamais de prix avant la démo. Voir [[Cadence de relance Callflow]].",
    tags: ["scintia", "tarifs", "callflow"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-cadence",
    accountId: "scintia",
    title: "Cadence de relance Callflow",
    body:
      "Exigée par ScintIA, non négociable :\n\n" +
      "Après le premier appel sans réponse → **5 rappels sur 2 jours** (3 h, 8 h, 24 h, 32 h, 48 h).\n\n" +
      "**Dès qu'il répond** : Alpha Voice ARRÊTE d'appeler, met à jour le pipeline, et passe " +
      "la main à l'humain (closer).\n\n" +
      "Opposition (« ne me rappelez plus ») ou numéro invalide : arrêt DÉFINITIF immédiat, " +
      "prioritaire sur la cadence.",
    tags: ["scintia", "doctrine", "cadence"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-closing",
    accountId: "scintia",
    title: "ScintIA — rituel de closing",
    body:
      "Quand le prospect est prêt : envoyer la **PROPOSITION COMMERCIALE** depuis " +
      "`z.tazi@scintia.ai`, via le panel `https://sales.scintiacallflow.ai/`.\n\n" +
      "Se tromper de rituel (envoyer un devis EAGLEYE sur un deal ScintIA) fait perdre " +
      "le deal au dernier mètre.\n\n" +
      "ScintIA vend Callflow comme un **produit** — c'est leur seule offre. " +
      "Tout le reste (visibilité, digitalisation < 40 k) revient à EAGLEYE.",
    tags: ["scintia", "closing"],
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    source: "playbook",
  },
];

/** Contexte compact des notes récupérées, à injecter dans un prompt IA. */
export function contextFromNotes(scored: Scored[], maxChars = 3000): string {
  const blocks: string[] = [];
  let used = 0;
  for (const { note } of scored) {
    const block = `## ${note.title}\n${note.body.trim()}`;
    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n");
}
