import test from "node:test";
import assert from "node:assert/strict";
import { verifieMentions } from "../lib/conformite";
import { buildTemplates, fillTemplate } from "../lib/templates";
import { plainText } from "../lib/email-html";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN GABARIT QUI NE PEUT PAS PARTIR DOIT CASSER LE BUILD, PAS L'ENVOI.
 *
 * ══ POURQUOI CE FICHIER EXISTE ══
 *
 * `/api/send` refuse un email dont les mentions obligatoires manquent : 422,
 * « rien ne part ». C'est la bonne décision, et elle ne bouge pas.
 *
 * Mais jusqu'ici, **rien ne vérifiait qu'un gabarit du produit puisse
 * effectivement les satisfaire.** La découverte se faisait donc au moment de
 * l'envoi, en production, sur une vraie campagne — c'est-à-dire au pire
 * moment : celui où l'on croit envoyer.
 *
 * Et une 4ᵉ mention a été ajoutée le 17/09 (la provenance de l'adresse, au
 * PREMIER message). Une mention de plus, c'est une raison de plus pour qu'un
 * gabarit devienne soudain inenvoyable sans que personne ne l'apprenne avant
 * la campagne suivante.
 *
 * ══ ⚠⚠ ON VÉRIFIE LE TEXTE RENDU, JAMAIS LE GABARIT NU ══
 *
 * Erreur commise en écrivant ce fichier, et corrigée avant de conclure : un
 * premier audit a mesuré `108 / 108 REFUSÉS` et c'était **faux**. Le pied
 * « STOP », la signature et la mention de plateforme sont ajoutés par le
 * RENDU (`plainText`), pas par le gabarit. Contrôler le corps saisi refuse
 * tous les emails du produit — le commentaire de `/api/send` le dit déjà, et
 * je ne l'avais pas lu avant de mesurer.
 *
 * ⚠ Même piège sur les OPTIONS : `buildTemplates({})` fait tomber `agency`
 * sur son repli d'usine `"l'agence"`, ce qui a produit un second faux
 * signalement (« 48 gabarits signent d'un libellé d'usine »). La production
 * appelle `buildTemplates({ agency: settings.agencyName })`. **Un test qui
 * n'utilise pas les paramètres de production mesure un produit qui n'existe
 * pas.**
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les paramètres de PRODUCTION, tels que `app/(app)/templates/page.tsx` les passe. */
const CLOSER = "Zakaria Tazi";
const AGENCE = "EAGLEYE CORP";
const gabarits = () => buildTemplates({ agency: AGENCE });
const rendu = (corps: string) =>
  plainText({
    closerName: CLOSER,
    agencyName: AGENCE,
    subject: "Objet de contrôle",
    replyTo: "contact@eagleyecorp.fr",
    body: fillTemplate(corps, null, CLOSER),
  } as Parameters<typeof plainText>[0]);

test("⚠⚠ CHAQUE GABARIT PEUT PARTIR EN PREMIER CONTACT", () => {
  /**
   * Le premier message est le plus exigeant : il doit porter les mentions de
   * TOUS les messages **plus** la provenance de l'adresse. C'est aussi le
   * seul rang qu'une campagne neuve utilise — donc celui dont l'échec se
   * découvrirait sur la première vraie campagne.
   */
  const refuses: string[] = [];
  for (const t of gabarits()) {
    const manques = verifieMentions(rendu(t.body), CLOSER, AGENCE, "premier");
    if (manques.length) refuses.push(`${t.id} → ${manques.join(" | ")}`);
  }
  assert.deepEqual(refuses, [], `des gabarits du produit sont inenvoyables :\n  ${refuses.join("\n  ")}`);
});

test("⚠ ET EN RELANCE — le rang ne doit pas devenir un piège inverse", () => {
  /**
   * Le contre-test. Sans lui, on pourrait satisfaire le premier rang en
   * imposant partout une mention qui n'a de sens qu'au premier contact — et
   * les relances deviendraient absurdes à lire sans que rien ne tombe.
   */
  const refuses: string[] = [];
  for (const t of gabarits()) {
    const manques = verifieMentions(rendu(t.body), CLOSER, AGENCE, "suivant");
    if (manques.length) refuses.push(`${t.id} → ${manques.join(" | ")}`);
  }
  assert.deepEqual(refuses, [], `des relances sont inenvoyables :\n  ${refuses.join("\n  ")}`);
});

test("⚠⚠ LE GARDE LIT LE TEXTE RENDU — et il tombe si on lui donne le corps nu", () => {
  /**
   * ⚠ MUTATION INTÉGRÉE AU TEST, parce que c'est l'erreur que j'ai commise et
   * que le prochain lecteur la commettra aussi.
   *
   * Si quelqu'un « simplifie » les deux tests ci-dessus en vérifiant
   * `t.body` au lieu de `rendu(t.body)`, ils continueront de s'appeler
   * « les gabarits peuvent partir » et mesureront l'inverse. Cette assertion
   * fige la différence : le corps NU est refusé, le corps RENDU passe. Le
   * jour où les deux se mettent d'accord, un des deux mécanismes a changé et
   * il faut le regarder.
   */
  const t = gabarits()[0];
  const nu = fillTemplate(t.body, null, CLOSER);
  assert.ok(
    verifieMentions(nu, CLOSER, AGENCE, "premier").length > 0,
    "le corps saisi ne porte PAS les mentions : elles sont ajoutées par le rendu",
  );
  assert.equal(
    verifieMentions(rendu(t.body), CLOSER, AGENCE, "premier").length,
    0,
    "et le texte rendu, lui, les porte",
  );
});

test("⚠ LE REPLI D'USINE DE `buildTemplates` NE DOIT PAS SE SERVIR EN SILENCE", () => {
  /**
   * `buildTemplates` fait tomber `agency` sur `"l'agence"` quand l'option est
   * vide. Ce n'est pas une faute en soi — c'est un repli. Mais il est
   * SILENCIEUX, alors que la doctrine de ce dépôt exige qu'un repli d'usine
   * soit VISIBLE (`identiteDUsine`, `signataire().usine`) : « le libellé
   * d'usine, rendu visible au lieu d'être masqué ».
   *
   * Ce test ne corrige pas cette asymétrie — il la DOCUMENTE et la borne :
   * le repli existe, il est atteignable, et un gabarit ainsi replié reste
   * LÉGALEMENT envoyable. Ce qu'il perd est l'identité, pas la conformité.
   * Le jour où quelqu'un s'appuie dessus pour une vraie campagne, c'est
   * `identiteDUsine` côté écran qui doit prévenir, pas ce test.
   */
  const repli = buildTemplates({});
  assert.ok(
    repli.some((t) => /l['’]agence/.test(t.body)),
    "le repli d'usine existe bien — s'il disparaît, ce test doit être relu, pas supprimé",
  );
  const manques = verifieMentions(rendu(repli[0].body), CLOSER, AGENCE, "premier");
  assert.deepEqual(manques, [], "un gabarit replié reste envoyable : il perd l'identité, pas la conformité");
});
