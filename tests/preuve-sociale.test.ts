import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { seedMeetings, seedProspects, seedCampaigns, isDemoCampaign, isDemoProspect, EMAILS_DE_DEMO, estAdresseDeDemo } from "../lib/seed";
import { demoDepuisProfil } from "../lib/demo-icp";
import { buildTemplates } from "../lib/templates";
import { useAlpha } from "../lib/store";

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

/** Idem pour du JSX : `{/* … *\/}` est un commentaire, pas du texte affiché. */
const sansCommentairesTsx = (src: string) =>
  sansCommentaires(src).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** Tous les .ts/.tsx sous les dossiers donnés — le garde DÉDUIT son périmètre. */
function fichiersSources(dirs: string[]): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) visite(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

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
 *
 * ⚠⚠⚠ DEUX TOURNURES ONT MARCHÉ SUR CE GARDE, DANS UN FICHIER DÉJÀ SURVEILLÉ.
 *
 * `lib/seed.ts` était dans REDACTEURS depuis la correction précédente. Les
 * campagnes de démonstration contenaient pourtant, en clair :
 *
 *   · « On équipe des ambulanciers du Rhône avec un standard IA » — corps
 *     d'email envoyé au prospect ;
 *   · « Mentionner les confrères équipés. » — consigne d'appel.
 *
 * Aucune ne matchait. Le motif était ancré sur le POSSESSIF (« nos », « qu'on
 * équipe ») ; ces deux-là affirment la même clientèle sans possessif : un
 * « on » nu, et une troisième personne (« les confrères équipés »).
 *
 * La leçon n'est pas « ajouter deux regex ». C'est que le fichier était dans
 * le périmètre, le garde tournait, et la fabrication est passée quand même
 * parce qu'elle était formulée autrement. Un garde par motif attrape ce qu'on
 * a déjà vu ; il faut le rouvrir chaque fois qu'on trouve une formulation
 * neuve, et c'est la lecture de l'écran qui les trouve, pas le test.
 */
const CLIENTELE_AFFIRMEE = [
  /\bnos (?:clients?|artisans?|restos?|pubs?|garages?|partenaires?)\b/i,
  /\bqu'on (?:équipe|accompagne|installe)\b/i,
  /\bnous (?:équipons|accompagnons)\b/i,
  /\bdéjà \d+ (?:clients?|entreprises?)\b/i,
  /\bils sont \d+ à nous\b/i,
  /**
   * Le « on » nu : « On équipe des ambulanciers du Rhône avec… ».
   *
   * ⚠ L'OBJET EST OBLIGATOIRE DANS LE MOTIF, et c'est lui qui sépare les deux
   * sens. Écrit d'abord en `\bon (équipe|installe|…)\b`, il a mordu en
   * élargissant le périmètre, sur une phrase parfaitement honnête de la
   * garantie Alpha Voice : « **On installe**, l'agent tourne, et vous ne payez
   * l'installation que le jour où il vous a pris un premier rendez-vous ».
   *
   * Là, « on installe » décrit le SERVICE, au futur conditionnel d'une offre.
   * Ce qu'on refuse, c'est « on équipe DES ambulanciers » — un objet au
   * pluriel qui affirme une clientèle existante. Sans objet, il n'y a aucune
   * revendication.
   *
   * ⚠⚠ Et on ne reformule PAS la garantie pour contenter une regex : son
   * libellé est une décision du 02/09/2026, lue à voix haute en rendez-vous.
   * Tordre une phrase vraie pour éviter un faux positif, c'est apprendre à
   * contourner ses propres gardes — après quoi on les assouplit au mauvais
   * endroit.
   */
  /\bon (?:équipe|accompagne|installe|a équipé|a installé)\s+(?:des?|les|nos|plusieurs|\d+)\s+\p{L}/iu,
  // La clientèle affirmée à la troisième personne : « les confrères équipés »,
  // « des voisins déjà équipés ». C'est la même promesse, sans le possessif.
  /\b(?:confrères?|voisins?|concurrents?|collègues?) (?:déjà )?(?:équipés?|clients?)\b/i,
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ LA QUATRIÈME FAMILLE : LA CONVERSION ATTRIBUÉE À UN NOM.
 *
 * `CLAUDE.md` la désignait déjà comme « la forme la plus convaincante des
 * trois, et la seule qu'aucun garde ne tenait » — pour les références nommées.
 * Elle est restée non branchée, et voici ce qu'elle a laissé passer :
 *
 *   « et c'est ce qui a converti la <enseigne réelle> »
 *
 * recopiée dans CINQ fichiers, dont `lib/os-map.ts` et `lib/voice-script.ts`
 * qui alimentent les prompts. Deux fautes en huit mots :
 *  · elle nommait une entreprise réelle dans un dépôt public ;
 *  · elle était FAUSSE — la fiche est au stade `offre`, `JUILLET_REEL.gagnes`
 *    vaut 0. Rien n'a jamais été signé.
 *
 * Pourquoi les trois motifs existants ne la voyaient pas : ils cherchent un
 * POSSESSIF (« nos clients »), un « on » nu (« on équipe »), ou une troisième
 * personne collective (« les confrères équipés »). Une conversion attribuée à
 * un nom propre n'en porte AUCUN. C'est la même leçon, pour la quatrième fois :
 * un garde par motif n'attrape que ce qu'on a déjà vu.
 *
 * ⚠ CALIBRAGE. Le motif exige un NOM PROPRE derrière le verbe. « Le taux de
 * conversion », « convertir un prospect », « ce qui convertit le mieux » sont
 * du vocabulaire de vente parfaitement légitime, écrit partout dans le
 * produit : les refuser ferait de ce garde un garde qu'on désarme. C'est ce
 * qui distingue une méthode d'une référence — et seule la référence ment.
 * ─────────────────────────────────────────────────────────────────────
 */
const CONVERSION_ATTRIBUEE = [
  // « a converti la Carrosserie X », « ont converti Untel »
  /\b(?:a|ont|avait|ont pu) converti\s+(?:la |le |les |l'|chez )?[A-ZÉÈÀ]/,
  // « notre premier client », « nos premiers clients »
  /\bnos? premi(?:er|ers|ère|ères) clients?\b/i,
  /**
   * « client depuis 2025 », « clients depuis six mois ».
   *
   * ⚠ LA DATE EST OBLIGATOIRE DANS LE MOTIF, ET CE N'EST PAS DU ZÈLE. Écrit
   * d'abord en `\bclients? depuis\b`, il a mordu au premier passage sur une
   * phrase parfaitement honnête du README : « consentement du **client depuis**
   * SON compte » — où « depuis » est un lieu, pas une durée.
   *
   * On resserre plutôt que de reformuler la phrase juste : c'est la règle que
   * ce dépôt s'est donnée le jour où un motif d'affiliation a mordu sur le
   * verbe « supprime ». Un garde qui refuse une phrase vraie est un garde
   * qu'on assouplira au mauvais endroit la fois suivante.
   */
  /\bclients? depuis (?:\d|le \d|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i,
  // « a signé avec nous », « ils ont signé chez nous »
  /\b(?:a|ont|avait) signé (?:avec|chez) nous\b/i,
  // « qui nous a fait confiance »
  /\bnous a fait confiance\b/i,
  // « X est équipé depuis », attribué à un nom propre
  /\b[A-ZÉÈÀ][\p{L}'-]{3,} est (?:équipé|client)\b/u,
];

/**
 * Le périmètre de CE garde-là est plus large que `REDACTEURS`, et c'est voulu.
 *
 * La phrase fautive vivait dans `lib/os-map.ts` (une chaîne markdown lue par
 * les prompts, donc pas un « rédacteur » au sens de la liste) ET dans trois
 * fichiers `.md` publics. Un garde qui n'aurait regardé que les rédacteurs en
 * aurait manqué quatre sur cinq.
 */
const PORTEURS_DE_REFERENCE = [
  ...REDACTEURS,
  "lib/os-map.ts",
  "lib/page-guides.ts",
  "lib/bricks.ts",
  "docs/VOIX.md",
  "docs/OFFRE-ALPHA-VOICE.md",
  "docs/public-readme.md",
  "voice/README.md",
  "README.md",
  /**
   * ⚠ LE SCRIPT DE PUBLICITÉ, ET IL A FAILLI ÊTRE OUBLIÉ ICI.
   *
   * Une pièce DIFFUSÉE est le pire endroit possible pour une preuve
   * fabriquée : contrairement à une page qu'on corrige en redéployant, une
   * vidéo part chez des gens et ne se rappelle pas. Elle est pourtant arrivée
   * dans `docs/` sans que rien ne la regarde — la suite est passée au vert
   * alors qu'aucun garde n'avait ouvert le fichier.
   *
   * C'est la panne signature du dépôt vue de l'autre côté : ce n'est pas le
   * garde qui manquait, c'est le fichier qui manquait au garde.
   */
  "docs/PUB-MOTION-MOA.md",
  // ⚠ Et le fichier RÉELLEMENT rendu, pas seulement le script relu : c'est
  // celui-ci qui part chez des gens. Un doc conforme ne protège de rien si la
  // scène dessine autre chose.
  "scripts/pub/scene.html",
];

test("⚠ aucune conversion n'est attribuée à un nom — zéro affaire signée", () => {
  const fautes: string[] = [];

  for (const f of PORTEURS_DE_REFERENCE) {
    let src: string;
    try {
      src = readFileSync(join(RACINE, f), "utf8");
    } catch {
      fautes.push(`${f} — introuvable, la liste des porteurs de référence est périmée`);
      continue;
    }
    // Sur un `.md`, tout est du texte ; sur un `.ts`, le commentaire ne part
    // pas au prospect et a le droit d'expliquer ce qu'on refuse.
    const code = /\.tsx?$/.test(f) ? sansCommentaires(src) : src;
    for (const motif of CONVERSION_ATTRIBUEE) {
      const m = code.match(motif);
      if (m) fautes.push(`${f} → « ${m[0]} »`);
    }
  }

  assert.deepEqual(
    fautes,
    [],
    "zéro affaire signée à ce jour : attribuer une conversion à un nom est une référence inventée, " +
      "et une référence se vérifie auprès de l'intéressé sans nous prévenir :\n  " + fautes.join("\n  ")
  );
});

test("⚠ aucun texte destiné au prospect n'affirme une clientèle", () => {
  /**
   * ⚠⚠ CE TEST NE REGARDAIT QUE `REDACTEURS`, ET UNE MUTATION L'A DIT.
   *
   * En ajoutant le script de publicité à `PORTEURS_DE_REFERENCE`, j'ai cru la
   * pièce couverte. Elle l'était contre les conversions NOMMÉES, et pas du
   * tout contre la clientèle AFFIRMÉE : deux listes de fichiers, deux
   * couvertures, et la seconde ne regardait pas la pièce la plus diffusée.
   * J'ai collé « nos clients gagnent 3 RDV par semaine » dans le script : vert.
   *
   * Les deux familles balaient désormais le MÊME ensemble. `PORTEURS_DE_REFERENCE`
   * contient `REDACTEURS` : c'est un sur-ensemble strict, donc élargir ne perd
   * rien et supprime la question « laquelle des deux listes ? », qui est
   * exactement le genre de question dont la mauvaise réponse ne se voit pas.
   */
  const fautes: string[] = [];

  for (const f of PORTEURS_DE_REFERENCE) {
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
  const bandeau = readFileSync(join(RACINE, "components/donnees-de-demo.tsx"), "utf8");
  assert.match(bandeau, /if \(demoAvecArgent\.length === 0\) return null;/, "il doit disparaître sans intervention");
  assert.match(bandeau, /status === "paye"/, "et ne se déclencher que sur de l'argent réellement compté");
});

test("⚠ les TAUX de démonstration sont nommés sur l'écran des campagnes", () => {
  /**
   * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT.
   *
   * Sur `/campaigns`, deux panneaux se contredisaient à deux centimètres près :
   *
   *   « MESSAGES 0 · OUVERTURES 0 · TAUX D'OUVERTURE 0 % »   (le réel, honnête)
   *   « 42 ENVOYÉS · 67 % OUVERTS · 21 % RÉPONSES · 4 RDV »  (le seed, inventé)
   *
   * Un TAUX est plus dangereux qu'un total : il se retient, se cite en
   * rendez-vous, et sert à comparer deux campagnes. Celui-là n'a jamais été
   * mesuré — « zéro donnée → zéro chiffre » et « jamais un taux nu » sont
   * précisément la doctrine de la boucle.
   */
  const avecStats = seedCampaigns.filter((c) => c.stats.sent > 0);
  assert.ok(
    avecStats.length > 0,
    "le jeu de démo doit encore porter des compteurs — sinon ce test ne garde rien"
  );
  for (const c of avecStats) {
    assert.ok(isDemoCampaign(c.id), `${c.id} n'est pas reconnue comme campagne de démo`);
  }

  const src = readFileSync(join(RACINE, "app/(app)/campaigns/page.tsx"), "utf8");
  assert.match(
    src,
    /<ChiffresDeCampagneDemo campaigns=\{campaigns\} \/>/,
    "l'écran des campagnes doit nommer les compteurs de démonstration"
  );

  // Le bandeau se retire TOUT SEUL, comme celui de l'argent.
  const bandeau = readFileSync(join(RACINE, "components/donnees-de-demo.tsx"), "utf8");
  assert.match(bandeau, /if \(demo\.length === 0\) return null;/, "il doit disparaître sans intervention");
  assert.match(bandeau, /c\.stats\.sent > 0/, "et ne se déclencher que sur des compteurs réellement affichés");
});

test("la liste des campagnes de démo est DÉRIVÉE, jamais recopiée", () => {
  /**
   * Même règle que `DEMO_PROSPECT_IDS` : une seconde liste tenue à la main
   * diverge, et diverger veut dire ici qu'une campagne de démo affiche ses
   * 67 % sans bandeau.
   */
  const src = readFileSync(join(RACINE, "lib/seed.ts"), "utf8");
  assert.match(
    src,
    /DEMO_CAMPAIGN_IDS[^=]*= new Set\(seedCampaigns\.map\(\(c\) => c\.id\)\)/,
    "DEMO_CAMPAIGN_IDS doit être dérivée de seedCampaigns"
  );
  for (const c of seedCampaigns) assert.ok(isDemoCampaign(c.id), `${c.id} manque à la liste dérivée`);
  assert.equal(isDemoCampaign("c-une-vraie-campagne-de-l-operateur"), false);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * PAS DE « STANDARD DU MARCHÉ » DANS UN ÉCRAN MONTRÉ À UN PROSPECT.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT. Le calculateur de ROI de `/offre` — celui
 * qu'on ouvre EN RENDEZ-VOUS, dont la légende dit « la décision devient une
 * évidence chiffrée » — se terminait par :
 *
 *   « Chiffres calés sur les standards du marché ; devis personnalisé… »
 *
 * Les « chiffres » sont les quatre curseurs que l'opérateur déplace lui-même.
 * Aucune moyenne n'a été constatée : ni chez nous (zéro vente), ni ailleurs
 * (aucune source attachée). C'est la même faute que « nos clients », déplacée
 * du témoignage vers la statistique — et elle se vérifie encore plus vite.
 *
 * Le motif ne juge que les écrans, pas `lib/` : le modèle économique a le
 * droit de RAISONNER sur des comparables dans un commentaire interne. Ce qui
 * est interdit, c'est de l'AFFIRMER à quelqu'un qui va payer.
 * ─────────────────────────────────────────────────────────────────────
 */
const NORME_AFFIRMEE = [
  /standards? du march[ée]/i,
  /moyennes? du march[ée]/i,
  /moyennes? constat[ée]es? (?:du|dans le) (?:march[ée]|secteur)/i,
];

test("⚠ aucun écran n'affirme un « standard du marché » qu'on n'a pas mesuré", () => {
  const fautes: string[] = [];
  for (const f of fichiersSources(["app", "components"])) {
    const code = sansCommentairesTsx(readFileSync(f, "utf8"));
    for (const motif of NORME_AFFIRMEE) {
      const m = code.match(motif);
      if (m) fautes.push(`${relative(RACINE, f)} → « ${m[0]} »`);
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "ces écrans affirment une norme de marché sans source — un prospect la vérifie plus vite qu'un témoignage :\n  " +
      fautes.join("\n  ")
  );
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE REFUS D'ÉCRIRE À UNE FICHE DE DÉMO VIT AU POINT DE PASSAGE.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT. La boîte d'envoi bloquait ces fiches et
 * disait pourquoi (« rebond dur, ton domaine en paie le prix pendant des
 * mois »). Trois autres surfaces appelaient `/api/send` sans ce contrôle,
 * dont `/newsletter` qui proposait « Envoyer à 4 destinataire(s) » — en LOT,
 * d'un seul bouton, vers quatre domaines inventés.
 *
 * Le contrôle est descendu dans la route : une surface écrite demain est
 * couverte sans que personne y pense. Ce test garde les deux clés, et il
 * DÉDUIT la liste des surfaces au lieu de la nommer.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ /api/send refuse les fiches de démonstration, par id ET par adresse", () => {
  const src = sansCommentaires(readFileSync(join(RACINE, "app/api/send/route.ts"), "utf8"));
  assert.match(src, /isDemoProspect\(body\.prospectId\)/, "la route doit refuser par identifiant");
  assert.match(src, /estAdresseDeDemo\(body\.to\)/, "et par adresse, pour l'appelant qui n'envoie pas d'identifiant");
  assert.match(src, /status:\s*409/, "la requête est correcte : c'est la cible qui est refusée, pas la forme");

  // Les deux clés sont dérivées du seed — pas de liste tenue à la main.
  const seedSrc = readFileSync(join(RACINE, "lib/seed.ts"), "utf8");
  assert.match(seedSrc, /EMAILS_DE_DEMO[^=]*= new Set\(\s*seedProspects\.map/, "EMAILS_DE_DEMO doit être dérivée");
  for (const p of seedProspects) {
    assert.ok(isDemoProspect(p.id), `${p.id} manque à la liste dérivée des ids`);
    if (p.email?.trim()) {
      assert.ok(EMAILS_DE_DEMO.has(p.email.trim().toLowerCase()), `${p.email} manque à la liste dérivée des adresses`);
    }
  }
  assert.equal(EMAILS_DE_DEMO.has("contact@une-vraie-boite.fr"), false);
  assert.equal(estAdresseDeDemo("contact@une-vraie-boite.fr"), false, "une vraie adresse ne doit jamais être prise pour une démo");
});

test("⚠ LE VERROU TIENT SUR LES FICHES ENGENDRÉES — celles qu'aucune liste ne connaît", () => {
  /**
   * ⚠ LE MOMENT OÙ CE VERROU SE SERAIT OUVERT TOUT SEUL.
   *
   * `isDemoProspect` et `EMAILS_DE_DEMO` répondaient par appartenance à deux
   * ensembles dérivés des huit fiches écrites à la main. Tant que le jeu de
   * démonstration était figé, ça suffisait. Depuis qu'il se GÉNÈRE à partir
   * de l'ICP de l'inscrit (`lib/demo-icp.ts`), les fiches produites n'y sont
   * plus : les deux clés auraient rendu `false`, `/api/send` les aurait
   * traitées comme de vrais prospects, et l'agent vocal aurait composé leurs
   * numéros. Rien n'aurait cassé, rien n'aurait alerté.
   *
   * Les deux clés sont donc STRUCTURELLES : un préfixe réservé, un domaine
   * réservé. On le vérifie sur la vraie sortie du générateur, pas sur une
   * fiche fabriquée pour le test — sinon on ne mesure que sa propre fixture.
   */
  const fiches = demoDepuisProfil({
    poste: "solo",
    metier: "logiciel RH",
    cibleSecteur: "logistique",
    cibleRole: "directeur des opérations",
    cibleZone: "Rhône",
  })!;
  assert.ok(fiches.length > 0, "le générateur doit produire quelque chose sur un profil exploitable");

  for (const f of fiches) {
    assert.ok(isDemoProspect(f.id), `${f.id} : fiche engendrée non reconnue comme démo — /api/send l'accepterait`);
    assert.ok(estAdresseDeDemo(f.email ?? ""), `${f.email} : adresse engendrée non reconnue comme démo`);
    /**
     * Le numéro doit être dans la tranche ARCEP réservée à la fiction
     * (décision 2018-0881) : ni appelable, ni attribuable. Un numéro
     * « plausible » inventé à la main appartient à quelqu'un.
     */
    assert.match(f.phone ?? "", /^06 39 98 /, `${f.phone} : hors de la tranche réservée à la fiction`);
    // Et un humain doit pouvoir le voir sans lire le code.
    assert.match(f.company, /\(démo\)/, `${f.company} : rien ne signale à l'écran que la fiche est inventée`);
    /**
     * ⚠ AUCUNE VALEUR MONÉTAIRE. Une fiche inventée qui porte un montant
     * entre dans le pipe pondéré et dans les prévisions : le tableau de bord
     * annoncerait un chiffre d'affaires imaginaire tous les matins.
     */
    assert.equal(f.monthlyValue, 0, `${f.company} : une fiche de démo ne doit peser aucun euro`);
    assert.equal(f.setupValue, 0);
    assert.equal(f.probability, 0);
  }
});

test("⚠ le même profil rend TOUJOURS les mêmes fiches", () => {
  /**
   * Une démonstration qui change à chaque rendu ne se lit pas comme « c'est
   * un exemple » : elle se lit comme une perte de données. C'est le même
   * défaut que l'écran qui se vide une seconde au chargement — il ressemble
   * trait pour trait à une panne.
   */
  const profil = {
    poste: "solo" as const,
    metier: "conseil",
    cibleSecteur: "industrie",
    cibleRole: "DAF",
    cibleZone: "",
  };
  assert.deepEqual(demoDepuisProfil(profil), demoDepuisProfil(profil));

  // Et deux profils différents ne donnent pas le même jeu, sinon la
  // personnalisation est décorative.
  const autre = demoDepuisProfil({ ...profil, cibleSecteur: "santé" })!;
  assert.notDeepEqual(demoDepuisProfil(profil)!.map((f) => f.company), autre.map((f) => f.company));
});

test("un profil sans cible ne fabrique RIEN — il retombe sur le jeu écrit à la main", () => {
  /**
   * Inventer des fiches à partir de rien produirait un décor générique de
   * plus, sans le mérite d'être cohérent. Le `null` est le message : il dit
   * à l'appelant de garder le jeu existant.
   */
  assert.equal(demoDepuisProfil({ poste: "solo", metier: "", cibleSecteur: "", cibleRole: "", cibleZone: "" }), null);
  assert.equal(demoDepuisProfil({ poste: "solo", metier: "x", cibleSecteur: "  ", cibleRole: "y", cibleZone: "z" }), null);
});

test("aucune surface d'envoi ne compose une liste envoyable de fiches de démo", () => {
  /**
   * La route est le verrou : rien ne part. Mais un écran qui ANNONCE
   * « Envoyer à 4 destinataire(s) », ou qui prépare quarante brouillons dont
   * huit seront refusés un par un, est un mensonge d'interface — l'opérateur
   * approuve, puis regarde des échecs sans comprendre lesquels ni pourquoi.
   *
   * Deux surfaces composent une liste, et on les vérifie différemment :
   *  · la revue de campagne — par le COMPORTEMENT, c'est plus solide qu'un
   *    scan de source : on prépare les brouillons et on regarde leur statut ;
   *  · la newsletter — par la source, parce que son audience est calculée
   *    dans le composant et n'est pas atteignable depuis un test node.
   *
   * `components/recette/go-live-checklist.tsx` envoie à l'adresse que
   * l'opérateur TAPE, pas à une fiche : rien à filtrer.
   */
  // ── La revue de campagne : aucun brouillon « pending » sur une fiche de démo.
  const store = useAlpha.getState();
  const campagne = seedCampaigns.find((c) => c.sector === "restaurant") ?? seedCampaigns[0];
  store.prepareCampaignDrafts(campagne.id);
  const drafts = useAlpha.getState().drafts.filter((d) => d.campaignId === campagne.id);
  assert.ok(drafts.length > 0, "le jeu de démo doit produire des brouillons — sinon ce test ne garde rien");

  const demoEnvoyables = drafts.filter((d) => isDemoProspect(d.prospectId) && d.status === "pending");
  assert.deepEqual(
    demoEnvoyables.map((d) => `${d.company} → ${d.to}`),
    [],
    "des brouillons de campagne partiraient vers des adresses inventées"
  );
  // Et la raison doit être ÉCRITE : un brouillon écarté sans motif se relit
  // comme un bug de l'app.
  for (const d of drafts.filter((d) => isDemoProspect(d.prospectId))) {
    assert.match(d.error ?? "", /démonstration/i, `${d.company} : brouillon écarté sans dire pourquoi`);
  }

  // ── La newsletter : son audience écarte la démo, et elle le dit.
  const news = readFileSync(join(RACINE, "app/(app)/newsletter/page.tsx"), "utf8");
  assert.match(news, /\.filter\(\(p\) => !isDemoProspect\(p\.id\)\)/, "l'audience newsletter doit écarter la démo");
  assert.match(news, /demoExclues/, "et l'écran doit dire combien de fiches ont été retirées");
});
