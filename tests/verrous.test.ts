import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { briquesPayantes, etatChemin, offrePourBrique, POURQUOI_PAYANT } from "../lib/verrous";
import { signalAbonnement, MULTIPLE_SEUIL } from "../lib/peut-se-payer";
import { BRIQUES_GRATUITES } from "../lib/entitlements";
import { OFFRES } from "../lib/offres-publiques";
import { SOCLE_GRATUIT } from "../lib/public-catalogue";
import { prospectDefaults, PREFIXE_DEMO } from "../lib/seed";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ON GRISE CE QUI EST À VENDRE, ON MASQUE CE QUI EST À NOUS.
 *
 * Le rail masquait tout ce que le compte ne possède pas. Un inscrit gratuit
 * voyait une application plus petite que la vraie et ne pouvait ni vouloir ce
 * qu'il ne voyait pas, ni comprendre un refus dont la porte était invisible.
 * ─────────────────────────────────────────────────────────────────────
 */

const GRATUIT = [...BRIQUES_GRATUITES];

test("un chemin gratuit est ouvert à un compte gratuit", () => {
  assert.equal(etatChemin("/pipeline", GRATUIT, false, false).type, "ouvert");
  assert.equal(etatChemin("/closer", GRATUIT, false, false).type, "ouvert");
  // Les chemins communs le sont pour tout le monde, même sans une seule brique.
  assert.equal(etatChemin("/compte", [], false, false).type, "ouvert");
  assert.equal(etatChemin("/settings", [], false, false).type, "ouvert");
});

test("⚠ une brique payante se GRISE — elle ne disparaît plus", () => {
  /**
   * C'est le renversement entier. Avant, `/campaigns` était absent du rail
   * d'un compte gratuit ; il est maintenant présent, gris, et cliquable vers
   * son explication.
   */
  const e = etatChemin("/campaigns", GRATUIT, false, false);
  assert.equal(e.type, "verrouille", "une brique achetable ne doit pas être masquée");
  if (e.type !== "verrouille") return;
  assert.equal(e.brique, "campagnes");
  assert.ok(e.pourquoi.length > 40, "un verrou sans raison écrite ne vaut pas mieux qu'un masquage");
  assert.ok(e.offreId, "…et il doit mener à une offre, sinon c'est un cul-de-sac");
});

test("⚠ CE QUI EST À NOUS RESTE MASQUÉ — griser, c'est annoncer", () => {
  /**
   * ⚠ LA SEULE EXCEPTION, ET ELLE N'EST PAS DE CONFORT.
   *
   * Montrer à un client une porte « Payouts » revient à lui dire que nous
   * prenons une part sur quelque chose, et à l'inviter à demander laquelle.
   * Ce n'est pas une fonctionnalité qu'il pourrait acheter : c'est NOTRE
   * économie, elle ne lui sera jamais vendue. Une porte qu'aucune somme
   * n'ouvre n'a aucune raison d'être montrée.
   *
   * Mutation vérifiée : faire tomber la branche `requises.length === 0` vers
   * le cas « verrouillé » fait échouer ce test, et lui seul.
   */
  assert.equal(etatChemin("/payouts", GRATUIT, false, false).type, "masque");
  assert.equal(etatChemin("/offre", GRATUIT, false, false).type, "masque");
  // Un chemin non classé se masque aussi : le griser promettrait une
  // fonctionnalité qui n'existe pas.
  assert.equal(etatChemin("/chemin-qui-nexiste-pas", GRATUIT, false, false).type, "masque");
});

test("le maître et le mode solo voient tout, y compris ce qui est à nous", () => {
  assert.equal(etatChemin("/payouts", [], true, false).type, "ouvert");
  assert.equal(etatChemin("/campaigns", [], false, true).type, "ouvert");
});

test("⚠ l'offre qui ouvre une brique est CALCULÉE, et elle la contient vraiment", () => {
  /**
   * Une correspondance brique → offre tenue à la main devient fausse au
   * premier changement de grille, et elle devient fausse en SILENCE : le
   * bouton mènerait vers une offre qui n'ouvre plus ce qu'on vient de
   * promettre. On dérive donc de la grille.
   */
  const o = offrePourBrique("alpha-voice");
  assert.ok(o, "alpha-voice doit être vendable");
  assert.ok(o!.capacites.includes("alpha-voice"), "l'offre proposée doit VRAIMENT contenir la brique");

  for (const b of briquesPayantes()) {
    const offre = offrePourBrique(b.brique);
    assert.ok(offre, `${b.brique} : aucune offre ne l'ouvre — le verrou serait un cul-de-sac`);
    assert.ok(offre!.capacites.includes(b.brique), `${b.brique} : l'offre proposée ne la contient pas`);
  }
});

test("…et c'est la MOINS CHÈRE de celles qui la contiennent", () => {
  // Proposer l'offre à 590 € quand celle à 149 € ouvre la même brique, c'est
  // se faire refuser pour une raison qu'on a créée soi-même.
  for (const b of briquesPayantes()) {
    const choisie = offrePourBrique(b.brique);
    if (!choisie || choisie.prixHT === null) continue;
    for (const autre of OFFRES) {
      if (!autre.capacites.includes(b.brique) || autre.prixHT === null) continue;
      assert.ok(
        choisie.prixHT! <= autre.prixHT,
        `${b.brique} : on propose ${choisie.nom} (${choisie.prixHT} €) alors que ${autre.nom} (${autre.prixHT} €) l'ouvre aussi`
      );
    }
  }
});

test("⚠ chaque brique payante a une RAISON, et aucune n'est gratuite", () => {
  /**
   * Deux moitiés. La première : un verrou sans raison écrite se lit comme
   * une rançon sur une fonctionnalité retenue exprès. La seconde, plus
   * grave : une brique listée comme payante alors qu'elle est dans
   * `BRIQUES_GRATUITES` grillerait le gratuit — on ferait payer ce qu'on
   * annonce libre, et l'inscrit le découvrirait à l'usage.
   */
  for (const b of briquesPayantes()) {
    assert.ok(
      !BRIQUES_GRATUITES.includes(b.brique as never),
      `${b.brique} est gratuite : elle ne peut pas être verrouillée`
    );
    assert.ok(b.pourquoi.length > 40, `${b.brique} : raison trop courte pour expliquer quoi que ce soit`);
  }
  // Aucune brique gratuite ne doit avoir d'entrée dans la table des raisons.
  for (const g of BRIQUES_GRATUITES) {
    assert.equal(POURQUOI_PAYANT[g], undefined, `${g} est gratuite : elle n'a pas de raison d'être payante`);
  }
});

// ═══════════ « TU PEUX TE LE PAYER » ═══════════

const fiche = (id: string, stage: Prospect["stage"], mrr: number): Prospect =>
  ({ ...prospectDefaults, id, name: "X", company: "Y", stage, monthlyValue: mrr }) as Prospect;

test("⚠ ZÉRO DONNÉE → ZÉRO CHIFFRE. Jamais « 0 € signé »", () => {
  /**
   * Un `0 %` ou un `0 €` se lit comme un RÉSULTAT — un constat d'échec.
   * C'est un angle mort : l'inscrit n'a peut-être simplement rien saisi. La
   * règle du dépôt est de DIRE l'angle mort, pas de le chiffrer.
   */
  const r = signalAbonnement([], [], "alpha-voice");
  assert.equal(r.source, "aucune");
  assert.equal(r.mrrSigne, null, "un montant nul serait affiché comme un résultat");
  assert.equal(r.proposer, false);
  assert.equal(r.message, "");
});

test("des fiches signées SANS montant restent un angle mort", () => {
  // Le stade « signé » ne dit rien de ce que ça rapporte. Compter 0 €
  // reviendrait à affirmer qu'il n'a rien gagné, ce qu'on ne sait pas.
  const r = signalAbonnement([fiche("a", "signe", 0)], [], "alpha-voice");
  assert.equal(r.mrrSigne, null);
  assert.equal(r.proposer, false);
  assert.equal(r.fiches, 1, "on sait quand même combien de fiches on a regardées");
});

test("⚠ LES FICHES DE DÉMO NE COMPTENT PAS DANS SON REVENU", () => {
  /**
   * ⚠ Elles portent 0 € aujourd'hui (`lib/demo-icp.ts`), donc l'exclusion
   * paraît redondante. Elle ne l'est pas : le jour où quelqu'un leur remet
   * des montants « pour que la démo soit jolie », ce module se mettrait à
   * annoncer un revenu imaginaire — et la seule trace serait un bandeau qui
   * félicite l'inscrit pour de l'argent qu'il n'a pas.
   *
   * Mutation vérifiée : retirer `&& !isDemoProspect(p.id)` fait tomber ce
   * test.
   */
  const demo = fiche(`${PREFIXE_DEMO}x-1`, "signe", 5000);
  const r = signalAbonnement([demo], [], "alpha-voice");
  assert.equal(r.proposer, false, "une fiche inventée a déclenché une proposition d'abonnement");
  assert.equal(r.mrrSigne, null);
});

test("on propose quand le revenu SIGNÉ dépasse le seuil — et pas avant", () => {
  const prix = offrePourBrique("alpha-voice")!.prixHT!;

  // Juste en dessous : on se tait.
  const sous = signalAbonnement([fiche("a", "signe", prix * MULTIPLE_SEUIL - 1)], [], "alpha-voice");
  assert.equal(sous.proposer, false, "proposer trop tôt abîme le produit sans rien obtenir");
  assert.ok(sous.mrrSigne! > 0, "on connaît quand même son chiffre — on choisit de ne rien dire");

  // Au seuil : on parle.
  const ok = signalAbonnement([fiche("a", "signe", prix * MULTIPLE_SEUIL)], [], "alpha-voice");
  assert.equal(ok.proposer, true);
  assert.match(ok.message, /D'après tes fiches/, "le message doit dire d'où vient le chiffre");
  assert.match(ok.message, /%/, "…et rapporter le prix à ce qu'il gagne, sinon le montant seul ne dit rien");
});

test("⚠ on ne propose PAS ce que le compte possède déjà", () => {
  /**
   * C'est le signe le plus sûr qu'on ne regarde pas son compte — et c'est
   * exactement le genre de relance qui fait passer un produit pour un
   * publipostage.
   */
  const prix = offrePourBrique("alpha-voice")!.prixHT!;
  const r = signalAbonnement([fiche("a", "signe", prix * 100)], ["alpha-voice"], "alpha-voice");
  assert.equal(r.proposer, false);
  assert.equal(r.source, "aucune", "on ne calcule même pas : il n'y a rien à proposer");
});

test("seules les fiches SIGNÉES comptent — pas le pipe", () => {
  const prix = offrePourBrique("alpha-voice")!.prixHT!;
  const gros = [fiche("a", "offre", prix * 100), fiche("b", "redzone", prix * 100)];
  assert.equal(signalAbonnement(gros, [], "alpha-voice").proposer, false, "un pipe n'est pas un revenu");
});

// ═══════════ LE CÂBLAGE ═══════════

test("⚠ le rail GRISE au lieu de masquer — et l'ancienne fonction est morte", () => {
  /**
   * Le défaut récurrent du dépôt, dans les deux sens : brancher le nouveau,
   * et retirer l'ancien. `afficherChemin` répondait « faut-il montrer ? » et
   * masquait tout ; laissée en place, elle serait rebranchée par erreur et
   * remasquerait tout, sans que rien n'échoue.
   */
  const shell = readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8");
  assert.match(shell, /etatChemin\(/, "le rail doit consulter l'état de verrou");
  assert.match(shell, /verrou=\{verrouDe\(href\)\}/, "…et le transmettre à chaque entrée");

  const hook = readFileSync(join(process.cwd(), "lib/use-droits.ts"), "utf8");
  assert.doesNotMatch(hook, /export function afficherChemin/, "l'ancienne fonction de masquage doit être supprimée");
});

test("⚠ la page qui EXPLIQUE le verrou n'est pas derrière le verrou", () => {
  /**
   * La boucle parfaite qu'on évite : ne pouvoir apprendre pourquoi c'est
   * fermé qu'en l'ayant déjà acheté. Elle ne montre aucune donnée — un nom
   * de brique, une raison technique, un prix déjà public.
   */
  const acces = readFileSync(join(process.cwd(), "lib/bricks-access.ts"), "utf8");
  const communs = acces.slice(acces.indexOf("CHEMINS_COMMUNS"), acces.indexOf("ACCES_PAR_CHEMIN"));
  assert.match(communs, /"\/offre-brique"/, "/offre-brique doit être un chemin commun");
  assert.equal(etatChemin("/offre-brique", [], false, false).type, "ouvert");
});

test("⚠ une entrée verrouillée reste un LIEN, jamais un bouton désactivé", () => {
  /**
   * Un élément désactivé est le pire des deux mondes : la porte devient
   * visible ET impossible à interroger. Il sort en plus du parcours clavier
   * et des lecteurs d'écran, au moment précis où il a le plus à dire.
   */
  const shell = readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8");
  assert.match(shell, /\/offre-brique\?b=\$\{encodeURIComponent\(verrou\)\}/, "le verrou doit MENER à l'explication");
  assert.match(shell, /aria-label=\{verrou \?/, "l'état doit se dire au lecteur d'écran, pas se deviner à la couleur");
});

// ═══════════ SANS COMPTE — le premier écran d'un lancement ═══════════

test("⚠ SANS SESSION, LA RAISON N'EST PAS L'ARGENT — constaté en production", () => {
  /**
   * ⚠ CE TEST VIENT D'UNE CAPTURE D'ÉCRAN, PAS D'UNE RELECTURE.
   *
   * Le site était en ligne, l'adresse partagée à 400 personnes. Un visiteur
   * sans compte reçoit `DROIT_REFUSE` — donc `statut: "suspendu"` et zéro
   * brique, ce qui est CORRECT côté serveur (« pas de tenantId, pas de
   * session, pas de plancher gratuit »).
   *
   * Mais l'écran lisait ce discriminant interne comme une phrase adressée à
   * un humain, et affichait à un prospect qui venait d'arriver :
   *   · « Compte suspendu — l'accès revient dès la régularisation » ;
   *   · « Aucune brique active sur ce compte » ;
   *   · « /closer n'est pas inclus dans ton offre » — alors que `closer` est
   *     GRATUIT.
   *
   * Trois affirmations fausses, sur le premier écran d'un lancement, à
   * quelqu'un à qui on annonçait un impayé qu'il n'avait pas.
   *
   * La règle : sans compte, la marche suivante est l'INSCRIPTION GRATUITE,
   * jamais un abonnement. On ne demande pas d'argent avant d'avoir rendu un
   * service.
   */
  const e = etatChemin("/campaigns", [], false, false, false);
  assert.equal(e.type, "verrouille");
  if (e.type !== "verrouille") return;
  assert.match(e.pourquoi, /créer ton compte|gratuit/i, "la raison doit parler d'inscription, pas de minutes de téléphonie");
  assert.doesNotMatch(e.pourquoi, /téléphonie|jetons|facturé/i, "on n'explique pas un prix à quelqu'un qui n'a pas de compte");
  assert.equal(e.offreId, null, "aucune offre proposée : la marche suivante est gratuite");
});

test("⚠⚠ LA PHRASE SANS COMPTE NOMME TOUT LE SOCLE, PAS LA MOITIÉ", () => {
  /**
   * ⚠⚠ TROUVÉ EN VÉRIFIANT QUE `/overlay` S'OUVRE BIEN AU GRATUIT — il
   * s'ouvrait, et cette phrase-ci ne citait pas le copilote (12/09/2026).
   *
   * Elle énumérait quatre briques en dur : « Le CRM, le Closer OS, le Cerveau
   * et le pilotage s'ouvrent immédiatement. » Le socle en a gagné une
   * cinquième et la chaîne littérale n'a pas bougé — rien ne relie une phrase
   * à la liste qu'elle prétend décrire. Le visiteur sans compte lisait donc,
   * sur la porte même du copilote, que ce qui s'ouvre tout de suite est
   * autre chose : on lui cachait une brique qu'on lui donne.
   *
   * ⚠ Le test ne cherche AUCUNE phrase. Il exige que chaque brique gratuite
   * soit nommée par son libellé public dans la raison servie. Une réécriture
   * du style reste libre ; une énumération recopiée à la main retombe.
   */
  const e = etatChemin("/overlay", [], false, false, false);
  assert.equal(e.type, "verrouille", "/overlay doit être fermé à qui n'a PAS de compte");
  if (e.type !== "verrouille") return;

  for (const brique of BRIQUES_GRATUITES) {
    const label = SOCLE_GRATUIT.find((s) => s.id === brique)?.label;
    assert.ok(label, `${brique} est gratuite et n'a aucun libellé public — invisible sur la vitrine`);
    // Insensible à la casse : le libellé s'écrit « Le CRM » en tête de phrase
    // et « le CRM » au milieu, et c'est la seule différence permise.
    assert.match(
      e.pourquoi.toLowerCase(),
      new RegExp(label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `« ${label} » est gratuite et la phrase servie sans compte ne la nomme pas`
    );
  }
});

test("…et AVEC session, la raison redevient économique", () => {
  // Le contre-test, sans lequel le précédent passerait sur un module qui
  // ne dirait plus jamais pourquoi une brique se paie.
  const e = etatChemin("/campaigns", [...BRIQUES_GRATUITES], false, false, true);
  assert.equal(e.type, "verrouille");
  if (e.type !== "verrouille") return;
  assert.match(e.pourquoi, /domaine|réputation/i, "un compte connecté a droit à la vraie raison");
  assert.ok(e.offreId, "…et à la porte d'achat");
});

test("le défaut de `session` est OUVERT, pas fermé", () => {
  /**
   * Un défaut à `false` ferait annoncer « inscris-toi » à des comptes
   * parfaitement connectés dont l'appelant n'a simplement pas transmis
   * l'information — c'est-à-dire transformer un oubli de câblage en message
   * absurde servi à des clients payants.
   */
  const e = etatChemin("/campaigns", [...BRIQUES_GRATUITES], false, false);
  assert.equal(e.type, "verrouille");
  if (e.type !== "verrouille") return;
  assert.match(e.pourquoi, /domaine|réputation/i);
});

test("⚠ « compte suspendu » ne s'affiche PLUS à qui n'a jamais eu de compte", () => {
  /**
   * Le composant lisait `d.statut === "suspendu"` seul. Il doit lire la
   * session AUSSI — sinon la phrase la plus décourageante du produit
   * s'adresse à des inconnus.
   */
  const src = readFileSync(join(process.cwd(), "components/billing/mon-offre.tsx"), "utf8");
  assert.match(src, /d\.session && d\.statut === "suspendu"/, "le statut suspendu exige une session réelle");
  assert.match(src, /\{!d\.session &&/, "…et l'absence de session doit avoir son propre message");
  assert.match(src, /!d\.maitre && d\.session && manquantes\.length > 0/, "on ne vend rien à qui n'a pas de compte");
});

test("⚠ la distinction descend bien du SERVEUR — sinon l'écran la devine", () => {
  /**
   * `session` ne peut pas se déduire côté client : le JWT vit dans un cookie
   * que la page ne lit pas de façon fiable, et un écran qui « suppose » une
   * session finirait par en supposer une là où il n'y en a pas. La route la
   * calcule à partir de `tenantId`, qui est la seule preuve.
   */
  const route = readFileSync(join(process.cwd(), "app/api/compte/droits/route.ts"), "utf8");
  assert.match(route, /session: Boolean\(d\.tenantId\)/, "la session se déduit du locataire, jamais d'autre chose");

  const shell = readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8");
  assert.match(shell, /droits\.solo, droits\.session\)/, "le rail doit transmettre la session au calcul de verrou");
});
