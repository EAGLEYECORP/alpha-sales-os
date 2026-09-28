import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFFRES, auditBenefice, JARGON_INTERDIT, type EagleyeOffer } from "../lib/offer-match";
import { OFFRES_SYSTEME } from "../lib/offer-catalogue";
import { buildVoiceScript, auditScript, EXIGENCES_APPEL_FROID } from "../lib/voice-script";

const IDS = Object.keys(OFFRES) as EagleyeOffer[];
const base = { agentName: "ALPHA", onBehalfOf: "EAGLEYE CORP", company: "Carrosserie Test" };

/**
 * ─────────────────────────────────────────────────────────────────────
 * BÉNÉFICES SEULEMENT — la doctrine du 28/08/2026, tenue par une garde.
 *
 * ⚠ POURQUOI UNE GARDE ET PAS UNE CONSIGNE. La consigne « parle bénéfices »
 * existait déjà, en français, dans les commentaires. Le script d'appel ouvrait
 * quand même en diagnostic — « je voudrais comprendre comment vous suivez vos
 * demandes » — parce qu'une consigne écrite dans un commentaire ne s'exécute
 * pas. Ce fichier la rend exécutable.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠ AUCUNE offre livrée ne parle notre langue plutôt que celle du client", () => {
  for (const id of IDS) {
    const o = OFFRES[id];
    for (const [champ, texte] of [
      ["benefice", o.benefice],
      ["question", o.question],
      ["miseEnPlace", o.miseEnPlace],
    ] as const) {
      const v = auditBenefice(texte);
      assert.ok(
        v.ok,
        `${id}.${champ} contient du jargon : ${v.trouves.map((t) => `${t.mot} (${t.pourquoi})`).join(" · ")}`
      );
    }
  }
});

test("le catalogue éditable est tenu par la même règle que les offres du script", () => {
  /**
   * ⚠ Deux catalogues, une seule règle. `lib/offer-catalogue.ts` est ce que
   * l'OPÉRATEUR vend à SES prospects ; `lib/offer-match.ts` est ce qui se dit
   * au téléphone. Si seul le second était gardé, l'écran des offres
   * continuerait d'afficher des fiches produit pendant que l'agent, lui,
   * parlerait bénéfices — et le prospect lirait une chose en entendant l'autre.
   */
  for (const o of OFFRES_SYSTEME) {
    const v = auditBenefice(o.pitch);
    assert.ok(v.ok, `l'offre « ${o.label} » pitche du jargon : ${v.trouves.map((t) => t.mot).join(", ")}`);
  }
});

test("la garde attrape ce qu'elle doit attraper, et rien d'autre", () => {
  // Ce qu'on refuse : la fiche produit.
  for (const mauvais of [
    "Une solution d'automatisation de vos process commerciaux",
    "Notre plateforme SaaS s'intègre à votre CRM",
    "Une IA innovante pour optimiser votre pipeline",
    "L'intégration via API de notre agent vocal",
  ]) {
    assert.equal(auditBenefice(mauvais).ok, false, `devrait être refusé : ${mauvais}`);
  }

  /**
   * ⚠ Ce qu'on ACCEPTE, et qui est le cœur de la nuance : on interdit le NOM
   * abstrait, pas l'effet. « Se remplit tout seul » décrit exactement ce que
   * fait l'automatisation, sans jamais employer le mot — c'est ce qu'on veut
   * entendre, et une garde trop large le tuerait.
   */
  for (const bon of [
    "votre agenda se remplit tout seul pendant que vous travaillez",
    "vous ne perdez plus une seule demande",
    "les gens qui cherchent votre métier tombent sur vous",
    "vous ne rappelez que les gens qui comptent",
  ]) {
    const v = auditBenefice(bon);
    assert.ok(v.ok, `devrait passer : ${bon} — refusé pour ${v.trouves.map((t) => t.mot).join(", ")}`);
  }
});

test("chaque mot interdit porte la raison de son interdiction", () => {
  // Une liste de mots bannis sans raison se fait contourner à la première
  // relecture : personne ne sait plus pourquoi le mot était là.
  for (const j of JARGON_INTERDIT) {
    assert.ok(j.pourquoi.length > 30, `« ${j.mot} » est interdit sans raison écrite`);
    assert.ok(j.mot.length > 0);
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA COLLISION AVEC L'ARTICLE 50 — le piège que cette garde pouvait créer.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la garde du bénéfice n'attaque JAMAIS la divulgation légale", () => {
  /**
   * L'article 50 EU AI Act EXIGE que la première phrase dise qu'il s'agit
   * d'une intelligence artificielle. `JARGON_INTERDIT` bannit précisément ce
   * mot-là de l'argumentaire. Les deux règles sont justes et se
   * contrediraient si on auditait le SCRIPT au lieu des CHAMPS — et c'est
   * l'obligation légale qu'on serait tenté d'assouplir, parce que c'est elle
   * qui « bloque ».
   *
   * Ce test fige la séparation : le script conforme contient bien le mot,
   * l'audit de conformité le trouve, et l'audit du bénéfice ne le voit jamais.
   */
  const script = buildVoiceScript({ ...base, mode: "prospection-b2b", offre: "alpha-voice" });

  assert.match(script, /intelligence artificielle/i, "la divulgation obligatoire doit être là");
  assert.equal(auditScript(script, { mode: "prospection-b2b", offre: "alpha-voice" }).ok, true);

  // Et le mot interdit ne vient PAS des champs du catalogue.
  assert.equal(auditBenefice(OFFRES["alpha-voice"].benefice).ok, true);

  // Le script porte l'interdiction en clair pour l'agent — sinon il
  // reprendrait « intelligence artificielle » dans son argumentaire, puisque
  // c'est le premier mot qu'il a prononcé.
  assert.match(script, /au-delà de la phrase d'ouverture obligatoire/i);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA STRUCTURE DEMANDÉE : bénéfice → question fermée → « on met ça en
 * place » → rendez-vous → closing.
 * ─────────────────────────────────────────────────────────────────────
 */
test("le script sortant déroule bénéfice → question fermée → rendez-vous", () => {
  for (const id of IDS) {
    const script = buildVoiceScript({ ...base, mode: "prospection-b2b", offre: id });
    const o = OFFRES[id];

    const iBenefice = script.indexOf(o.benefice);
    const iQuestion = script.indexOf(o.question);
    const iMiseEnPlace = script.indexOf(o.miseEnPlace);

    assert.ok(iBenefice > 0, `${id} : le bénéfice doit être dit`);
    assert.ok(iQuestion > iBenefice, `${id} : la question vient APRÈS le bénéfice, jamais avant`);
    assert.ok(iMiseEnPlace > iQuestion, `${id} : « on met ça en place » ne se dit qu'après le oui`);

    // La question est FERMÉE : elle appelle oui ou non, pas un récit.
    assert.match(o.question, /^Vous aimeriez /, `${id} : la question doit appeler un oui ou un non`);
    assert.match(o.question, /\?$/);

    // Et le rendez-vous est nommé comme l'issue du oui.
    assert.match(script, /rendez-vous court avec un consultant/i);
  }
});

test("⚠ l'agent n'explique JAMAIS comment ça marche, et le refus est audité", () => {
  /**
   * Expliquer le mécanisme à froid fait deux dégâts en une phrase : ça donne
   * au prospect de quoi décider seul que « ce n'est pas pour moi », et ça vide
   * le rendez-vous de son contenu — c'est-à-dire de sa raison d'exister.
   */
  const exigence = EXIGENCES_APPEL_FROID.find((e) => /comment/i.test(e.label));
  assert.ok(exigence, "l'interdiction d'expliquer doit être une EXIGENCE auditée, pas une consigne en prose");

  const script = buildVoiceScript({ ...base, mode: "prospection-b2b", offre: "alpha-sales-os" });
  assert.match(script, exigence!.pattern);
  assert.match(script, /c'est précisément le sujet du rendez-vous/i, "l'agent doit avoir sa porte de sortie");

  // Un script amputé de cette règle est REFUSÉ, comme les autres exigences.
  const ampute = script.replace(/Tu n'expliques JAMAIS comment[^.]*\./, "");
  const verdict = auditScript(ampute, { mode: "prospection-b2b", offre: "alpha-sales-os" });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.manquantes.some((m) => /comment/i.test(m)));
});

test("le champ mort a été SUPPRIMÉ, pas gardé « au cas où »", () => {
  /**
   * `raisonAppel` portait l'ouverture en diagnostic. Une fois `benefice` en
   * place, plus rien ne le lisait. Le laisser avec un commentaire affirmant
   * qu'il servait encore aurait été un mensonge de commentaire — la pire
   * espèce, parce qu'elle survit à la relecture.
   */
  const src = readFileSync(join(process.cwd(), "lib/offer-match.ts"), "utf8");
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/raisonAppel/.test(sansCommentaires), "aucun code ne doit plus porter ce champ");
  assert.match(src, /`raisonAppel` a été SUPPRIMÉ/, "et sa disparition doit être expliquée là où on la chercherait");
});
