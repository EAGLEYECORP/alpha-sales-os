import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useAlpha } from "../lib/store";
import { isDemoProspect, prospectDefaults } from "../lib/seed";
import { nettoyerProfil, phraseProfil, profilExploitable, PROFIL_VIDE } from "../lib/profil-operateur";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA DÉMONSTRATION SUR LA CIBLE DE L'INSCRIT.
 *
 * Ce que ces tests gardent n'est PAS que le générateur soit joli. C'est
 * qu'appliquer un profil ne détruise jamais le travail de quelqu'un — sur une
 * app local-first, le localStorage est la SEULE copie qui existe, et il n'y a
 * rien à restaurer.
 * ─────────────────────────────────────────────────────────────────────
 */

const PROFIL = {
  poste: "solo" as const,
  metier: "logiciel de paie",
  cibleSecteur: "logistique",
  cibleRole: "directeur des opérations",
  cibleZone: "Rhône",
};

const fichReelle = (id: string): Prospect =>
  ({ ...prospectDefaults, id, name: "Vrai Client", company: "Vraie Boîte SAS", email: "contact@vraie-boite.fr" }) as Prospect;

test("⚠ APPLIQUER UN PROFIL NE TOUCHE PAS AUX FICHES RÉELLES", () => {
  /**
   * ⚠ LE SEUL TEST DE CE FICHIER QUI PROTÈGE DE QUELQUE CHOSE D'IRRÉVERSIBLE.
   *
   * L'ordre naturel est : on s'inscrit, on importe son fichier, on découvre
   * le produit, PUIS on se rend compte qu'on s'est mal décrit et on revient
   * corriger son ICP. Si l'application du profil remplaçait `prospects` en
   * bloc, ce geste-là effacerait le fichier réel de la personne. Sur une app
   * local-first, il n'existe aucune autre copie.
   */
  useAlpha.setState({ prospects: [fichReelle("vrai-1"), fichReelle("vrai-2")] });
  useAlpha.getState().appliquerProfil(PROFIL);

  const apres = useAlpha.getState().prospects;
  assert.ok(apres.some((p) => p.id === "vrai-1"), "la fiche réelle a été effacée — perte définitive");
  assert.ok(apres.some((p) => p.id === "vrai-2"));
  assert.ok(apres.some((p) => isDemoProspect(p.id)), "les fiches de démonstration doivent bien être posées");
});

test("réappliquer un profil ne fait pas s'empiler les fiches de démo", () => {
  /**
   * Sans le filtre, deux passages laisseraient douze fiches inventées, puis
   * dix-huit. Le pipe se remplirait de décor, et les compteurs de l'écran
   * d'accueil avec.
   */
  useAlpha.setState({ prospects: [fichReelle("vrai-1")] });
  const st = useAlpha.getState();
  st.appliquerProfil(PROFIL);
  const apresUn = useAlpha.getState().prospects.filter((p) => isDemoProspect(p.id)).length;
  useAlpha.getState().appliquerProfil({ ...PROFIL, cibleSecteur: "santé" });
  const apresDeux = useAlpha.getState().prospects.filter((p) => isDemoProspect(p.id)).length;
  assert.equal(apresDeux, apresUn, "les fiches de démo s'empilent au lieu de se remplacer");
  assert.equal(useAlpha.getState().prospects.filter((p) => !isDemoProspect(p.id)).length, 1);
});

test("⚠ un profil non exploitable ne VIDE pas les écrans", () => {
  /**
   * Quelqu'un qui efface son secteur par accident, puis valide, ne doit pas
   * découvrir un pipeline vide. `demoDepuisProfil` rend `null`, et ce `null`
   * veut dire « garde ce que tu as » — pas « remplace par rien ».
   *
   * ⚠ Mutation vérifiée : remplacer `if (!fabriquees) return { settings }`
   * par une pose inconditionnelle fait tomber cette assertion.
   */
  useAlpha.setState({ prospects: [fichReelle("vrai-1")] });
  useAlpha.getState().appliquerProfil(PROFIL);
  const avant = useAlpha.getState().prospects.length;

  useAlpha.getState().appliquerProfil({ ...PROFIL, cibleSecteur: "" });
  assert.equal(useAlpha.getState().prospects.length, avant, "un profil vide a effacé les fiches");
  // Le profil, lui, est bien enregistré — on n'ignore pas la saisie.
  assert.equal(useAlpha.getState().settings.profil?.cibleSecteur, "");
});

test("le profil est nettoyé avant d'être stocké", () => {
  /**
   * ⚠ CES CHAÎNES PARTENT DANS LES PROMPTS IA et dans les noms de fiches.
   * Un champ de 40 000 caractères collé par accident ferait exploser un
   * budget de jetons, et le premier signe serait la facture du mois suivant.
   */
  const sale = nettoyerProfil({
    poste: "n'importe quoi" as never,
    metier: "  du conseil  ",
    cibleSecteur: "x".repeat(500),
    cibleRole: undefined,
    cibleZone: 42 as never,
  });
  assert.equal(sale.poste, "solo", "un poste inconnu retombe sur le défaut, il ne passe pas tel quel");
  assert.equal(sale.metier, "du conseil");
  assert.equal(sale.cibleSecteur.length, 80, "les chaînes doivent être bornées");
  assert.equal(sale.cibleRole, "");
  assert.equal(sale.cibleZone, "", "un non-texte devient vide, jamais « 42 »");
});

test("« exploitable » ne dépend QUE du secteur cible", () => {
  /**
   * Exiger les quatre champs ferait retomber sur le jeu générique la moitié
   * des gens qui ont pourtant répondu à l'essentiel — c'est-à-dire punir ceux
   * qui ont commencé à remplir. Le secteur est le seul champ qui fournit les
   * noms, le vocabulaire et le décor : sans lui on ne sait rien fabriquer,
   * avec lui seul on sait déjà faire mieux que huit restaurants lyonnais.
   */
  assert.equal(profilExploitable(PROFIL_VIDE), false);
  assert.equal(profilExploitable(null), false);
  assert.equal(profilExploitable({ ...PROFIL_VIDE, cibleSecteur: "ab" }), false, "deux lettres ne sont pas un secteur");
  assert.equal(profilExploitable({ ...PROFIL_VIDE, cibleSecteur: "BTP" }), true, "le secteur SEUL doit suffire");
  assert.equal(
    profilExploitable({ ...PROFIL_VIDE, metier: "conseil", cibleRole: "DAF", cibleZone: "Lyon" }),
    false,
    "tout sauf le secteur ne suffit pas — c'est lui qui fabrique les fiches"
  );
});

test("la phrase de relecture rend à l'inscrit ce qu'on a compris de lui", () => {
  /**
   * Un ICP mal saisi produit une démonstration hors sujet, et personne ne
   * remonte un formulaire pour vérifier ce qu'il a tapé. Lui rendre sa phrase
   * est le seul moment où l'erreur peut se voir.
   */
  const p = phraseProfil(PROFIL);
  assert.match(p, /logistique/);
  assert.match(p, /directeur des opérations/);
  assert.match(p, /Rhône/);
  // Et sans cible, elle DIT qu'elle ne sait pas, au lieu d'inventer.
  assert.match(phraseProfil(PROFIL_VIDE), /non renseignée|générique/i);
});

// ─────────── LE CÂBLAGE ───────────

test("⚠ le bandeau de démo répond par STRUCTURE, plus par appartenance à une liste", () => {
  /**
   * L'accueil interrogeait `SEED_PROSPECT_IDS.includes(p.id)`. Depuis que le
   * jeu se génère, les fiches produites n'y sont pas : le bandeau
   * « ce ne sont pas tes chiffres » aurait disparu au moment précis où il
   * devient le plus utile — devant six fiches inventées qui comptent dans
   * les compteurs de l'écran.
   */
  const accueil = readFileSync(join(process.cwd(), "app/(app)/page.tsx"), "utf8");
  assert.match(accueil, /isDemoProspect\(p\.id\)/, "l'accueil doit détecter les fiches engendrées");
  assert.doesNotMatch(
    accueil.replace(/\/\*[\s\S]*?\*\//g, ""),
    /SEED_PROSPECT_IDS/,
    "la détection par liste doit avoir disparu, y compris de l'import"
  );
});

test("⚠ le formulaire est ATTEIGNABLE — sinon c'est un module mort de plus", () => {
  /**
   * Le défaut récurrent du dépôt. Deux surfaces, et les deux comptent :
   * l'accueil (là où on voit les fiches d'exemple pour la première fois) et
   * les réglages (là où on revient corriger).
   */
  const bandeau = readFileSync(join(process.cwd(), "components/bandeau-demo.tsx"), "utf8");
  assert.match(bandeau, /<ProfilIcp/, "le bandeau doit ouvrir le formulaire, pas seulement expliquer");
  const reglages = readFileSync(join(process.cwd(), "app/(app)/settings/page.tsx"), "utf8");
  assert.match(reglages, /<ProfilIcp/, "on doit pouvoir revenir corriger son ICP depuis les réglages");
});

test("⚠ le lien de rendez-vous n'a qu'UN formulaire", () => {
  /**
   * `bookingUrl` avait son propre champ dans les réglages. Le redemander
   * dans l'onboarding SANS retirer l'ancien aurait créé deux saisies pour la
   * même valeur : celui qui remplit l'une ne comprend pas pourquoi l'autre
   * est vide, et l'une des deux finit par écraser l'autre.
   */
  const reglages = readFileSync(join(process.cwd(), "app/(app)/settings/page.tsx"), "utf8");
  const champs = [...reglages.matchAll(/patchSettings\(\{\s*bookingUrl:/g)].length;
  assert.equal(champs, 0, "le lien de RDV se saisit dans ProfilIcp, pas une seconde fois dans les réglages");

  const formulaire = readFileSync(join(process.cwd(), "components/profil-icp.tsx"), "utf8");
  assert.match(formulaire, /bookingUrl/, "…et ProfilIcp doit bien le porter");
  assert.match(formulaire, /cal\.com/i, "il faut nommer un outil concret, sinon personne ne sait quoi coller");
});
