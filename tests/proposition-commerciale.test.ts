import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  emailPreDevis,
  estRefus,
  renderDevis,
  renderPreDevis,
  type CibleProposition,
  type MarqueProposition,
} from "../lib/proposition-commerciale";
import { SIEGES_MAX_ESTIMATION, type EtatCadrage } from "../lib/cadrage";

const marque: MarqueProposition = { societe: "Nuwacom", ville: "Luxembourg", signataire: "Camille" };
const cible: CibleProposition = { entreprise: "Agence Exemple", sieges: 12 };
const cadrageOk: EtatCadrage = {
  creneauIso: "2026-09-20T10:00:00.000Z",
  reelementTenu: true,
  validePar: "Zakaria",
};

test("⚠⚠ PAS DE DEVIS SANS CADRAGE — et la fonction ne rend PAS de document", () => {
  /**
   * La garde rend un REFUS plutôt qu'un document accompagné d'un drapeau.
   * Un `{ html, autorise: false }` aurait laissé le drapeau se faire ignorer :
   * l'appelant aurait eu un HTML sous la main, et un HTML sous la main finit
   * toujours par partir.
   */
  for (const manque of [
    { creneauIso: null },
    { reelementTenu: false },
    { validePar: null },
  ] as Partial<EtatCadrage>[]) {
    const d = renderDevis(cible, marque, { ...cadrageOk, ...manque }, 22_000);
    assert.ok(estRefus(d), `${JSON.stringify(manque)} : aucun document ne doit être produit`);
    assert.ok((d as { manquants: string[] }).manquants.length > 0, "et le refus doit NOMMER ce qui manque");
  }
});

test("cadrage tenu et validé → le devis se rend, daté et engageant", () => {
  const d = renderDevis(cible, marque, cadrageOk, 22_000);
  assert.ok(!estRefus(d));
  const doc = d as { html: string; engageant: boolean; titre: string };
  assert.equal(doc.engageant, true);
  assert.match(doc.html, /Devis/);
  assert.match(doc.html, /validé par Zakaria/, "le devis dit QUI a validé — sinon la garde est invisible");
  // ⚠ U+202F : `toLocaleString("fr-FR")` sépare les milliers avec une espace
  // insécable ÉTROITE, pas une espace. Troisième fois que ce piège fait
  // échouer une assertion sur un rendu parfaitement correct.
  assert.match(doc.html, /22[\s\u202f\u00a0]000 €/);
});

test("⚠⚠ LE PRÉ-DEVIS NE PEUT PAS PASSER POUR UN DEVIS", () => {
  const d = renderPreDevis(cible, marque)!;
  assert.equal(d.engageant, false);
  assert.ok(!/^Devis/.test(d.titre), `le titre ne doit pas commencer par « Devis » (vu : « ${d.titre} »)`);
  assert.match(d.html, /n&#39;est pas un devis|n'est pas un devis/, "il doit se nier lui-même, en toutes lettres");

  /**
   * ⚠ L'AVERTISSEMENT EST EN TÊTE, PAS EN PIED. Un lecteur qui découvre en bas
   * de page que ce n'est pas un devis a déjà lu le montant comme un
   * engagement — et c'est ce qu'il retiendra.
   */
  const iAvert = d.html.indexOf("pas un devis");
  const iMontant = d.html.indexOf("Première année");
  assert.ok(iAvert > 0 && iAvert < iMontant, "l'avertissement doit précéder le total");
});

test("⚠ LES RÉSERVES DE `cadrage` VOYAGENT DANS LE DOCUMENT", () => {
  // Elles ne sont pas réécrites ici : les recopier en ferait une seconde
  // version, et c'est celle qu'on ne relit pas qui finirait par mentir.
  const d = renderPreDevis(cible, marque)!;
  assert.match(d.html, /Alpha Voice/, "la voix non comprise doit être dite dans le document");
  assert.match(d.html, /cadrage/i);
  const src = readFileSync(join(process.cwd(), "lib/proposition-commerciale.ts"), "utf8");
  assert.match(src, /e\.reserves\.map\(/, "les réserves viennent du module, pas du gabarit");
});

test("⚠ AU-DELÀ DE LA BORNE, aucun pré-devis — la porte de derrière est fermée", () => {
  /**
   * `estimationPublique` refuse au-delà de la borne. Fabriquer un chiffre ici
   * contournerait ce refus par un autre chemin — exactement le genre de
   * seconde porte que ce dépôt paie à répétition.
   */
  assert.equal(renderPreDevis({ ...cible, sieges: SIEGES_MAX_ESTIMATION + 1 }, marque), null);
  assert.equal(renderPreDevis({ ...cible, sieges: 0 }, marque), null);
  assert.ok(renderPreDevis({ ...cible, sieges: SIEGES_MAX_ESTIMATION }, marque) !== null);
});

test("⚠ WHITE-LABEL : c'est la marque du COMPTE qui émet, jamais la nôtre", () => {
  // Un pré-devis partant d'un revendeur sous NOTRE raison sociale est le
  // défaut que `lib/signature.ts` a déjà payé quatre fois.
  const d = renderPreDevis(cible, marque)!;
  assert.match(d.html, /Nuwacom/);
  assert.ok(!/EAGLEYE/i.test(d.html), "aucun repli vers notre marque dans un document d'un autre compte");
  const e = emailPreDevis(cible, marque);
  assert.match(e.corps, /Nuwacom/);
  assert.ok(!/EAGLEYE/i.test(e.corps));
});

test("⚠⚠ L'EMAIL NE CHIFFRE RIEN — le montant vit avec ses réserves", () => {
  /**
   * Un chiffre répété dans le corps d'un email se retrouve cité hors contexte,
   * sans les trois lignes qui le bornent. Il reste dans la pièce jointe.
   */
  const e = emailPreDevis(cible, marque);
  assert.ok(!/\d[\d\s ]*€/.test(e.corps), `aucun montant dans le corps (vu : « ${e.corps.slice(0, 80)}… »)`);
  assert.match(e.corps, /pas un devis/, "mais il dit ce que c'est");
  assert.match(e.objet, /Agence Exemple/);
});

test("⚠ PAS DE DIVULGATION IA DANS CET EMAIL — un humain le relit et l'envoie", () => {
  /**
   * L'y écrire serait FAUX (`lib/signature-ia.ts` : la divulgation dit « vous
   * interagissez avec une IA », pas « une IA a aidé à écrire »). S'il devait
   * partir automatiquement, c'est `divulgation("email", "autonome")` qui
   * déciderait — pas ce gabarit.
   */
  const e = emailPreDevis(cible, marque);
  assert.ok(!/\bune?\s+ia\b|intelligence artificielle|assistant (ia|automatique)/i.test(e.corps));
});

test("⚠ ÉCHAPPEMENT : un nom d'entreprise ne peut pas injecter du HTML", () => {
  // Le nom vient d'un import CSV, donc de l'extérieur. Un `<script>` dans une
  // raison sociale est improbable — et c'est exactement pour ça qu'on ne le
  // verrait pas passer.
  const d = renderPreDevis({ entreprise: '<script>alert(1)</script>', sieges: 5 }, marque)!;
  assert.ok(!d.html.includes("<script>alert"), "le nom doit être échappé");
  assert.match(d.html, /&lt;script&gt;/);
});
