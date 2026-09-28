/**
 * ─────────────────────────────────────────────────────────────────────
 * Normalisation du texte parlé.
 *
 * La reconnaissance vocale rend du texte sale : pas de ponctuation
 * fiable, des accents parfois absents, « euh » partout, et une casse
 * arbitraire. Tout ce qui compare de la parole à un catalogue doit
 * passer par ici — sinon « J'ai déjà une assistante » et « jai deja une
 * assistante » sont deux choses différentes, ce qui est absurde.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9€%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots vides — ils font du bruit dans toute comparaison. */
const STOP = new Set(
  ("le la les un une des du de d a au aux et ou ou mais donc or ni car que qui quoi dont ou " +
    "je tu il elle on nous vous ils elles me te se lui leur y en " +
    "ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs " +
    "est sont etait etaient ete suis es sommes etes ai as avons avez ont avait avais " +
    "pas ne plus tres bien tout tous toute toutes meme aussi alors comme si " +
    "pour par avec sans sur sous dans chez vers entre depuis " +
    "euh hein bah ben voila donc du coup enfin " +
    "la ca cela ceci il y a")
    .split(/\s+/)
    .filter(Boolean)
);

/** Tokens significatifs — mots vides et mots d'une lettre écartés. */
export function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Recouvrement de tokens, entre 0 et 1 : part des tokens de la
 * référence retrouvés dans ce qui a été entendu. On mesure dans ce sens
 * volontairement — une phrase entendue longue ne doit pas être pénalisée
 * parce qu'elle contient autre chose que l'objection.
 */
export function overlap(heard: string, reference: string): number {
  const ref = tokens(reference);
  if (ref.length === 0) return 0;
  const seen = new Set(tokens(heard));
  let hit = 0;
  for (const t of ref) if (seen.has(t)) hit++;
  return hit / ref.length;
}
