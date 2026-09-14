import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIVULGATION_ECRITE,
  MENTION_PLATEFORME,
  divulgation,
  verifieDivulgation,
} from "../lib/signature-ia";

test("⚠⚠ LES DEUX ERREURS SONT SYMÉTRIQUES — et la seconde rend la promesse défendable", () => {
  /**
   * « Toute interaction menée par l'IA le dit, le reste est un humain » n'a de
   * valeur que si le SECOND membre est vrai. Une app qui signe tout « IA » ne
   * prouve rien : elle dit seulement qu'elle n'a pas regardé.
   */
  const auto = divulgation("email", "autonome");
  assert.equal(auto.obligatoire, true);
  assert.equal(auto.interdite, false);

  const relu = divulgation("email", "valide-par-humain");
  assert.equal(relu.obligatoire, false);
  assert.equal(relu.interdite, true, "signer « IA » un message qu'un humain a envoyé est un MENSONGE");
  assert.equal(relu.mention, null);
  assert.match(relu.motif, /FAUX/);
});

test("⚠ « pas obligatoire » et « interdite » ne sont PAS la même chose", () => {
  // Un booléen unique aurait confondu « tu peux » et « tu ne dois pas ».
  // C'est cette distinction qui empêche un opérateur bien intentionné de
  // signer « IA » partout « pour être transparent » — et de mentir.
  for (const mode of ["valide-par-humain", "ecrit-par-humain"] as const) {
    const v = divulgation("email", mode);
    assert.equal(v.obligatoire, false);
    assert.equal(v.interdite, true, `${mode} : l'aveu serait faux, pas seulement superflu`);
  }
});

test("⚠⚠ C'EST LE MODE QUI DÉCIDE, JAMAIS LE CANAL", () => {
  /**
   * Router sur le canal aurait signé « IA » toute la boîte d'envoi, y compris
   * les messages que quelqu'un a réellement écrits. Le même canal donne deux
   * verdicts opposés selon qui a appuyé sur envoyer.
   */
  for (const canal of ["email", "sms", "linkedin", "chat-site"] as const) {
    assert.equal(divulgation(canal, "autonome").obligatoire, true, `${canal} autonome`);
    assert.equal(divulgation(canal, "valide-par-humain").interdite, true, `${canal} relu`);
  }
});

test("⚠ L'APPEL AUTONOME N'AJOUTE PAS DE MENTION ÉCRITE — elle se PRONONCE", () => {
  // La divulgation vocale tombe dans la PREMIÈRE PHRASE, prononcée par le code
  // avec `allow_interruptions=False`. Un pied de message n'aurait aucun sens
  // au téléphone, et le proposer ferait croire que l'obligation est couverte.
  const v = divulgation("appel", "autonome");
  assert.equal(v.obligatoire, true, "l'obligation existe bel et bien");
  assert.equal(v.mention, null, "mais elle ne se satisfait pas d'un texte ajouté");
  assert.match(v.motif, /PRONONCÉE/);
});

test("divulgation MANQUANTE sur un envoi autonome → refus, et le motif l'explique", () => {
  const p = verifieDivulgation("Bonjour, je reviens vers vous au sujet de votre demande.", "email", "autonome");
  assert.equal(p.length, 1);
  assert.match(p[0], /manquante/i);
});

test("divulgation EN TROP sur un message relu → refus aussi, et c'est le point", () => {
  const p = verifieDivulgation(
    "Bonjour, ce message est envoyé par un assistant IA. Je reviens vers vous.",
    "email",
    "valide-par-humain",
  );
  assert.equal(p.length, 1);
  assert.match(p[0], /FAUX/);
});

test("⚠ on cherche la FORME de l'aveu, pas la phrase au mot près", () => {
  /**
   * Un opérateur a le droit de reformuler. Exiger le texte exact ferait
   * refuser des messages conformes, et on finirait par désarmer le garde —
   * la leçon déjà payée deux fois par `InterditFroid`.
   */
  for (const variante of [
    DIVULGATION_ECRITE,
    "Je suis un assistant automatique, pas une personne.",
    "Vous échangez avec une IA.",
    "Ce message provient d'un agent virtuel.",
    "Rédigé par intelligence artificielle.",
  ]) {
    assert.deepEqual(verifieDivulgation(variante, "email", "autonome"), [], `« ${variante} » doit passer`);
  }
});

test("⚠ LES MOTS ORDINAIRES NE DÉCLENCHENT RIEN — sinon le garde refuse du vrai", () => {
  // Contre-test. « intelligence », « agent commercial », « automatiser » sont
  // du vocabulaire courant chez nous : s'ils déclenchaient l'aveu, un message
  // humain parfaitement légitime serait accusé de mentir.
  for (const phrase of [
    "Notre agent commercial passera vous voir mardi.",
    "On peut automatiser vos relances.",
    "Votre équipe a une vraie intelligence du terrain.",
    "Je vous rappelle demain.",
  ]) {
    assert.deepEqual(
      verifieDivulgation(phrase, "email", "valide-par-humain"),
      [],
      `« ${phrase} » est un message humain légitime`,
    );
  }
});

test("⚠ LA MENTION DE PLATEFORME N'EST PAS UNE DIVULGATION", () => {
  /**
   * Elle nomme l'OUTIL, pas l'auteur — et c'est la seule chose qui survit au
   * white-label (marque, adresse et logo suivent le COMPTE). Les confondre
   * ferait croire qu'un pied « Généré avec… » couvre l'obligation légale.
   */
  assert.deepEqual(
    verifieDivulgation(`Bonjour. ${MENTION_PLATEFORME}`, "email", "autonome"),
    [
      // Elle ne suffit PAS : l'aveu manque toujours.
      ...verifieDivulgation("Bonjour.", "email", "autonome"),
    ],
    "la mention d'outil ne couvre pas l'obligation de divulgation",
  );
  // Et elle ne DÉCLENCHE pas non plus le refus sur un message relu.
  assert.deepEqual(verifieDivulgation(`Bonjour. ${MENTION_PLATEFORME}`, "email", "valide-par-humain"), []);
});

test("⚠ la divulgation écrite est déclarée à UN endroit", () => {
  // Le script vocal a la sienne (première phrase, prononcée par le code).
  // Deux TEXTES pour deux canaux, mais UNE règle qui décide s'ils s'appliquent.
  const src = readFileSync(join(process.cwd(), "lib/signature-ia.ts"), "utf8");
  assert.match(src, /export const DIVULGATION_ECRITE/);
  assert.match(DIVULGATION_ECRITE, /STOP/, "le moyen de refus voyage avec l'aveu");
});

test("⚠⚠ LA RÈGLE EST BRANCHÉE DANS /api/send — la vitrine la PROMETTAIT DÉJÀ", () => {
  /**
   * ══ LE DÉFAUT LE PLUS GRAVE DE LA SESSION, ET IL ÉTAIT DE MOI ══
   *
   * `lib/signature-ia.ts` était juste, testé, mutation-testé — et importé par
   * PERSONNE. Pendant ce temps la vitrine affirmait « quand c'est l'IA qui
   * mène l'échange, elle le dit ». Une promesse invérifiable sur une page
   * publique : exactement ce que `tests/vitrine-fuite` refuse ailleurs, sauf
   * que celle-ci venait d'être ajoutée par la correction elle-même.
   *
   * La garde vit dans `/api/send` — le SEUL endroit d'où un message part.
   */
  const src = readFileSync(join(process.cwd(), "app/api/send/route.ts"), "utf8");
  assert.match(src, /from "@\/lib\/signature-ia"/, "la route doit consulter le module");
  assert.match(src, /verifieDivulgation\(text, "email"/, "sur le texte RENDU, comme les mentions");
  assert.match(src, /verifieDivulgation\(body\.body, "sms"/, "et sur le SMS, où rien ne s'ajoute");

  /**
   * ⚠⚠ ON ASSERTE LA CONDITION, PAS LA PRÉSENCE DU REFUS. Première rédaction :
   * je vérifiais que `verifieDivulgation` était appelé — et la mutation
   * `if (false)` laissait l'appel en place, donc le test au vert, avec le
   * contrôle désarmé. C'est le piège que la doctrine nomme mot pour mot
   * (« asserter la PRÉSENCE du refus au lieu de la CONDITION qui y mène ») et
   * que ce dépôt a déjà payé quatre fois sur la validation partenaire.
   */
  assert.match(src, /if \(divulg\.length > 0\) \{/, "le refus doit dépendre du RÉSULTAT, pas d'une constante");
  assert.match(src, /if \(divulgSms\.length > 0\) \{/, "idem pour le SMS");
  assert.match(src, /modeProduction: ModeProduction;/, "le mode doit être REQUIS côté TypeScript");
});

test("⚠⚠ ABSENT ⇒ AUTONOME — le repli est celui qui REFUSE", () => {
  /**
   * Sens fail-closed, et il n'est pas symétrique : un expéditeur automatique
   * qui oublie le champ se fait refuser (bruyant, immédiat, réparable) ;
   * l'inverse le laisserait démarcher sans se déclarer — illégal, et invisible
   * jusqu'à la plainte.
   */
  const src = readFileSync(join(process.cwd(), "app/api/send/route.ts"), "utf8");
  assert.match(src, /body\.modeProduction \?\? "autonome"/, "le repli doit être le mode STRICT");
  assert.ok(
    !/body\.modeProduction \?\? "valide-par-humain"/.test(src),
    "un repli permissif laisserait passer un envoi automatique non déclaré",
  );
});

test("⚠ LES QUATRE APPELANTS DÉCLARENT LEUR MODE — sinon ils tombent tous en 422", () => {
  /**
   * Conséquence directe du repli strict : sans déclaration, chaque envoi
   * HUMAIN serait refusé pour divulgation manquante. Les quatre appelants sont
   * des gestes humains — quelqu'un clique — donc `valide-par-humain`.
   *
   * ⚠ Mesuré : aucun ne le déclarait après le branchement. Le type ne les
   * force pas (ils construisent le JSON à la main), donc c'est ce test qui
   * tient — et c'est lui qui attrapera le cinquième appelant.
   */
  for (const f of [
    "components/send-bar.tsx",
    "components/campaigns/campaign-review.tsx",
    "app/(app)/newsletter/page.tsx",
    "components/recette/go-live-checklist.tsx",
  ]) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    assert.match(src, /modeProduction:/, `${f} doit déclarer qui parle`);
  }
});
