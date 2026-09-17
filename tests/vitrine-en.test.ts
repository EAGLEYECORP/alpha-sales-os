import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  EN_ATTENDU,
  EN_HERO,
  EN_META,
  EN_PARTAGE,
  EN_PARTAGE_TITRE,
  EN_PREUVES,
  EN_PRIX,
  EN_SOUVERAINETE,
} from "../lib/vitrine-en";
import { PARTAGE, PREUVES } from "../lib/promesse";
import { PACK_MONTHLY_HT, PACK_SETUP_HT } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE PAGE ANGLAISE PASSE À TRAVERS LES QUARANTE GARDES DE LA VITRINE.
 *
 * ══ LE CONSTAT QUI JUSTIFIE CE FICHIER ══
 *
 * Tous les gardes publics de ce dépôt cherchent des motifs **français** :
 * `vitrine-fuite` refuse « lauréat », « les meilleurs », « nos clients » ;
 * `preuve-sociale` cherche un possessif français ; `promesse` cherche « le X
 * de Y ». Écrit en anglais, **chacun des trois interdits passe sans bruit** —
 * « backed by », « trusted by leading French SMBs », « the <acteur> of sales ».
 *
 * Ce n'est pas une faiblesse de rédaction : c'est la propriété connue d'un
 * garde par motif, que la doctrine énonce déjà — « il n'attrape que ce qu'on a
 * déjà vu, et se rouvre à chaque tournure neuve ». Une langue neuve est le cas
 * extrême de cette phrase.
 *
 * Ce fichier rejoue donc les QUATRE familles d'interdits dans leur forme
 * anglaise, sur la seule surface où l'anglais a le droit de s'écrire.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Tous les textes anglais publics, en un seul jeu. */
const TEXTES = [
  EN_META.title,
  EN_META.description,
  EN_HERO.kicker,
  EN_HERO.title,
  EN_HERO.sub,
  EN_HERO.cta,
  EN_SOUVERAINETE,
  ...EN_PREUVES.map((p) => p.claim),
  ...EN_PARTAGE,
  EN_PARTAGE_TITRE.alpha,
  EN_PARTAGE_TITRE.client,
  EN_PARTAGE_TITRE.note,
  EN_PRIX.setup,
  EN_PRIX.monthly,
  EN_PRIX.note,
];

test("⚠⚠ AUCUNE PREUVE SOCIALE, DANS SA FORME ANGLAISE", () => {
  /**
   * Zéro vente : aucun témoignage, logo, note ou compteur n'existe. La forme
   * anglaise de ces affirmations est celle qui aurait traversé tous les gardes
   * du dépôt.
   */
  /**
   * ⚠⚠ CE MOTIF A DÛ ÊTRE RESSERRÉ AU PREMIER PASSAGE, ET C'EST LA MÊME LEÇON
   * QUE « supprime » SUR LA VITRINE FRANÇAISE.
   *
   * Écrit `\b(our|their)\s+(clients?|customers?)\b`, il a fait tomber
   * l'argument de SOUVERAINETÉ — « …should not have to hand **their customer**
   * list to a foreign platform ». Ce « their » désigne le PROSPECT et ses
   * données à lui : c'est la phrase que le test suivant EXIGE de garder.
   *
   * Ce qui est interdit, c'est de s'attribuer une clientèle (« our clients »),
   * pas de parler de celle du lecteur. Un garde qui refuse une phrase vraie
   * est un garde qu'on assouplira au mauvais endroit la fois suivante.
   */
  const INTERDITS: { motif: RegExp; quoi: string }[] = [
    { motif: /\bour\s+(clients?|customers?|users?)\b/i, quoi: "clientèle attribuée à NOUS" },
    { motif: /\b(clients?|customers?|users?)\s+(love|rave|praise|swear by)\b/i, quoi: "éloge attribué à une clientèle" },
    { motif: /\btrusted by\b|\bloved by\b|\bused by\b/i, quoi: "« trusted / used by »" },
    { motif: /\bjoin\s+\d|\b\d+\+?\s*(companies|teams|businesses|customers)\b/i, quoi: "compteur de clients" },
    { motif: /\btestimonial|\bcase stud(y|ies)\b|\breview(s)? from\b/i, quoi: "témoignage ou étude de cas" },
    { motif: /\bconverted\s+[A-Z][a-z]+/, quoi: "conversion attribuée à un nom propre" },
  ];
  for (const t of TEXTES) {
    for (const i of INTERDITS) {
      assert.ok(!i.motif.test(t), `${i.quoi} — « ${t} »`);
    }
  }
});

test("⚠⚠ AUCUNE AFFILIATION — la famille la plus dangereuse, en anglais", () => {
  /**
   * Un témoignage inventé se démonte en conversation ; une affiliation **se
   * vérifie auprès de l'organisme, sans nous prévenir**. La vitrine française
   * a déjà affirmé candidater à un programme dont un critère éliminatoire nous
   * écarte — trouvé EN LIGNE, pas par un test.
   */
  const INTERDITS: { motif: RegExp; quoi: string }[] = [
    { motif: /\bbacked by\b|\bfunded by\b|\bincubat|\baccelerat(ed|or)\b/i, quoi: "programme / accélérateur" },
    { motif: /\bawards?\b|\bwinner\b|\blaureate\b|\bcertified by\b|\bofficial partner\b/i, quoi: "prix ou label" },
    { motif: /\bas seen (in|on)\b|\bfeatured (in|on)\b/i, quoi: "citation presse" },
    { motif: /\bYC\b|\bY Combinator\b|\bTechstars\b/i, quoi: "affiliation nommée" },
  ];
  for (const t of TEXTES) {
    for (const i of INTERDITS) {
      assert.ok(!i.motif.test(t), `${i.quoi} — « ${t} »`);
    }
  }
});

test("⚠⚠ AUCUN SUPERLATIF NI EMPRUNT DE MARQUE", () => {
  /**
   * « le X de Y » signale DÉRIVÉ, et à zéro vente rejoint les affirmations
   * invérifiables. En anglais la tournure est encore plus naturelle à écrire —
   * c'est justement pour ça qu'elle se garde ici.
   */
  const INTERDITS: { motif: RegExp; quoi: string }[] = [
    { motif: /\bbest[- ]in[- ]class\b|\bthe best\b|\bworld[- ]class\b|\b#1\b|\bnumber one\b/i, quoi: "superlatif" },
    { motif: /\bleading\b|\bmarket leader\b|\bindustry[- ]leading\b/i, quoi: "« leading »" },
    { motif: /\brevolutionary\b|\bgame[- ]?chang|\bdisrupt/i, quoi: "invérifiable" },
    { motif: /\bthe\s+\w+\s+of\s+(sales|selling|GTM|revenue)\b/i, quoi: "emprunt de marque « the X of Y »" },
  ];
  for (const t of TEXTES) {
    for (const i of INTERDITS) {
      assert.ok(!i.motif.test(t), `${i.quoi} — « ${t} »`);
    }
  }
});

test("⚠⚠ AUCUNE PERFORMANCE CHIFFRÉE — zéro vente, rien à citer", () => {
  /**
   * Un pourcentage ou un « 3× faster » sur une page publique serait inventé.
   * Les seuls nombres autorisés sont les PRIX, et ils sont importés (test
   * suivant). On retire donc les trois textes de prix avant de chercher.
   */
  const sansPrix = TEXTES.filter((t) => !Object.values(EN_PRIX).includes(t as never));
  for (const t of sansPrix) {
    assert.ok(!/\d+\s*%|\b\d+(\.\d+)?\s*[x×]\b|\b\d+\s*times (more|faster|better)\b/i.test(t), `chiffre de performance — « ${t} »`);
  }
});

test("⚠⚠ LES PRIX SONT IMPORTÉS, JAMAIS ÉCRITS À LA MAIN", () => {
  /**
   * La règle qui vient de coûter 16 fiches sur 16 chiffrées sur une grille
   * morte, appliquée à une page publique — où le prix est ce qu'un prospect
   * retient. Le test lit la SOURCE : un montant en dur ne se voit pas au
   * rendu, il se voit ici.
   */
  const src = readFileSync(join(process.cwd(), "lib/vitrine-en.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  const montants = src.match(/\b\d[\d _]{2,}\b/g) ?? [];
  assert.deepEqual(montants, [], `montant(s) écrit(s) en dur : ${montants.join(", ")}`);

  // …et ce qui s'affiche est bien ce que le client paie.
  assert.ok(EN_PRIX.setup.includes(PACK_SETUP_HT.toLocaleString("en-GB")), "le setup affiché est celui qui est décidé");
  assert.ok(
    EN_PRIX.monthly.includes(PACK_MONTHLY_HT.toLocaleString("en-GB")),
    "le mensuel affiché est celui que rend la formule au siège",
  );
});

test("⚠⚠ RIEN NE DISPARAÎT EN SILENCE DE LA VERSION ANGLAISE", () => {
  /**
   * ══ LE DÉFAUT QUE DEUX PAGES ÉCRITES CÔTE À CÔTE AURAIENT CRÉÉ ══
   *
   * Une vitrine anglaise rédigée à part dérive de la française — et c'est la
   * version qu'on ne relit pas qui cesse de dire la vérité. Les preuves sont
   * donc indexées sur le `module` de `PREUVES` : une garantie ajoutée côté
   * français sans son rendu anglais fait TOMBER ce test, au lieu de manquer
   * discrètement sur une page publique.
   */
  assert.equal(EN_PREUVES.length, EN_ATTENDU.preuves, "autant de preuves des deux côtés");
  assert.equal(EN_PARTAGE.length, EN_ATTENDU.partage, "autant de lignes de partage des deux côtés");

  const modulesFr = PREUVES.map((p) => p.module).sort();
  const modulesEn = EN_PREUVES.map((p) => p.module).sort();
  assert.deepEqual(modulesEn, modulesFr, "chaque preuve anglaise vise le MÊME module que sa jumelle française");

  /**
   * ⚠ Et chaque module cité doit exister. C'est ce qui sépare une garantie
   * d'un argument de vente : on peut l'ouvrir. Une preuve dont le module
   * disparaît fait tomber le build, en anglais comme en français.
   */
  for (const p of EN_PREUVES) {
    assert.ok(
      readdirSync(join(process.cwd(), "lib")).includes(p.module.replace(/^lib\//, "")),
      `${p.module} est cité par la page anglaise et n'existe pas`,
    );
  }

  assert.equal(PARTAGE.filter((l) => l.qui === "client").length, 2, "le partage garde ses deux lignes « client »");
});

test("⚠⚠ L'ANGLE DE SOUVERAINETÉ SURVIT À LA TRADUCTION", () => {
  /**
   * C'est le seul argument VÉRIFIABLE que nous ayons à zéro vente, et celui
   * qui a REMPLACÉ une affiliation inventée. Le perdre en anglais publierait
   * la version de la page qui n'a plus rien à défendre, devant le public le
   * plus susceptible de poser la question.
   */
  assert.match(EN_SOUVERAINETE, /French/i, "il nomme le marché qu'il défend");
  assert.match(EN_SOUVERAINETE, /foreign|third party|own database|your browser/i, "…et où vivent les données");
  assert.ok(EN_SOUVERAINETE.length > 120, "un argument d'une ligne ne défend rien");
});

test("⚠ LA PROMESSE ANGLAISE EST UNE TRADUCTION, PAS UN AUTRE POSITIONNEMENT", () => {
  /**
   * `lib/promesse.ts` existe parce que le positionnement vivait à quatre
   * endroits sans autorité. Une page anglaise qui dirait autre chose en
   * ferait un cinquième — et le plus difficile à repérer, puisque personne ne
   * relit les deux langues côte à côte.
   */
  assert.match(EN_HERO.kicker, /humans close/i, "les humains closent");
  assert.match(EN_HERO.kicker, /machine/i, "…et Alpha fait tourner la machine");
});

test("⚠⚠ LA SURFACE ANGLAISE EST BRANCHÉE — sinon c'est un export mort", () => {
  /**
   * Le défaut de signature du dépôt. Une page anglaise parfaitement gardée
   * que personne ne sert ne convertit personne, et se fait rebrancher plus
   * tard par une session qui ne repassera pas par ces gardes.
   */
  const consommateurs: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.tsx$/.test(e.name) && /vitrine-en/.test(readFileSync(p, "utf8"))) consommateurs.push(p);
    }
  };
  parcourir(join(process.cwd(), "app"));
  assert.ok(consommateurs.length > 0, "aucune page ne sert la version anglaise");
});
