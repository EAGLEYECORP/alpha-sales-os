import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { verifieMentions } from "../lib/conformite";
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
 * aucun moyen de refus, et un email envoyé au nom de ScintIA arrivait avec
 * notre marque en papier à en-tête, notre raison sociale en pied et notre
 * aigle en logo.
 * ─────────────────────────────────────────────────────────────────────
 */

test("verifieMentions attrape ce qui manque vraiment dans un SMS", () => {
  const nu = "Bonjour, on peut vous faire gagner du temps. Rappelez-moi.";
  const manques = verifieMentions(nu, "Camille", "ScintIA");
  assert.ok(
    manques.some((m) => /refus/i.test(m)),
    "un SMS sans moyen de refus doit être signalé"
  );
  assert.ok(manques.some((m) => /Nom de l'expéditeur/i.test(m)));
  assert.ok(manques.some((m) => /Société/i.test(m)));

  const complet = "Camille de ScintIA : 2 min pour vos appels manqués ? Répondez STOP pour ne plus être contacté.";
  assert.deepEqual(verifieMentions(complet, "Camille", "ScintIA"), []);
});

/**
 * ⚠ Le contrôle doit rester déclenchable : un `verifieMentions` qui ne rend
 * jamais rien serait un `if (false)` déguisé. On vérifie donc les DEUX sens.
 */
test("verifieMentions ne se contente pas d'un placeholder", () => {
  const texte = `Le Closer de EAGLEYE CORP. Répondez STOP.`;
  const manques = verifieMentions(texte, CLOSER_USINE, "EAGLEYE CORP");
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

  const revendeur = habillageEnvoi({ accountId: "scintia", base: "https://x.fr" });
  assert.equal(revendeur.marque, "ScintIA");
  assert.equal(revendeur.logoUrl, undefined, "notre aigle ne part pas sur un compte revendeur");
  assert.ok(!/EAGLEYE/i.test(revendeur.addressLine), "ni notre raison sociale au pied");
  assert.match(revendeur.addressLine, /ScintIA/);
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
    /const manques = verifieMentions\(text, habillage\.closerName, marque\)/,
    "l'email se vérifie sur le texte rendu"
  );
  assert.match(code, /if \(manques\.length > 0\)[\s\S]{0,220}status: 422/);

  /**
   * Côté SMS, le contrôle porte sur `body.body` — c'est LITTÉRALEMENT ce qui
   * est transmis à Textbelt (`message: body.body`). Rien n'ajoute de pied.
   */
  assert.match(
    code,
    /const manquesSms = verifieMentions\(body\.body, habillage\.closerName, marque\)/,
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
    identiteEnvoi({ accountId: "scintia", closerName: "Camille", agencyName: "ScintIA" }),
    { accountId: "scintia", closerName: "Camille", agencyName: "ScintIA" }
  );

  /**
   * Le point qui compte : remplacer un nom vide par le libellé d'usine côté
   * client rendrait le trou invisible du côté serveur, qui le refuserait pour
   * une mauvaise raison — ou pas du tout.
   */
  assert.notEqual(identiteEnvoi({}).closerName, CLOSER_USINE);
  assert.equal(signataire("", "ScintIA").nom, "ScintIA", "à défaut de nom, la société identifie");
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
