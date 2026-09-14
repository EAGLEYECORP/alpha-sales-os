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

test("⚠⚠ LA SORTIE VISIO EXISTE — un ordre de grandeur sans porte de sortie ne produit rien", () => {
  /**
   * C'est la moitié manquante d'un pré-devis. Un chiffre sans « et maintenant
   * quoi ? » laisse le lecteur avec un montant et rien à en faire — donc il ne
   * fait rien. Deux chemins, parce qu'il y a deux états après lecture : le
   * chiffre passe, ou il reste des questions. Le second n'est pas un échec :
   * c'est ce que le cadrage sert à traiter, et c'est lui qui débloque le devis.
   */
  const avecLien = { ...marque, bookingUrl: "https://cal.example/nuwacom" };
  const d = renderPreDevis(cible, avecLien)!;
  assert.match(d.html, /visio/i, "le document doit proposer la visio");
  assert.match(d.html, /cal\.example/, "et porter le lien quand il existe");

  const e = emailPreDevis(cible, avecLien);
  assert.match(e.corps, /visio/i);
  assert.match(e.corps, /cal\.example/);
});

test("⚠⚠ SANS LIEN DE RÉSERVATION, ON N'EN INVENTE PAS — on propose de répondre", () => {
  /**
   * Écrire « prenez rendez-vous ici » sans lien, ou fabriquer une URL, envoie
   * le prospect dans le mur au moment précis où il était d'accord. C'est la
   * façon la plus chère de perdre un oui. Idiome repris de
   * `lib/linkedin-sequence.ts`.
   */
  const d = renderPreDevis(cible, marque)!; // marque SANS bookingUrl
  assert.match(d.html, /visio/i, "la visio reste proposée");
  assert.ok(!/href="[^"]*"/.test(d.html), "mais aucun lien fabriqué");
  assert.match(d.html, /Répondez/i, "et on dit quoi faire à la place");

  const e = emailPreDevis(cible, marque);
  assert.ok(!/https?:\/\//.test(e.corps), `aucune URL inventée dans l'email`);
  assert.match(e.corps, /deux créneaux/i);
});

test("⚠ LA VISIO SE PRÉSENTE COMME LE CADRAGE, pas comme une démo de plus", () => {
  // Elle doit dire à quoi elle sert — arrêter le périmètre — sinon elle se lit
  // comme un rendez-vous de courtoisie qu'on décale indéfiniment. Et c'est
  // elle qui débloque le devis : le lien entre les deux doit être écrit.
  const e = emailPreDevis(cible, { ...marque, bookingUrl: "https://cal.example/x" });

  /**
   * ⚠ ON VISE LA PHRASE DE LA VISIO, PAS L'EMAIL ENTIER. Première rédaction :
   * je cherchais « périmètre » et « devis » n'importe où — et la réserve
   * « ce n'est pas un devis : le périmètre se décide au cadrage » les contient
   * DÉJÀ. La mutation qui retirait la raison d'être de la visio passait donc au
   * vert. Un garde qui cherche un mot au lieu de son point d'usage ne garde
   * rien : c'est la quatrième fois de la session.
   */
  const phrase = e.corps
    .split(/\n/)
    .find((l) => /visio/i.test(l));
  assert.ok(phrase, "l'email doit porter une phrase sur la visio");
  assert.match(phrase!, /périmètre/i, "elle doit dire à quoi sert la visio : arrêter le périmètre");
  assert.match(phrase!, /devis/i, "et ce qu'elle débloque — sinon c'est un rendez-vous de courtoisie");
});

test("⚠⚠ LE PRÉ-DEVIS EST ATTEIGNABLE DEPUIS LA FICHE — dernier maillon", () => {
  /**
   * `renderPreDevis` et `emailPreDevis` étaient justes, testés, vérifiés au
   * rendu — et appelés par AUCUN écran. Le défaut récurrent du dépôt, sur la
   * chaîne qu'on venait précisément de construire pour obtenir des
   * rendez-vous : elle s'arrêtait juste avant d'être utilisable.
   */
  const page = readFileSync(join(process.cwd(), "app/(app)/prospects/[id]/page.tsx"), "utf8");
  assert.match(page, /<PreDevisPanel\b/, "la fiche doit monter le panneau");

  /**
   * ⚠ ET DANS L'ONGLET COMMERCIAL, PAS DANS L'AUDIT. Je l'avais d'abord posé à
   * côté des outils de deep-dive — c'est là que vivent les autres documents
   * imprimables, et c'était le mauvais critère : un audit se donne pour OUVRIR
   * une conversation, un pré-devis la CONCLUT. Vu au rendu : l'onglet audit
   * n'est pas celui qu'on ouvre quand on parle argent.
   */
  const commercial = page.slice(page.indexOf("function CommercialTab({"), page.indexOf("function CoachTab"));
  assert.ok(commercial.includes("<PreDevisPanel"), "le panneau doit vivre dans l'onglet commercial");

  const comp = readFileSync(join(process.cwd(), "components/prospects/pre-devis-panel.tsx"), "utf8");
  assert.match(comp, /renderPreDevis\(/, "il doit appeler le module");
  assert.match(comp, /emailPreDevis\(/);
});

test("⚠⚠ RIEN NE PART DE CET ÉCRAN — et c'est ce qui rend l'email honnête", () => {
  /**
   * Le document s'OUVRE, l'email se COPIE. Aucun chemin n'expédie un pré-devis
   * tout seul depuis la fiche. C'est ce qui le range par construction dans
   * `valide-par-humain` (`lib/signature-ia.ts`) — donc sans divulgation IA,
   * donc sans mentir. Un bouton « envoyer » ici basculerait le message en
   * `autonome` et rendrait l'absence de divulgation ILLÉGALE.
   */
  const comp = readFileSync(join(process.cwd(), "components/prospects/pre-devis-panel.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");
  assert.ok(!/fetch\(/.test(comp), "aucun appel réseau : ce panneau n'envoie rien");
  assert.ok(!/\/api\/send/.test(comp), "et surtout pas la route d'envoi");
  assert.match(comp, /navigator\.clipboard/, "l'email se copie, il ne s'expédie pas");
});

test("⚠ PAS D'ÉMISSION SANS IDENTITÉ — le produit est white-label", () => {
  /**
   * Un document qui sort avec une raison sociale vide arrive chez un prospect
   * signé par personne. Et aucun repli ne doit remettre NOTRE marque : c'est
   * le défaut que `lib/signature.ts` a déjà payé quatre fois.
   */
  const comp = readFileSync(join(process.cwd(), "components/prospects/pre-devis-panel.tsx"), "utf8");
  assert.match(comp, /identiteManquante/, "le panneau doit refuser d'émettre sans identité");
  const sansCommentaires = comp.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");
  assert.ok(
    !/["'`]EAGLEYE/i.test(sansCommentaires),
    "aucun repli en dur vers notre marque : elle vient des réglages ou rien",
  );
  assert.ok(
    !/["'`]Lyon["'`]/.test(sansCommentaires),
    "ni notre ville — `lib/signature.ts` l'a déjà payé",
  );
});
