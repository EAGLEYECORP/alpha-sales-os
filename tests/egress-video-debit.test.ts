import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COUT_EGRESS_EUR,
  COUT_EMAIL_EUR,
  COUT_VIDEO_EUR,
  montantADebiter,
} from "../lib/compteur-essai";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEUX ROUTES DÉPENSAIENT SANS RIEN DÉBITER.
 *
 * Le compteur d'essai ne connaissait que l'IA et l'email. Or
 * `lib/credentials.ts` dit déjà, noir sur blanc, que `/api/audit` « récupère
 * des sites tiers DEPUIS NOTRE SERVEUR, donc notre egress et notre exposition
 * à l'abus — une clé IA ne paie pas ça ». La phrase était écrite, exacte, et
 * **le compteur ne la connaissait pas**. Le défaut récurrent du dépôt, dans sa
 * forme la plus pure : une règle juste, en prose, que rien ne pose.
 *
 * Conséquence directe : l'enveloppe d'ouverture, branchée le matin même,
 * était **partiellement fausse** — un essai pouvait consommer sans qu'elle
 * bouge.
 *
 * ⚠ ET LA CLASSIFICATION, ELLE, ÉTAIT DÉJÀ JUSTE. `tests/entitlements.test.ts`
 * déclare `/api/video` (« rendu vidéo — calcul et stockage ») et `/api/audit`
 * (« récupération de sites tiers depuis notre serveur (egress + abus) ») dans
 * `API_QUI_DEPENSENT` depuis longtemps, avec les bons motifs. Le dépôt SAVAIT
 * que ces routes coûtent. Seul le compteur l'ignorait.
 *
 * Aucun test ici ne revérifie cette classification : elle est déjà gardée là-bas,
 * et la recopier créerait la seconde définition que ce dépôt refuse partout.
 * ─────────────────────────────────────────────────────────────────────
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("⚠⚠ EGRESS ET VIDÉO N'ONT AUCUN CHEMIN BYOK — la dépense nous revient toujours", () => {
  /**
   * C'est la distinction qui décide du montant. Pour l'IA et l'email,
   * `origine` peut valoir `locataire` et le débit tombe à zéro : il a apporté
   * sa clé, il paie son fournisseur. Pour l'egress et la vidéo, il n'existe
   * aucun moyen qu'un locataire apporte notre bande passante ou nos crédits
   * de rendu — donc la question ne se pose même pas, et le débit est toujours
   * le nôtre.
   */
  assert.ok(montantADebiter("egress", "maison", "/api/audit/generate") > 0);
  assert.ok(montantADebiter("video", "maison", "/api/video/render") > 0);
  assert.equal(COUT_EGRESS_EUR, montantADebiter("egress", "maison", "/x"));
  assert.equal(COUT_VIDEO_EUR, montantADebiter("video", "maison", "/x"));
});

test("⚠⚠ UN RENDU VIDÉO NE COÛTE PAS LE PRIX D'UN EMAIL", () => {
  /**
   * Le montant est une DÉCISION — aucune facture de rendu n'a jamais été lue
   * ici. Ce qui n'est pas arbitraire, c'est l'ORDRE DE GRANDEUR : un rendu GPU
   * ou un crédit json2video n'est pas du même monde qu'un message. Les mettre
   * au même prix laisserait un essai produire trente vidéos sans que
   * l'enveloppe bouge d'un centime — un plafond qui ne borne rien.
   */
  assert.ok(
    COUT_VIDEO_EUR >= COUT_EMAIL_EUR * 50,
    `un rendu doit peser nettement plus qu'un email (vidéo ${COUT_VIDEO_EUR} € vs email ${COUT_EMAIL_EUR} €)`,
  );
  assert.ok(COUT_EGRESS_EUR > 0, "aller frapper chez un tiers depuis notre IP n'est pas gratuit");
});

test("⚠⚠ LE `switch` EST EXHAUSTIF — un canal de plus ne retombe pas sur le prix de l'IA", () => {
  /**
   * ⚠ LE DÉFAUT QUE CE TEST EXISTE POUR EMPÊCHER, ET IL A FAILLI SE PRODUIRE.
   *
   * `montantADebiter` s'écrivait
   * `depense === "email" ? COUT_EMAIL_EUR : coutEstimeIaEur(route)` : **tout
   * ce qui n'était pas « email » retombait sur le calcul IA.** Ajouter
   * `egress` aujourd'hui l'aurait donc facturé au prix d'un appel de modèle,
   * en silence, sans qu'aucun test ne tombe.
   *
   * Un `switch` sans `default` fait tenir l'exhaustivité par `tsc` : une
   * valeur de `Depense` non traitée ne compile pas. Le compilateur garde la
   * règle, pas la relecture.
   */
  const src = sansCommentaires(lire("lib/compteur-essai.ts"));
  assert.match(src, /switch \(depense\)/, "l'exhaustivité se tient par un switch typé");
  assert.ok(!/default:/.test(src.slice(src.indexOf("switch (depense)"))), "aucun `default` : il masquerait l'oubli");
  /**
   * ⚠⚠ CE QUI ÉTAIT ÉCRIT ICI TESTAIT UNE COÏNCIDENCE, PAS UNE RÈGLE.
   *
   * J'avais asserté que le prix d'egress DIFFÈRE du prix IA. Le test est
   * tombé : `COUT_EGRESS_EUR` vaut 0,02 € et `/api/ai` (6 000 jetons) revient
   * à 0,0192 €, arrondi à… 0,02 €. Deux décisions indépendantes qui atterrissent
   * sur le même nombre — ça n'a strictement rien à voir avec l'exhaustivité du
   * `switch`, et « corriger » en changeant un prix pour faire passer un test
   * aurait été le pire des deux mondes.
   *
   * La vraie propriété, elle, ne dépend d'aucun chiffre : **le coût IA varie
   * avec la route** (chaque route a son budget de jetons), **l'egress et la
   * vidéo sont forfaitaires**. Si un canal forfaitaire se mettait à retomber
   * sur le calcul IA, son prix bougerait d'une route à l'autre.
   */
  const routes = ["/api/ai", "/api/agent", "/api/icp"];
  const iaSelonRoute = new Set(routes.map((r) => montantADebiter("ia", "maison", r)));
  assert.ok(iaSelonRoute.size > 1, "le coût IA dépend bien de la route (budgets de jetons distincts)");
  for (const canal of ["egress", "video"] as const) {
    const parRoute = new Set(routes.map((r) => montantADebiter(canal, "maison", r)));
    assert.equal(parRoute.size, 1, `${canal} est forfaitaire : il ne doit pas varier avec la route`);
  }
});

test("⚠⚠ LE DÉBIT PASSE AVANT LA DÉPENSE, dans les deux routes", () => {
  /**
   * Débiter après coup laisserait passer le balayage entier avant de constater
   * le dépassement : le plafond ne bornerait plus rien, il raconterait ce qui
   * s'est déjà produit. On vise donc l'ORDRE dans la source, pas seulement la
   * présence de l'appel.
   */
  const audit = sansCommentaires(lire("app/api/audit/generate/route.ts"));
  const iDebit = audit.indexOf('debiterLaRequete(req, "egress")');
  const iFetch = audit.indexOf("fetchSiteText(");
  assert.ok(iDebit > 0, "l'audit doit débiter l'egress");
  assert.ok(iDebit < iFetch, "et le débit doit précéder la récupération du site");

  const video = sansCommentaires(lire("app/api/video/render/route.ts"));
  const vDebit = video.indexOf('debiterLaRequete(req, "video")');
  assert.ok(vDebit > 0, "le rendu doit débiter");
  for (const depense of ["textToVideo(", "renderJson2Video("]) {
    assert.ok(vDebit < video.indexOf(depense), `le débit doit précéder ${depense}`);
  }
});

test("⚠⚠ UN DÉBIT REFUSÉ ARRÊTE LA DÉPENSE — 402, et rien ne part", () => {
  /**
   * La moitié qui fait que le plafond existe. Sans elle, le compteur est un
   * journal facultatif : il suffit que l'écriture échoue en boucle pour
   * dépenser sans limite.
   */
  for (const f of ["app/api/audit/generate/route.ts", "app/api/video/render/route.ts"]) {
    const src = sansCommentaires(lire(f));
    assert.match(src, /if \(!\(await debiterLaRequete\(/, `${f} doit traiter le refus`);
    assert.match(src, /status: 402/, `${f} doit répondre 402 quand le plafond est atteint`);
    assert.match(src, /plafond_essai/, `${f} doit donner un code exploitable par l'écran`);
  }
});

test("⚠⚠ `/api/audit/extract` NE DÉBITE PAS D'EGRESS — classer par DÉPENSE, pas par FAMILLE", () => {
  /**
   * Elle reçoit le texte déjà collé par l'opérateur : elle ne va frapper nulle
   * part. Lui ajouter un débit d'egress au motif qu'elle est « dans la famille
   * audit » serait exactement le défaut que ce dépôt a payé trois fois —
   * `alpha-live`, `/linkedin`, `/appels`, tous classés par famille au lieu de
   * l'être par leur coût réel.
   *
   * ⚠ Elle débite bien l'IA, elle, via `moteurIADeLaRequete`. Une route peut
   * dépenser une chose et pas une autre.
   */
  const src = sansCommentaires(lire("app/api/audit/extract/route.ts"));
  assert.ok(!/debiterLaRequete/.test(src), "elle ne récupère aucun site : rien à débiter en egress");
  assert.match(src, /moteurIADeLaRequete/, "…mais son appel IA est bien débité");
  assert.ok(!/fetchSiteText/.test(src), "et elle ne va frapper nulle part — c'est ce qui le justifie");
});

test("⚠⚠ LE `GET` DU RENDU NE DÉBITE JAMAIS — un plafond borne ce qu'on ENGAGE", () => {
  /**
   * ⚠ LE PIÈGE QU'UNE SESSION SUIVANTE TENDRA EN « COMPLÉTANT » LE TRAVAIL.
   *
   * Le `GET` interroge l'état d'un rendu **déjà lancé et déjà payé**. Le
   * débiter facturerait deux fois la même dépense ; le REFUSER serait pire —
   * le rendu a été produit, il nous a coûté, et on s'interdirait d'aller le
   * chercher. On paierait pour rien.
   *
   * Comme la route dépense côté POST, son GET aura toujours l'air d'avoir été
   * oublié. Il ne l'est pas.
   */
  const src = sansCommentaires(lire("app/api/video/render/route.ts"));
  const get = src.slice(src.indexOf("export async function GET"));
  assert.ok(get.length > 0, "le GET doit exister");
  assert.ok(!/debiterLaRequete/.test(get), "lire l'état d'un rendu déjà payé ne se facture pas deux fois");
});
