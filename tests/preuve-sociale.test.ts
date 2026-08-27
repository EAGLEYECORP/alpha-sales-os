import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { seedMeetings, seedProspects } from "../lib/seed";
import { buildTemplates } from "../lib/templates";

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
  "lib/proof.ts",
  /**
   * ⚠ AJOUTÉ APRÈS COUP, ET C'EST LE PLUS INSTRUCTIF DES ONZE.
   *
   * Les contenus de séquence du seed sont des CONSIGNES, lues par l'opérateur
   * au moment d'écrire son message. L'une d'elles disait, mot pour mot :
   * « une preuve fraîche même secteur (on vient d'équiper X, +N clients/mois) ».
   *
   * Ce n'est pas une phrase envoyée : c'est une instruction à en fabriquer
   * une. Le fichier n'était pas dans la liste parce qu'il « ne rédige pas » —
   * or il dicte. Troisième endroit du dépôt où cette tentation était écrite.
   */
  "lib/seed.ts",
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
 *
 * ⚠⚠ IL EST VOLONTAIREMENT UN PEU LARGE, ET ÇA A UN COÛT ASSUMÉ. En corrigeant
 * `lib/proof.ts`, la phrase de remplacement que j'avais écrite — « la machine,
 * celle QU'ON INSTALLE » — a déclenché ce test. Elle ne revendiquait aucun
 * client ; c'est bien un faux positif.
 *
 * On a quand même reformulé plutôt que d'assouplir le motif. Resserrer
 * demanderait de deviner si le mot qui précède désigne des clients — une
 * heuristique qui se trompe ici laisserait passer « les garages qu'on équipe ».
 * Un test strict qui impose parfois de tourner une phrase autrement coûte
 * moins cher qu'une preuve inventée envoyée à un prospect.
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

test("⚠ les RDV de démonstration tombent dans la fenêtre d'appel", () => {
  /**
   * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
   *
   * `daysAhead` conserve l'heure COURANTE. Les cinq rendez-vous de démo en
   * héritaient : une démo ouverte à 23 h affichait « Closing — Le Bouchon des
   * Canuts (23:23) » sur `/aujourdhui`, juste sous le bandeau « Hors fenêtre
   * d'appel — après 18h, on ne joint pas un dirigeant de TPE ».
   *
   * Le produit se contredisait dans le même écran, et le premier bouton de
   * l'app est « Explorer la démo ». Une incohérence visible à la première
   * seconde coûte plus cher qu'un bug qu'on ne rencontre jamais.
   */
  const heures = seedMeetings.map((m) => new Date(m.date).getHours());
  const hors = heures.filter((h) => h < 9 || h >= 18);
  assert.deepEqual(hors, [], `des RDV de démo hors fenêtre professionnelle : ${hors.join("h, ")}h`);

  // Et ils ne tombent pas tous à la même heure : un jeu de démonstration
  // où tout est calé à 10h30 ne ressemble pas à une semaine de travail.
  assert.ok(new Set(heures).size >= 3, "les créneaux de démo doivent être variés");
});

test("le modèle J+60 se lit correctement SANS référence réelle", () => {
  /**
   * ⚠ La phrase supposait que `{proof}` soit un chiffre : « des nouvelles
   * fraîches : {proof} […] à chaque fois que je vois ces chiffres ». Or à
   * zéro vente, `{proof}` vaut le MÉCANISME — la substitution était sûre, la
   * prose autour ne l'était pas.
   */
  const t = buildTemplates({ agency: "EAGLEYE CORP" }).find((x) => x.title.includes("J+60"));
  assert.ok(t, "le modèle J+60 doit exister");
  assert.doesNotMatch(t!.body, /ces chiffres/i, "on ne renvoie pas à des chiffres qu'on n'a pas donnés");
  assert.doesNotMatch(t!.body, /nouvelles fraîches/i, "un mécanisme n'est pas une nouvelle");
  assert.match(t!.body, /\{proof\}|concrètement/, "la substitution doit rester en place");
});

test("⚠ l'argent de DÉMONSTRATION est nommé sur les écrans d'argent", () => {
  /**
   * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT.
   *
   * Avec le jeu de démo chargé — l'état par défaut, et le premier bouton de
   * l'app est « Explorer la démo » — `/payouts` affiche « Ta part cumulée
   * 1 390 € · Ventes 2 » et `/trajectoire` « 1 390 € encaissés ». Rien ne
   * disait que ces euros sont fictifs, et ce sont exactement les écrans qu'on
   * ouvre pour PROUVER que l'OS fonctionne.
   *
   * Même ligne rouge que « nos clients » dans le script hors-ligne, en pire :
   * un chiffre se croit plus vite qu'une phrase.
   *
   * Le mécanisme (`isDemoProspect`) existait et n'était branché que sur la
   * boîte d'envoi et le push Notion — encore une garde câblée à un seul
   * endroit.
   */
  const seedPaye = seedProspects.filter((p) => (p.payments ?? []).some((x) => x.status === "paye"));
  assert.ok(seedPaye.length > 0, "le jeu de démo doit encore contenir des paiements — sinon ce test ne garde rien");

  for (const f of ["app/(app)/payouts/page.tsx", "app/(app)/trajectoire/page.tsx"]) {
    const src = readFileSync(join(RACINE, f), "utf8");
    assert.match(src, /<ArgentDeDemo prospects=\{prospects\} \/>/, `${f} doit nommer l'argent de démo`);
  }

  // Le bandeau se retire TOUT SEUL : un avertissement qu'il faut penser à
  // enlever est un avertissement qu'on oublie, puis qu'on montre.
  const bandeau = readFileSync(join(RACINE, "components/argent-de-demo.tsx"), "utf8");
  assert.match(bandeau, /if \(demoAvecArgent\.length === 0\) return null;/, "il doit disparaître sans intervention");
  assert.match(bandeau, /status === "paye"/, "et ne se déclencher que sur de l'argent réellement compté");
});
