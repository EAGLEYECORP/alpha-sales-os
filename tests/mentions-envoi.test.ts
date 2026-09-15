import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { verifieMentions, MENTION_PROVENANCE } from "../lib/conformite";
import { signataire, CLOSER_USINE } from "../lib/signature";
import { identiteEnvoi, habillageEnvoi } from "../lib/expediteur";

const R = process.cwd();
const lire = (f: string) => readFileSync(join(R, f), "utf8");
/** Les commentaires racontent le bug corrigé : ils ne doivent pas le rejouer. */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/<!--[\s\S]*?-->/g, "");

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI SIGNE, ET COMMENT ON REFUSE UN MESSAGE SANS MENTIONS.
 *
 * ⚠ DEUX MÉCANISMES JUSTES, TESTÉS, BRANCHÉS NULLE PART — le défaut récurrent
 * de ce dépôt, trouvé par l'audit des exports orphelins :
 *
 *  · `verifieMentions` (lib/conformite.ts) : écrit, corrigé une fois (le nom
 *    d'usine le satisfaisait), couvert par deux fichiers de test… et appelé
 *    par AUCUNE route. Aucun message n'a jamais été contrôlé avant de partir.
 *  · `signataire` (lib/signature.ts) : écrit pour réunir les quatre réponses
 *    divergentes à « qui signe ? », et jamais branché sur `/api/send` — la
 *    seule route d'où un email PART. Elle faisait
 *    une variable d'environnement de signature avec repli « EAGLEYE », donc
 *    une valeur unique pour
 *    un produit multi-comptes, avec repli sur NOTRE marque.
 *
 * Conséquence concrète, celle qui coûte : un SMS de prospection partait sans
 * aucun moyen de refus, et un email envoyé au nom d'un partenaire arrivait avec
 * notre marque en papier à en-tête, notre raison sociale en pied et notre
 * aigle en logo.
 * ─────────────────────────────────────────────────────────────────────
 */

test("verifieMentions attrape ce qui manque vraiment dans un SMS", () => {
  const nu = "Bonjour, on peut vous faire gagner du temps. Rappelez-moi.";
  const manques = verifieMentions(nu, "Camille", "Vaubex", "suivant");
  assert.ok(
    manques.some((m) => /refus/i.test(m)),
    "un SMS sans moyen de refus doit être signalé"
  );
  assert.ok(manques.some((m) => /Nom de l'expéditeur/i.test(m)));
  assert.ok(manques.some((m) => /Société/i.test(m)));

  const complet = "Camille de Vaubex : 2 min pour vos appels manqués ? Répondez STOP pour ne plus être contacté.";
  assert.deepEqual(verifieMentions(complet, "Camille", "Vaubex", "suivant"), []);
});

/**
 * ⚠ Le contrôle doit rester déclenchable : un `verifieMentions` qui ne rend
 * jamais rien serait un `if (false)` déguisé. On vérifie donc les DEUX sens.
 */
test("verifieMentions ne se contente pas d'un placeholder", () => {
  const texte = `Le Closer de EAGLEYE CORP. Répondez STOP.`;
  const manques = verifieMentions(texte, CLOSER_USINE, "EAGLEYE CORP", "suivant");
  assert.ok(
    manques.some((m) => m.includes(CLOSER_USINE)),
    "le libellé d'usine est PRÉSENT dans le texte : c'est justement ce qui doit être refusé"
  );
});

test("⚠ /api/send signe depuis le COMPTE — plus jamais depuis une env ni « EAGLEYE »", () => {
  const brut = lire("app/api/send/route.ts");
  const code = sansCommentaires(brut);

  assert.ok(
    !/process\.env\.CLOSER_NAME/.test(code),
    "une env unique ne peut pas signer les envois de plusieurs comptes"
  );
  assert.ok(
    !/\|\|\s*"EAGLEYE"/.test(code),
    "le repli ne doit pas remettre notre marque sur un envoi partenaire"
  );

  // La CONDITION : l'habillage vient de la source unique, nourrie par le compte.
  assert.match(code, /const habillage = habillageEnvoi\(\{[\s\S]{0,200}accountId: body\.accountId/);
  assert.match(code, /closerName: habillage\.closerName/, "le rendu doit utiliser le signataire résolu");
  assert.match(code, /addressLine: habillage\.addressLine/, "l'adresse légale doit suivre le compte");
  assert.match(code, /logoUrl: habillage\.logoUrl/, "le logo aussi");
});

/**
 * ⚠ L'APERÇU ET L'ENVOI DOIVENT RENDRE LE MÊME EXPÉDITEUR.
 *
 * `/api/email/preview` lisait l'ancienne variable d'environnement pendant que
 * `/api/send` résolvait depuis le compte. On relisait un email et on en
 * envoyait un autre — en croyant avoir vérifié.
 */
test("⚠ l'aperçu et l'envoi passent par la MÊME résolution d'expéditeur", () => {
  /**
   * ⚠ ON ASSERTE L'USAGE, PAS LA PRÉSENCE DE L'APPEL.
   *
   * Une première version se contentait de trouver `habillageEnvoi(` dans le
   * fichier. Une mutation qui remettait `closerName: "EAGLEYE"` juste à côté
   * passait au vert : l'appel était là, son résultat n'était pas lu. C'est le
   * piège que ce dépôt collectionne, et il vient de se refermer une fois de
   * plus. Les TROIS champs doivent être liés, dans les DEUX routes.
   */
  for (const f of ["app/api/send/route.ts", "app/api/email/preview/route.ts"]) {
    const code = sansCommentaires(lire(f));
    assert.match(code, /habillageEnvoi\(/, `${f} doit passer par la source unique`);
    assert.ok(!/process\.env\.CLOSER_NAME/.test(code), `${f} ne doit plus lire une env de signature`);
    for (const champ of ["closerName", "addressLine", "logoUrl"]) {
      assert.match(
        code,
        new RegExp(`${champ}: habillage\\.${champ}`),
        `${f} appelle habillageEnvoi mais n'en lit pas ${champ} — l'appel serait décoratif`
      );
    }
    assert.ok(
      !/EAGLEYE"/.test(code),
      `${f} contient encore notre marque en littéral : elle finirait sur l'email d'un autre compte`
    );
  }

  // Et les écrans qui demandent un aperçu doivent annoncer leur identité,
  // sinon l'aperçu retombe sur le compte par défaut et ment à nouveau.
  for (const f of [
    "app/(app)/templates/page.tsx",
    "app/(app)/newsletter/page.tsx",
    "components/campaigns/campaign-review.tsx",
  ]) {
    assert.match(
      sansCommentaires(lire(f)),
      /identiteEnvoi\(settings\)/,
      `${f} demande un aperçu sans dire qui envoie`
    );
  }
});

test("habillageEnvoi : la marque, l'adresse et le logo suivent le compte", () => {
  const maitre = habillageEnvoi({ accountId: "eagleye", base: "https://x.fr" });
  assert.equal(maitre.marque, "EAGLEYE CORP");
  assert.ok(maitre.logoUrl, "notre aigle sur notre compte");

  const revendeur = habillageEnvoi({ accountId: "nuwacom", base: "https://x.fr" });
  assert.equal(revendeur.marque, "Nuwacom");
  assert.equal(revendeur.logoUrl, undefined, "notre aigle ne part pas sur un compte revendeur");
  assert.ok(!/EAGLEYE/i.test(revendeur.addressLine), "ni notre raison sociale au pied");
  assert.match(revendeur.addressLine, /Nuwacom/);
});

test("⚠ /api/send refuse un message sans mentions obligatoires — email ET sms", () => {
  const code = sansCommentaires(lire("app/api/send/route.ts"));

  /**
   * Côté EMAIL, le contrôle porte sur le texte RENDU (`text`), pas sur le
   * corps saisi : le pied « Répondez STOP », la signature et l'adresse légale
   * sont ajoutés par le rendu. Contrôler `body.body` refuserait tous les
   * emails du produit — une garde qui refuse tout se fait désactiver.
   */
  assert.match(
    code,
    /const manques = verifieMentions\(text, habillage\.closerName, marque, rang\)/,
    "l'email se vérifie sur le texte rendu"
  );
  assert.match(code, /if \(manques\.length > 0\)[\s\S]{0,220}status: 422/);

  /**
   * Côté SMS, le contrôle porte sur `body.body` — c'est LITTÉRALEMENT ce qui
   * est transmis à Textbelt (`message: body.body`). Rien n'ajoute de pied.
   */
  assert.match(
    code,
    /const manquesSms = verifieMentions\(body\.body, habillage\.closerName, marque, "premier"\)/,
    "le SMS se vérifie sur le corps exact, celui qui part"
  );
  assert.match(code, /if \(manquesSms\.length > 0\)[\s\S]{0,240}status: 422/);

  /**
   * ⚠ `force` NE DOIT PAS désarmer ce refus. Il sert au score anti-spam et à
   * la fenêtre de recontact — deux jugements. Une mention obligatoire n'en est
   * pas un, et une garde qu'un booléen ouvre n'est pas une garde.
   */
  const iSms = code.indexOf("const manquesSms");
  const blocSms = code.slice(iSms, iSms + 400);
  assert.ok(!/body\.force/.test(blocSms), "aucun `force` ne doit contourner les mentions");

  // Le refus précède l'envoi réel, dans les deux canaux.
  const iMentions = code.indexOf("const manques = verifieMentions");
  const iEnvoiMail = code.indexOf("createTrackedEmail(");
  assert.ok(iMentions > 0 && iMentions < iEnvoiMail, "l'email se refuse AVANT d'être tracé et expédié");
  assert.ok(iSms > 0 && iSms < code.indexOf("phone: body.to"), "le SMS se refuse AVANT l'appel à Textbelt");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CÂBLAGE — c'est là que ce dépôt échoue, pas dans la garde.
 *
 * La route ne sait QUI signe que si l'appelant le dit. Quatre écrans
 * appellent `/api/send` ; trois annonçaient le compte, aucun n'annonçait le
 * signataire, et la recette n'annonçait rien du tout.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ les QUATRE appelants de /api/send annoncent leur identité d'envoi", () => {
  const appelants = [
    "components/send-bar.tsx",
    "components/campaigns/campaign-review.tsx",
    "app/(app)/newsletter/page.tsx",
    "components/recette/go-live-checklist.tsx",
  ];
  for (const f of appelants) {
    const code = sansCommentaires(lire(f));
    assert.match(
      code,
      /\.\.\.identiteEnvoi\(settings\)/,
      `${f} n'annonce pas son identité d'envoi : le serveur signerait avec la marque du compte par défaut`
    );
  }
});

test("identiteEnvoi ne substitue rien — un réglage vide part vide", () => {
  assert.deepEqual(identiteEnvoi({}), { accountId: "eagleye", closerName: "", agencyName: "" });
  assert.deepEqual(
    identiteEnvoi({ accountId: "nuwacom", closerName: "Camille", agencyName: "Vaubex" }),
    { accountId: "nuwacom", closerName: "Camille", agencyName: "Vaubex" }
  );

  /**
   * Le point qui compte : remplacer un nom vide par le libellé d'usine côté
   * client rendrait le trou invisible du côté serveur, qui le refuserait pour
   * une mauvaise raison — ou pas du tout.
   */
  assert.notEqual(identiteEnvoi({}).closerName, CLOSER_USINE);
  assert.equal(signataire("", "Vaubex").nom, "Vaubex", "à défaut de nom, la société identifie");
  assert.equal(signataire("", "").usine, true, "à défaut de tout, le trou reste visible");
});

test("⚠ le rendu d'email ne contient plus notre marque en dur", () => {
  const code = sansCommentaires(lire("lib/email-html.ts"));

  /**
   * On tolère UNE occurrence : la mention de plateforme (« Envoyé avec ALPHA
   * SALES OS® — Eagleye Corp, Lyon »), qui nomme l'éditeur de l'outil et non
   * l'expéditeur. Toute autre est le bug qui revient.
   */
  const occurrences = [...code.matchAll(/Eagleye|EAGLEYE/g)].length;
  assert.equal(
    occurrences,
    1,
    `notre marque apparaît ${occurrences} fois en dur dans le rendu (attendu : la seule mention de plateforme)`
  );
  assert.match(code, /Envoy[ée] avec ALPHA SALES OS/, "la mention de plateforme, elle, reste");

  // L'en-tête se déduit de l'expéditeur, il n'est plus écrit à la main.
  assert.match(code, /const \[enTeteMarque, enTeteLieu\]/);
  assert.ok(!/Sales OS — Lyon/.test(code), "le sous-titre du papier à en-tête était le nôtre, en dur");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * D'OÙ VIENT L'ADRESSE — la mention du PREMIER message (15/09/2026)
 *
 * La CNIL impose d'informer la personne quand ses coordonnées viennent d'un
 * tiers. Notre sourcing est intégralement indirect (arrêtés, profils,
 * feuilles) : l'obligation nous vise en plein, et rien ne la posait.
 *
 * Décision de Zakaria : au PREMIER message seulement. Informer une fois
 * remplit le texte ; le répéter à chaque relance alourdit sans rien ajouter
 * en droit.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠⚠ LA PROVENANCE EST EXIGÉE AU PREMIER MESSAGE, ET SEULEMENT LÀ", () => {
  const sansProvenance =
    "Camille de Vaubex : deux minutes pour vos acquéreurs ? Répondez STOP pour ne plus être contacté.";

  // Sur un PREMIER message : refusé, et le refus dit quoi écrire.
  const premier = verifieMentions(sansProvenance, "Camille", "Vaubex", "premier");
  assert.ok(
    premier.some((m) => /provenance/i.test(m)),
    `un premier message sans provenance doit être refusé. Manques : ${JSON.stringify(premier)}`
  );
  assert.ok(
    premier.some((m) => m.includes(MENTION_PROVENANCE.exemple)),
    "le refus doit porter une formulation utilisable — un garde qui refuse sans dire quoi écrire se fait désarmer"
  );

  /**
   * ⚠ LE CONTRE-TEST, ET IL EST OBLIGATOIRE. Sans lui, une règle qui
   * exigerait la provenance sur TOUS les messages passerait au vert — c'est
   * exactement l'option que Zakaria n'a PAS retenue.
   */
  assert.deepEqual(
    verifieMentions(sansProvenance, "Camille", "Vaubex", "suivant"),
    [],
    "une relance sans provenance est parfaitement licite : l'exiger refuserait un message juste"
  );
});

test("⚠ le motif de provenance exige les DEUX moitiés — sinon il n'informe de rien", () => {
  const dire = (corps: string) =>
    verifieMentions(
      `Camille de Vaubex. ${corps} Répondez STOP pour ne plus être contacté.`,
      "Camille",
      "Vaubex",
      "premier"
    ).some((m) => /provenance/i.test(m));

  // La formulation d'exemple passe — sinon on refuserait ce qu'on recommande.
  assert.equal(dire(MENTION_PROVENANCE.exemple), false, "l'exemple fourni doit satisfaire le motif");
  assert.equal(dire("J'ai trouvé vos coordonnées sur votre profil professionnel."), false);
  assert.equal(dire("Vos coordonnées sont issues de l'annuaire de la fédération."), false);

  /**
   * ⚠ Une moitié seule ne suffit pas, et c'est tout l'intérêt du couplage :
   *  · parler des coordonnées sans dire d'où elles viennent n'informe de rien ;
   *  · parler d'une source sans dire qu'il s'agit de SES coordonnées non plus.
   */
  assert.equal(dire("Votre adresse est la bonne, j'espère ?"), true, "possessif seul : pas une information de provenance");
  assert.equal(
    dire("Nos tarifs sont publiés sur notre site."),
    true,
    "source seule : « publié » et « site » parlent de NOUS, pas de la façon dont on l'a trouvé"
  );

  // Et le vocabulaire de vente ordinaire ne doit pas satisfaire le motif par accident.
  assert.equal(dire("Je peux vous trouver des acquéreurs."), true);
});

test("⚠⚠ LE RANG VIENT DU SERVEUR, JAMAIS DE L'APPELANT", () => {
  const code = sansCommentaires(lire("app/api/send/route.ts"));

  /**
   * Le point entier. Si le rang venait du corps de la requête, n'importe quel
   * appelant se dispenserait de la mention en annonçant « c'est une relance ».
   * La garde deviendrait déclarative — donc nulle.
   */
  assert.match(
    code,
    /const rang: RangMessage = \(await aDejaEcrit\(to, tenantId\)\) \? "suivant" : "premier"/,
    "le rang se calcule depuis le tracking, pas depuis la requête"
  );
  const iRang = code.indexOf("const rang: RangMessage");
  const iMentions = code.indexOf("const manques = verifieMentions");
  assert.ok(iRang > 0 && iRang < iMentions, "le rang se calcule AVANT le contrôle qui s'en sert");

  // Aucun champ de la requête ne doit pouvoir décider du rang.
  const blocRang = code.slice(iRang, iRang + 200);
  assert.ok(
    !/body\./.test(blocRang),
    "aucun champ du corps de requête ne doit entrer dans le calcul du rang"
  );
  assert.ok(!/body\.force/.test(blocRang), "et `force` encore moins");

  /**
   * ⚠ Le SMS n'est PAS tracé — la question n'a donc pas de réponse, et
   * l'inconnu vaut « premier ». Écrire "suivant" ici dispenserait chaque SMS
   * de la mention sur la foi d'une donnée qui n'existe pas.
   */
  assert.match(
    code,
    /verifieMentions\(body\.body, habillage\.closerName, marque, "premier"\)/,
    "faute de trace SMS, l'inconnu doit valoir « premier »"
  );
});

test("⚠⚠ aDejaEcrit REND « premier » SUR TOUTE PANNE — le repli n'est pas symétrique", () => {
  const src = lire("lib/tracking.ts");
  const i = src.indexOf("export async function aDejaEcrit");
  assert.ok(i > 0, "aDejaEcrit doit exister dans lib/tracking");
  const corps = src.slice(i, i + 1200);

  /**
   * Mettre la mention à quelqu'un qui l'a déjà lue coûte une phrase ;
   * l'omettre à quelqu'un qui ne l'a jamais lue est le manquement qu'on
   * corrige. Les deux erreurs ne coûtent pas pareil — donc une erreur de base
   * doit rendre `false` (= « premier » = mention exigée), jamais `true`.
   */
  assert.match(corps, /if \(error\) return false/, "une erreur de base doit mener à « premier »");
  assert.ok(
    !/if \(error\) return true/.test(corps),
    "rendre `true` sur une panne dispenserait de la mention au moment précis où l'on ne sait plus rien"
  );
});
