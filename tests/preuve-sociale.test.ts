import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ON NE CITE PAS DE CLIENTS QU'ON N'A PAS.
 *
 * CLAUDE.md le pose sans ambiguïté :
 *
 *   « Ce qui reste bloqué tant qu'il n'y a pas de client : témoignages,
 *     logos, endossements. Zéro vente = zéro preuve sociale disponible ;
 *     l'appliquer quand même fabrique de la preuve inventée. »
 *
 * ⚠ CE QUI SE DISAIT QUAND MÊME. `lib/hormozi.ts` — le script hors-ligne,
 * celui qui tourne AUJOURD'HUI puisqu'aucune clé IA n'est configurée —
 * affirmait cinq fois des clients existants :
 *
 *   « les restos lyonnais QU'ON ÉQUIPE prennent leurs réservations la nuit »
 *   « NOS pubs clients remplissent leurs mardis soir »
 *   « NOS clients ambulanciers ne ratent plus une demande de nuit »
 *
 * Et ces phrases sortaient au bloc « Les 3 Croyances », sous l'intitulé
 * « Le produit fonctionne » — donc lues à voix haute devant un prospect. Un
 * seul « lequel ? » et l'entretien est fini.
 *
 * ⚠⚠ LE PLUS INSTRUCTIF : C'ÉTAIT DÉJÀ RÉSOLU À UN FICHIER DE DISTANCE.
 * `buildTemplates` (lib/templates.ts) porte le commentaire « Une référence
 * réelle si elle existe, sinon le mécanisme — jamais un client inventé », et
 * le code qui va avec. La discipline existait ; elle n'avait pas traversé.
 * C'est le motif de tout ce dépôt, appliqué cette fois à une règle
 * commerciale plutôt qu'à une garde technique.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();

/**
 * Les modules qui produisent du texte LU PAR UN PROSPECT — de vive voix ou
 * dans un message. La liste est explicite : c'est ce périmètre-là qui compte,
 * et l'élargir à tout `lib/` noierait le signal sous les commentaires
 * d'analyse et les libellés d'écran interne.
 */
const REDACTEURS = [
  "lib/hormozi.ts",
  "lib/templates.ts",
  "lib/mail-compose.ts",
  "lib/linkedin-sequence.ts",
  "lib/approche-ecrite.ts",
  "lib/argumentaire.ts",
  "lib/voice-script.ts",
  "lib/offer-match.ts",
  "lib/lead-magnet.ts",
  "lib/ladder.ts",
];

const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Les tournures qui AFFIRMENT une clientèle.
 *
 * ⚠ « vos clients » et « ses clients » sont légitimes — ce sont les SIENS, et
 * c'est tout le sujet de la conversation. Seul le possessif à la première
 * personne fabrique de la preuve. Le motif est donc ancré sur « nos / on »,
 * pas sur le mot « client ».
 */
const CLIENTELE_AFFIRMEE = [
  /\bnos (?:clients?|artisans?|restos?|pubs?|garages?|partenaires?)\b/i,
  /\bqu'on (?:équipe|accompagne|installe)\b/i,
  /\bnous (?:équipons|accompagnons)\b/i,
  /\bdéjà \d+ (?:clients?|entreprises?)\b/i,
  /\bils sont \d+ à nous\b/i,
];

test("⚠ aucun texte destiné au prospect n'affirme une clientèle", () => {
  const fautes: string[] = [];

  for (const f of REDACTEURS) {
    let src: string;
    try {
      src = readFileSync(join(RACINE, f), "utf8");
    } catch {
      // Le module a été renommé : ce n'est pas au test de deviner, mais il
      // ne doit pas passer en silence.
      fautes.push(`${f} — introuvable, la liste des rédacteurs est périmée`);
      continue;
    }
    const code = sansCommentaires(src);
    for (const motif of CLIENTELE_AFFIRMEE) {
      const m = code.match(motif);
      if (m) fautes.push(`${relative(RACINE, f)} → « ${m[0]} »`);
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "zéro vente à ce jour : ces phrases fabriquent de la preuve sociale, et un « lequel ? » y met fin :\n  " +
      fautes.join("\n  ")
  );
});

test("le script hors-ligne dit ce que le produit FAIT, pas qui l'utilise", () => {
  /**
   * C'est le repli qui tourne aujourd'hui : `/api/health` rend
   * `ai: { configured: false }`. Ce n'est donc pas un chemin de secours
   * théorique — c'est le chemin normal tant qu'aucune clé n'est posée.
   */
  const src = sansCommentaires(readFileSync(join(RACINE, "lib/hormozi.ts"), "utf8"));
  assert.doesNotMatch(src, /proof:/, "le champ qui affirmait une clientèle ne doit plus exister");
  assert.match(src, /mecanisme:/, "il est remplacé par ce que le produit fait");
  // Et la porte pour une VRAIE référence, le jour où il y en aura une.
  assert.match(src, /preuveReelle/, "une référence réelle doit pouvoir être fournie");
  assert.match(src, /preuveReelle\?\.trim\(\) \|\| hook\.mecanisme/, "réelle si elle existe, mécanisme sinon");
});

test("la même discipline existe déjà dans les modèles — elle sert de référence", () => {
  /**
   * `buildTemplates` faisait ça correctement depuis le début. Ce test le
   * verrouille : si quelqu'un l'affaiblit là-bas, on perd l'exemple ET la
   * règle. C'est le seul endroit du dépôt où elle était écrite en code.
   */
  const src = readFileSync(join(RACINE, "lib/templates.ts"), "utf8");
  assert.match(src, /realProof \|\| angle\.mechanism/, "référence réelle sinon mécanisme");
  // La phrase est écrite sur deux lignes de commentaire : on retire les
  // marqueurs et on aplatit les blancs avant de la chercher, sinon le test
  // dépend de l'endroit où le retour à la ligne tombe.
  const prose = src.replace(/^\s*\/\/\s?/gm, " ").replace(/\s+/g, " ");
  assert.match(prose, /jamais un client inventé/i, "et la raison doit rester écrite");
});
