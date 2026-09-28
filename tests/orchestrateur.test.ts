import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { autoriserApi, lireCles, PORTEES } from "../lib/api-keys";
import {
  aTrancher, EXPIRATION_HEURES, peutApprouver, resumeFile, statutReel,
  TYPES_PROPOSITION, validerProposition, type Proposition,
} from "../lib/propositions";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ORCHESTRATEUR — il voit tout, il ne peut rien casser.
 *
 * Un agent qui surveille un pipe RÉEL, avec un client qui paie au bout, doit
 * pouvoir se tromper sans que ça coûte le client. Tout le dispositif tient sur
 * une asymétrie : lecture large, écriture réduite à « déposer une proposition
 * qu'un humain tranchera ».
 *
 * Ces tests protègent l'asymétrie. Elle se perdrait en une ligne de diff.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les COMMENTAIRES sont retirés avant toute analyse de contenu.
 *
 * Sans ça, le commentaire qui explique « ne jamais ajouter un paramètre
 * `executer` » déclenche le test qui interdit `executer`. C'est arrivé trois
 * fois dans ce dépôt, sur trois fichiers différents — et la « correction »
 * naturelle est de supprimer l'explication pour faire taire le test, c'est-à-
 * dire exactement l'inverse du but.
 */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const prop = (over: Partial<Proposition> = {}): Proposition => ({
  id: "p1",
  type: "email",
  auteur: "orchestrateur",
  createdAt: new Date().toISOString(),
  titre: "Relancer Carrosserie des Lilas",
  pourquoi: "Aucun contact depuis 19 jours, et le next step du 3/08 est passé sans rien.",
  contenu: "Bonjour, je reviens vers vous après notre échange du 3 août au sujet des appels manqués…",
  statut: "en-attente",
  ...over,
});

// ── LES CLÉS ET LEURS PORTÉES ──────────────────────────────────────────

test("clés — sans configuration, l'API est FERMÉE", () => {
  // Une API d'écriture ouverte par défaut est une faute. On refuse, et on dit
  // pourquoi : sinon l'intégrateur cherche du côté de sa clé.
  const avant = process.env.ALPHA_API_KEYS;
  try {
    delete process.env.ALPHA_API_KEYS;
    const v = autoriserApi("Bearer nimporte", "etat.read");
    assert.equal(v.ok, false);
    assert.equal(v.ok === false && v.statut, 401);
    assert.match(v.ok === false ? v.pourquoi : "", /Aucune clé configurée/);
  } finally {
    process.env.ALPHA_API_KEYS = avant;
  }
});

test("clés — une clé sans la portée est refusée en 403, pas en 401", () => {
  /**
   * Deux refus différents appellent deux corrections différentes. Confondre
   * « ta clé est fausse » et « ta clé n'a pas ce droit » fait perdre une heure.
   */
  const avant = process.env.ALPHA_API_KEYS;
  try {
    process.env.ALPHA_API_KEYS = "n8n-client:client-couvreur:prospects.write:sk_test_abc";
    const ok = autoriserApi("Bearer sk_test_abc", "prospects.write");
    assert.equal(ok.ok, true);

    const refus = autoriserApi("Bearer sk_test_abc", "propositions.write");
    assert.equal(refus.ok, false);
    assert.equal(refus.ok === false && refus.statut, 403);
    assert.match(refus.ok === false ? refus.pourquoi : "", /n8n-client/, "le message nomme la clé");
    assert.match(refus.ok === false ? refus.pourquoi : "", /propositions\.write/, "et la portée manquante");
  } finally {
    process.env.ALPHA_API_KEYS = avant;
  }
});

test("clés — l'ancien format garde tous ses droits (pas de rupture)", () => {
  // Casser les intégrations existantes pour un refactor serait un mauvais
  // échange : une clé nue reste une clé opérateur complète.
  const avant = process.env.ALPHA_API_KEYS;
  try {
    process.env.ALPHA_API_KEYS = "cle_historique_sans_format";
    for (const p of PORTEES) {
      assert.equal(autoriserApi("Bearer cle_historique_sans_format", p).ok, true, p);
    }
  } finally {
    process.env.ALPHA_API_KEYS = avant;
  }
});

test("clés — une entrée mal formée est IGNORÉE, jamais devinée", () => {
  // Deviner ce qu'un administrateur voulait dire, c'est accorder un droit
  // qu'il n'a pas écrit.
  assert.deepEqual(lireCles("nom:proprio:trop:de:champs:ici"), []);
  assert.deepEqual(lireCles("nom::etat.read:secret"), [], "propriétaire vide = ignorée");
  // Une portée inconnue n'accorde rien, mais la clé existe (diagnosticable).
  const c = lireCles("n:p:portee.inventee:s");
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].portees, []);
});

// ── LA VALIDATION D'UNE PROPOSITION ────────────────────────────────────

test("proposition — une justification vague est refusée", () => {
  /**
   * Le seuil sur « pourquoi » n'est pas cosmétique : une file qu'on ne peut
   * pas trancher au vol ne sera pas traitée du tout, et une proposition sans
   * raison vérifiable ne s'approuve pas — elle se subit.
   */
  const err = validerProposition({ ...prop(), pourquoi: "à relancer" });
  assert.ok(err.some((e) => e.champ === "pourquoi"));
  assert.deepEqual(validerProposition(prop()), []);
});

test("proposition — un email sans texte exact est refusé", () => {
  // Approuver une intention revient à envoyer un texte que personne n'a lu.
  const err = validerProposition({ ...prop(), contenu: "" });
  assert.ok(err.some((e) => e.champ === "contenu"));
  // Une alerte, elle, n'a rien à exécuter : pas de contenu exigé.
  assert.deepEqual(validerProposition({ ...prop(), type: "alerte", contenu: undefined }), []);
});

test("proposition — le type est une liste FERMÉE", () => {
  // Un type ouvert ferait de l'agent le concepteur de ses propres pouvoirs.
  const err = validerProposition({ ...prop(), type: "supprimer-tout" as never });
  assert.ok(err.some((e) => e.champ === "type"));
  assert.ok(TYPES_PROPOSITION.length <= 8, "la liste doit rester courte et revue à la main");
});

test("proposition — un rendez-vous sans date, une étape sans cible : refusés", () => {
  assert.ok(validerProposition({ ...prop(), type: "rendez-vous", contenu: undefined }).some((e) => e.champ === "quand"));
  assert.ok(validerProposition({ ...prop(), type: "etape", contenu: undefined }).some((e) => e.champ === "etape"));
});

// ── L'EXPIRATION ───────────────────────────────────────────────────────

test("expiration — le statut suit la DATE, pas un champ qu'un cron met à jour", () => {
  /**
   * Un cron qui ne tourne pas ne doit pas rendre approuvable une proposition
   * périmée : le contexte a bougé, le prospect a peut-être répondu, et le
   * message ne correspond plus à rien.
   */
  const vieille = prop({ createdAt: new Date(Date.now() - (EXPIRATION_HEURES + 1) * 3_600_000).toISOString() });
  assert.equal(statutReel(vieille), "expiree");
  assert.equal(peutApprouver(vieille).ok, false);
  assert.match(peutApprouver(vieille).raison ?? "", /contexte a bougé/i);

  const fraiche = prop();
  assert.equal(statutReel(fraiche), "en-attente");
  assert.equal(peutApprouver(fraiche).ok, true);
});

test("file — on ne compte que ce qui EXIGE une décision", () => {
  // Compter les alertes avec le reste ferait paraître la file plus lourde
  // qu'elle n'est, et une file qui a l'air lourde ne se traite pas.
  const r = resumeFile([prop({ id: "a" }), prop({ id: "b", type: "alerte", contenu: undefined })]);
  assert.equal(r.enAttente, 2);
  assert.equal(r.aDecider, 1);
  assert.equal(r.alertes, 1);
  assert.equal(aTrancher([prop({ id: "x", statut: "approuvee" })]).length, 0);
});

// ── L'ASYMÉTRIE, VÉRIFIÉE SUR LE CODE ──────────────────────────────────

test("orchestrateur — le canal d'écriture ne peut PAS exécuter", () => {
  /**
   * Le jour où `/api/v1/propositions` accepte un paramètre `executer`, tout
   * l'édifice — revue humaine, trace, responsabilité — tombe en une ligne.
   * Ce test est là pour que ça se voie en revue de code.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "app/api/v1/propositions/route.ts"), "utf8"));
  assert.doesNotMatch(src, /executer|execute\s*:/i, "un paramètre d'exécution est apparu dans le canal de proposition");
  assert.match(src, /statut: "en-attente"/, "une proposition naît TOUJOURS en attente");
  // L'auteur vient de la clé, jamais du corps : sinon on signe du nom d'un autre.
  assert.match(src, /auteur: v\.appelant\.nom/);
});

test("orchestrateur — approuver n'exécute rien non plus", () => {
  // « Approuver » et « faire » restent deux gestes quand un client réel est
  // au bout. Un seul clic qui fait les deux finit par partir tout seul.
  const brut = readFileSync(join(process.cwd(), "app/api/propositions/route.ts"), "utf8");
  assert.match(brut, /RIEN n'est parti/);
  assert.doesNotMatch(sansCommentaires(brut), /sendMail|api\/send|voice\/call/, "la route d'approbation déclenche une action");
});

test("orchestrateur — aucune coordonnée de tiers ne sort vers un agent", () => {
  /**
   * Un moniteur n'a pas besoin de savoir comment joindre quelqu'un pour dire
   * qu'il faut le joindre. Sortir email/téléphone vers un agent externe serait
   * une transmission de données personnelles sans nécessité.
   */
  const src = readFileSync(join(process.cwd(), "app/api/v1/etat/route.ts"), "utf8");
  const projection = src.slice(src.indexOf("const fiche ="), src.indexOf("const { data: propsData }"));
  for (const champ of ["email", "phone", "city", "name"]) {
    assert.doesNotMatch(projection, new RegExp(`\\b${champ}:`), `l'état du pipe expose « ${champ} »`);
  }
});

test("orchestrateur — toute route /api/v1 vérifie une portée", () => {
  // Une route ajoutée sous /api/v1 sans contrôle serait publique : ce préfixe
  // contourne la porte d'accès par conception.
  const dir = join(process.cwd(), "app/api/v1");
  const routes: string[] = [];
  const visite = (rel: string) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (e.isDirectory()) visite(`${rel}/${e.name}`);
      else if (e.name === "route.ts") routes.push(`${rel}/${e.name}`);
    }
  };
  visite(".");
  assert.ok(routes.length >= 3, `seulement ${routes.length} routes trouvées — le balayage est cassé`);
  for (const r of routes) {
    const src = readFileSync(join(dir, r), "utf8");
    assert.match(src, /autoriserApi\(|ALPHA_API_KEYS/, `${r} ne vérifie aucune clé`);
  }
});
