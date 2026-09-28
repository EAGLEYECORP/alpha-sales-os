/**
 * ─────────────────────────────────────────────────────────────────────
 * FIXTURE ICP — le CSV que la suite peut lire SUR UN CLONE PROPRE.
 *
 * ⚠ POURQUOI ELLE EXISTE : `tests/audit-icp.test.ts` assertait sur
 * `PROSPECTS_ICP_CSV`, qui se charge depuis `donnees-privees/` — un dossier
 * ignoré par git. Sur une CI, chez un contributeur, sur un déploiement neuf,
 * ce CSV est VIDE : trois tests tombaient. Mesuré en déplaçant le dossier,
 * pas supposé. Le dépôt ne passait donc pas sa propre suite tel qu'il se
 * clone — exactement le genre d'écart entre ce qu'un dépôt affirme et ce
 * qu'il est que le reste des gardes s'emploie à interdire.
 *
 * ⚠⚠ CE QU'ELLE NE REMPLACE PAS, ET C'EST LE PIÈGE.
 * Une fixture est un texte QUE NOUS AVONS ÉCRIT. Asserter « chaque fiche a
 * un téléphone » dessus ne mesure rien : ça vérifie qu'on a bien tapé une
 * colonne téléphone. C'est la tautologie que ce dépôt a déjà payée une fois
 * (`EMAILS_DE_DEMO`, dérivé de `seedProspects`, rendait vraie une assertion
 * sur `seedProspects`).
 *
 * D'où le partage, et il est net :
 *  · CE QUI SE TESTE ICI = le PARSEUR et le ROUTAGE. `csvToProspects` doit
 *    tenir le point-virgule, les guillemets, un point-virgule DANS un champ
 *    cité, les accents et une cellule vide ; `verticalForProspect` doit
 *    rattacher chaque fiche à la bonne verticale via ses notes. Ce sont des
 *    propriétés du CODE, et une fixture les mesure honnêtement.
 *  · CE QUI SE TESTE SUR LE VRAI FICHIER = la QUALITÉ DE LA LISTE (aucune
 *    ligne perdue, chaque fiche joignable, le compte annoncé). Ce sont des
 *    propriétés de la DONNÉE. Ces assertions restent dans
 *    `audit-icp.test.ts` et se déclarent **skip** quand le fichier est
 *    absent — un `skip` se voit dans le compte-rendu, un test qui passerait
 *    à vide ne se verrait jamais.
 *
 * ⚠ Contraintes que cette fixture respecte, comme tout le dépôt :
 *  · téléphones dans la plage ARCEP réservée à la fiction (décision
 *    2018-0881, `0465 71`) — ni appelables, ni attribuables ;
 *  · domaines RFC 2606 (`example.org`, `example.com`) — non déposables ;
 *  · raisons sociales manifestement inventées, et aucun nom de quartier
 *    réel : `tests/vitrine-fuite.test.ts` a déjà attrapé des toponymes
 *    lyonnais recopiés de bonne foi depuis les feuilles de prospection.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Mêmes en-têtes, même délimiteur et mêmes formes que le fichier réel — une
 * fixture d'une autre forme testerait un parseur qu'on n'utilise pas.
 *
 * Les cas de bord sont VOULUS, un par ligne :
 *  · ligne 2 : un point-virgule À L'INTÉRIEUR d'un champ cité (le cas qui
 *    casse tout parseur naïf `split(";")`) ;
 *  · ligne 3 : des guillemets doublés `""` à l'intérieur d'un champ cité ;
 *  · ligne 4 : une cellule email VIDE (toutes les fiches n'ont pas d'email) ;
 *  · ligne 5 : un secteur hors `SECTOR_ALIASES` → doit retomber sur `autre`
 *    sans perdre la ligne ;
 *  · ligne 6 : plusieurs `problems` séparés par `|`, et des accents partout.
 */
export const FIXTURE_ICP_CSV = [
  "company;name;sector;city;phone;email;stage;problems;notes",
  `"Garage Ternova";"Hervé Dancourt";"artisan";"Lyon 7e";"04 65 71 00 11";"atelier@example.org";"prospect";"Devis au téléphone";"Garage et carrosserie ; deux lignes fixes, personne à l'accueil entre midi et 14h"`,
  `"Régie Almandin";"Salomé Vaugier";"autre";"Lyon 6e";"04 65 71 00 12";"contact@example.com";"contact";"Appels locataires";"Régie immobilière : le standard sature sur les ""urgences plomberie"" du lundi"`,
  `"Auto-école Vireval";"Nour Bassenge";"autre";"Villeurbanne";"04 65 71 00 13";"";"prospect";"Inscriptions perdues";"Auto-école : les moniteurs sont en conduite, le bureau n'est tenu que le mercredi"`,
  `"Ateliers Kervost";"Maël Trigance";"cordonnerie";"Lyon 3e";"04 65 71 00 14";"devis@example.org";"prospect";"";"Métier non listé dans l'enum Sector — la ligne doit survivre en secteur « autre »"`,
  `"Cabinet Yssembre";"Aude Pélican";"autre";"Lyon 8e";"04 65 71 00 15";"cabinet@example.com";"contact";"Créneaux annulés|Rappels manuels";"Cabinet médical : secrétariat externalisé, les rappels de rendez-vous se font à la main"`,
].join("\n");

/** Ce que le parseur doit rendre — écrit ici pour qu'un ajout de ligne le casse. */
export const FIXTURE_ICP_COUNT = 5;
