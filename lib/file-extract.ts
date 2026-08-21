/**
 * ─────────────────────────────────────────────────────────────────────
 * EXTRACTION DE TEXTE — PDF, HTML, DOCX, Markdown, texte brut.
 *
 * Le Cerveau ne vaut que par ce qu'on lui donne. Les audits envoyés vivent
 * en PDF, les échanges en `.html`, les comptes rendus en `.docx` : tant
 * qu'on ne sait pas les lire, la mémoire de l'entreprise reste vide.
 *
 * ZÉRO DÉPENDANCE, comme partout ici :
 *   · PDF  — on lit les flux de contenu et on décode les opérateurs de texte
 *            (Tj, TJ, '). Les flux compressés passent par DecompressionStream,
 *            natif depuis Node 18 et présent dans tous les navigateurs récents.
 *   · DOCX — c'est un ZIP ; on localise `word/document.xml`, on le décompresse
 *            (deflate brut) et on retire les balises.
 *   · HTML — on retire script/style, on décode les entités, on garde les sauts
 *            de ligne structurels.
 *
 * ⚠ CE QUE ÇA NE FAIT PAS, et il faut le dire au lieu de rendre du charabia :
 *   · un PDF SCANNÉ (image) ne contient aucun texte — il faudrait un OCR ;
 *   · un PDF à polices exotiques peut rendre des caractères faux ;
 *   · les tableaux perdent leur structure.
 * Chaque extraction renvoie donc un `warning` quand le résultat est douteux,
 * plutôt que de laisser croire que tout est allé bien.
 * ─────────────────────────────────────────────────────────────────────
 */

export type FileKind = "pdf" | "docx" | "html" | "markdown" | "texte" | "inconnu";

export interface Extraction {
  kind: FileKind;
  text: string;
  /** Nombre de caractères utiles extraits. */
  chars: number;
  /** Vrai si on a obtenu quelque chose d'exploitable. */
  ok: boolean;
  /** Ce qui s'est mal passé, ou ce dont il faut se méfier. */
  warning?: string;
}

export function kindFromName(name: string, mime?: string): FileKind {
  const n = name.toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (n.endsWith(".pdf") || m.includes("pdf")) return "pdf";
  if (n.endsWith(".docx") || m.includes("wordprocessingml")) return "docx";
  if (n.endsWith(".html") || n.endsWith(".htm") || m.includes("html")) return "html";
  if (n.endsWith(".md") || n.endsWith(".markdown")) return "markdown";
  if (n.endsWith(".txt") || n.endsWith(".csv") || m.startsWith("text/")) return "texte";
  return "inconnu";
}

// ── HTML ───────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç",
  ugrave: "ù", ocirc: "ô", icirc: "î", euro: "€", hellip: "…",
  laquo: "«", raquo: "»", rsquo: "'", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Texte lisible d'un document HTML (email exporté, page sauvegardée). */
export function extractHtml(html: string): Extraction {
  const stripped = html
    // Le contenu de script/style n'est pas du texte lisible.
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Les balises de bloc deviennent des sauts de ligne : sans ça, tout le
    // document se colle en une seule phrase illisible.
    .replace(/<\/(p|div|tr|li|h[1-6]|section|article|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(stripped)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();

  return {
    kind: "html",
    text,
    chars: text.length,
    ok: text.length > 0,
    warning: text.length === 0 ? "Aucun texte lisible dans ce HTML." : undefined,
  };
}

// ── Décompression (partagée PDF / DOCX) ────────────────────────────────

async function inflate(bytes: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

// ── PDF ────────────────────────────────────────────────────────────────

const latin1 = (b: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

/** Déséchappe une chaîne littérale PDF : \( \) \\ \n \t et octal \053. */
function unescapePdf(s: string): string {
  return s
    .replace(/\\([nrtbf])/g, (_, c) => ({ n: "\n", r: "\n", t: "\t", b: "", f: "\n" })[c as string] ?? "")
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, "$1");
}

/** Les chaînes affichées d'un morceau de flux de contenu PDF. */
function textFromContentStream(content: string): string {
  const out: string[] = [];
  // Tj / ' : une chaîne. TJ : un tableau de chaînes et de décalages.
  const re = /\((?:[^()\\]|\\.)*\)\s*(?:Tj|')|\[(?:[^\][\\]|\\.)*\]\s*TJ|\bT\*|\bTd\b|\bTD\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const tok = m[0];
    if (/^\bT\*|Td|TD/.test(tok)) {
      out.push("\n");
      continue;
    }
    if (tok.startsWith("[")) {
      const parts = tok.match(/\((?:[^()\\]|\\.)*\)/g) ?? [];
      out.push(parts.map((p) => unescapePdf(p.slice(1, -1))).join(""));
    } else {
      const lit = tok.match(/\((?:[^()\\]|\\.)*\)/)?.[0] ?? "";
      out.push(unescapePdf(lit.slice(1, -1)));
    }
  }
  return out.join("");
}

/**
 * Texte d'un PDF. On parcourt les objets `stream…endstream`, on décompresse
 * ceux qui sont en FlateDecode, et on lit les opérateurs de texte.
 */
export async function extractPdf(buf: ArrayBuffer): Promise<Extraction> {
  const bytes = new Uint8Array(buf);
  const raw = latin1(bytes);

  if (!raw.startsWith("%PDF")) {
    return { kind: "pdf", text: "", chars: 0, ok: false, warning: "Ce fichier n'est pas un PDF valide." };
  }

  const chunks: string[] = [];
  const marker = "stream";
  let i = 0;
  while ((i = raw.indexOf(marker, i)) !== -1) {
    // En-tête de l'objet : dit si le flux est compressé.
    const header = raw.slice(Math.max(0, i - 400), i);
    let start = i + marker.length;
    if (raw[start] === "\r") start++;
    if (raw[start] === "\n") start++;
    let end = raw.indexOf("endstream", start);
    if (end === -1) break;

    // Le format PDF impose un saut de ligne AVANT « endstream », et il ne fait
    // pas partie des données. Le laisser corrompt le flux et fait échouer la
    // décompression sur un fichier pourtant valide.
    if (raw[end - 1] === "\n") end--;
    if (raw[end - 1] === "\r") end--;

    const slice = bytes.subarray(start, end);
    if (/FlateDecode/.test(header)) {
      const inflated = (await inflate(slice, "deflate")) ?? (await inflate(slice, "deflate-raw"));
      if (inflated) chunks.push(textFromContentStream(latin1(inflated)));
    } else if (!/\/Image|DCTDecode|JPXDecode/.test(header)) {
      chunks.push(textFromContentStream(latin1(slice)));
    }
    i = end + 9;
  }

  const text = chunks
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  // Un PDF scanné produit zéro caractère : il faut le dire, pas rendre du vide
  // en prétendant que tout va bien.
  if (text.length < 20) {
    return {
      kind: "pdf",
      text,
      chars: text.length,
      ok: false,
      warning:
        "Presque aucun texte extrait. Ce PDF est probablement SCANNÉ (une image) : il faudrait un OCR. " +
        "Copie-colle le texte à la main, ou réexporte le document depuis sa source.",
    };
  }

  return { kind: "pdf", text, chars: text.length, ok: true };
}

// ── DOCX ───────────────────────────────────────────────────────────────

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/**
 * Texte d'un .docx. Le format est un ZIP : on cherche l'entrée
 * `word/document.xml` via les en-têtes locaux, on la décompresse en deflate
 * brut, puis on retire le balisage en préservant les paragraphes.
 */
export async function extractDocx(buf: ArrayBuffer): Promise<Extraction> {
  const b = new Uint8Array(buf);
  const fail = (warning: string): Extraction => ({ kind: "docx", text: "", chars: 0, ok: false, warning });

  if (!(b[0] === 0x50 && b[1] === 0x4b)) return fail("Ce fichier n'est pas un .docx valide (signature ZIP absente).");

  for (let i = 0; i + 30 < b.length; i++) {
    // Signature d'en-tête local : PK\x03\x04
    if (!(b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x03 && b[i + 3] === 0x04)) continue;

    const method = u16(b, i + 8);
    const compSize = u32(b, i + 18);
    const nameLen = u16(b, i + 26);
    const extraLen = u16(b, i + 28);
    const nameStart = i + 30;
    const name = latin1(b.subarray(nameStart, nameStart + nameLen));
    if (name !== "word/document.xml") continue;

    const dataStart = nameStart + nameLen + extraLen;
    const data = b.subarray(dataStart, dataStart + (compSize || b.length - dataStart));
    const xmlBytes = method === 0 ? data : await inflate(data, "deflate-raw");
    if (!xmlBytes) return fail("Impossible de décompresser le document — fichier corrompu ou format inattendu.");

    const xml = new TextDecoder("utf-8").decode(xmlBytes);
    const text = xml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .trim();

    return {
      kind: "docx",
      text: decodeEntities(text),
      chars: text.length,
      ok: text.length > 0,
      warning: text.length === 0 ? "Document vide ou sans texte lisible." : undefined,
    };
  }
  // Le streaming ZIP met parfois la taille en descripteur : on le dit au lieu
  // de rendre silencieusement du vide.
  return fail("« word/document.xml » introuvable. Réenregistre le fichier depuis Word ou LibreOffice.");
}

// ── Point d'entrée unique ──────────────────────────────────────────────

/**
 * Extrait le texte de N'IMPORTE lequel des formats gérés.
 * C'est le point d'entrée que toute l'app doit utiliser — un seul endroit
 * où corriger le jour où un format change.
 */
export async function extractFile(name: string, buf: ArrayBuffer, mime?: string): Promise<Extraction> {
  const kind = kindFromName(name, mime);
  switch (kind) {
    case "pdf":
      return extractPdf(buf);
    case "docx":
      return extractDocx(buf);
    case "html": {
      return extractHtml(new TextDecoder("utf-8").decode(buf));
    }
    case "markdown":
    case "texte": {
      const text = new TextDecoder("utf-8").decode(buf).trim();
      return { kind, text, chars: text.length, ok: text.length > 0 };
    }
    default:
      return {
        kind: "inconnu",
        text: "",
        chars: 0,
        ok: false,
        warning: `Format non géré : « ${name} ». Formats acceptés : PDF, DOCX, HTML, Markdown, TXT, CSV.`,
      };
  }
}

/** Titre proposé pour la note du Cerveau, tiré du contenu ou du nom de fichier. */
export function suggestTitle(name: string, text: string): string {
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 8 && l.length <= 120);
  return firstLine ?? name.replace(/\.[^.]+$/, "");
}
