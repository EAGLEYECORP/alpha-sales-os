import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { LINKEDIN_DAILY_SAFE, LINKEDIN_INVITE_LIMIT, linkedinTouchesToday, linkedinUrl } from "../lib/linkedin";
import { buildLinkedinQueue, inviteText, relanceText } from "../lib/linkedin-sequence";
import {
  EFFECTIF_MAX, PRESENCE_LINKEDIN, SCORE_MIN, detecterRole, qualifier, trierLot,
  type ProfilLinkedin,
} from "../lib/linkedin-ciblage";
import {
  EN_ATTENTE_MAX, LINKEDIN_WEEKLY_LIMIT, RETRAIT_APRES_JOURS, entonnoir, hygieneInvitations,
  plafondSemaine, planifierCampagne, quotaDuJour,
} from "../lib/linkedin-plan";
import { ENTETE_MODELE, importerProfils, parserProfils } from "../lib/linkedin-import";
import { verticalForProspect } from "../lib/playbook";
import { prospect as makeProspect } from "./fixtures";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LINKEDIN — le canal où l'erreur coûte le compte, pas un email.
 *
 * Ces modules écrivent des messages envoyés sous le nom de Zakaria, à des
 * inconnus, depuis un profil qui ne se remplace pas. Ils n'avaient AUCUN test.
 *
 * Trois choses sont protégées ici :
 *  · la limite de 300 caractères, qui est une limite DURE de la plateforme ;
 *  · les plafonds d'envoi, parce qu'un garde-fou qui autorise ce que LinkedIn
 *    refuse ne protège de rien ;
 *  · le refus d'inventer un taux de conversion tant qu'aucune campagne n'a
 *    tourné.
 * ─────────────────────────────────────────────────────────────────────
 */

const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const profil = (over: Partial<ProfilLinkedin> = {}): ProfilLinkedin => ({
  nom: "Claire Berthier",
  titre: "Gérante",
  entreprise: "Agence Berthier Immobilier",
  ville: "Lyon 6e",
  url: "https://www.linkedin.com/in/claire-berthier",
  taille: "11-50 employés",
  ...over,
});

// ── LA LIMITE DURE DE LA PLATEFORME ────────────────────────────────────

test("invitation — jamais au-dessus de 300 caractères, quel que soit le prospect", () => {
  /**
   * LinkedIn tronque, il ne prévient pas. Un message coupé au milieu d'une
   * phrase est pire qu'un message court : il donne l'air d'un envoi en masse
   * mal configuré, ce qui est exactement l'impression à éviter.
   */
  const cas = [
    makeProspect({ name: "Jean-Baptiste de la Rochefoucauld-Montmorency", company: "A".repeat(120), city: "Villefranche-sur-Saône" }),
    makeProspect({ name: "", company: "", city: "" }),
    makeProspect({ name: "Léa", company: "Garage des Brotteaux", city: "Lyon 6e", notes: "carrosserie" }),
  ];
  for (const p of cas) {
    const t = inviteText(p);
    assert.ok(t.length <= LINKEDIN_INVITE_LIMIT, `invitation de ${t.length} caractères pour « ${p.company} »`);
    assert.ok(t.trim().length > 0, "invitation vide");
  }
});

test("séquence — aucun message ne s'envoie à une fiche signée ou perdue", () => {
  // Relancer un client signé sur une séquence de prospection froide est le
  // genre de détail qui coûte la recommandation.
  const q = buildLinkedinQueue([
    makeProspect({ id: "a", company: "Actif", stage: "prospect" }),
    makeProspect({ id: "b", company: "Signé", stage: "signe" }),
    makeProspect({ id: "c", company: "Perdu", stage: "perdu" }),
  ]);
  assert.deepEqual(q.map((t) => t.prospect.id), ["a"]);
});

test("séquence — la relance ne culpabilise pas et ferme la porte proprement", () => {
  /**
   * Doctrine MASTER RAPPEL : jamais « je me permets de relancer ». Le silence
   * s'assume, et la dernière touche annonce qu'il n'y en aura pas d'autre —
   * c'est ce qui laisse la porte ouverte pour de vrai.
   */
  const t = relanceText(makeProspect({ name: "Claire", company: "Agence B" }));
  assert.doesNotMatch(t, /je me permets|sans réponse de votre part|je reviens vers vous une dernière/i);
  assert.match(t, /ne relancerai pas/i);
});

test("URL — sans profil en fiche, on tombe sur une recherche, jamais sur une page morte", () => {
  const avec = linkedinUrl(makeProspect({ linkedin: "linkedin.com/in/claire" }));
  assert.equal(avec, "https://linkedin.com/in/claire", "le protocole est ajouté, l'URL n'est pas inventée");
  const sans = linkedinUrl(makeProspect({ name: "Claire B", company: "Agence B", city: "Lyon" }));
  assert.match(sans, /\/search\/results\/people\/\?keywords=/);
});

// ── LES PLAFONDS ───────────────────────────────────────────────────────

test("plafond — le quota JOURNALIER seul laissait dépasser la limite hebdomadaire", () => {
  /**
   * C'est le défaut que ce module corrige, et il vaut d'être figé : cinq jours
   * à 25 invitations font 125, soit plus que le plafond hebdomadaire. L'app
   * affichait « quota OK » pendant que LinkedIn bloquait déjà.
   */
  assert.ok(
    LINKEDIN_DAILY_SAFE * 5 > LINKEDIN_WEEKLY_LIMIT,
    "si cette inégalité tombe, le garde-fou hebdomadaire n'a plus de raison d'être — vérifier avant de le retirer"
  );

  const q = quotaDuJour({ envoyeesSemaine: LINKEDIN_WEEKLY_LIMIT, envoyeesAujourdhui: 0, semaineCampagne: 9 });
  assert.equal(q.reste, 0, "le plafond hebdomadaire doit mordre même si la journée est vierge");
  assert.equal(q.contrainte, "semaine");
});

test("plafond — la contrainte qui mord est NOMMÉE", () => {
  /**
   * « Quota atteint » sans raison pousse à passer outre. Dire laquelle des
   * trois limites bloque, et de combien, se respecte.
   */
  const jour = quotaDuJour({ envoyeesSemaine: 0, envoyeesAujourdhui: LINKEDIN_DAILY_SAFE, semaineCampagne: 9 });
  assert.equal(jour.contrainte, "jour");
  assert.equal(jour.reste, 0);

  const rampe = quotaDuJour({ envoyeesSemaine: 0, envoyeesAujourdhui: 0, semaineCampagne: 0 });
  assert.equal(rampe.contrainte, "rampe", "en semaine 1, c'est la montée en charge qui commande");
  assert.ok(rampe.message.includes(String(plafondSemaine(0))));
});

test("plafond — la rampe monte, et ne redescend jamais sous le premier palier", () => {
  // Passer de 0 à 25/jour d'un coup est le déclencheur classique de la
  // restriction : c'est le changement de rythme qui se voit, pas le volume.
  assert.ok(plafondSemaine(0) < plafondSemaine(1), "la rampe doit monter");
  assert.equal(plafondSemaine(99), LINKEDIN_WEEKLY_LIMIT, "elle plafonne à la limite de la plateforme");
  assert.equal(plafondSemaine(-3), plafondSemaine(0), "un numéro de semaine absurde ne débride rien");
  for (let s = 0; s < 12; s++) {
    assert.ok(plafondSemaine(s) <= LINKEDIN_WEEKLY_LIMIT, `semaine ${s} dépasse la limite`);
  }
});

test("plafond — une file d'attente saturée passe avant tout le reste", () => {
  /**
   * Continuer à inviter pendant que 200 invitations dorment fait baisser le
   * taux d'acceptation, c'est-à-dire le seul chiffre qui protège le compte.
   */
  const q = quotaDuJour({ envoyeesSemaine: 0, envoyeesAujourdhui: 0, semaineCampagne: 9, enAttente: EN_ATTENTE_MAX });
  assert.equal(q.reste, 0);
  assert.equal(q.contrainte, "en-attente");
  assert.match(q.message, /taux d'acceptation/i);
});

// ── LE PLAN ────────────────────────────────────────────────────────────

test("plan — « 200 personnes » est un calendrier de plusieurs semaines, pas une matinée", () => {
  /**
   * C'est tout l'intérêt du module : tant que le nombre est un vœu, il paraît
   * faisable en une session. Vu comme des dates, il se décide autrement.
   */
  const plan = planifierCampagne(200, { depart: new Date("2026-09-07T09:00:00Z") }); // un lundi
  assert.equal(plan.cibles, 200);
  assert.ok(plan.semaines >= 3, `200 invitations planifiées sur ${plan.semaines} semaine(s) seulement`);
  assert.ok(plan.alertes.some((a) => /semaine/i.test(a)), "le plan doit dire que LinkedIn compte à la semaine");
  assert.ok(plan.finLe, "un plan sans date de fin n'est pas un plan");
});

test("plan — aucun envoi le week-end, aucun jour au-dessus du quota", () => {
  const plan = planifierCampagne(200, { depart: new Date("2026-09-07T09:00:00Z") });
  for (const j of plan.jours) {
    const d = new Date(`${j.date}T12:00:00Z`).getUTCDay();
    assert.ok(d >= 1 && d <= 5, `${j.date} tombe un week-end`);
    assert.ok(j.invitations <= LINKEDIN_DAILY_SAFE, `${j.date} : ${j.invitations} invitations`);
    assert.ok(j.invitations > 0, `${j.date} : jour vide dans le plan`);
  }
  // Le total planifié couvre bien la demande.
  assert.equal(plan.jours.reduce((s, j) => s + j.invitations, 0), 200);
});

test("plan — aucune semaine ne dépasse son plafond", () => {
  const plan = planifierCampagne(300, { depart: new Date("2026-09-07T09:00:00Z") });
  const parSemaine = new Map<number, number>();
  for (const j of plan.jours) parSemaine.set(j.semaine, (parSemaine.get(j.semaine) ?? 0) + j.invitations);
  for (const [s, n] of parSemaine) {
    assert.ok(n <= plafondSemaine(s), `semaine ${s} : ${n} invitations pour un plafond de ${plafondSemaine(s)}`);
  }
});

test("plan — zéro cible ne produit pas un plan fantôme", () => {
  const plan = planifierCampagne(0);
  assert.deepEqual(plan.jours, []);
  assert.equal(plan.finLe, null);
  assert.equal(plan.semaines, 0);
});

test("plan — un lot ingérable le dit, au lieu de s'étaler indéfiniment", () => {
  // Une campagne qui déborde d'un trimestre n'est pas un plan : c'est le
  // constat que le canal ne suffit pas.
  const plan = planifierCampagne(5000, { depart: new Date("2026-09-07T09:00:00Z") });
  assert.ok(plan.alertes.some((a) => /trop gros|autre canal/i.test(a)));
});

// ── L'HYGIÈNE ──────────────────────────────────────────────────────────

test("hygiène — on retire le vieux, jamais le récent", () => {
  /**
   * Une invitation retirée ne peut pas être renvoyée avant ~3 semaines : le
   * nettoyage n'est pas gratuit. On ne touche donc pas à ce qui peut encore
   * être accepté.
   */
  const now = new Date("2026-09-30T10:00:00Z");
  const vieux = new Date(now.getTime() - (RETRAIT_APRES_JOURS + 2) * 86_400_000).toISOString();
  const recent = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const h = hygieneInvitations([{ id: "a", envoyeeLe: vieux }, { id: "b", envoyeeLe: recent }], now);
  assert.deepEqual(h.aRetirer.map((i) => i.id), ["a"]);
  assert.match(h.message, /3 semaines/i, "le coût du retrait doit être dit");
});

test("hygiène — une file pleine mais récente demande de RALENTIR, pas de nettoyer", () => {
  const now = new Date("2026-09-30T10:00:00Z");
  const pending = Array.from({ length: EN_ATTENTE_MAX }, (_, i) => ({
    id: String(i),
    envoyeeLe: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
  }));
  const h = hygieneInvitations(pending, now);
  assert.equal(h.aRetirer.length, 0);
  assert.match(h.message, /ralentir/i);
});

// ── LE REFUS D'INVENTER ────────────────────────────────────────────────

test("entonnoir — sans campagne mesurée, AUCUN taux n'est affiché", () => {
  /**
   * « 30 % d'acceptation, 10 % de réponse » traîne partout et a l'air
   * sérieux. Ces chiffres ne viennent d'aucune campagne de cette maison, sur
   * aucune de ces verticales, avec ce message. Affichés, ils deviennent la
   * base d'une décision.
   */
  const e = entonnoir(200);
  assert.equal(e.source, "aucune");
  assert.equal(e.acceptations, 0);
  assert.equal(e.reponses, 0);
  assert.doesNotMatch(e.note, /\d+\s?%/, "aucun pourcentage ne doit apparaître sans mesure");
});

test("entonnoir — avec des taux mesurés, la projection est calculée et sourcée", () => {
  const e = entonnoir(100, { tauxAcceptation: 0.3, tauxReponse: 0.2 });
  assert.equal(e.source, "mesure");
  assert.equal(e.acceptations, 30);
  assert.equal(e.reponses, 6);
  // Un taux aberrant ne produit pas un chiffre aberrant.
  assert.equal(entonnoir(100, { tauxAcceptation: 4, tauxReponse: -1 }).acceptations, 100);
  assert.equal(entonnoir(100, { tauxAcceptation: Number.NaN, tauxReponse: 0.5 }).acceptations, 0);
});

// ── LE CIBLAGE ─────────────────────────────────────────────────────────

test("ciblage — un décideur d'une verticale connue est retenu", () => {
  const c = qualifier(profil());
  assert.equal(c.retenu, true);
  assert.equal(c.role, "decideur");
  assert.equal(c.verticaleId, "immobilier");
  assert.ok(c.pourquoi.length >= 2, "un profil retenu doit dire POURQUOI, fait par fait");
});

test("ciblage — un exécutant n'use pas une invitation", () => {
  /**
   * L'invitation est un budget plafonné à la semaine. Celle dépensée sur un
   * apprenti est celle qui n'ira pas au gérant du garage d'à côté.
   */
  const c = qualifier(profil({ titre: "Apprenti mécanicien", entreprise: "Garage Central" }));
  assert.equal(c.retenu, false);
  assert.equal(c.role, "operationnel");
  assert.ok(c.risques.some((r) => /tranche/i.test(r)));
});

test("ciblage — « responsable » et « chargé de » ne sont PAS des décideurs", () => {
  // Les inclure ferait passer presque tout le monde, c'est-à-dire ne
  // filtrerait plus rien.
  assert.notEqual(detecterRole("Responsable commercial"), "decideur");
  assert.notEqual(detecterRole("Chargé de développement"), "decideur");
  assert.equal(detecterRole("Gérant & technicien"), "decideur", "le décideur l'emporte sur le second titre");
  assert.equal(detecterRole(""), "inconnu");
  assert.equal(detecterRole(undefined), "inconnu");
});

test("ciblage — un grand compte est écarté : la doctrine ne s'y applique pas", () => {
  /**
   * Tout le playbook vise « le patron est sur le terrain ». Dans une boîte de
   * 250 personnes il y a un standard, un service informatique et un processus
   * d'achat : la douleur vendue n'existe pas.
   */
  const c = qualifier(profil({ taille: "1001-5000 employés" }));
  assert.equal(c.retenu, false);
  assert.ok(c.risques.some((r) => new RegExp(String(EFFECTIF_MAX)).test(r)));
});

test("ciblage — un concurrent est écarté, même parfaitement qualifié par ailleurs", () => {
  const c = qualifier(profil({ titre: "Fondateur", entreprise: "Agence digitale Pixel", secteur: "agence de communication" }));
  assert.equal(c.retenu, false, "on ne dépense pas une invitation à vendre à un vendeur");
});

test("ciblage — un profil sans nom ni URL n'est pas contactable, donc pas retenu", () => {
  const c = qualifier(profil({ nom: "", url: "" }));
  assert.equal(c.retenu, false);
  // C'est une EXCLUSION, pas une lacune : un profil sans point de contact ne
  // se rattrape pas en allant chercher l'information ailleurs.
  assert.ok(c.risques.some((r) => /ne se contacte pas/i.test(r)));
  assert.ok(c.score >= 0);
});

test("ciblage — ce qui MANQUE est listé : un profil pauvre n'est pas un mauvais profil", () => {
  const c = qualifier({ nom: "Inconnu", url: "https://www.linkedin.com/in/x" });
  assert.ok(c.manque.length >= 3, "il faut savoir quoi aller chercher avant de trancher");
  assert.deepEqual(c.risques, [], "manquer d'information n'est pas un risque, c'est une lacune");
});

test("ciblage — le lot dit la friction du canal, pas seulement un compte", () => {
  /**
   * L'aveu le plus utile de tout le module : les métiers du playbook
   * (couvreurs, garagistes, restaurateurs) sont à peine présents sur LinkedIn.
   * C'est la douleur qu'on leur vend — « vous êtes sur le terrain, pas devant
   * un écran » — et elle vaut aussi pour ce canal.
   */
  const lot = trierLot([
    profil(),
    profil({ nom: "P. Roux", titre: "Gérant", entreprise: "Couverture Roux", url: "https://linkedin.com/in/roux" }),
    profil({ titre: "Stagiaire" }),
  ]);
  assert.equal(lot.retenus.length + lot.ecartes.length, 3);
  assert.ok(lot.resume.some((r) => /peu présentes sur LinkedIn/i.test(r)));
  // La file est ordonnée : le meilleur score en premier.
  for (let i = 1; i < lot.retenus.length; i++) {
    assert.ok(lot.retenus[i - 1].ciblage.score >= lot.retenus[i].ciblage.score);
  }
});

test("ciblage — toute verticale du playbook a une présence LinkedIn documentée", () => {
  // Une verticale ajoutée sans cette information rendrait le tri muet là où il
  // est le plus utile.
  const src = readFileSync(join(process.cwd(), "lib/playbook.ts"), "utf8");
  const ids = [...src.matchAll(/^\s{4}id: "([a-z0-9-]+)",$/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 7, `seulement ${ids.length} verticales trouvées — le balayage est cassé`);
  for (const id of ids) {
    assert.ok(PRESENCE_LINKEDIN[id], `verticale « ${id} » sans présence LinkedIn documentée`);
  }
});

// ── L'INVARIANT DE FOND ────────────────────────────────────────────────

test("LinkedIn — aucun module ne pilote un navigateur ni ne détient d'identifiants", () => {
  /**
   * La décision d'architecture, et la seule qui compte ici : PAS de bot qui se
   * connecte avec les identifiants de Zakaria. LinkedIn détecte et restreint
   * ces comptes, et son profil est un actif commercial irremplaçable — avec un
   * premier client au bout. L'app prépare, l'humain colle et envoie.
   *
   * Ce test existe parce que la tentation reviendra le jour où la file
   * paraîtra longue.
   */
  for (const f of ["lib/linkedin.ts", "lib/linkedin-sequence.ts", "lib/linkedin-plan.ts", "lib/linkedin-ciblage.ts"]) {
    const src = sansCommentaires(readFileSync(join(process.cwd(), f), "utf8"));
    for (const re of [
      /puppeteer|playwright|selenium|webdriver/i,
      /li_at|JSESSIONID|csrf-token/i,
      /voyager\/api|linkedin\.com\/voyager/i,
      /password|motDePasse|identifiants/i,
    ]) {
      assert.doesNotMatch(src, re, `${f} : automatisation ou identifiants LinkedIn (${re})`);
    }
  }
});

test("LinkedIn — les touches du jour se comptent sur la vraie date", () => {
  const p = makeProspect({
    events: [
      { id: "e1", date: new Date().toISOString(), kind: "linkedin", summary: "invitation" },
      { id: "e2", date: "2020-01-01T10:00:00.000Z", kind: "linkedin", summary: "vieille touche" },
      { id: "e3", date: new Date().toISOString(), kind: "appel", summary: "appel" },
    ],
  });
  assert.equal(linkedinTouchesToday([p]), 1);
});

// ── L'ENTRÉE DES PROFILS SOURCÉS ───────────────────────────────────────

test("import — les trois formats qui arrivent réellement sont lus", () => {
  /**
   * Un tableau JSON (sortie d'outil), du JSONL (une ligne = un objet, ce que
   * crache un outil en flux) et du CSV/TSV avec en-tête (export de tableur,
   * copier-coller). Deviner le format en silence trompe : il est rendu.
   */
  const json = parserProfils('[{"name":"Claire","title":"Gérante","company":"Régie B"}]');
  assert.equal(json.format, "json");
  assert.equal(json.profils[0].nom, "Claire");
  assert.equal(json.profils[0].titre, "Gérante");

  const jsonl = parserProfils('{"nom":"A","entreprise":"X"}\n{"nom":"B","entreprise":"Y"}');
  assert.equal(jsonl.profils.length, 2, "le JSONL échoue sur un JSON.parse global");

  const tsv = parserProfils("nom\ttitre\tentreprise\nClaire\tGérante\tRégie B");
  assert.equal(tsv.format, "csv");
  assert.equal(tsv.profils[0].entreprise, "Régie B");
});

test("import — un en-tête illisible le DIT, au lieu de rendre un lot vide", () => {
  // « 0 profil importé » sans raison fait conclure que la source est mauvaise,
  // alors que c'est le nom d'une colonne qui ne correspond pas.
  const r = parserProfils("colonne1;colonne2\na;b");
  assert.deepEqual(r.profils, []);
  assert.equal(r.rejets.length, 1);
  assert.match(r.rejets[0].raison, /aucune colonne reconnue/i);
  assert.ok(r.avertissements.some((a) => /nom|titre|entreprise/.test(a)), "il faut donner les noms attendus");
});

test("import — les guillemets protègent le séparateur", () => {
  const r = parserProfils('nom;entreprise\n"Roux, Paul";"Couverture Roux; et fils"');
  assert.equal(r.profils[0].nom, "Roux, Paul");
  assert.equal(r.profils[0].entreprise, "Couverture Roux; et fils");
});

test("import — les colonnes ignorées remontent dès la première tentative", () => {
  const r = parserProfils("nom;entreprise;lubie\nA;X;z");
  assert.ok(r.avertissements.some((a) => /lubie/.test(a)), "un intégrateur doit l'apprendre tout de suite");
});

test("import — le métier atterrit dans les NOTES, pas dans un enum à cinq valeurs", () => {
  /**
   * « gérant de régie immobilière » n'entre pas dans `Sector`. Sans ce
   * détour par les notes, la fiche tomberait dans « autre » et perdrait sa
   * verticale — c'est `verticalForProspect` qui lit les notes.
   */
  const r = importerProfils(`${ENTETE_MODELE}\nClaire;Gérante;Régie B;Lyon 6e;linkedin.com/in/c;immobilier;11-50`);
  assert.equal(r.retenus.length, 1);
  const p = r.retenus[0].prospect;
  assert.match(p.notes, /immobilier/i);
  assert.equal(verticalForProspect(p)?.id, "immobilier", "la verticale doit survivre à l'import");
});

test("import — une fiche entrée par ce canal reste au DÉBUT du pipeline", () => {
  // Un profil relevé sur une page publique n'a rien demandé. L'avancer ferait
  // mentir toutes les prévisions qui s'appuient sur le stade.
  const r = importerProfils(`${ENTETE_MODELE}\nClaire;Gérante;Régie B;Lyon 6e;linkedin.com/in/c;immobilier;11-50`);
  assert.equal(r.retenus[0].prospect.stage, "prospect");
  assert.equal(r.retenus[0].prospect.preferredChannel, "linkedin");
});

test("import — réimporter le même lot ne crée pas un second contact", () => {
  /**
   * L'identifiant est stable sur l'URL du profil. Un doublon sur ce canal
   * n'est pas une ligne en trop dans un tableau : c'est une DEUXIÈME
   * invitation envoyée à la même personne.
   */
  const ligne = `${ENTETE_MODELE}\nClaire;Gérante;Régie B;Lyon 6e;linkedin.com/in/claire;immobilier;11-50`;
  const a = importerProfils(ligne).retenus[0].prospect.id;
  const b = importerProfils(ligne).retenus[0].prospect.id;
  assert.equal(a, b);
  assert.ok(a.startsWith("li-"), "l'origine du contact doit rester lisible dans l'identifiant");
});

test("import — les écartés remontent AVEC leur raison", () => {
  /**
   * Un tri dont on ne voit pas les refus ne se corrige jamais — et c'est là
   * qu'on découvre que la colonne « titre » était mal nommée dans l'export.
   */
  const r = importerProfils(
    `${ENTETE_MODELE}\n` +
      `Claire;Gérante;Régie B;Lyon 6e;linkedin.com/in/c;immobilier;11-50\n` +
      `Paul;Apprenti;Couverture Roux;Lyon 7e;linkedin.com/in/p;couverture;3`
  );
  assert.equal(r.retenus.length, 1);
  assert.equal(r.ecartes.length, 1);
  assert.ok(r.ecartes[0].ciblage.risques.length > 0, "un écarté sans raison est un refus opaque");
});

test("import — le lot vide ne produit ni fiche ni faux diagnostic", () => {
  const r = importerProfils("   ");
  assert.equal(r.parse.format, "aucun");
  assert.deepEqual(r.retenus, []);
  assert.deepEqual(r.parse.rejets, []);
});

test("import — les réserves du ciblage suivent la fiche", () => {
  // Sans ça, personne ne se souvient dans trois semaines pourquoi ce profil
  // était limite au moment de l'inviter.
  const r = importerProfils(
    `${ENTETE_MODELE}\nJean;Gérant;Couverture Roux;Lyon 7e;linkedin.com/in/j;couverture;5`
  );
  assert.equal(r.retenus.length, 1);
  assert.match(r.retenus[0].prospect.notes, /Réserves au ciblage/);
  assert.match(r.retenus[0].prospect.notes, /peu présent sur LinkedIn/i);
});

test("import — le module ne va RIEN chercher : il reçoit du texte", () => {
  /**
   * La collecte reste dehors, remplaçable, et aucune dépendance de scraping
   * n'entre dans le produit vendu. Un `fetch` ici serait le début d'un
   * collecteur embarqué — et la fin de cette garantie.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/linkedin-import.ts"), "utf8"));
  for (const re of [/\bfetch\s*\(/, /axios|got\(|https?\.request/, /puppeteer|playwright/]) {
    assert.doesNotMatch(src, re, `lib/linkedin-import.ts effectue une collecte (${re})`);
  }
});

test("sourcing — le dépôt n'adopte jamais le backend qui se connecte AVEC ton compte", () => {
  /**
   * `mcp-server-linkedin` demande `uvx mcp-server-linkedin@latest --login` :
   * ce `--login`, c'est la session LinkedIn de Zakaria. Chaque requête est
   * ensuite faite EN SON NOM par un navigateur automatisé — le mécanisme
   * exact qui fait restreindre les comptes.
   *
   * Ce test balaie la configuration et l'outillage, là où la ligne
   * s'ajouterait le jour où le confort l'emportera. La documentation, elle, a
   * le droit d'en parler : c'est là qu'on explique pourquoi on n'en veut pas.
   */
  const zones = ["package.json", "scripts", ".claude", "lib", "app", "components"];
  const suspects: string[] = [];
  const visiter = (rel: string) => {
    const abs = join(process.cwd(), rel);
    let stat;
    try { stat = statSync(abs); } catch { return; }
    if (stat.isDirectory()) {
      for (const e of readdirSync(abs)) visiter(join(rel, e));
      return;
    }
    if (!/\.(ts|tsx|json|mjs|js|ya?ml|sh)$/.test(rel)) return;
    const src = readFileSync(abs, "utf8");
    if (/mcp-server-linkedin|linkedin-scraper|li_at|--login\s+.*linkedin/i.test(src)) suspects.push(rel);
  };
  zones.forEach(visiter);
  assert.deepEqual(suspects, [], `automatisation LinkedIn par session adoptée dans : ${suspects.join(", ")}`);
});
