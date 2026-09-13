import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPACITES,
  EFFORT_RAPIDE_MAX_JOURS,
  capacitesPour,
  routerDossier,
  type Capacite,
} from "../lib/veille";
import { NUWACOM_THRESHOLD_HT } from "../lib/accounts";
import { chiffrer } from "../lib/calculateur-offres";

const cap = (p: Partial<Capacite> = {}): Capacite => ({
  id: "c",
  fonction: "rappeler automatiquement une demande entrante",
  origine: "open-source",
  effortJours: { bas: 1, haut: 3 },
  besoin: "traiter les demandes entrantes plus vite",
  preuve: "non-verifie",
  ...p,
});

test("⚠⚠ LES DEUX CRITÈRES SE CONTREDISENT, ET LE MODULE LE DIT AU LIEU DE TRANCHER", () => {
  /**
   * C'est tout l'objet du module. Le PRIX était exécutable
   * (`NUWACOM_THRESHOLD_HT`), la FAISABILITÉ vivait dans une chaîne de
   * `accounts-commercial.ts`. Un chantier à 60 k qu'un outil libre règle en
   * une semaine : le prix l'envoie chez le partenaire à 15 %, la faisabilité
   * dit de le garder à 100 %.
   *
   * Un routage automatique aurait choisi le critère le plus facile à coder —
   * le prix — et sous-traité à 15 % des dossiers qu'on sait faire à 100 %.
   */
  const v = routerDossier(60_000, [cap()]);
  assert.equal(v.routage, "arbitrage-humain");
  assert.equal(v.faisableViteParNous, true);
  assert.equal(v.auDessusDuSeuil, true);
  assert.match(v.motif, /se contredisent/, "le conflit doit être NOMMÉ");
  /**
   * ⚠ L'ESPACE DES MILLIERS N'EST PAS UNE ESPACE. `toLocaleString("fr-FR")`
   * insère U+202F (espace insécable étroite) : un motif écrit avec une espace
   * ordinaire ne mord pas, sur un rendu parfaitement correct. Même famille de
   * piège que le « 1490 € » sans séparateur relevé dans la doctrine — sauf que
   * celui-ci fait échouer un test au lieu d'afficher une faute.
   */
  assert.match(v.motif, /51[\s\u202f\u00a0]000 €/, "l'écart doit être chiffré — c'est lui qui rend l'arbitrage sérieux");
  assert.match(v.motif, /CAPACITÉ/, "et dire ce qui manque : un jugement, pas un calcul");
});

test("⚠ AUCUNE CAPACITÉ = ON NE SAIT PAS FAIRE, et le montant n'y change rien", () => {
  // Un petit dossier qu'on ne sait pas livrer part quand même chez le
  // partenaire. Aucun prix ne rend faisable ce qu'on ne sait pas faire.
  const v = routerDossier(5_000, []);
  assert.equal(v.routage, "nuwacom");
  assert.equal(v.faisableViteParNous, false);
  assert.match(v.motif, /Aucune capacité/);
});

test("faisable vite ET sous le seuil → EAGLEYE, 100 %", () => {
  const v = routerDossier(12_000, [cap({ effortJours: { bas: 2, haut: 4 } })]);
  assert.equal(v.routage, "eagleye");
  assert.match(v.motif, /meilleur levier/);
});

test("ni faisable vite, ni sous le seuil → NUWACOM sans ambiguïté", () => {
  const v = routerDossier(80_000, [cap({ effortJours: { bas: 20, haut: 40 } })]);
  assert.equal(v.routage, "nuwacom");
  assert.match(v.motif, /Trop lourd/);
});

test("⚠⚠ L'EFFORT SE CUMULE SUR LA BORNE HAUTE — le biais qui fait déborder les chantiers", () => {
  /**
   * Additionner les bornes basses reviendrait à supposer le meilleur des cas
   * sur chaque brique EN MÊME TEMPS. C'est exactement comme ça qu'un devis
   * tient sur le papier et pas à la livraison.
   */
  const trois = [
    cap({ id: "a", effortJours: { bas: 1, haut: 4 } }),
    cap({ id: "b", effortJours: { bas: 1, haut: 4 } }),
    cap({ id: "c", effortJours: { bas: 1, haut: 4 } }),
  ];
  // bornes basses = 3 jours (rapide) · bornes hautes = 12 jours (pas rapide)
  const v = routerDossier(10_000, trois);
  assert.equal(v.faisableViteParNous, false, "12 jours cumulés dépassent le régime rapide");
  assert.match(v.motif, /12 jours-homme/);
});

test("⚠ UNE SEULE brique « à construire » sort du régime rapide, même courte", () => {
  // Ce n'est pas sa durée qui coûte, c'est son incertitude. Une estimation sur
  // du neuf est la seule qu'on n'a aucun moyen de vérifier avant de la vivre.
  const v = routerDossier(10_000, [cap({ origine: "a-construire", effortJours: { bas: 1, haut: 2 } })]);
  assert.equal(v.faisableViteParNous, false);
  assert.match(v.motif, /neuf à construire/);
});

test("le seuil est IMPORTÉ, jamais recopié", () => {
  // Il existe déjà à cinq endroits du dépôt. Une sixième valeur écrite ici
  // ferait router deux modules différemment sur le même dossier.
  const src = readFileSync(join(process.cwd(), "lib/veille.ts"), "utf8");
  assert.match(src, /from "\.\/accounts"/);
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!/40[_ ]?000/.test(sansCommentaires), "aucun 40 000 en dur");
  // Et le comportement suit la constante, pas un nombre gravé.
  assert.equal(routerDossier(NUWACOM_THRESHOLD_HT, [cap()]).auDessusDuSeuil, false, "au seuil exact : pas au-dessus");
  assert.equal(routerDossier(NUWACOM_THRESHOLD_HT + 1, [cap()]).auDessusDuSeuil, true);
});

test("⚠⚠ LA TABLE DE VEILLE EST VIDE, ET C'EST L'ÉTAT HONNÊTE", () => {
  /**
   * Une veille se remplit en regardant ce qui sort, pas en écrivant de mémoire
   * ce qu'on croit savoir. La pré-remplir fabriquerait des entrées qui ont
   * l'air mesurées et qui sont devinées — et elles routeraient de VRAIS
   * dossiers vers un compte plutôt qu'un autre.
   */
  assert.deepEqual(CAPACITES, [], "on ne pré-remplit pas une veille de mémoire");
  assert.deepEqual(capacitesPour("n'importe quoi"), [], "une recherche sur table vide rend vide, pas une erreur");
  // Le contre-test : la recherche FONCTIONNE dès qu'il y a de la matière.
  const table = [cap({ besoin: "rappeler les acquéreurs" }), cap({ id: "z", besoin: "trier les candidatures" })];
  assert.equal(capacitesPour("candidatures", table).length, 1);
  assert.equal(capacitesPour("", table).length, 0, "une recherche vide ne rend pas TOUT");
});

test("⚠ CHAQUE CAPACITÉ PORTERA SON NIVEAU DE PREUVE — comme les références externes", () => {
  // `mesure-maison` n'est légitime qu'après une livraison RÉELLE. Le champ
  // existe pour que personne ne puisse ajouter une entrée sans répondre à
  // « comment on le sait ? ».
  const src = readFileSync(join(process.cwd(), "lib/veille.ts"), "utf8");
  assert.match(src, /preuve:\s*"mesure-maison"\s*\|\s*"praticien"\s*\|\s*"non-verifie"/);
  assert.match(src, /effortJours: \{ bas: number; haut: number \}/, "un effort est une fourchette, jamais un point");
});

test("⚠ les capacités se décrivent par leur FONCTION, pas par un nom de produit", () => {
  /**
   * Deux raisons. Un nom de produit périme la table à la première version
   * suivante ; et le dépôt est public — une liste d'outils nommés décrit
   * notre stack à qui veut la copier. La fonction, elle, reste vraie.
   */
  const src = readFileSync(join(process.cwd(), "lib/veille.ts"), "utf8");
  assert.match(src, /décrite? par sa FONCTION/i, "la règle doit être écrite à côté du champ");
});

test("⚠⚠ LA RÈGLE EST APPELABLE DEPUIS LE CHIFFRAGE — pas seulement exportée", () => {
  /**
   * Le défaut récurrent du dépôt, et je l'avais commis moi-même : `routerDossier`
   * était juste, testé, et appelé par AUCUN écran. Le calculateur n'alertait
   * que sur « sous le seuil » — donc un chantier à 60 k qu'un outil libre
   * règle en une semaine partait chez le partenaire à 15 % SANS UN MOT.
   */
  const src = readFileSync(join(process.cwd(), "lib/calculateur-offres.ts"), "utf8");
  assert.match(src, /import \{ routerDossier \} from "\.\/veille"/, "le chiffrage doit consulter la règle");
  assert.match(src, /routerDossier\(devis, \[/, "et l'appeler sur le montant réel du devis");

  // Comportement : le conflit remonte dans les alertes du chiffrage.
  const conflit = chiffrer({ chantierHT: 60_000, effortJours: 5 });
  assert.ok(
    conflit.alertes.some((a) => /se contredisent/.test(a)),
    "un gros chantier qu'on sait faire vite doit produire une alerte d'arbitrage",
  );
});

test("⚠ SANS ESTIMATION D'EFFORT, on ne prétend pas savoir", () => {
  // Absent ⇒ le verdict de faisabilité n'est pas rendu. Inventer un effort par
  // défaut ferait dire « on sait le faire » d'un dossier que personne n'a regardé.
  const muet = chiffrer({ chantierHT: 60_000 });
  assert.ok(!muet.alertes.some((a) => /se contredisent/.test(a)));
  // Le seuil de prix, lui, continue de parler — les deux règles sont distinctes.
  const petit = chiffrer({ chantierHT: 10_000 });
  assert.ok(petit.alertes.some((a) => /sous le seuil/.test(a)));
});

test("⚠ un chantier LOURD ne produit pas d'alerte : c'est le cas normal", () => {
  // Contre-test. Si toute saisie produisait une alerte, elles deviendraient du
  // bruit et on cesserait de les lire — y compris celle qui vaut 51 000 €.
  const lourd = chiffrer({ chantierHT: 60_000, effortJours: 40 });
  assert.ok(!lourd.alertes.some((a) => /se contredisent/.test(a)));
});
