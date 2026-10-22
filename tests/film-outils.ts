import assert from "node:assert/strict";
import { AGENTS_ALPHA } from "../lib/agents-alpha";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES OUTILS DES TESTS DE FILM — une seule définition pour tous les films.
 *
 * Extraits de `tests/film-cycle.test.ts` le 22/10/2026, quand le second film
 * (« Tu vends quoi ? ») en a eu besoin. Deux copies du plancher de lecture ou
 * de la liste d'interdits auraient divergé, et c'est celle qu'on ne relit pas
 * qui aurait cessé de mordre.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le texte que voit le spectateur : ni les commentaires HTML, ni le script, ni le style. */
export const visibleDe = (html: string): string =>
  html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

/** Aucun nom d'agent écrit autrement qu'en capitales — dans n'importe quel texte public. */
export function verifierNomsEnCapitales(texte: string): void {
  for (const a of AGENTS_ALPHA) {
    const [prefixe, ...reste] = a.nom.split(" ");
    const faux = new RegExp(`\\b(?:${prefixe}|${prefixe[0]}${prefixe.slice(1).toLowerCase()})\\s+${reste.join("\\s+")}\\b`, "gi");
    for (const m of texte.matchAll(faux)) {
      assert.equal(m[0], a.nom, `« ${m[0]} » : le nom s'écrit ${a.nom}, toujours en capitales (lib/agents-alpha.ts)`);
    }
  }
  assert.doesNotMatch(texte, /\bVotre IA\b/, "« Votre IA » est l'ancien libellé : c'est ALPHA ASSIST");
}

/** Ce qu'un texte public d'Alpha n'a pas le droit de dire — chaque film ET son post passent par la même liste. */
export const INTERDITS: [RegExp, string][] = [
  [/€|\d\s?%|×|\bx\s?\d|\bfois plus\b/i, "un prix ou un chiffre de performance se recopie hors contexte"],
  [/\b(?:meilleur|n°\s?1|num[ée]ro\s?1|leader|r[ée]volution|incontournable|garanti)/i, "superlatif : une conviction, pas une preuve"],
  [/\b(?:t[ée]moignage|nos clients|ils nous font confiance|lauréat|certifié)\b/i, "zéro vente = zéro preuve sociale"],
  [/\btravaill(?:e|ons) avec (?:les|des|aux?)\b/i, "« je m'adresse aux… », jamais « je travaille avec… » (zéro client)"],
  [
    /\b(?:chaque|toutes?|tous) (?:les? )?\w+ (?:est|sont) (?:consign|trac|enregistr|journalis)/i,
    "universel invérifiable : le journal montre les 12 derniers événements du CRM, pas « chaque action » (trouvé le 21/10, avant publication)",
  ],
  [
    /\b(?:sur|dans) (?:chaque|tous les|toutes les) (?:[ée]crans?|pages?)\b/i,
    "« sur chaque écran » : /login, /overlay et la vitrine n'ont pas la bande — « dans l'application » est vrai sans exception",
  ],
  [/\bvous ratez\b/i, "interdit à froid sur la maîtrise d'ouvrage"],
  [/\ble (?:\w+ )?(?:de la|du|des) (?:vente|prospection)\b/i, "« le X de la vente » signale un dérivé (lib/promesse.ts)"],
];

export interface Pas {
  cible: string;
  t: number;
  duree: number;
  stagger: number;
  deOpacite?: number;
  versOpacite?: number;
}

/** Joue le script de la composition avec un GSAP simulé : il enregistre, il n'anime rien. */
export function tweens(html: string): Pas[] {
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  assert.ok(script, "le script de la composition est introuvable");
  const pas: Pas[] = [];
  const cible = (c: unknown): string => String(Array.isArray(c) ? c[0] : c).replace(/ \.mot$/, "");
  const tl = {
    fromTo(c: unknown, de: Record<string, number>, vers: Record<string, number>, t: number) {
      pas.push({ cible: cible(c), t, duree: vers.duration ?? 0, stagger: vers.stagger ?? 0, deOpacite: de.opacity, versOpacite: vers.opacity });
      return tl;
    },
    to(c: unknown, vers: Record<string, number>, t: number) {
      pas.push({ cible: cible(c), t, duree: vers.duration ?? 0, stagger: vers.stagger ?? 0, versOpacite: vers.opacity });
      return tl;
    },
    // Un changement INSTANTANÉ (une image de frappe qui remplace la précédente).
    set(c: unknown, vers: Record<string, number>, t: number) {
      pas.push({ cible: cible(c), t, duree: 0, stagger: 0, versOpacite: vers.opacity });
      return tl;
    },
  };
  const gsap = { timeline: () => tl, utils: { toArray: (s: string) => [s] } };
  const document = { fonts: { ready: { then: () => undefined } } };
  const window = { __timelines: {} as Record<string, unknown> };
  new Function("gsap", "document", "window", script)(gsap, document, window);
  return pas;
}

/** L'élément `#id` en entier (balises imbriquées comprises), ou `null`. */
export function bloc(html: string, id: string): string | null {
  const debut = html.search(new RegExp(`<(\\w+)\\b[^>]*\\bid="${id}"`));
  if (debut < 0) return null;
  const balise = /^<(\w+)/.exec(html.slice(debut))![1];
  if (balise === "img") return html.slice(debut, html.indexOf(">", debut) + 1);
  const re = new RegExp(`<(/?)${balise}\\b[^>]*>`, "g");
  re.lastIndex = debut;
  let profondeur = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    profondeur += m[1] ? -1 : 1;
    if (profondeur === 0) return html.slice(debut, m.index + m[0].length);
  }
  return null;
}

export const mots = (fragment: string): number =>
  fragment.replace(/<[^>]+>/g, " ").split(/\s+/).filter((m) => m && !/^\d+$/.test(m)).length;

/** Combien de temps un texte doit rester posé : 0,3 s/mot, plancher 1,2 s (0,8 s sous 3 mots). */
export const plancher = (n: number): number => (n <= 2 ? 0.8 : Math.max(1.2, 0.3 * n));

/**
 * Les textes retirés trop tôt, mesurés sur la timeline JOUÉE : pour chaque
 * texte, le temps où il est entré ET pas encore sorti (lui, ou l'écran qui le
 * contient). Rend aussi le nombre de textes mesurés — un test qui ne mesure
 * plus rien passerait vert.
 */
export function textesRetiresTropTot(html: string, duree: number): { fautifs: string[]; mesures: number } {
  const pas = tweens(html);
  const sorties = pas.filter((p) => p.versOpacite === 0 && p.deOpacite === undefined);
  const fautifs: string[] = [];
  let mesures = 0;
  for (const entree of pas.filter((p) => p.deOpacite === 0 && p.versOpacite === 1)) {
    const fragment = bloc(html, entree.cible.replace(/^#/, ""));
    if (!fragment) continue;
    const n = mots(fragment);
    if (n === 0) continue; // une image, une onde, un fil, un éclair : rien à lire
    mesures += 1;
    const nbMots = (fragment.match(/class="mot[ "]/g) ?? []).length;
    const pose = entree.t + entree.duree + entree.stagger * Math.max(0, nbMots - 1);
    const sortie =
      sorties
        .filter((s) => s.t > entree.t && (s.cible === entree.cible || (bloc(html, s.cible.replace(/^#/, "")) ?? "").includes(`id="${entree.cible.slice(1)}"`)))
        .map((s) => s.t)
        .sort((a, b) => a - b)[0] ?? duree;
    const tenue = sortie - pose;
    if (tenue + 1e-9 < plancher(n)) {
      fautifs.push(`${entree.cible} : ${n} mots, posé ${tenue.toFixed(2)} s pour ${plancher(n).toFixed(2)} s requises`);
    }
  }
  return { fautifs, mesures };
}
