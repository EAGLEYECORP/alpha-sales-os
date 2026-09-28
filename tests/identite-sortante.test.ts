import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inviteText, messageText, relanceText, textForStep, buildLinkedinQueue } from "../lib/linkedin-sequence";
import { emailBody } from "../lib/mail-compose";
import { buildArgumentaire, argumentaireText } from "../lib/argumentaire";
import { seedProspects } from "../lib/seed";
import { ACCOUNTS } from "../lib/accounts";
import { CLOSER_USINE, presentation } from "../lib/signature";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PRODUIT EST WHITE-LABEL : RIEN DE SORTANT NE PORTE NOTRE IDENTITÉ.
 *
 * ⚠ `lib/signature.ts` existe depuis longtemps et son en-tête énumère les
 * QUATRE fichiers qui répondaient chacun autre chose à « qui signe ? ».
 * Le balayage s'était arrêté aux fichiers qui écrivent des EMAILS.
 *
 * Sont restés en dehors, et découverts le 11/09/2026 :
 *  · `lib/linkedin-sequence.ts` — les TROIS messages signaient « <prénom> —
 *    EAGLEYE CORP » ; un revendeur qui utilise la file envoyait donc ses
 *    invitations sous notre raison sociale, à SES prospects ;
 *  · `lib/argumentaire.ts` — « je suis <prénom>, de {compte} », et ce
 *    script-là se PRONONCE au téléphone ;
 *  · `lib/mail-compose.ts` — le repli d'agence était notre raison sociale, et
 *    la ville de signature était « Lyon » en dur.
 *
 * Ce n'est pas cosmétique. Dans un message commercial envoyé sous une autre
 * marque, c'est une usurpation d'identité — et `MENTIONS_OBLIGATOIRES`
 * (lib/conformite.ts) impose justement « nom + société » exacts.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Les modules qui PRODUISENT du texte lu ou entendu par un prospect.
 *
 * ⚠ Liste tenue à la main, et elle le dit : il n'existe pas de marqueur qui
 * distingue « module qui parle au prospect » de « module interne ». Un
 * fichier neuf n'y entre pas tout seul — c'est la limite de ce garde, pas un
 * oubli. Ce qu'il tient, c'est que les cinq points d'appel CONNUS ne se
 * rouvrent pas, et le test de rendu plus bas rattrape le reste.
 */
const MODULES_SORTANTS = [
  "lib/linkedin-sequence.ts",
  "lib/argumentaire.ts",
  "lib/mail-compose.ts",
  "lib/gmail-draft.ts",
  "lib/email-html.ts",
  "lib/audit-doc.ts",
  "lib/templates.ts",
  "lib/approche-ecrite.ts",
];

/**
 * ⚠ EXEMPTION NOMMÉE, AVEC SON MOTIF. `lib/voice-script.ts` porte une chaîne
 * qui CITE notre nom pour énoncer la règle : « Sur l'appel d'un partenaire,
 * on ne vend que son produit. Mentionner EAGLEYE … ». C'est un message
 * d'audit destiné à l'opérateur, pas au prospect. L'effacer laisserait la
 * garde sans sa raison — la doctrine du dépôt l'interdit explicitement.
 */

const NOTRE_MARQUE = /\bEAGLEYE\b/i;

function litterauxDe(fichier: string): string[] {
  const src = readFileSync(join(process.cwd(), fichier), "utf8");
  // Les commentaires d'abord : expliquer POURQUOI un nom en dur était un
  // défaut doit rester permis, sinon on efface la décision avec le bug.
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...sansCommentaires.matchAll(/"[^"]*"|'[^']*'|`[^`]*`/g)].map((m) => m[0]);
}

test("⚠⚠ AUCUN MODULE SORTANT NE PORTE NOTRE MARQUE EN DUR", () => {
  /**
   * ⚠ CE GARDE A REFUSÉ UNE LIGNE JUSTE À SA PREMIÈRE RÉDACTION :
   * `accountId = "eagleye"`, la valeur par défaut d'un paramètre de ROUTAGE.
   * Un identifiant de compte n'est pas une marque dans une phrase — il ne part
   * dans aucun message, il sert à choisir lequel parle.
   *
   * L'exemption est DÉRIVÉE de `ACCOUNTS`, pas écrite à la main : un compte
   * ajouté demain est exempté sans qu'on y pense, et une marque en prose ne
   * peut pas s'y glisser puisqu'elle ne sera jamais ÉGALE à un identifiant.
   * Resserrer le jour même — un garde qui refuse une phrase vraie est un garde
   * qu'on assouplira au mauvais endroit la fois suivante.
   */
  const identifiants = new Set(ACCOUNTS.map((a) => a.id));
  const contenu = (lit: string) => lit.slice(1, -1);

  /**
   * ⚠ L'EXCEPTION EST NOMMÉE, AVEC SON MOTIF — c'est la règle du dépôt, et ce
   * n'est pas un assouplissement de confort.
   *
   * `lib/email-html.ts` a DÉJÀ subi cette correction : son en-tête raconte le
   * retrait du bandeau « Eagleye Corp · Lyon » posé sous le pied expéditeur,
   * là où l'œil lit « qui m'écrit ». Ce qui reste est la mention de
   * PLATEFORME, et CLAUDE.md la sanctionne explicitement : « Seule survit la
   * mention de plateforme (« Envoyé avec Alpha Sales OS® »), qui nomme
   * l'éditeur de l'outil et reste vraie partout. »
   *
   * Un éditeur de logiciel n'est pas l'expéditeur d'un message : la mention
   * reste vraie quel que soit le compte qui écrit. L'exemption est donc
   * limitée à CETTE forme — elle exige le préfixe « Envoyé avec », pour qu'on
   * ne puisse pas y glisser une signature déguisée en mention de plateforme.
   */
  const MENTION_PLATEFORME = /^Envoyé avec ALPHA SALES OS®/;

  const fautes: string[] = [];
  for (const f of MODULES_SORTANTS) {
    for (const lit of litterauxDe(f)) {
      if (identifiants.has(contenu(lit))) continue;
      if (MENTION_PLATEFORME.test(contenu(lit))) continue;
      if (NOTRE_MARQUE.test(lit)) fautes.push(`${f} → ${lit.slice(0, 90)}`);
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "notre raison sociale est écrite en dur dans du texte sortant — sur un compte " +
      "revendeur, elle part sous SA marque :\n  " + fautes.join("\n  ")
  );
});

test("⚠⚠ CHAQUE COMPTE SIGNE SOUS SA PROPRE MARQUE", () => {
  /**
   * ⚠⚠ LE TEST QUI COMPTE, et il ne lit pas de source : il construit les
   * messages réellement produits, pour CHAQUE compte du portefeuille, et
   * vérifie qu'aucun ne nomme un AUTRE compte que le sien.
   *
   * C'est la seule forme qui survit à une réécriture : peu importe d'où vient
   * le nom, il doit être celui du compte au nom duquel on écrit.
   */
  const p = seedProspects[0];
  assert.ok(p, "aucune fiche — le test ne mesure rien");
  assert.ok(ACCOUNTS.length >= 2, `portefeuille à ${ACCOUNTS.length} compte(s) : rien à croiser`);

  for (const compte of ACCOUNTS) {
    const sortants: Array<[string, string]> = [
      ["invitation LinkedIn", inviteText(p, compte.id)],
      ["message LinkedIn", messageText(p, undefined, compte.id)],
      ["relance LinkedIn", relanceText(p, compte.id)],
      ["corps email", emailBody(p, { accountId: compte.id })],
      ["argumentaire", argumentaireText(buildArgumentaire(p, compte.id))],
    ];

    for (const [ou, texte] of sortants) {
      for (const autre of ACCOUNTS) {
        if (autre.id === compte.id) continue;
        assert.ok(
          !texte.includes(autre.name),
          `${compte.name} · ${ou} : le texte nomme « ${autre.name} », qui n'est pas ce compte`
        );
      }
    }
  }
});

test("⚠ SANS NOM SAISI, ON SIGNE DE LA SOCIÉTÉ — jamais d'un prénom deviné", () => {
  /**
   * L'ordre de repli de `lib/signature.ts` : nom saisi → RAISON SOCIALE →
   * libellé d'usine rendu visible. Ce qui est interdit, c'est d'inventer
   * l'identité d'un humain. Une raison sociale, elle, identifie légalement et
   * appartient bien à l'expéditeur.
   *
   * ⚠ Le libellé d'usine ne doit pas non plus partir en silence : il existe
   * pour être SIGNALÉ. Qu'il apparaisse dans un message signifie qu'on a
   * écrit à un prospect sans savoir qui signe.
   */
  const p = seedProspects[0];
  for (const compte of ACCOUNTS) {
    const texte = inviteText(p, compte.id);
    assert.ok(texte.includes(compte.name), `${compte.name} : l'invitation ne nomme pas le compte`);
    assert.ok(
      !texte.includes(CLOSER_USINE),
      `${compte.name} : le libellé d'usine « ${CLOSER_USINE} » part dans un message`
    );
  }
});

test("⚠ le nom saisi PRIME, et il traverse jusqu'au texte", () => {
  /**
   * Le défaut documenté dans ce même fichier — « le paramètre qui meurt au
   * dernier saut » — s'était reproduit : `relanceText(p)` était appelée sans
   * compte NI signataire par `textForStep`, alors que les deux autres étapes
   * les recevaient. Corrigé à un endroit, oublié à l'autre.
   */
  /**
   * ⚠⚠ CE TEST REMPLACE UN MOTIF QUI NE POUVAIT PAS MARCHER.
   *
   * Le garde de source ci-dessus cherche NOTRE RAISON SOCIALE. Il ne voit donc
   * pas un PRÉNOM en dur — or `lib/signature.ts` appelle justement celui du
   * propriétaire « le pire des quatre ». Mesuré par mutation : remettre
   * « je suis <prénom>, de {compte} » dans l'argumentaire ne faisait tomber
   * AUCUN test, parce que le texte nommait quand même le bon compte.
   *
   * On ne met donc aucun nom dans un motif : on passe un nom SAISI et on exige
   * qu'il ressorte. Un texte qui en porte un autre en dur échoue, quel qu'il
   * soit — et personne n'a besoin d'écrire lequel.
   */
  const p = seedProspects[0];
  const NOM = "Camille Dupont";
  const sorties: Array<[string, string]> = [
    ["invitation", inviteText(p, "eagleye", NOM)],
    ["message", messageText(p, undefined, "eagleye", NOM)],
    ["relance", relanceText(p, "eagleye", NOM)],
    // ⚠ Ce script-là se PRONONCE : l'appelant se présente à voix haute.
    ["argumentaire", argumentaireText(buildArgumentaire(p, "eagleye", { closerName: NOM }))],
    /**
     * ⚠⚠ ET SURTOUT PAR `textForStep`, QUI EST LE VRAI CHEMIN. Les trois
     * appels directs au-dessus ne prouvent rien du câblage : le défaut
     * documenté dans `linkedin-sequence.ts` — « le paramètre qui meurt au
     * dernier saut » — s'était reproduit exactement là, sur l'étape relance,
     * pendant que les deux autres étaient corrigées. Mesuré : le remettre ne
     * faisait tomber aucun test tant que ces lignes-ci n'existaient pas.
     */
    ["étape invitation", textForStep(p, "invitation", undefined, "eagleye", NOM)],
    ["étape message", textForStep(p, "message", undefined, "eagleye", NOM)],
    ["étape relance", textForStep(p, "relance", undefined, "eagleye", NOM)],
  ];
  for (const [ou, texte] of sorties) {
    assert.ok(texte.includes(NOM), `${ou} : le nom saisi n'arrive pas jusqu'au texte`);
  }

  // La file complète : c'est elle qu'un opérateur utilise réellement.
  const file = buildLinkedinQueue(seedProspects, { accountId: "eagleye", closerName: NOM });
  assert.ok(file.length > 0, "file vide — le test ne mesure rien");
  for (const t of file) {
    assert.ok(t.text.includes(NOM), `file · ${t.step} · ${t.prospect.company} : le nom saisi n'y est pas`);
  }
});

test("⚠⚠ ON NE SE PRÉSENTE PAS DEUX FOIS SOUS LE MÊME NOM", () => {
  /**
   * ⚠⚠ DÉFAUT QUE LA CORRECTION PRÉCÉDENTE A CRÉÉ, et qui était déjà poussé.
   *
   * `signataire` rend la RAISON SOCIALE quand aucun nom n'est saisi — c'est le
   * repli documenté et voulu. Une phrase écrite « je suis {nom}, de {société} »
   * produit alors « je suis EAGLEYE CORP, de EAGLEYE CORP ». Le défaut
   * n'existait pas tant qu'un prénom était en dur : le remplacer l'a fabriqué.
   *
   * Vu en IMPRIMANT le script des six secteurs, pas en le relisant. C'est la
   * troisième fois de la journée qu'une faute de français ne se voit qu'au
   * rendu — « les ceux », « les les », et maintenant celle-ci.
   *
   * Le garde cherche la RÉPÉTITION, pas une chaîne : un même nom deux fois
   * dans la phrase de présentation, quel que soit ce nom.
   */
  const p = seedProspects[0];
  for (const compte of ACCOUNTS) {
    const sortants: Array<[string, string]> = [
      ["argumentaire", argumentaireText(buildArgumentaire(p, compte.id))],
      ["invitation LinkedIn", inviteText(p, compte.id)],
    ];
    for (const [ou, texte] of sortants) {
      const occurrences = texte.split(compte.name).length - 1;
      const presentation = texte.match(/je suis [^.»]{0,120}/)?.[0] ?? "";
      assert.ok(
        (presentation.split(compte.name).length - 1) <= 1,
        `${compte.name} · ${ou} : la présentation nomme la société deux fois — « ${presentation} »`
      );
      assert.ok(occurrences >= 1, `${compte.name} · ${ou} : la société n'est jamais nommée`);
    }
  }
});

test("⚠ l'élision suit le nom du compte, elle n'est pas écrite en dur", () => {
  /**
   * « d'EAGLEYE CORP » mais « de Nuwacom ». Les textes en dur portaient
   * l'apostrophe : tout compte à consonne initiale aurait produit
   * « je suis X, d'Nuwacom ». La règle vit dans `lib/signature.ts`, une seule
   * fois — elle était sur le point d'être recopiée dans un deuxième fichier.
   *
   * ⚠ On n'élide PAS devant un h : « de Hxxx » est toujours correct, « d'Hxxx »
   * dépend du h aspiré, qu'aucune règle mécanique ne tranche.
   */
  assert.equal(presentation("Marc Perrin", "EAGLEYE CORP"), "je suis Marc Perrin, d'EAGLEYE CORP");
  assert.equal(presentation("Marc Perrin", "Nuwacom"), "je suis Marc Perrin, de Nuwacom");
  assert.equal(presentation("Marc Perrin", "Hauts Bâtisseurs"), "je suis Marc Perrin, de Hauts Bâtisseurs");
  // Sans nom saisi : la société, UNE fois.
  assert.equal(presentation(undefined, "EAGLEYE CORP"), "je suis EAGLEYE CORP");
  assert.equal(presentation(undefined, "Nuwacom", "Lyon"), "je suis Nuwacom, à Lyon");
});
