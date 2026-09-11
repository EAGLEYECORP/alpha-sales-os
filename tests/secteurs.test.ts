import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORDRE_SECTEURS, LIBELLE_SECTEUR, GROUPE_SECTEUR, secteursPresents } from "../lib/secteurs";
import { seedProspects } from "../lib/seed";
import type { Prospect, Sector } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FILTRE DE SECTEUR DOIT POUVOIR ATTEINDRE LES FICHES QU'ON A.
 *
 * ⚠ CE QU'IL A COÛTÉ, et ça ne se voyait nulle part. La liste des secteurs
 * était écrite en dur dans QUATRE écrans, et les quatre oubliaient `"autre"`.
 * Le marché est passé à la maîtrise d'ouvrage ; toutes les fiches sont en
 * `"autre"`. Donc :
 *  · filtrer le pipeline par secteur les faisait TOUTES disparaître, sans
 *    aucune option pour les retrouver ;
 *  · la répartition par secteur de l'écran d'accueil comptait zéro partout.
 * Rien ne tombait, aucun log, aucune erreur. Les écrans fonctionnaient.
 * ─────────────────────────────────────────────────────────────────────
 */

const fiche = (sector: Sector): Pick<Prospect, "sector"> => ({ sector });

test("⚠ un secteur PRÉSENT dans les fiches est proposé", () => {
  const vus = secteursPresents([fiche("autre"), fiche("artisan"), fiche("autre")]);
  assert.deepEqual(vus, ["artisan", "autre"]);
});

test("⚠ un secteur ABSENT des fiches n'est pas proposé", () => {
  /**
   * C'est ce qui fait disparaître le marché d'AVANT (restauration, pubs,
   * ambulances) sans l'interdire : il s'efface parce qu'il n'y a plus une
   * seule fiche qui le porte, et il reviendrait seul chez un opérateur qui en
   * a. On ne retire pas à quelqu'un un filtre sur ses propres données pour
   * régler notre problème de marché.
   */
  const vus = secteursPresents([fiche("autre")]);
  assert.deepEqual(vus, ["autre"]);
  for (const mort of ["restaurant", "pub", "ambulance"] as Sector[]) {
    assert.ok(!vus.includes(mort), `${mort} proposé alors qu'aucune fiche ne le porte`);
  }
});

test("⚠ l'ordre est FIXE, il ne suit pas l'ordre des fiches", () => {
  /**
   * Une liste déroulante dont les entrées changent de place à chaque import
   * est inutilisable : on clique à côté. Deux ordres d'arrivée opposés doivent
   * rendre exactement la même liste.
   */
  const a = secteursPresents([fiche("autre"), fiche("restaurant"), fiche("artisan")]);
  const b = secteursPresents([fiche("artisan"), fiche("autre"), fiche("restaurant")]);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ["restaurant", "artisan", "autre"]);
});

test("⚠ zéro fiche → zéro secteur, jamais une liste de complaisance", () => {
  // Doctrine du dépôt : zéro donnée → zéro chiffre. Proposer un filtre qui ne
  // peut rien sélectionner est exactement le défaut qu'on vient de corriger.
  assert.deepEqual(secteursPresents([]), []);
});

test("⚠ une valeur hors du type ne remonte pas à l'écran", () => {
  /**
   * Un CSV n'est pas typé : `ficheVersProspect` peut poser n'importe quoi. Une
   * valeur inconnue proposée comme option produirait un libellé `undefined`
   * dans la liste déroulante — visible, moche, et inexplicable.
   */
  const vus = secteursPresents([{ sector: "boulangerie" as Sector }, fiche("autre")]);
  assert.deepEqual(vus, ["autre"]);
});

test("⚠ CHAQUE secteur du type a un libellé — sinon l'écran affiche « undefined »", () => {
  for (const s of ORDRE_SECTEURS) {
    assert.equal(typeof LIBELLE_SECTEUR[s], "string", `${s} sans libellé`);
    assert.ok(LIBELLE_SECTEUR[s].length > 0, `${s} : libellé vide`);
  }
});

test("⚠ LE JEU DE DÉMONSTRATION EST ATTEIGNABLE PAR LE FILTRE", () => {
  /**
   * ⚠⚠ LE TEST QUI AURAIT ATTRAPÉ LE BUG. Il ne vérifie pas une liste, il
   * vérifie que les fiches qu'on LIVRE sont sélectionnables dans l'écran qui
   * sert à les chercher. C'est ce lien-là qui manquait : le jeu de démo a
   * changé de marché, les écrans non, et les deux moitiés avaient l'air
   * correctes chacune de son côté.
   */
  const proposes = secteursPresents(seedProspects);
  assert.ok(proposes.length > 0, "aucun secteur proposé pour le jeu de démonstration");
  for (const p of seedProspects) {
    assert.ok(
      proposes.includes(p.sector),
      `${p.company} est en « ${p.sector} », que le filtre ne propose pas — elle est invisible`
    );
  }
});

test("⚠ UN IDENTIFIANT DE SECTEUR NE S'AFFICHE JAMAIS TEL QUEL", () => {
  /**
   * ⚠⚠ TROUVÉ EN REFAISANT UNE VIDÉO DE CAPTURES, pas par un test.
   *
   * La fiche rendait `<span className="capitalize">{p.sector}</span>` — donc
   * l'identifiant brut, maquillé par du CSS. Tant que les valeurs étaient des
   * noms communs (« artisan »), ça passait. Avec « maitrise-ouvrage », l'écran
   * affichait « Maitrise-Ouvrage » : ni accent, ni apostrophe, un trait
   * d'union à la place. Sur une capture d'écran publique.
   *
   * Pire, et c'est ce qui rend ce garde nécessaire : le message LinkedIn
   * proposé sur la fiche construisait `p.sector + "s"`. Le texte devenait
   * « je travaille avec des **maitrise-ouvrages** du coin » — un VRAI message
   * sortant, pas un libellé qu'on corrige au prochain passage.
   *
   * ⚠ Ce garde est un MOTIF, donc il n'attrape que la forme déjà vue : rendre
   * `{p.sector}` dans du JSX, et le concaténer. Il ne prétend pas plus. Ce qui
   * le rend utile malgré ça, c'est que les deux fautes viennent du même
   * réflexe — traiter un identifiant comme du texte lisible.
   */
  const src = readFileSync(join(process.cwd(), "app/(app)/prospects/[id]/page.tsx"), "utf8");
  /**
   * ⚠ LE `(?<!\$)` A ÉTÉ AJOUTÉ LE JOUR MÊME, parce que la première rédaction a
   * refusé une ligne JUSTE : `${p.sector}` dans un gabarit de chaîne contient
   * littéralement `{p.sector}`, et celui-là construit une requête de recherche
   * interne que personne ne lit. Un garde qui refuse une phrase vraie est un
   * garde qu'on assouplira au mauvais endroit la fois suivante.
   * Ce qui reste visé est le JSX : `{p.sector}` posé seul dans du rendu.
   */
  assert.doesNotMatch(
    src,
    /(?<!\$)\{\s*p\.sector\s*\}/,
    "la fiche rend l'identifiant de secteur tel quel — passe par LIBELLE_SECTEUR"
  );
  assert.doesNotMatch(
    src,
    /p\.sector\s*\+\s*"/,
    "un identifiant de secteur est concaténé dans une phrase — passe par GROUPE_SECTEUR"
  );

  // Et les deux tables sont remplies pour de vrai : le compilateur exige les
  // clés, pas le contenu. Une chaîne vide afficherait un blanc dans un email.
  for (const s of ORDRE_SECTEURS) {
    assert.ok(GROUPE_SECTEUR[s]?.trim().length > 0, `${s} : nom de groupe vide`);
  }
});

test("⚠ AUCUN ÉCRAN NE RECOPIE LA LISTE POUR REGARDER SES PROPRES FICHES", () => {
  /**
   * ⚠ C'EST LA RECOPIE QUI A CRÉÉ LE DÉFAUT, pas l'oubli d'une valeur. Quatre
   * copies, quatre fois le même trou. Ce garde interdit la cinquième aux deux
   * écrans qui REGARDENT tes fiches.
   *
   * ⚠ Il ne vise PAS `/campaigns`, `/intel` ni `/newsletter`, et c'est une
   * décision, pas un oubli : là, le secteur ne filtre rien — il CHOISIT un
   * angle d'accroche parmi ceux écrits dans `SECTOR_ANGLES` (lib/templates.ts).
   * Retirer une option y retirerait la capacité de viser ce secteur, pas un
   * libellé périmé. Les deux questions se ressemblent et n'ont pas la même
   * réponse ; les confondre coûterait une fonctionnalité.
   */
  const ECRANS_DE_LECTURE = ["app/(app)/pipeline/page.tsx", "app/(app)/page.tsx"];
  for (const f of ECRANS_DE_LECTURE) {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    // On cherche la VALEUR du type, pas le libellé : c'est elle qui fait la
    // liste. Les commentaires sont retirés d'abord — expliquer pourquoi
    // « restaurant » a disparu doit rester permis.
    const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const mort of ["restaurant", "pub", "ambulance"]) {
      assert.doesNotMatch(
        sansCommentaires,
        new RegExp(`["']${mort}["']`),
        `${f} nomme « ${mort} » en dur — la liste doit venir de secteursPresents()`
      );
    }
  }
});
