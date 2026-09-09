import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  accesContenuAutorise,
  CHAMPS_EXPLOITATION,
  filtrerExploitation,
  peutCreerSousCompte,
  peutVoirContenu,
  peutVoirExploitation,
  porteeSur,
  type CompteOrg,
} from "../lib/organisation";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA BRÈCHE VOLONTAIRE DANS LE SEUL MUR QUI EXISTE.
 *
 * Tout le cloisonnement tient à la RLS plus le `user_id` du JWT. Ce module
 * ouvre délibérément une porte dedans — « piloter le compte du client ». Ces
 * tests sont ce qui borne la porte.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAITRE: CompteOrg = { id: "u-maitre", role: "maitre", parentId: null };
const PATRON: CompteOrg = { id: "u-patron", role: "responsable", parentId: null };
const AUTRE_PATRON: CompteOrg = { id: "u-patron2", role: "responsable", parentId: null };
const REP_A: CompteOrg = { id: "u-rep-a", role: "membre", parentId: "u-patron" };
const REP_B: CompteOrg = { id: "u-rep-b", role: "membre", parentId: "u-patron" };
const REP_AILLEURS: CompteOrg = { id: "u-rep-x", role: "membre", parentId: "u-patron2" };

test("chacun voit son propre compte en entier", () => {
  for (const c of [MAITRE, PATRON, REP_A]) {
    assert.equal(porteeSur(c, c), "contenu");
  }
});

test("⚠ LE MAÎTRE NE VOIT PAS LE CONTENU — c'est la décision centrale", () => {
  /**
   * ⚠ UNE LIGNE SÉPARE CE TEST DE SON CONTRAIRE, et cette ligne ferait de
   * nous un SOUS-TRAITANT RGPD (art. 28) de chacun de nos clients, sans
   * contrat, avec accès aux nom, téléphone et email de tous leurs prospects
   * — des gens qui n'ont jamais entendu parler de nous.
   *
   * Le confort d'un dépannage ne vaut pas ça, et surtout : l'exploitation
   * SUFFIT à faire le travail. Le support, le succès client et
   * l'encaissement ont besoin de savoir si le compte tourne, s'il consomme
   * et s'il paie. Aucun des trois n'a besoin d'un numéro de téléphone.
   *
   * Mutation vérifiée : `return "contenu"` dans la branche `maitre` fait
   * tomber ce test, et lui seul.
   */
  assert.equal(porteeSur(MAITRE, PATRON), "exploitation");
  assert.equal(porteeSur(MAITRE, REP_A), "exploitation");
  assert.equal(peutVoirContenu(MAITRE, PATRON), false, "nous ne lisons pas le CRM d'un client");
  assert.equal(peutVoirExploitation(MAITRE, PATRON), true, "mais nous voyons s'il tourne et s'il paie");
});

test("un responsable voit le CONTENU de SES membres", () => {
  /**
   * Ce n'est pas une faveur : les prospects appartiennent à l'entreprise, pas
   * au commercial qui les a saisis. Un directeur commercial qui ne peut pas
   * reprendre le portefeuille d'un vendeur parti n'a pas un CRM, il a un
   * carnet privé par personne.
   */
  assert.equal(porteeSur(PATRON, REP_A), "contenu");
  assert.equal(porteeSur(PATRON, REP_B), "contenu");
});

test("⚠ …et RIEN au-delà de ses membres", () => {
  /**
   * Le rattachement est un lien vers des comptes PRÉCIS, pas un
   * laissez-passer attaché au rôle. Trois cas, et le troisième est celui
   * qu'on oublie : deux clients concurrents chez nous.
   *
   * Mutation vérifiée : retirer `cible.parentId === observateur.id` fait
   * tomber ce test — un responsable lirait alors le CRM de TOUS les
   * commerciaux de TOUS les clients.
   */
  assert.equal(porteeSur(PATRON, REP_AILLEURS), "aucune", "le commercial d'un autre client");
  assert.equal(porteeSur(PATRON, AUTRE_PATRON), "aucune", "un client concurrent");
  assert.equal(porteeSur(PATRON, MAITRE), "aucune", "notre propre compte");
});

test("⚠ un MEMBRE ne voit personne d'autre — ni son patron, ni ses collègues", () => {
  /**
   * Le sens de la hiérarchie n'est pas symétrique. Un commercial qui lit le
   * pipe de son collègue peut lui prendre ses affaires ; un commercial qui
   * lit le compte de son patron voit la marge sur son propre travail.
   */
  assert.equal(porteeSur(REP_A, REP_B), "aucune", "un collègue du même patron");
  assert.equal(porteeSur(REP_A, PATRON), "aucune", "son propre responsable");
  assert.equal(porteeSur(REP_A, MAITRE), "aucune");
  assert.equal(porteeSur(REP_A, REP_AILLEURS), "aucune");
});

test("un rattachement qui pointe dans le vide n'ouvre rien", () => {
  // Une donnée incohérente en base (parent supprimé, migration à moitié
  // passée) ne doit pas produire un accès : le refus est le défaut.
  const orphelin: CompteOrg = { id: "u-orphelin", role: "membre", parentId: "u-nexiste-pas" };
  assert.equal(porteeSur(PATRON, orphelin), "aucune");
  assert.equal(porteeSur(MAITRE, orphelin), "exploitation", "le maître garde l'exploitation, jamais plus");
});

// ─────────── CRÉER UN SOUS-COMPTE ───────────

test("⚠ SEUL un responsable crée des sous-comptes — pas nous, pas un membre", () => {
  /**
   * ⚠ LE REFUS DU MAÎTRE EST DÉLIBÉRÉ, et c'est le moins intuitif des trois.
   *
   * Nous pourrions techniquement créer un membre sous n'importe quel client.
   * Mais un compte créé par nous sous le nom d'un client est un compte dont
   * le client IGNORE L'EXISTENCE — c'est exactement la forme qu'aurait une
   * porte dérobée, et elle serait indiscernable d'une vraie.
   *
   * Et le refus du membre garde la hiérarchie plate : sinon un commercial se
   * fabrique ses propres sous-comptes et « un seul niveau » n'est plus vrai.
   */
  assert.equal(peutCreerSousCompte(PATRON), true);
  assert.equal(peutCreerSousCompte(MAITRE), false, "un compte créé par nous est un compte que le client ignore");
  assert.equal(peutCreerSousCompte(REP_A), false, "sinon la hiérarchie n'est plus plate");
});

// ─────────── L'EXCEPTION DE SUPPORT, ET SES VERROUS ───────────

const DEMAIN = new Date(Date.now() + 864e5).toISOString();
const HIER = new Date(Date.now() - 864e5).toISOString();

test("l'accès au contenu ne demande aucune exception quand la portée le donne déjà", () => {
  assert.equal(accesContenuAutorise(PATRON, REP_A, null), true, "son propre membre");
  assert.equal(accesContenuAutorise(REP_A, REP_A, null), true, "soi-même");
});

test("⚠ par DÉFAUT, le support n'a pas accès au contenu", () => {
  // La porte est conçue fermée. C'est l'état normal, pas un cas d'erreur.
  assert.equal(accesContenuAutorise(MAITRE, PATRON, null), false);
});

test("⚠ LES VERROUS SONT CUMULATIFS — en retirer un ferme la porte", () => {
  /**
   * ⚠ CETTE PORTE EST CONÇUE MAINTENANT PARCE QUE LE BESOIN ARRIVERA UN
   * MARDI SOIR, avec un client au téléphone et une envie de faire vite.
   * C'est le pire moment pour concevoir une exception.
   *
   * On teste chaque verrou en le retirant SEUL : c'est la seule façon de
   * savoir qu'il porte quelque chose.
   *
   * ⚠⚠ ET C'EST COMME ÇA QU'ON A TROUVÉ UN VERROU MORT. Le titre de ce test
   * disait « LES QUATRE », et la vérification par mutation a montré qu'ils
   * étaient TROIS : le contrôle séparé de `expireLe` absent ne servait à
   * rien, `Date.parse(null)` rendant déjà `NaN`. Le retirer ne faisait
   * tomber aucun test. Une condition morte fait croire à une protection qui
   * n'existe pas — c'est exactement le piège que la doctrine du dépôt nomme
   * (asserter la PRÉSENCE d'un refus au lieu de la CONDITION qui y mène).
   * Date absente et date illisible sont désormais le même refus, prononcé
   * une seule fois, et les deux cas restent couverts ci-dessous.
   */
  const complet = { consenti: true, expireLe: DEMAIN, contratSousTraitance: true };
  assert.equal(accesContenuAutorise(MAITRE, PATRON, complet), true, "tous réunis, la porte s'ouvre");

  assert.equal(
    accesContenuAutorise(MAITRE, PATRON, { ...complet, consenti: false }),
    false,
    "sans consentement du client"
  );
  assert.equal(
    accesContenuAutorise(MAITRE, PATRON, { ...complet, contratSousTraitance: false }),
    false,
    "sans contrat de sous-traitance RGPD — et celui-là se signe, il ne se code pas"
  );
  assert.equal(
    accesContenuAutorise(MAITRE, PATRON, { ...complet, expireLe: null }),
    false,
    "un accès sans terme n'est pas un dépannage, c'est un abonnement à ses données"
  );
  assert.equal(
    accesContenuAutorise(MAITRE, PATRON, { ...complet, expireLe: HIER }),
    false,
    "un consentement expiré est un refus"
  );
  assert.equal(
    accesContenuAutorise(MAITRE, PATRON, { ...complet, expireLe: "pas une date" }),
    false,
    "une date illisible n'est pas une date : dans le doute on n'ouvre pas"
  );
});

test("⚠ l'exception n'est ouverte QU'À NOUS, et jamais entre clients", () => {
  /**
   * Un responsable muni d'un consentement bricolé ne doit pas pouvoir lire le
   * compte d'un concurrent. L'exception est un chemin de support, pas un
   * mécanisme d'accès générique.
   */
  const complet = { consenti: true, expireLe: DEMAIN, contratSousTraitance: true };
  assert.equal(accesContenuAutorise(PATRON, AUTRE_PATRON, complet), false);
  assert.equal(accesContenuAutorise(REP_A, REP_B, complet), false);
  assert.equal(accesContenuAutorise(REP_A, PATRON, complet), false);
});

// ─────────── LE FILTRE DE SORTIE ───────────

test("⚠ l'exploitation est une LISTE BLANCHE — tout le reste est refusé", () => {
  /**
   * ⚠ POURQUOI PAS UNE LISTE NOIRE. Décrire ce qu'on RETIRE d'une fiche
   * condamne à se souvenir de chaque champ ajouté ensuite : le jour où
   * quelqu'un ajoute `telephoneDirect` au modèle, une liste noire le laisse
   * passer et personne ne le voit — il faudrait avoir pensé à l'interdire.
   *
   * On énumère ce qui SORT ; tout le reste est refusé par construction, y
   * compris ce qui n'existe pas encore.
   */
  const brut = {
    tenantId: "u-1",
    nbFiches: 42,
    statutAbonnement: "actif",
    // Tout ce qui suit doit disparaître.
    name: "Marc Perrin",
    phone: "04 78 12 34 56",
    email: "marc@vraie-boite.fr",
    notes: "Sa femme tient la caisse",
    monthlyValue: 290,
    telephoneDirect: "06 11 22 33 44",
  };
  const vue = filtrerExploitation(brut);

  assert.deepEqual(Object.keys(vue).sort(), ["nbFiches", "statutAbonnement", "tenantId"]);
  for (const interdit of ["name", "phone", "email", "notes", "monthlyValue", "telephoneDirect"]) {
    assert.equal(interdit in vue, false, `« ${interdit} » a traversé le filtre d'exploitation`);
  }
});

test("aucun champ d'exploitation ne peut identifier une personne", () => {
  /**
   * La liste blanche ne protège que si son contenu est sûr. Ce test est là
   * pour le jour où quelqu'un ajoutera « juste le nom du contact » à
   * `CHAMPS_EXPLOITATION` en croyant que c'est pratique.
   */
  const suspects = ["name", "nom", "phone", "telephone", "email", "adresse", "contact", "notes"];
  for (const champ of CHAMPS_EXPLOITATION) {
    const c = champ.toLowerCase();
    for (const s of suspects) {
      assert.ok(
        !c.includes(s),
        `« ${champ} » ressemble à une donnée personnelle — l'exploitation ne porte que des compteurs et des états`
      );
    }
  }
});

// ─────────── LE CÂBLAGE — sinon c'est un module mort de plus ───────────

test("⚠ la règle est LUE par la route, pas redéduite à côté", () => {
  /**
   * Le défaut récurrent du dépôt : un mécanisme juste, testé, branché nulle
   * part. Ici il serait pire qu'ailleurs — une règle d'accès qui n'est
   * consultée par personne laisse la route inventer la sienne, et celle-là
   * n'aura ni commentaire, ni test, ni mutation passée dessus.
   */
  const route = readFileSync(join(process.cwd(), "app/api/organisation/route.ts"), "utf8");
  assert.match(route, /peutVoirExploitation\(/, "la route doit demander la portée, pas la deviner");
  assert.match(route, /filtrerExploitation\(/, "…et filtrer en SORTIE, dernier point par lequel tout passe");
});

test("⚠ la route ne rend AUCUN champ de contenu", () => {
  /**
   * Le filtre est une liste blanche, donc cette vérification pourrait
   * sembler acquise. Elle ne l'est pas : rien n'empêche d'ajouter une clé
   * APRÈS le filtre, dans le `NextResponse.json` — c'est même la façon la
   * plus naturelle de « rajouter juste un champ ». On lit donc la source.
   */
  const route = readFileSync(join(process.cwd(), "app/api/organisation/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    /**
     * ⚠ `tenant.email` EST EXCLU, ET LA DISTINCTION EST TOUT LE SUJET.
     *
     * C'est l'adresse de CELUI QUI DEMANDE, lue dans son propre jeton pour
     * savoir si c'est nous (`estMaitre`). Elle ne sort jamais de la route et
     * n'appartient à aucun tiers. Ce que ce test interdit, c'est l'email d'un
     * PROSPECT — quelqu'un qui n'a jamais entendu parler de nous.
     *
     * Sans cette exclusion, le test aurait forcé à contourner `estMaitre`
     * pour se taire, c'est-à-dire à affaiblir le code pour satisfaire sa
     * propre garde. Un test qui pousse à dégrader ce qu'il protège est pire
     * qu'un test absent.
     */
    .replace(/tenant\.email/g, "");
  for (const interdit of ["prospects", "monthlyValue", "phone", "email", "notes"]) {
    assert.doesNotMatch(
      route,
      new RegExp(`\\b${interdit}\\b`),
      `la route mentionne « ${interdit} » : elle ne doit servir que de l'exploitation`
    );
  }
});

test("⚠ le rôle « maitre » ne se lit PAS dans la table", () => {
  /**
   * `estMaitre()` lit l'email du JETON contre `OWNER_EMAILS`. Si la route
   * lisait `role = 'maitre'` en base pour nous accorder quoi que ce soit,
   * une élévation de privilège passerait par une table que le produit écrit
   * — exactement ce qu'une table ne doit jamais décider.
   */
  const route = readFileSync(join(process.cwd(), "app/api/organisation/route.ts"), "utf8");
  assert.match(route, /estMaitre\(tenant\.email\)/, "le maître se déduit du jeton, jamais de la base");
});
