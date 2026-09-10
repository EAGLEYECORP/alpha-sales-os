import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOGEMENTS_MIN,
  SCORE_MIN_PERMIS,
  communeDansLaZone,
  VALIDITE_MOIS,
  importerPermis,
  lirePermis,
  peremptionMois,
  phaseDuPermis,
  ressembleAuPermis,
  trierPermis,
  typeDeMaitreOuvrage,
  type PermisConstruire,
} from "../lib/permis-construire";
import { verticalForText, verticalForProspect } from "../lib/playbook";
import { qualifier } from "../lib/linkedin-ciblage";
import { ACCOUNTS_COMMERCIAL } from "../lib/accounts-commercial";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AVATAR « MAÎTRE D'OUVRAGE AVEC PERMIS ACTIF », DE BOUT EN BOUT.
 *
 * Le fil que suit ce fichier est celui d'un vrai lot : un export d'open data
 * arrive, la plupart des lignes ne valent rien, quelques-unes valent un
 * message écrit à la main. Ce qui compte n'est pas que le score soit joli —
 * c'est que ce qu'on ÉCARTE soit écarté pour la bonne raison, et que la
 * verticale servie derrière soit la bonne.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAINTENANT = new Date("2026-09-04T10:00:00Z");
/** Un arrêté vieux de `n` mois par rapport à MAINTENANT. */
const ilYA = (mois: number) => {
  const d = new Date(MAINTENANT);
  d.setMonth(d.getMonth() - mois);
  return d.toISOString().slice(0, 10);
};

const promoteur = (over: Partial<PermisConstruire> = {}): PermisConstruire => ({
  numero: "PC 069 383 25 A0123",
  demandeur: "SCCV LES JARDINS DE GERLAND",
  dateDecision: ilYA(5),
  logements: 42,
  commune: "Lyon 7e",
  ...over,
});

// ── LA QUESTION QUI COMMANDE TOUT : a-t-il quelque chose à vendre ? ──

test("permis — le tri sépare ceux qui vendent de ceux qui n'ont rien à vendre", () => {
  assert.equal(typeDeMaitreOuvrage("SCCV LES JARDINS DE GERLAND"), "promoteur");
  assert.equal(typeDeMaitreOuvrage("NEXITY PROMOTION IMMOBILIERE"), "promoteur");
  assert.equal(typeDeMaitreOuvrage("MAISONS D'EN FRANCE RHONE"), "constructeur-maisons");
  assert.equal(typeDeMaitreOuvrage("OPAC DU RHONE"), "bailleur-social");
  assert.equal(typeDeMaitreOuvrage("VILLE DE LYON"), "public");
  assert.equal(typeDeMaitreOuvrage("M. et Mme DUPONT"), "particulier");
  assert.equal(typeDeMaitreOuvrage("BOULANGERIE MARTIN SARL"), "entreprise");
  assert.equal(typeDeMaitreOuvrage(""), "inconnu");
});

test("⚠ un bailleur social, une commune et un particulier sortent par EXCLUSION, pas par score", () => {
  /**
   * C'est le cœur du module. Un bailleur social de 80 logements coche TOUT le
   * reste : phase parfaite, grosse opération, commune renseignée. S'il sortait
   * par le score, il rentrerait — et on écrirait à un office HLM pour lui
   * vendre un OS de vente.
   *
   * ⚠ Le piège de test du dépôt : asserter que le refus EST LÀ au lieu
   * d'asserter la CONDITION qui y mène. On vérifie donc qu'un permis
   * IDENTIQUE, au seul demandeur près, passe — sinon le refus pourrait venir
   * de n'importe quoi d'autre.
   */
  const base = { dateDecision: ilYA(5), logements: 80, commune: "Villeurbanne" };

  const bailleur = lirePermis({ ...base, demandeur: "OPAC DU RHONE" }, MAINTENANT);
  assert.equal(bailleur.retenu, false);
  assert.equal(bailleur.problemeDeVente, false);
  assert.ok(
    bailleur.score >= SCORE_MIN_PERMIS,
    `le score seul suffirait à le retenir (${bailleur.score}) : c'est bien l'exclusion qui l'écarte, pas le barème`
  );

  const memeChoseMaisPromoteur = lirePermis({ ...base, demandeur: "SCCV DU PARC" }, MAINTENANT);
  assert.equal(memeChoseMaisPromoteur.retenu, true, "à demandeur près, la même ligne doit passer");
});

test("une société sans marqueur de promotion passe, mais avec le doute ÉCRIT", () => {
  /**
   * Une SAS qui dépose un permis pour 30 logements est un promoteur qui ne
   * s'est pas nommé comme tel. Répondre non par prudence supprimerait la
   * moitié des vraies cibles ; répondre oui en silence ferait écrire à
   * n'importe qui. On répond oui ET on nomme le doute.
   */
  const l = lirePermis(promoteur({ demandeur: "ALPHA INVEST SAS" }), MAINTENANT);
  assert.equal(l.typeMoa, "entreprise");
  assert.equal(l.retenu, true);
  assert.ok(
    l.manque.some((m) => /vérifier qu'elle construit bien pour vendre/i.test(m)),
    "le doute doit être écrit sur la fiche, pas gardé pour soi"
  );
});

// ── LA PHASE : le permis dit OÙ EN EST l'affaire ──

test("phases — l'arrêté, le recours, le chantier et l'achèvement se distinguent", () => {
  assert.equal(phaseDuPermis({ dateDecision: ilYA(1) }, MAINTENANT), "recours");
  assert.equal(phaseDuPermis({ dateDecision: ilYA(5) }, MAINTENANT), "commercialisation");
  assert.equal(phaseDuPermis({ dateDecision: ilYA(20) }, MAINTENANT), "lancement-bloque");
  assert.equal(phaseDuPermis({ dateDecision: ilYA(40) }, MAINTENANT), "perime");
  assert.equal(phaseDuPermis({}, MAINTENANT), "inconnue");

  // Le chantier ouvert prime sur la péremption : les trois ans ne courent plus
  // une fois les travaux commencés.
  assert.equal(
    phaseDuPermis({ dateDecision: ilYA(40), dateOuvertureChantier: ilYA(30) }, MAINTENANT),
    "chantier",
    "un permis de plus de trois ans dont le chantier est ouvert n'est PAS périmé"
  );
  // Et l'achèvement prime sur tout, y compris sur un chantier encore déclaré.
  assert.equal(
    phaseDuPermis({ dateDecision: ilYA(30), dateOuvertureChantier: ilYA(20), dateAchevement: ilYA(1) }, MAINTENANT),
    "acheve"
  );
});

test("la prorogation décale la péremption, et se plafonne à deux", () => {
  assert.equal(peremptionMois(0), VALIDITE_MOIS);
  assert.equal(peremptionMois(1), VALIDITE_MOIS + 12);
  assert.equal(peremptionMois(2), VALIDITE_MOIS + 24);
  // Le code de l'urbanisme n'en accorde que deux : une donnée fausse en entrée
  // ne doit pas rallonger la validité indéfiniment.
  assert.equal(peremptionMois(9), VALIDITE_MOIS + 24, "au-delà de deux prorogations, on plafonne");

  const sans = lirePermis(promoteur({ dateDecision: ilYA(40) }), MAINTENANT);
  assert.equal(sans.phase, "perime");
  const avec = lirePermis(promoteur({ dateDecision: ilYA(40), prorogations: 1 }), MAINTENANT);
  assert.notEqual(avec.phase, "perime", "une prorogation doit ressusciter le permis");
});

test("le permis d'un an sans chantier est le signal le plus fort ET le plus ambigu", () => {
  const l = lirePermis(promoteur({ dateDecision: ilYA(20) }), MAINTENANT);
  assert.equal(l.phase, "lancement-bloque");
  assert.equal(l.retenu, true);
  assert.ok(
    l.risques.some((r) => /abandonn/i.test(r)),
    "l'ambiguïté doit être écrite : sans elle, on écrit à une opération morte en croyant tenir un signal"
  );
});

// ── LA TAILLE : l'offre VIP doit être proportionnée ──

test("une opération minuscule n'est pas exclue, elle est dite disproportionnée", () => {
  const petit = lirePermis(promoteur({ logements: LOGEMENTS_MIN - 3 }), MAINTENANT);
  assert.ok(
    petit.risques.some((r) => new RegExp(`sous ${LOGEMENTS_MIN}`).test(r)),
    "la disproportion doit être nommée"
  );
  const grand = lirePermis(promoteur({ logements: 60 }), MAINTENANT);
  assert.ok(grand.score > petit.score, "la taille doit peser dans l'ordre de la file");
});

// ── LA ZONE : LYON + VILLEURBANNE ──

test("⚠ HORS ZONE EST UNE EXCLUSION, PAS DIX POINTS EN MOINS", () => {
  /**
   * ⚠ CE QUE CE TEST GARDE, ET IL A ÉTÉ ÉCRIT PARCE QUE ÇA NE TENAIT PAS.
   *
   * La commune ne faisait qu'ajouter dix points. Un promoteur de Bron, de
   * Saint-Priest ou de Vénissieux — phase parfaite, 42 logements — sortait
   * donc RETENU, entrait dans la file, et rien dans le lot ne disait qu'on
   * venait d'ajouter des cibles hors du terrain qu'on couvre.
   *
   * ⚠ Le piège de test du dépôt : asserter que le refus EST LÀ. On vérifie
   * donc la CONDITION — le MÊME permis, à la commune près, passe. Mutation
   * vérifiée : remettre `score += 10` à la place de l'exclusion fait tomber
   * l'assertion `retenu === false` et elle seule.
   */
  const dedans = lirePermis(promoteur({ commune: "Lyon 7e" }), MAINTENANT);
  const dehors = lirePermis(promoteur({ commune: "Bron" }), MAINTENANT);

  assert.equal(dedans.retenu, true, "le permis de référence doit passer, sinon ce test ne prouve rien");
  assert.equal(dehors.retenu, false, "le même permis à Bron ne doit pas passer");
  assert.ok(
    dehors.risques.some((r) => /hors zone/i.test(r)),
    `la raison doit être écrite : ${dehors.risques.join(" | ")}`
  );
});

test("⚠ la zone se reconnaît sur la FORME du libellé, pas sur un `includes(\"lyon\")`", () => {
  /**
   * ⚠ LE FAUX POSITIF QU'UN `includes` AURAIT CRÉÉ, ET IL EST À CÔTÉ.
   *
   * « Sainte-Foy-lès-Lyon » contient « lyon ». « Métropole de Lyon » et
   * « Grand Lyon » aussi, et ce sont des libellés qu'un export porte
   * réellement, pour des lignes dont la commune est ailleurs. Le nom doit
   * COMMENCER par la commune visée, suivi d'une fin de chaîne ou d'un
   * séparateur — sinon on rouvre la zone à toute la métropole en croyant
   * l'avoir fermée.
   */
  for (const ok of ["Lyon", "LYON 3E", "Lyon 7e", "Lyon-9e", "Villeurbanne", "VILLEURBANNE", "69003 LYON", "69100"]) {
    assert.equal(communeDansLaZone(ok), true, `« ${ok} » doit être dans la zone`);
  }
  for (const ko of ["Sainte-Foy-lès-Lyon", "Métropole de Lyon", "Grand Lyon", "Bron", "Vénissieux", "Lyons-la-Forêt", "69200"]) {
    assert.equal(communeDansLaZone(ko), false, `« ${ko} » ne doit PAS être dans la zone`);
  }

  /**
   * ⚠⚠ COMMUNE ABSENTE N'EST PAS HORS ZONE — c'est `null`, et ça reste un
   * `manque`. Exclure sur une donnée absente jetterait des cibles au motif
   * que l'export était pauvre en colonnes : le module dit ses angles morts,
   * il ne les comble pas et ne les punit pas.
   */
  assert.equal(communeDansLaZone(undefined), null);
  assert.equal(communeDansLaZone("   "), null);
  const sansCommune = lirePermis(promoteur({ commune: undefined }), MAINTENANT);
  assert.ok(
    sansCommune.manque.some((m) => /commune absente/i.test(m)),
    "l'absence se NOMME"
  );
  assert.ok(
    !sansCommune.risques.some((r) => /hors zone/i.test(r)),
    "…et ne se transforme jamais en exclusion"
  );
});

// ── LE LOT, ET CE QU'IL VAUT ──

test("le résumé d'un lot dit ce qu'on a jeté et pourquoi — pas seulement ce qu'on garde", () => {
  const lot = trierPermis(
    [
      promoteur(),
      promoteur({ numero: "PC-2", demandeur: "GRAND LYON HABITAT", logements: 60 }),
      promoteur({ numero: "PC-3", demandeur: "M. et Mme BERNARD", logements: 1 }),
      promoteur({ numero: "PC-4", demandeur: "VILLE DE LYON", logements: 0 }),
    ],
    MAINTENANT
  );
  assert.equal(lot.retenus.length, 1);
  assert.ok(
    lot.resume.some((r) => /n'a rien à vendre/i.test(r) && /3 écarté/.test(r)),
    `le résumé doit compter les maîtres d'ouvrage sans problème de vente : ${lot.resume.join(" | ")}`
  );
});

test("import — un export tabulaire devient des fiches contactables sur LinkedIn", () => {
  const texte = [
    "numero;demandeur;datedecision;nblogements;commune;adresse",
    `PC 069 383 25 A0123;SCCV LES JARDINS DE GERLAND;${ilYA(5)};42;Lyon 7e;12 rue Pré-Gaudry`,
    `PC 069 266 25 A0044;OPAC DU RHONE;${ilYA(4)};60;Villeurbanne;3 avenue Roosevelt`,
  ].join("\n");

  const res = importerPermis(texte, MAINTENANT);
  assert.equal(res.retenus.length, 1);
  const p = res.retenus[0].prospect;
  assert.equal(p.stage, "prospect", "une ligne d'open data n'a rien demandé");
  assert.equal(
    p.preferredChannel,
    "linkedin",
    "un export de permis ne porte aucun téléphone : router ces fiches vers la file d'appels les y ferait pourrir"
  );
  assert.ok(!p.phone, "aucun numéro ne doit être inventé");
  assert.ok(p.tags.includes("maitrise-ouvrage"), "le tag porte la verticale, c'est lui qui route les leçons terrain");
  assert.match(p.notes, /Arrêté :/, "la note garde les faits datés");
  assert.doesNotMatch(
    p.notes,
    /pré-commercialisation est la fenêtre/i,
    "la note ne recopie pas la doctrine : mille fiches, mille copies du même paragraphe"
  );
});

test("détection de format — deux marqueurs, jamais un seul", () => {
  assert.equal(ressembleAuPermis("numero;demandeur;datedecision;nblogements"), true);
  // « commune » et « adresse » se trouvent dans n'importe quel export
  // d'entreprises : router un relevé terrain vers le tri permis écarterait
  // toutes les fiches, c'est-à-dire l'inverse du service rendu.
  assert.equal(ressembleAuPermis("entreprise;commune;adresse;telephone"), false);
  assert.equal(ressembleAuPermis('{"places":[]}'), false);
  assert.equal(ressembleAuPermis(""), false);
});

// ── LE RACCORDEMENT AU RESTE DE L'OS ──

test("⚠ « permis de construire » ne tombe PLUS sur la verticale auto-école", () => {
  /**
   * Mesuré avant correction, pas supposé : `VERTICAL_KEYWORDS` testait
   * `permis` nu, et `.find()` rend la première règle qui matche. Un export de
   * permis entier se classait donc en auto-école — avec le script du plateau
   * et des leçons de conduite servi à un promoteur.
   */
  assert.equal(verticalForText("Permis de construire accordé - 48 logements")?.id, "maitrise-ouvrage");
  assert.equal(verticalForText("Promoteur immobilier, permis actif Lyon 3e")?.id, "maitrise-ouvrage");
  assert.equal(verticalForText("Maître d'ouvrage - opération de 30 logements")?.id, "maitrise-ouvrage");
  assert.equal(verticalForText("Directeur de programmes immobiliers")?.id, "maitrise-ouvrage");
  assert.equal(verticalForText("SCCV Les Jardins")?.id, "maitrise-ouvrage");

  // Et la contrepartie : l'auto-école n'a pas été cassée en corrigeant.
  assert.equal(verticalForText("auto-école, permis B, conduite accompagnée")?.id, "auto-ecole");
  assert.equal(verticalForText("permis de conduire, code de la route")?.id, "auto-ecole");
  // L'agence de transaction reste chez elle.
  assert.equal(verticalForText("agence immobilière, mandats de vente")?.id, "immobilier");

  /**
   * ─────────────────────────────────────────────────────────────────────
   * ⚠ CETTE LIGNE ASSERTAIT L'INVERSE, ET C'EST ELLE QUI FIGEAIT LE BUG.
   *
   * Elle exigeait que « il passe son permis en janvier » rende `auto-ecole`,
   * c'est-à-dire que le mot « permis » NU suffise. Le lookahead n'excluait
   * alors que « permis de construire / d'aménager / de démolir » — trois
   * formes qu'une fiche réelle n'écrit presque jamais.
   *
   * Mesuré : `notesDepuisPermis` produit « Permis : PC 069 383 24 A0123 », et
   * une note à la main dit « permis obtenu », « permis purgé », « permis
   * n° … ». Les huit fiches de démonstration de maîtrise d'ouvrage rendaient
   * TOUTES `auto-ecole`. En production, la file du matin aurait servi le
   * script du moniteur de conduite à des directeurs de programmes.
   *
   * L'arbitrage, dit franchement : « permis » seul est AMBIGU, et rendre
   * `null` est le bon comportement — la fiche retombe sur son secteur, et une
   * vraie auto-école écrit « auto-école », « conduite » ou « code de la
   * route », qui matchent tous. Le coût des deux erreurs n'est pas
   * symétrique : rater une auto-école coûte un rattachement, servir le script
   * auto-école à un promoteur coûte l'appel et la crédibilité.
   *
   * Une liste d'exceptions est toujours en retard sur la façon dont les gens
   * écrivent ; un contexte exigé ne l'est pas.
   * ─────────────────────────────────────────────────────────────────────
   */
  assert.equal(
    verticalForText("il passe son permis en janvier"),
    null,
    "« permis » nu est ambigu : il ne doit rattacher à AUCUNE verticale"
  );
});

test("⚠ LE TAG PRIME SUR LE TEXTE — une devinette ne pilote pas la file du matin", () => {
  /**
   * ⚠ LA CORRECTION DE FOND, et le motif du dépôt appliqué à la file d'appels.
   *
   * Rattacher une fiche par le TEXTE de ses notes est une devinette : le
   * résultat dépend de la tournure qu'a employée celui qui a saisi, et il se
   * trompe en silence. `permisVersProspect` pose pourtant des tags décidés par
   * le module de TRI — « permis-construire », « maitrise-ouvrage », la phase.
   *
   * CLAUDE.md l'énonce déjà pour le Cerveau : « verticale identifiée par tag,
   * jamais par ressemblance de mots ». La règle existait, elle n'était branchée
   * qu'à un endroit. C'est le défaut le plus fréquent de ce dépôt.
   *
   * ⚠ Le test vérifie la CONDITION : la même fiche, avec un texte qui pointe
   * ailleurs, suit son TAG. Sans cette mise en opposition, elle pourrait
   * tomber juste par le texte et on ne saurait pas lequel des deux a décidé.
   */
  const fiche = {
    sector: "autre" as const,
    notes: "auto-école, conduite accompagnée, code de la route",
    tags: ["permis-construire", "maitrise-ouvrage", "commercialisation"],
  };
  assert.equal(
    verticalForProspect(fiche)?.id,
    "maitrise-ouvrage",
    "le tag posé par l'importeur doit primer sur ce que raconte la note"
  );

  // Et le texte reste le REPLI : les imports CSV, LinkedIn et terrain ne
  // posent aucun tag de verticale, et le ciblage LinkedIn n'a pas de fiche.
  assert.equal(
    verticalForProspect({ sector: "autre", notes: "auto-école, conduite accompagnée" })?.id,
    "auto-ecole",
    "sans tag, on retombe sur le texte — le retirer casserait tous les autres imports"
  );

  // Un tag qui ne désigne aucune verticale ne doit RIEN décider.
  assert.equal(
    verticalForProspect({ sector: "autre", notes: "auto-école", tags: ["chaud", "lyon-3e"] })?.id,
    "auto-ecole",
    "un tag ordinaire n'est pas un identifiant de verticale"
  );
});

test("un directeur de programmes est retenu par le ciblage LinkedIn, avec le doute sur le playbook", () => {
  const c = qualifier({
    nom: "Claire Berthier",
    titre: "Directrice de programmes immobiliers",
    entreprise: "SCCV Les Jardins",
    ville: "Lyon 7e",
    url: "linkedin.com/in/claire",
    taille: "11-50",
  });
  assert.equal(c.retenu, true);
  assert.equal(c.verticaleId, "maitrise-ouvrage");
  /**
   * Le niveau de preuve doit REMONTER jusqu'ici : sinon le champ `preuve` du
   * playbook est un commentaire déguisé en donnée. Une verticale écrite au
   * bureau ne doit pas ressembler à une méthode jouée cent fois.
   */
  assert.ok(
    c.risques.some((r) => /zéro appel derrière|hypothèse/i.test(r)),
    `le playbook non éprouvé doit être signalé : ${c.risques.join(" | ")}`
  );
});

test("⚠ le module est BRANCHÉ : un export lib que rien n'importe est mort, pas prêt", () => {
  /**
   * Le défaut le plus fréquent de ce dépôt : un mécanisme juste, testé, et
   * branché nulle part. Ce test ne vérifie pas que le code est beau — il
   * vérifie qu'un écran l'appelle réellement.
   */
  const panneau = readFileSync(join(process.cwd(), "components/linkedin/sourcing-panel.tsx"), "utf8");
  assert.match(panneau, /importerPermis/, "le panneau de sourcing doit appeler l'import des permis");
  assert.match(
    panneau,
    /estPermis \? importerPermis\(texte\)/,
    "la détection doit ROUTER l'import, pas seulement exister à côté de lui"
  );
});

test("⚠ L'ICP ÉCRIT ET LE CODE QUI TRIE DISENT LA MÊME CHOSE", () => {
  /**
   * ─────────────────────────────────────────────────────────────────────
   * DEUX ENDROITS POSENT « QUI EST NOTRE CIBLE ? » — ILS DOIVENT RÉPONDRE
   * PAREIL.
   *
   * L'ICP d'EAGLEYE (`lib/accounts-commercial.ts`) énonce ses disqualifiants
   * en PROSE : elle est lue par l'opérateur, elle nourrit les prompts, elle
   * s'affiche dans les Réglages. `lirePermis` les applique en CODE : c'est lui
   * qui décide ce qui entre dans la file.
   *
   * C'est exactement la forme du défaut récurrent de ce dépôt. Une prose qui
   * dérive du code ne casse rien : elle ment, en silence, à l'endroit précis
   * où quelqu'un vient chercher la règle. On vérifie donc que chaque
   * disqualifiant ANNONCÉ est réellement APPLIQUÉ, sur un permis qui coche
   * tout le reste — sinon le refus pourrait venir d'autre chose.
   *
   * ⚠ Ce test ne compare pas des chaînes de caractères : il rejoue le tri.
   * Reformuler un disqualifiant est libre ; le retirer du code ne l'est pas.
   * ─────────────────────────────────────────────────────────────────────
   */
  const eagleye = ACCOUNTS_COMMERCIAL.find((c) => c.accountId === "eagleye");
  assert.ok(eagleye?.icp, "le compte MAÎTRE doit avoir un client parfait déclaré, comme les autres");
  const dq = (eagleye!.icp!.disqualifiers ?? []).join(" \n ").toLowerCase();

  // Le témoin : il coche tout, il doit passer. Sans lui, chaque refus
  // ci-dessous pourrait venir de n'importe quelle autre règle.
  assert.equal(lirePermis(promoteur(), MAINTENANT).retenu, true, "le témoin doit passer");

  const applique: [string, RegExp, Partial<PermisConstruire>][] = [
    ["personne physique", /personne physique/, { demandeur: "M. et Mme DUVAL" }],
    ["bailleur social", /bailleur social/, { demandeur: "OPAC DU RHONE" }],
    ["personne publique", /personne publique/, { demandeur: "VILLE DE LYON" }],
    ["hors zone", /hors lyon \+ villeurbanne/, { commune: "Bron" }],
    ["permis périmé", /au-delà de sa validité|achevé/, { dateDecision: ilYA(40) }],
  ];

  for (const [nom, motif, mutation] of applique) {
    assert.match(dq, motif, `l'ICP doit ANNONCER le disqualifiant « ${nom} »`);
    assert.equal(
      lirePermis(promoteur(mutation), MAINTENANT).retenu,
      false,
      `l'ICP annonce « ${nom} » mais le code le laisse passer`
    );
  }

  /**
   * ⚠ Le seuil de taille est le seul qui n'EXCLUT pas, et l'ICP doit le dire
   * comme tel. Une opération de trois lots reste une cible — pour Alpha Voice
   * seul, pas pour l'offre VIP. Écrire « disqualifiant » sans cette nuance
   * ferait jeter des fiches que le code garde.
   */
  assert.match(dq, /alpha voice/, "le seuil de taille doit renvoyer vers l'offre proportionnée, pas vers la poubelle");
  assert.equal(
    lirePermis(promoteur({ logements: LOGEMENTS_MIN - 3 }), MAINTENANT).retenu,
    true,
    "une petite opération n'est pas exclue : elle est dite disproportionnée pour le VIP"
  );

  // Et la zone annoncée est bien celle qui est implémentée.
  assert.match((eagleye!.icp!.geo ?? "").toLowerCase(), /lyon/);
  assert.match((eagleye!.icp!.geo ?? "").toLowerCase(), /villeurbanne/);
});
