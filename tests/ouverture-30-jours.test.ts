import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DUREE_ESSAI_JOURS,
  ENVELOPPE_OUVERTURE_EUR,
  HORS_ESSAI,
  PLAFOND_ESSAI_COUT_EUR,
  etatEssai,
} from "../lib/essai";
import { BRIQUES_CONNUES, BRIQUES_ESSAI, BRIQUES_GRATUITES } from "../lib/entitlements";
import { COUT_EMAIL_EUR, coutEstimeIaEur, montantADebiter } from "../lib/compteur-essai";
import { ESSAI_JOURS } from "../lib/client-onboarding";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'OUVERTURE 30 JOURS — « téléphonie grisée, sans que ça nous coûte ».
 *
 * Ce fichier garde les trois affirmations de cette phrase, et chacune a été
 * vérifiée par MUTATION, pas par relecture.
 * ─────────────────────────────────────────────────────────────────────
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

// ══════════ 1. « TÉLÉPHONIE GRISÉE » ══════════

test("⚠⚠ L'ESSAI OUVRE TOUT LE CATALOGUE SAUF LA TÉLÉPHONIE", () => {
  assert.ok(BRIQUES_ESSAI.includes("campagnes"), "l'essai doit ouvrir ce qui se vend");
  assert.ok(BRIQUES_ESSAI.includes("agent-alpha"));
  assert.ok(BRIQUES_ESSAI.includes("audits"));
  assert.ok(BRIQUES_ESSAI.includes("tracking"));
  assert.ok(!BRIQUES_ESSAI.includes("alpha-voice"), "la téléphonie est la seule exclue");

  // Le socle gratuit est INCLUS : un essai ne retire jamais ce qu'on donne
  // sans condition. Un essai qui ouvre moins que le gratuit serait une
  // punition déguisée en cadeau.
  for (const b of BRIQUES_GRATUITES) {
    assert.ok(BRIQUES_ESSAI.includes(b), `${b} est gratuite, l'essai ne peut pas la retirer`);
  }

  // Le compte exact : tout, moins ce que `HORS_ESSAI` nomme.
  assert.equal(BRIQUES_ESSAI.length, BRIQUES_CONNUES.length - HORS_ESSAI.length);
});

test("⚠⚠ BRIQUES_ESSAI est DÉRIVÉE — une liste recopiée oublierait la brique suivante", () => {
  /**
   * MUTATION JOUÉE : remplacer le `.filter(…)` par une liste littérale des
   * neuf briques. Tout passait. C'est le problème : la dixième brique ajoutée
   * au catalogue serait alors ABSENTE de l'essai par simple oubli, et
   * personne ne saurait dire si c'était une décision ou une distraction.
   *
   * Le garde vise donc la FORME de la dérivation, pas le contenu du résultat —
   * le contenu, lui, est déjà vérifié au-dessus.
   */
  const src = sansCommentaires(lire("lib/entitlements.ts"));
  assert.match(
    src,
    /BRIQUES_ESSAI[^=]*=\s*BRIQUES_CONNUES\.filter\(\(b\) => !HORS_ESSAI\.includes\(b\)\)/,
    "le périmètre de l'essai doit se DÉRIVER du catalogue, jamais se recopier",
  );
});

test("⚠⚠ C'EST LE CODE QUI TIENT LE PÉRIMÈTRE, PAS LA COLONNE `bricks`", () => {
  /**
   * ⚠ LA MUTATION QUI A JUSTIFIÉ CE GARDE. Remplacer `bricks: [...BRIQUES_ESSAI]`
   * par `bricks: normaliserBriques(l.bricks)` — c'est-à-dire « faire confiance
   * à ce que la base dit » — ne fait tomber AUCUN autre test. Et pourtant :
   * une ligne d'essai posée à la main ou par un script avec
   * `bricks = '{alpha-voice}'` ouvrirait nos minutes LiveKit à un inconnu.
   *
   * « La téléphonie est grisée » doit être vrai QUOI QU'IL ARRIVE en base,
   * sinon ce n'est pas une garantie, c'est une convention d'écriture SQL.
   */
  const src = sansCommentaires(lire("lib/entitlements.ts"));
  const branche = src.slice(src.indexOf('if (statut === "essai")'));
  assert.ok(branche.length > 0, "la branche essai doit exister");
  const retour = branche.slice(0, branche.indexOf("essaiJusquA"));
  assert.match(retour, /bricks: \[\.\.\.BRIQUES_ESSAI\]/, "l'essai SUBSTITUE son périmètre");
  assert.ok(
    !/normaliserBriques/.test(retour),
    "il ne doit PAS lire la colonne `bricks` : une ligne écrite à la main ouvrirait la téléphonie",
  );
});

test("⚠ LA MIGRATION N'ÉCRIT AUCUN NOM DE BRIQUE — une seule définition du périmètre", () => {
  /**
   * Même règle que le plafond, que la migration 008 refuse déjà de recopier :
   * deux définitions du périmètre de l'essai finiraient par diverger, et c'est
   * le SQL qui gagnerait — il s'exécute en premier et personne ne le relit.
   */
  const sql = lire("supabase/migrations/012-ouverture-30-jours.sql")
    .replace(/^\s*--.*$/gm, "");
  for (const b of BRIQUES_CONNUES) {
    assert.ok(!sql.includes(b), `la migration ne doit nommer aucune brique (trouvé : ${b})`);
  }
  assert.match(sql, /bricks\s*,?[^)]*\)\s*\n?\s*values[\s\S]*?'\{\}'/, "elle pose une liste VIDE");
});

// ══════════ 2. « SANS QUE ÇA NOUS COÛTE » ══════════

test("⚠⚠ UNE CLÉ APPORTÉE NE CONSOMME RIEN — c'est ça, « gratuit pour nous »", () => {
  /**
   * La règle qui rend l'ouverture finançable. Un locataire qui paie son
   * fournisseur ne doit toucher NI son plafond NI l'enveloppe : son essai peut
   * durer, et il ne nous coûte rien.
   *
   * ⚠ MUTATION JOUÉE : retirer le `if (origine !== "maison") return 0;`.
   * Le module se met alors à débiter les comptes BYOK — et l'essai se ferme
   * sur une dépense que nous n'avons jamais faite. Ce test tombe.
   */
  assert.equal(montantADebiter("ia", "locataire", "/api/ai"), 0);
  assert.equal(montantADebiter("email", "locataire", "/api/send"), 0);
  assert.equal(montantADebiter("ia", "aucune", "/api/ai"), 0, "rien ne part, rien à débiter");
  assert.ok(montantADebiter("ia", "maison", "/api/ai") > 0, "sur NOTRE clé, on compte");
  assert.equal(montantADebiter("email", "maison", "/api/send"), COUT_EMAIL_EUR);
});

test("⚠ UN ENVOI N'EST PAS GRATUIT, même s'il ne se facture pas au message", () => {
  /**
   * Le réflexe est d'écrire 0 : notre hébergeur ne facture pas à l'unité. Ce
   * qu'un envoi consomme n'est pas de l'argent, c'est la réputation d'un
   * domaine PARTAGÉ avec les mails de confirmation Supabase. Un débit nul la
   * rendrait invisible, donc illimitée — mille envois d'essai, zéro alerte.
   */
  assert.ok(COUT_EMAIL_EUR > 0, "un débit nul rendrait l'envoi illimité pendant l'essai");
});

test("⚠ AUCUN APPEL IA NE S'ARRONDIT À ZÉRO", () => {
  /**
   * `coutEstimeIaEur` arrondit à deux décimales. Sans plancher, une route au
   * petit budget rendrait 0,00 € — donc gratuite à l'infini, en boucle,
   * pendant trente jours. Le trou exact qu'un arrondi fabrique sans qu'aucune
   * ligne n'ait l'air fausse.
   *
   * ⚠⚠ ET VOICI CE QUE LA MUTATION A DIT, parce que je l'ai jouée au lieu de
   * l'affirmer. J'avais écrit ici « retirer le `Math.max(0.01, …)` fait
   * tomber ce test ». **C'est FAUX, et ça l'était au moment où je l'écrivais.**
   * Mesuré : le plus petit budget déclaré est `/api/icp` à 3 000 jetons, soit
   * 0,0096 € — qui s'arrondit à 0,01 tout seul. Le plancher n'est atteignable
   * qu'en dessous d'environ 1 560 jetons, et aucune route n'y descend.
   *
   * Donc le comportement d'aujourd'hui ne distingue pas les deux versions, et
   * une boucle `for` sur les routes existantes est un garde qui **valide sans
   * mordre** — précisément la famille de fautes que ce dépôt traque ailleurs.
   * Ce qui protège réellement est le garde de SOURCE ci-dessous : il tient le
   * jour où quelqu'un déclare une route à 800 jetons, c'est-à-dire le seul
   * jour où ça compte.
   */
  const src = sansCommentaires(lire("lib/compteur-essai.ts"));
  assert.match(src, /Math\.max\(0\.01,/, "le plancher doit exister AVANT qu'une route descende assez bas");

  // L'invariant lui-même, vérifié sur ce qui existe. Il passe des deux côtés
  // de la mutation — il documente la règle, il ne la garde pas.
  for (const route of ["/api/ai", "/api/agent", "/api/brain", "/api/icp", "/api/route-qui-n-existe-pas"]) {
    assert.ok(coutEstimeIaEur(route) >= 0.01, `${route} doit coûter quelque chose`);
  }
});

test("⚠⚠ L'ENVELOPPE FERME L'ESSAI — le plafond par compte ne borne pas la facture", () => {
  /**
   * LE RAISONNEMENT QUE CE TEST PROTÈGE :
   *   ce que ça nous coûte = (nombre d'essais) × plafond par compte
   * Le seul terme borné était celui qu'on ne veut pas borner. Vingt comptes
   * parfaitement dans les clous = 600 €, sans qu'aucune garde ne parle.
   */
  const sage = { jusquA: dans(20), coutConsommeEur: 1 };
  assert.equal(etatEssai({ ...sage, coutGlobalEur: 0 }).actif, true);
  const pleine = etatEssai({ ...sage, coutGlobalEur: ENVELOPPE_OUVERTURE_EUR });
  assert.equal(pleine.actif, false, "l'enveloppe ferme même un compte irréprochable");
  assert.equal(pleine.fin, "enveloppe-epuisee");
});

test("⚠ L'ENVELOPPE INCONNUE FERME AUSSI — l'inconnu vaut refus", () => {
  const r = etatEssai({ jusquA: dans(20), coutConsommeEur: 1, coutGlobalEur: null });
  assert.equal(r.actif, false);
  assert.equal(r.fin, "cout-inconnu", "on ne laisse pas tourner ce qui dépense quand on ne sait plus combien");
});

test("⚠ SON PLAFOND D'ABORD, NOTRE ENVELOPPE ENSUITE", () => {
  /**
   * Les deux ferment, mais ils ne disent pas la même chose. « Tu as consommé
   * ton essai » est actionnable ; « l'ouverture est pleine » ne l'est pas.
   * Celui qui a dépensé l'entend en premier.
   */
  const lesDeux = etatEssai({
    jusquA: dans(20),
    coutConsommeEur: PLAFOND_ESSAI_COUT_EUR,
    coutGlobalEur: ENVELOPPE_OUVERTURE_EUR,
  });
  assert.equal(lesDeux.fin, "plafond-atteint");
});

test("⚠⚠ L'ENVELOPPE NE DESCEND PAS DANS LA PHRASE SERVIE AU LOCATAIRE", () => {
  /**
   * C'est le budget d'acquisition de NOTRE société — même famille que
   * `/offre` et `voice-costs`, réservés au maître. Son plafond personnel, lui,
   * s'affiche : c'est SA consommation.
   */
  const r = etatEssai({ jusquA: dans(3), coutConsommeEur: 1, coutGlobalEur: ENVELOPPE_OUVERTURE_EUR });
  assert.ok(
    !r.phrase.includes(String(ENVELOPPE_OUVERTURE_EUR)),
    `la phrase ne doit pas chiffrer notre enveloppe (vue : « ${r.phrase} »)`,
  );
  // …et elle doit tout de même orienter vers la sortie qui ne nous coûte rien.
  assert.match(r.phrase, /clé/i, "elle doit nommer le BYOK : c'est la sortie gratuite pour tout le monde");
});

// ══════════ 3. LE COMPTEUR EST BRANCHÉ ══════════

test("⚠⚠ LE DÉBIT EST POSÉ AUX DEUX SEULS POINTS QUI DÉCIDENT QUI PAIE", () => {
  /**
   * Le défaut récurrent du dépôt, appliqué au compteur lui-même : un débit
   * juste, testé, que personne n'appelle. `cout_consomme_eur` a vécu ainsi
   * depuis la migration 008 — écrit par ZÉRO fichier.
   */
  const src = sansCommentaires(lire("lib/credentials-secret.ts"));
  assert.match(src, /montantADebiter\("ia", moteur\.origine/, "l'IA débite à la résolution du moteur");
  assert.match(src, /montantADebiter\("email", maison\.origine/, "l'email débite à la résolution du SMTP");
  assert.match(src, /montantADebiter\("video"|debiterLaRequete/, "les dépenses sans résolveur passent par un point unique");
  /**
   * ⚠⚠ LE COMPTE FIGÉ A SAUTÉ — et c'est la DEUXIÈME fois aujourd'hui que ce
   * motif se paie (l'autre était `anglesMorts().length === 4`).
   *
   * Ce test exigeait `facturerEssai(` exactement 3 fois : deux appels plus la
   * définition. Brancher l'egress et la vidéo a ajouté `debiterLaRequete`, qui
   * l'appelle légitimement — et le test est tombé sur « 4 !== 3 », un message
   * qui ne dit ni ce qui a été ajouté, ni si c'est voulu.
   *
   * L'INTENTION, elle, ne bouge pas et se vérifie mieux autrement : le débit
   * ne doit pas se disperser dans les routes. On l'exprime donc directement —
   * aucun fichier de route n'appelle `debiter()`, tout passe par ce module.
   */
  /**
   * ⚠ `readdirSync({ recursive: true })` plutôt qu'une TROISIÈME copie de
   * `fichiersSources`, qui est déjà dupliquée dans deux fichiers de test. Ce
   * dépôt refuse les secondes définitions ; en ajouter une ici, dans le test
   * qui garde justement l'unicité du point de débit, serait mal venu.
   */
  const routes = readdirSync(join(process.cwd(), "app/api"), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => join("app/api", f));
  const dispersees = routes.filter((f) => /\bdebiter\(/.test(sansCommentaires(lire(f))));
  assert.deepEqual(
    dispersees,
    [],
    "aucune route ne débite en direct : le point de débit est `lib/credentials-secret.ts`, et lui seul",
  );
});

test("⚠⚠ UN DÉBIT QUI ÉCHOUE REFUSE LA DÉPENSE", () => {
  /**
   * LA MOITIÉ QUI FAIT QUE LE PLAFOND EXISTE. Si on ne sait pas enregistrer ce
   * qu'on s'apprête à dépenser, on ne le dépense pas — sinon il suffit que
   * l'écriture échoue en boucle (base saturée, RPC absente) pour consommer
   * sans aucune limite, et c'est exactement la panne qu'un usage intensif
   * provoque.
   *
   * ⚠ MUTATION JOUÉE : remplacer `return ok ? moteur : AUCUN_MOTEUR` par
   * `return moteur`. Aucun autre test ne tombe — le compteur devient un
   * journal facultatif, et le plafond une décoration.
   */
  const src = sansCommentaires(lire("lib/credentials-secret.ts"));
  assert.match(src, /return ok \? moteur : AUCUN_MOTEUR/, "IA : pas de débit, pas de moteur");
  assert.match(src, /return ok \? maison : AUCUN_SMTP/, "email : pas de débit, pas de boîte");
});

test("⚠ LE DÉFAUT DÉBITE — la sortie est explicite, et elle a deux appelants nommés", () => {
  /**
   * L'inverse aurait la même forme et la propriété opposée : la route ajoutée
   * demain dépenserait sans compter. Ici, une route qui oublie l'option débite
   * pour rien — un essai se ferme un peu trop tôt, ça se répare.
   *
   * Les deux seules sorties légitimes RÉSOLVENT sans APPELER.
   */
  const secret = sansCommentaires(lire("lib/credentials-secret.ts"));
  assert.match(secret, /if \(opts\.depense === false\)/, "la sortie doit être un opt-out explicite");
  assert.ok(
    !/opts\.depense === true/.test(secret),
    "le défaut doit être de DÉBITER, pas de devoir le demander",
  );

  for (const [fichier, motif] of [
    ["app/api/health/route.ts", /moteurIADeLaRequete\(req, \{ depense: false \}\)/],
    ["app/api/deliverability/dns/route.ts", /resoudreSmtp\([^)]*\{ depense: false \}\)/],
  ] as const) {
    assert.match(sansCommentaires(lire(fichier)), motif, `${fichier} résout sans dépenser`);
  }

  /**
   * ⚠ LE CONTRE-TEST, et il est obligatoire : sans lui, un dépôt où TOUTES les
   * routes passent `depense: false` satisferait le test précédent. On exige
   * que les deux routes qui DÉPENSENT vraiment ne l'utilisent pas.
   */
  for (const fichier of ["app/api/send/route.ts", "app/api/ai/route.ts"]) {
    assert.ok(
      !/depense: false/.test(sansCommentaires(lire(fichier))),
      `${fichier} dépense réellement : il ne doit pas sortir du compteur`,
    );
  }
});

test("⚠ LE DÉMARREUR POSE `0`, JAMAIS LE DÉFAUT DE LA COLONNE", () => {
  /**
   * ⚠⚠ LE PIÈGE DE CETTE MIGRATION, ET CELUI QUI A TUÉ L'ESSAI PENDANT DIX
   * JOURS. Le défaut de `cout_consomme_eur` est `null` ; `null` FERME l'essai.
   * Un démarreur qui se contente d'écrire `statut = 'essai'` crée donc un
   * essai mort-né — ouvert sur le papier, fermé le jour même.
   *
   * `0` dit « ce compte n'a rien consommé », `null` dit « on ne sait pas », et
   * ces deux phrases mènent à des décisions opposées.
   */
  const sql = lire("supabase/migrations/012-ouverture-30-jours.sql").replace(/^\s*--.*$/gm, "");
  const inserts = sql.match(/insert into public\.entitlements[\s\S]*?;/g) ?? [];
  assert.ok(inserts.length >= 2, "le trigger ET la reprise des inscrits d'avant");
  for (const i of inserts) {
    assert.match(i, /cout_consomme_eur/, "la colonne doit être écrite explicitement");
    assert.match(i, /on conflict \(tenant_id\) do nothing/, "un essai se donne UNE fois");
  }
  assert.match(sql, /coalesce\(cout_consomme_eur, 0\)/, "débiter un compteur null le laisserait null");
});

test("⚠ LE DÉBIT EST ATOMIQUE — lire-puis-écrire perd des dépenses", () => {
  /**
   * Deux appels simultanés lisent tous deux 12,00 et écrivent tous deux
   * 12,50 : une dépense disparaît. Sur une boucle d'appels — le cas même que
   * le plafond existe pour borner — la fuite est proportionnelle au débit.
   */
  const src = sansCommentaires(lire("lib/compteur-essai.ts"));
  assert.match(src, /\.rpc\("debiter_essai"/, "l'addition se fait DANS la base");
  assert.ok(!/\.select\(["']cout_consomme_eur["']\)[\s\S]{0,400}\.update\(/.test(src), "jamais lire-puis-écrire");
});

test("⚠ L'ENVELOPPE NE COMPTE QUE LES ESSAIS", () => {
  /**
   * Un client qui PAIE ne consomme pas le budget d'acquisition. L'y inclure
   * ferait fermer l'ouverture d'autant plus vite qu'on vend mieux — une garde
   * qui punit le succès.
   */
  const src = sansCommentaires(lire("lib/compteur-essai.ts"));
  assert.match(src, /\.eq\("statut", "essai"\)/);
});

// ══════════ 4. LES DEUX DURÉES ══════════

test("⚠⚠ IL N'Y A PLUS QU'UNE DURÉE D'ESSAI", () => {
  /**
   * `ESSAI_JOURS` valait **14** et s'affichait sur `/souscrire`, la page où
   * l'on ACHÈTE, pendant que le serveur en appliquait **30**. On annonçait
   * moins que ce qu'on donnait — la divergence dans le sens qui se paie : un
   * prospect qui compare conclut que le site n'est pas à jour.
   */
  assert.equal(ESSAI_JOURS, DUREE_ESSAI_JOURS);
  const src = sansCommentaires(lire("lib/client-onboarding.ts"));
  assert.ok(
    !/ESSAI_JOURS\s*=\s*\d+/.test(src),
    "la durée doit être IMPORTÉE du module qui l'applique, jamais réécrite en littéral",
  );
});

test("⚠ LA DURÉE DU SQL ET CELLE DU CODE DISENT LA MÊME CHOSE", () => {
  /**
   * La seule recopie que la migration s'autorise : un trigger ne peut pas
   * importer une constante, et laisser le code poser la date ferait dépendre
   * l'ouverture d'un appel applicatif qui peut ne pas avoir lieu. Elle n'est
   * donc pas gratuite — ce test la paie.
   */
  const sql = lire("supabase/migrations/012-ouverture-30-jours.sql").replace(/^\s*--.*$/gm, "");
  const jours = [...sql.matchAll(/interval '(\d+) days'/g)].map((m) => Number(m[1]));
  assert.ok(jours.length >= 2, "le trigger et la reprise posent chacun une échéance");
  for (const j of jours) assert.equal(j, DUREE_ESSAI_JOURS, "le SQL et lib/essai.ts divergent");
});

function dans(jours: number): string {
  return new Date(Date.now() + jours * 86_400_000).toISOString();
}
