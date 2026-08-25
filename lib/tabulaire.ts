/**
 * ─────────────────────────────────────────────────────────────────────
 * LECTURE DE TABLEAUX COLLÉS — le format arrive tel qu'il arrive.
 *
 * ── POURQUOI CE MODULE EXISTE ──
 *
 * `linkedin-import.ts` savait déjà lire du CSV, du TSV, du JSON et du JSONL
 * avec des alias de colonnes tolérants. Le sourcing terrain a exactement le
 * même besoin, sur d'autres colonnes : un export d'annuaire, un copier-coller
 * de tableur, une sortie d'outil.
 *
 * Recopier ce lecteur aurait produit deux comportements qui divergent au
 * premier bug corrigé d'un seul côté — et les guillemets, les séparateurs et
 * le JSONL sont précisément les endroits où on se trompe. Il n'y en a donc
 * qu'un, paramétré par sa table d'alias.
 *
 * ── CE QU'IL NE FAIT PAS ──
 *
 * Il ne devine jamais. Une colonne non reconnue est SIGNALÉE, pas rattachée
 * au champ qui lui ressemble le plus : deviner ce qu'un intégrateur voulait
 * dire, c'est remplir un téléphone avec un numéro de SIRET.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Normalisation d'un nom de colonne : minuscule, sans accents, sans ponctuation. */
export const normCle = (s: string) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export interface Rejet {
  /** Index dans la source (1 = première ligne de données). */
  ligne: number;
  raison: string;
  /** Ce qui a été lu, tronqué — pour retrouver la ligne dans le fichier. */
  extrait: string;
}

export interface Lecture<T> {
  entrees: T[];
  rejets: Rejet[];
  /** Ce que l'intégrateur doit apprendre dès la première tentative. */
  avertissements: string[];
  /** Le format détecté, dit à l'écran : deviner en silence trompe. */
  format: "json" | "csv" | "aucun";
}

/** Découpe une ligne en respectant les guillemets (et les guillemets doublés). */
export function decouper(ligne: string, sep: string): string[] {
  const out: string[] = [];
  let courant = "";
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else dansGuillemets = !dansGuillemets;
    } else if (c === sep && !dansGuillemets) {
      out.push(courant);
      courant = "";
    } else courant += c;
  }
  out.push(courant);
  return out.map((c) => c.trim());
}

/**
 * Le séparateur se DÉDUIT de l'en-tête.
 *
 * Un copier-coller de tableur arrive en tabulations, un export français en
 * points-virgules, un export anglo-saxon en virgules. Imposer un séparateur
 * ferait échouer deux cas sur trois sans dire pourquoi.
 */
export function separateur(entete: string): string {
  const compte = (c: string) => (entete.split(c).length - 1);
  return ([["\t", compte("\t")], [";", compte(";")], [",", compte(",")]] as [string, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
}

/** Un objet quelconque → l'objet cible, via la table d'alias. */
function depuisEnregistrement<T extends object>(
  rec: Record<string, unknown>,
  alias: Record<string, keyof T>
): { entree: Partial<T>; inconnus: string[] } {
  const entree: Partial<T> = {};
  const inconnus: string[] = [];
  for (const [cle, valeur] of Object.entries(rec)) {
    const champ = alias[normCle(cle)];
    if (!champ) {
      if (String(valeur ?? "").trim()) inconnus.push(cle);
      continue;
    }
    const v = String(valeur ?? "").trim();
    if (v) (entree as Record<string, unknown>)[champ as string] = v;
  }
  return { entree, inconnus };
}

/**
 * Lit du texte collé — JSON, JSONL, CSV ou TSV — vers des objets typés.
 *
 * `alias` fait la loi : c'est la seule chose qui change d'un usage à l'autre.
 */
export function lireTableau<T extends object>(
  texte: string,
  alias: Record<string, keyof T>
): Lecture<Partial<T>> {
  const brut = (texte ?? "").trim();
  if (!brut) return { entrees: [], rejets: [], avertissements: [], format: "aucun" };
  return brut.startsWith("[") || brut.startsWith("{")
    ? lireJson(brut, alias)
    : lireCsv(brut, alias);
}

/** La liste des noms de colonnes acceptés, pour les messages d'erreur. */
export const champsReconnus = <T extends object>(alias: Record<string, keyof T>): string =>
  [...new Set(Object.values(alias))].join(", ");

function lireJson<T extends object>(brut: string, alias: Record<string, keyof T>): Lecture<Partial<T>> {
  const rejets: Rejet[] = [];
  const avertissements: string[] = [];
  let lignes: unknown[];

  try {
    const parsed = JSON.parse(brut) as unknown;
    lignes = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // JSONL : une ligne = un objet. C'est ce que crache la plupart des outils
    // en flux, et un JSON.parse global échoue dessus.
    lignes = [];
    brut.split("\n").forEach((l, i) => {
      const t = l.trim();
      if (!t) return;
      try {
        lignes.push(JSON.parse(t));
      } catch {
        rejets.push({ ligne: i + 1, raison: "ni JSON ni JSONL valide", extrait: t.slice(0, 60) });
      }
    });
  }

  const entrees: Partial<T>[] = [];
  const inconnusVus = new Set<string>();

  lignes.forEach((l, i) => {
    if (!l || typeof l !== "object" || Array.isArray(l)) {
      rejets.push({ ligne: i + 1, raison: "entrée qui n'est pas un objet", extrait: JSON.stringify(l).slice(0, 60) });
      return;
    }
    const { entree, inconnus } = depuisEnregistrement<T>(l as Record<string, unknown>, alias);
    inconnus.forEach((c) => inconnusVus.add(c));
    if (!Object.keys(entree).length) {
      rejets.push({ ligne: i + 1, raison: "aucun champ reconnu", extrait: JSON.stringify(l).slice(0, 60) });
      return;
    }
    entrees.push(entree);
  });

  if (inconnusVus.size) {
    avertissements.push(
      `Champs ignorés : ${[...inconnusVus].slice(0, 8).join(", ")}. Les noms reconnus sont : ${champsReconnus(alias)}.`
    );
  }
  return { entrees, rejets, avertissements, format: "json" };
}

function lireCsv<T extends object>(brut: string, alias: Record<string, keyof T>): Lecture<Partial<T>> {
  const lignes = brut.split(/\r?\n/).filter((l) => l.trim());
  const rejets: Rejet[] = [];
  const avertissements: string[] = [];

  const entete = lignes[0] ?? "";
  const sep = separateur(entete);
  const cellulesEntete = decouper(entete, sep);
  const colonnes = cellulesEntete.map((c) => alias[normCle(c)] ?? null);

  if (colonnes.filter(Boolean).length === 0) {
    return {
      entrees: [],
      rejets: [{ ligne: 1, raison: "aucune colonne reconnue dans l'en-tête", extrait: entete.slice(0, 80) }],
      avertissements: [`Première ligne attendue : un en-tête. Noms reconnus : ${champsReconnus(alias)}.`],
      format: "csv",
    };
  }

  const inconnues = cellulesEntete.filter((c) => c && !alias[normCle(c)]);
  if (inconnues.length) avertissements.push(`Colonnes ignorées : ${inconnues.slice(0, 8).join(", ")}.`);

  const entrees: Partial<T>[] = [];
  lignes.slice(1).forEach((ligne, i) => {
    const cellules = decouper(ligne, sep);
    const entree: Partial<T> = {};
    colonnes.forEach((champ, j) => {
      const v = (cellules[j] ?? "").trim();
      if (champ && v) (entree as Record<string, unknown>)[champ as string] = v;
    });
    if (!Object.keys(entree).length) {
      rejets.push({ ligne: i + 1, raison: "ligne vide après lecture des colonnes", extrait: ligne.slice(0, 60) });
      return;
    }
    entrees.push(entree);
  });

  return { entrees, rejets, avertissements, format: "csv" };
}
