import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRICKS } from "../lib/bricks";
import { TOUS_RELEVES, comparer, comparerParCompte, SIEGES_REFERENCE, type RelevePrix } from "../lib/marche";
import { REFERENCE_PAR_BRIQUE, positionnerBriques } from "../lib/positionnement";
import { seedTerrain } from "../lib/knowledge-seed";
import { ALPHA_VOICE_SETUP_HT, ALPHA_VOICE_PALIERS } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PRIX D'UNE BRIQUE EST ADOSSÉ À QUELQUE CHOSE — ou on le DIT.
 *
 * ⚠⚠ L'ÉTAT D'AVANT, mesuré le 12/09/2026 : sur dix briques du catalogue à la
 * carte, aucune n'était rapprochée d'un relevé de marché. `lib/marche.ts`
 * existait depuis le 26/08 et `lib/positionnement.ts` rapprochait les OFFRES
 * (les packs) — les BRIQUES, jamais. Or c'est le catalogue à la carte qui sort
 * dans un devis quand un client ne prend qu'un morceau, et la doctrine du
 * dépôt le prévoit explicitement.
 *
 * Trois ancrages possibles pour un prix : le coût, le marché, la vente.
 *  · le COÛT ne mord pas sur du logiciel — `lib/pricing-briques.ts` le dit
 *    lui-même et rend `hors-regle` sur six briques sur dix ;
 *  · le MARCHÉ n'était pas relevé pour quatre d'entre elles ;
 *  · la VENTE n'existe pas — zéro client à ce jour.
 * Six prix sur dix ne venaient donc de rien. L'écart le plus gros : l'Agent
 * ALPHA à 220 €/mois dans une catégorie dont le plancher d'entrée réel est
 * vers 1 650 €.
 * ─────────────────────────────────────────────────────────────────────
 */

const refDe = (id: string): RelevePrix | undefined => TOUS_RELEVES.find((r) => r.id === id);

test("⚠⚠ CHAQUE BRIQUE EST RAPPROCHÉE D'UN RELEVÉ, OU SON ABSENCE EST ÉCRITE", () => {
  /**
   * ⚠ Le test n'exige PAS une comparaison pour chacune : il exige une
   * RÉPONSE. `null` + un motif est une réponse ; une brique absente de la
   * table est un trou silencieux, et c'est exactement ce qu'on vient de
   * corriger. Sans cette assertion, ajouter une brique demain la laisserait
   * sans ancrage sans que rien ne le dise.
   */
  const orphelines = BRICKS.filter((b) => !(b.id in REFERENCE_PAR_BRIQUE));
  assert.deepEqual(
    orphelines.map((b) => b.id),
    [],
    "ces briques n'ont ni référence de marché ni motif écrit — leur prix n'est adossé à rien " +
      "et personne ne peut le savoir :\n  " + orphelines.map((b) => b.id).join("\n  ")
  );
});

test("⚠ une référence nommée EXISTE vraiment dans le relevé", () => {
  /**
   * Un identifiant mal tapé rendrait `undefined`, donc « aucune comparaison
   * défendable » — le même résultat qu'un `null` volontaire. La faute de
   * frappe se déguiserait en décision, et c'est indétectable à la lecture.
   */
  for (const [brique, refId] of Object.entries(REFERENCE_PAR_BRIQUE)) {
    if (refId === null) continue;
    assert.ok(refDe(refId), `${brique} pointe vers le relevé « ${refId} », qui n'existe pas`);
  }
});

test("⚠⚠ UN RELEVÉ PAR SIÈGE NE SE COMPARE PAS BRUT À UN PRIX PAR COMPTE", () => {
  /**
   * ⚠⚠ LE TEST QUI AURAIT ATTRAPÉ LA PREMIÈRE VERSION. `comparer()` prend deux
   * nombres et fait une division juste. Passer notre CRM (190 €/mois, par
   * compte) et Pipedrive (14–79 € par UTILISATEUR) rend « ×2,4 le haut de
   * fourchette, HORS MARCHÉ » — une phrase parfaitement construite, et fausse,
   * qui pousse à baisser un prix situé au milieu de sa bande.
   *
   * Le test compare les DEUX chemins sur le même relevé : si
   * `comparerParCompte` cessait de normaliser, il rendrait le même verdict que
   * `comparer` et l'assertion tombe.
   */
  const pipedrive = refDe("pipedrive");
  assert.ok(pipedrive, "relevé Pipedrive absent — le test ne mesure rien");
  assert.equal(pipedrive!.parSiege, true, "Pipedrive est facturé par utilisateur : le drapeau doit le dire");

  const brut = comparer("CRM", 190, pipedrive!);
  const normalise = comparerParCompte("CRM", 190, pipedrive!);

  assert.notEqual(
    brut.position,
    normalise.position,
    "la normalisation par siège ne change rien — soit le drapeau n'est plus lu, soit SIEGES_REFERENCE vaut 1"
  );
  assert.equal(normalise.position, "dans-marche", "190 €/mois est dans la bande d'un Pipedrive à 5 sièges");
  assert.match(
    normalise.reference.reserve,
    /HYPOTHÈSE/,
    "le verdict dépend entièrement du nombre de sièges supposé : il doit le dire"
  );
});

test("⚠ un relevé au FORFAIT ne se multiplie pas par les sièges", () => {
  /**
   * Le contre-test, sans lequel le précédent passerait sur un module qui
   * multiplierait TOUT par 5. Axonaut est un forfait « 1 à 20 personnes » :
   * le multiplier inventerait un concurrent cinq fois plus cher qu'il n'est,
   * et nous ferait croire qu'on est bon marché.
   */
  const axonaut = refDe("axonaut");
  assert.ok(axonaut, "relevé Axonaut absent");
  assert.ok(!axonaut!.parSiege, "Axonaut est un forfait : il ne porte pas le drapeau");
  assert.deepEqual(
    comparerParCompte("CRM", 190, axonaut!).reference.hautEur,
    axonaut!.hautEur,
    "un forfait a été multiplié par le nombre de sièges — le concurrent devient 5× plus cher qu'il n'est"
  );
});

test("⚠⚠ AUCUNE BRIQUE N'EST « HORS MARCHÉ » SANS QUE CE SOIT ASSUMÉ", () => {
  /**
   * ⚠ `hors-marche` = plus de DEUX FOIS le haut de la fourchette du comparable
   * le plus proche. À ce niveau, `comparer()` le dit lui-même : « l'écart ne
   * se justifie plus par le confort ». Ce n'est pas une interdiction de prix
   * — un produit qui fait autre chose a le droit de coûter autre chose — mais
   * ça ne doit jamais arriver PAR ACCIDENT, en changeant un nombre.
   *
   * Le test échoue donc si une brique franchit ce seuil, et la correction est
   * soit de baisser, soit d'écrire ici pourquoi l'écart tient.
   */
  const positions = positionnerBriques(BRICKS);
  const horsMarche = positions.filter((p) => p.comparaison?.position === "hors-marche");
  assert.deepEqual(
    horsMarche.map((p) => `${p.brickId} (${p.notreMensuelEur} €, ×${p.comparaison!.ratioHaut})`),
    [],
    "ces briques sont à plus de DEUX FOIS le haut de fourchette de leur comparable le plus proche :\n  " +
      horsMarche.map((p) => p.comparaison!.phrase).join("\n  ")
  );
});

test("⚠ une brique SANS comparaison porte un motif, jamais un blanc", () => {
  // Un `null` muet se relit comme un oubli, et la session suivante « complète »
  // le tableau avec une comparaison bancale — celle qui se fait démonter en
  // rendez-vous par un prospect qui connaît le concurrent mieux que nous.
  for (const p of positionnerBriques(BRICKS)) {
    if (p.comparaison) continue;
    assert.ok(
      p.pourquoiPas.length > 60,
      `${p.brickId} : aucune comparaison et aucun motif écrit — c'est un trou, pas une décision`
    );
  }
});

test("⚠⚠ LE CERVEAU NE PORTE PAS UNE GRILLE PÉRIMÉE — il DÉRIVE des constantes", () => {
  /**
   * ⚠⚠ CE QU'IL PORTAIT, ET C'EST LA FAUTE LA PLUS CHÈRE DE LA PASSE. La note
   * `sc-voix-tarifs` annonçait « Installation : 990 € HT » et les cinq paliers
   * 59/115/169/219/319 — la grille du revendeur disparu, remplacée le
   * 02/09/2026. Elle affirmait en plus « le PRIX n'a pas encore été décidé par
   * nous », faux depuis dix jours, avec un `updatedAt` au 02/09 : quelqu'un
   * avait touché la DATE le jour de la décision sans toucher au CONTENU.
   *
   * Le Cerveau alimente les prompts, et les prompts écrivent de VRAIS emails.
   * C'est la seule source de prix que le modèle peut citer.
   *
   * ⚠ Le test ne cherche pas les anciens montants — une liste de ce qu'il faut
   * bannir est toujours en retard. Il exige que la note contienne les valeurs
   * COURANTES, formatées comme elles s'écrivent en français. Changer un prix
   * sans que la note suive fait tomber ce test.
   */
  const note = seedTerrain.find((n) => n.id === "sc-voix-tarifs");
  assert.ok(note, "la note de grille Alpha Voice a disparu du Cerveau");

  /**
   * ⚠⚠ CE GARDE A ÉTÉ ÉCRIT DEUX FOIS, ET LA PREMIÈRE VERSION N'A PAS MORDU.
   *
   * Elle cherchait le montant courant N'IMPORTE OÙ dans la note. Mutation :
   * on re-fige le montant d'ouverture à 990 € — le test passait quand même,
   * parce que la phrase de contexte plus bas (« passée de 990 à 1 490 € »)
   * contient elle aussi le montant courant, et elle est dérivée.
   *
   * On vise donc la LIGNE D'ANNONCE, celle que le modèle recopie dans un
   * email : le montant doit être sur la ligne qui porte le mot
   * « Installation », pas ailleurs dans la note.
   */
  const ligneAnnonce = note!.body.split("\n").find((l) => /installation/i.test(l));
  assert.ok(ligneAnnonce, "la note n'annonce plus de prix d'installation");
  assert.match(
    ligneAnnonce!,
    new RegExp(ALPHA_VOICE_SETUP_HT.toLocaleString("fr-FR").replace(/\s/g, "\\s")),
    `la ligne d'annonce ne porte pas l'installation courante (${ALPHA_VOICE_SETUP_HT} €) : « ${ligneAnnonce} »`
  );
  for (const p of ALPHA_VOICE_PALIERS) {
    assert.match(note!.body, new RegExp(`${p.prixHT}\\s*€`), `la note ne porte pas le palier ${p.nom}`);
  }
  // La réserve doit voyager avec les chiffres : ce sont des décisions.
  assert.match(note!.body, /DÉCISIONS/, "une grille sans sa réserve se cite comme un fait mesuré");
});

test("⚠ SIEGES_REFERENCE est une DÉCISION, et elle est dite comme telle", () => {
  /**
   * Tout le verdict de la moitié du catalogue dépend de ce nombre. S'il
   * devenait une constante muette, on lirait « dans la bande » comme une
   * mesure alors que c'est une hypothèse sur la taille de l'équipe cliente.
   */
  assert.ok(SIEGES_REFERENCE >= 1, "un nombre de sièges nul rendrait toutes les bandes plates");
  const texte = readFileSync(join(process.cwd(), "lib/marche.ts"), "utf8");
  const ou = texte.indexOf("SIEGES_REFERENCE =");
  /**
   * ⚠ Le bloc est APLATI avant d'être cherché. Première rédaction : la phrase
   * tombait sur un retour à la ligne (« UNE DÉCISION, PAS UNE\n * MESURE ») et
   * le motif ne mordait pas — sur un commentaire parfaitement correct. Un
   * garde qui refuse une phrase juste est un garde qu'on assouplira au mauvais
   * endroit la fois suivante.
   */
  const bloc = texte.slice(Math.max(0, ou - 1400), ou).replace(/\s*\n\s*\*\s*/g, " ");
  assert.match(bloc, /DÉCISION, PAS UNE MESURE/, "SIEGES_REFERENCE doit porter, à côté de lui, qu'il n'est pas mesuré");
});
