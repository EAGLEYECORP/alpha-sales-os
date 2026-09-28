import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audienceBrief, audienceText, audiencePrompt } from "../lib/audience";
import { SEGMENTS } from "../lib/segments";

/**
 * Tout texte généré doit savoir POUR QUI il est écrit.
 *
 * Le rédacteur de posts recevait un sujet et un nom d'agence, rien de plus :
 * il produisait du « leadership tech » interchangeable. Un post qui ne nomme
 * personne ne convertit personne — le lecteur qui se reconnaît est le seul
 * qui répond, et il ne se reconnaît qu'à des détails de son métier.
 */

test("audience — il y a TOUJOURS une cible, même sans segment ni prospect", () => {
  // Le repli sur l'ICP du compte est le cœur du dispositif : un générateur
  // sans audience s'en réinvente une, générique, et on ne le voit pas.
  const a = audienceBrief({});
  assert.ok(a.label.length > 0, "un client visé, toujours");
  assert.ok(a.buyer.length > 0, "on sait qui signe");
  assert.ok(a.pains.length > 0, "au moins une douleur à nommer");
  assert.ok(a.angle.length > 0);
});

test("audience — le segment apporte le VOCABULAIRE du métier", () => {
  // C'est ce qui fait dire « c'est écrit pour moi » : les exemples concrets du
  // métier, pas une catégorie abstraite.
  const seg = SEGMENTS[0];
  const a = audienceBrief({ segmentId: seg.id });
  assert.equal(a.label, seg.label);
  assert.ok(a.vocabulaire.length > 0, "sans vocabulaire, le texte reste abstrait");
  assert.ok(a.pains.includes(seg.corePain), "la douleur centrale du segment doit être là");
});

test("audience — les mots du prospect passent AVANT ceux du segment", () => {
  // Ses problèmes à lui sont plus précis que la moyenne de son métier. Les
  // reléguer derrière le générique, c'est reperdre l'audit qu'on a fait.
  const a = audienceBrief({
    prospect: { sector: "artisan", company: "Carrosserie X", problems: ["le téléphone sonne pendant qu'on est sous un capot"] },
  });
  assert.equal(a.pains[0], "le téléphone sonne pendant qu'on est sous un capot");
});

test("audience — le bloc prompt impose la cible et interdit l'élargissement", () => {
  const txt = audiencePrompt({ segmentId: SEGMENTS[0].id });
  assert.match(txt, /À QUI CE TEXTE S'ADRESSE/);
  assert.match(txt, /ne pas élargir/i);
  // Le test de sortie : un texte publiable par n'importe qui est un texte raté.
  assert.match(txt, /une agence qui vend autre chose/);
  assert.match(txt, /À bannir/);
});

test("audience — aucun doublon de douleur, et la liste reste courte", () => {
  // Un prompt qui répète dilue la consigne : le modèle traite la répétition
  // comme du bruit, pas comme une insistance.
  const a = audienceBrief({ segmentId: SEGMENTS[0].id, prospect: { sector: "artisan", problems: [SEGMENTS[0].corePain] } });
  assert.equal(new Set(a.pains).size, a.pains.length, "une douleur ne doit apparaître qu'une fois");
  assert.ok(a.pains.length <= 5);
});

test("social — le rédacteur ET son gabarit hors-ligne reçoivent l'audience", () => {
  /**
   * Le gabarit compte autant que le prompt : sans clé IA, c'est LUI qui écrit.
   * Un gabarit générique annulerait tout le ciblage précisément quand on ne
   * peut pas rattraper à la main.
   */
  const src = readFileSync(join(process.cwd(), "app/api/social/draft/route.ts"), "utf8");
  assert.match(src, /audienceBrief\(/, "la route construit un brief");
  assert.match(src, /audienceText\(audience\)/, "le prompt porte le brief");
  assert.match(src, /fallbackDrafts\(topic, agency, audience/, "le gabarit hors-ligne aussi");
});

test("script de vente — la route IA porte aussi l'audience", () => {
  // La fiche donne les FAITS ; l'audience donne les MOTS de son métier.
  const src = readFileSync(join(process.cwd(), "app/api/ai/route.ts"), "utf8");
  assert.match(src, /audiencePrompt\(/);
});

test("audience — le texte ne contient jamais de montant", () => {
  // Ce bloc part dans des prompts publics-adjacents (posts sociaux). Doctrine
  // maison : jamais de prix avant la démo — un brief qui fuite un montant le
  // ferait écrire dans un post LinkedIn.
  for (const seg of SEGMENTS) {
    const txt = audienceText(audienceBrief({ segmentId: seg.id }));
    assert.doesNotMatch(txt, /\d[\d\s  ]*€/, `${seg.id} : un montant a fui dans le brief d'audience`);
  }
});
