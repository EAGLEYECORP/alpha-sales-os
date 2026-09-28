import { CATEGORIE, IDENTITE_REFUSEE, PROMESSE, PROMESSE_COURTE } from "./promesse";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CHARTE DE MARQUE — décrite UNE fois, jamais recopiée.
 *
 * ══ CE QU'ELLE EST, ET CE QU'ELLE N'EST PAS ══
 *
 * Elle ne définit RIEN. Les couleurs vivent dans `app/globals.css`, les
 * familles typographiques dans `tailwind.config.ts`, les matériaux dans les
 * trois classes gardées par `tests/mise-en-page.test.ts`, et la parole dans
 * `lib/promesse.ts`. Ce module les NOMME et dit à quoi chacun sert.
 *
 * ⚠⚠ ET C'EST TOUT LE SUJET. Une charte de marque est, par nature, le document
 * qui recopie les valeurs de la marque — « bronze : #E8C98A », « bleu : … ».
 * Faite comme ça ici, elle serait périmée au premier ajustement de jeton et
 * personne ne le saurait : une charte fausse ne casse rien, elle ment
 * simplement à celui qui vient y chercher la règle. C'est le défaut exact que
 * `lib/promesse.ts` a déjà corrigé pour le positionnement, qui vivait à quatre
 * endroits sans qu'aucun fasse autorité.
 *
 * `tests/brand-kit.test.ts` ouvre `globals.css` et `tailwind.config.ts` et
 * refuse un jeton déclaré ici qui n'y existerait pas — dans les DEUX thèmes.
 *
 * ══ ⚠⚠ DEUX MARQUES, ET LES CONFONDRE MET NOTRE AIGLE SUR UN DEVIS CLIENT ══
 *
 * Le produit est **white-label**. Ce document décrit la marque de la
 * PLATEFORME — l'outil, qui est à nous et ne change jamais. L'identité qui
 * s'affiche dans un message sortant, elle, suit le COMPTE : nom, adresse
 * légale, papier à en-tête, logo. Les quatre étaient en dur autrefois, et un
 * email partenaire partait avec notre en-tête et notre raison sociale.
 *
 * Une charte qui mélangerait les deux ferait exactement ça, en le
 * présentant comme la règle. D'où `PORTEE` ci-dessous, et un test qui refuse
 * qu'une raison sociale soit écrite en dur dans ce fichier.
 * ─────────────────────────────────────────────────────────────────────
 */

/** À qui appartient un élément de marque : à l'outil, ou à celui qui s'en sert. */
export type Portee =
  /** Fixe. C'est l'éditeur du logiciel, et ça reste vrai chez tous les clients. */
  | "plateforme"
  /** Variable. Ça suit le compte actif — et ça ne se code jamais en dur. */
  | "operateur";

export interface ElementDeMarque {
  /** Ce que c'est, en français, pour quelqu'un qui n'a pas le code sous les yeux. */
  quoi: string;
  portee: Portee;
  /** Le fichier qui en fait AUTORITÉ. C'est lui qu'on ouvre, pas cette charte. */
  source: string;
}

/**
 * ⚠ La mention de plateforme est le SEUL élément verbal qui survit à un compte
 * partenaire : elle nomme l'éditeur de l'outil et reste vraie partout. Tout le
 * reste de l'en-tête suit le compte.
 */
export const PORTEE: ElementDeMarque[] = [
  {
    quoi: "Le nom du produit et la mention « Envoyé avec Alpha Sales OS® »",
    portee: "plateforme",
    source: "lib/signature.ts",
  },
  {
    quoi: "Les couleurs, la typographie, les matériaux — l'apparence de l'outil",
    portee: "plateforme",
    source: "app/globals.css",
  },
  {
    quoi: "La promesse et ses preuves",
    portee: "plateforme",
    source: "lib/promesse.ts",
  },
  {
    quoi: "Le nom d'usage, la raison sociale, l'adresse, le logo d'en-tête d'un message",
    portee: "operateur",
    source: "lib/accounts.ts + lib/accounts-commercial.ts (serveur)",
  },
  {
    quoi: "La phrase « je suis … » d'un email, d'un SMS ou d'un argumentaire d'appel",
    portee: "operateur",
    source: "lib/signature.ts → presentation()",
  },
];

/** Un jeton de couleur : son NOM CSS et le rôle qu'il tient. Jamais sa valeur. */
export interface JetonCouleur {
  /** Le nom de la variable, sans `--`. Le test le cherche dans `globals.css`. */
  jeton: string;
  /** À quoi il sert. C'est ça qu'on ne retrouve nulle part ailleurs. */
  role: string;
}

/**
 * ⚠ AUCUNE VALEUR HEXADÉCIMALE ICI, et un test l'interdit.
 *
 * Écrire « bronze-400 = #E8C98A » créerait une deuxième définition de la
 * couleur, dans le document même censé faire foi. Et le clair redéfinit tous
 * ces jetons : une charte à une seule valeur serait fausse la moitié du temps.
 */
export const COULEURS: JetonCouleur[] = [
  { jeton: "ink-950", role: "le fond de page — l'assise de tout l'écran" },
  { jeton: "ink-900", role: "la surface des cartes" },
  { jeton: "ink-700", role: "les bordures et les séparateurs" },
  { jeton: "ink-500", role: "les icônes et les traits atténués" },
  { jeton: "paper", role: "le texte principal" },
  { jeton: "paper-dim", role: "le texte secondaire" },
  { jeton: "paper-faint", role: "la mention discrète — jamais une information nécessaire" },
  { jeton: "bronze-400", role: "L'ACCENT DE MARQUE : ce qu'on veut qu'on lise en premier" },
  { jeton: "bronze-500", role: "l'accent en aplat (boutons, pastilles)" },
  { jeton: "bronze-900", role: "le fond teinté d'un panneau d'emphase" },
  { jeton: "signal-green", role: "état sain — ça tourne" },
  { jeton: "signal-amber", role: "état à surveiller — surtout pas un encouragement" },
  { jeton: "signal-red", role: "état bloquant · le vermillon de marque" },
  { jeton: "signal-blue", role: "information neutre, sans jugement" },
];

/**
 * ⚠⚠ L'AMBRE EST UN PIÈGE DOCUMENTÉ, et il a déjà coûté.
 *
 * `/trajectoire` affichait « adéquation : plausible » EN AMBRE sur un dossier
 * éliminé à la première page : « une couleur qui encourage ». Un blocage GRISE,
 * il ne s'ambre pas. La couleur se lit AVANT la phrase — elle a déjà rassuré
 * quand on arrive au texte.
 */
export const REGLE_DES_ETATS =
  "Un état se lit à la couleur avant de se lire au texte. L'ambre veut dire « à surveiller », " +
  "jamais « presque bon » : sur un dossier bloqué, on GRISE. Et un écran de supervision ne " +
  "rend jamais zéro quand il ne sait pas — un tiret, sinon il affiche du calme sur une panne.";

export interface Materiau {
  /** La classe CSS, seule définition. */
  classe: string;
  quoi: string;
  /** La règle qu'on oublie, celle qui a coûté un bug. */
  piege: string;
}

/**
 * Les trois surfaces, et **une seule définition de chacune** — c'est tout le
 * sujet de `tests/mise-en-page.test.ts`.
 */
export const MATERIAUX: Materiau[] = [
  {
    classe: "page",
    quoi: "le rythme d'un écran : l'animation d'entrée et l'espacement vertical",
    piege:
      "Le padding appartient à la COQUILLE, jamais à la page. Deux écrans ajoutaient `p-4` " +
      "par-dessus et avaient un cadre plus épais que tous les autres.",
  },
  {
    classe: "card",
    quoi: "la plaque de verre de premier plan",
    piege:
      "Une plaque translucide, ce sont QUATRE choses ensemble : transparence, flou, " +
      "SATURATION, et arête haute éclairée + arête basse dans l'ombre. Retirer la saturation " +
      "suffit à la faire rendre grise et sale — c'est celle qu'on oublie.",
  },
  {
    classe: "panel",
    quoi: "la sous-surface creusée DANS une plaque",
    piege:
      "Elle se teinte avec `--card-fg`, la couleur du TEXTE : elle s'éclaircit sur fond " +
      "sombre et s'assombrit sur crème, sans une seule règle par thème.",
  },
  {
    classe: "glass-chrome",
    quoi: "le rail, l'en-tête mobile, la barre du bas",
    piege:
      "Ils encadrent le même contenu et portaient trois opacités différentes. Une seule " +
      "classe, sinon ils divergent à nouveau.",
  },
];

/** Ce qu'on ne fait jamais avec le matériau, quelle que soit l'envie. */
export const INTERDITS_VISUELS = [
  "Pas de verre dans le verre : un `backdrop-filter` imbriqué floute le rendu DÉJÀ flouté de " +
    "son parent. Ce n'est pas « plus de verre », c'est de la boue grise.",
  "Le thème clair ne redéfinit pas le matériau, il reteinte les jetons `--glass-*`. Deux " +
    "définitions du même matériau, ce sont deux vérités — et les deux « marchent ».",
  "Une carte sans flou doit devenir OPAQUE, sinon le texte se pose sur le grain de la page. " +
    "Deux cas réels : le navigateur qui ne sait pas flouter, et l'utilisateur qui a demandé " +
    "moins de transparence dans son système (`prefers-reduced-transparency`).",
  "Un titre d'écran ne s'écrit que dans `PageHeader`, et la pastille d'état se rend HORS du " +
    "`<h1>` : dedans, un lecteur d'écran annonce « titre : Machin Négociation » d'un bloc.",
];

export interface FamilleType {
  /** La clé Tailwind (`font-display`…), seule définition. */
  cle: string;
  usage: string;
}

export const TYPOGRAPHIE: FamilleType[] = [
  { cle: "display", usage: "les titres — c'est la voix de la marque" },
  { cle: "body", usage: "tout le texte courant" },
  { cle: "mono", usage: "les identifiants, les montants alignés, ce qui se copie" },
];

/**
 * Ce que la marque DIT. Importé, jamais recopié — `lib/promesse.ts` fait
 * autorité, et il existe précisément parce que ce positionnement vivait à
 * quatre endroits dont aucun ne tranchait.
 */
export const VOIX = {
  promesse: PROMESSE,
  promesseCourte: PROMESSE_COURTE,
  categorie: CATEGORIE,
  identiteRefusee: IDENTITE_REFUSEE,
} as const;

/**
 * ⚠⚠ CE QU'AUCUN ARTEFACT DE MARQUE N'A LE DROIT DE PORTER.
 *
 * Ce n'est pas une préférence de ton : chacune de ces lignes est tenue par un
 * test qui fait tomber le build. On les nomme ici parce qu'une charte de marque
 * est exactement le document qu'on ouvre avant de fabriquer une plaquette, une
 * slide ou une page — c'est-à-dire au moment précis où l'envie d'en écrire une
 * arrive.
 */
export const INTERDITS_DE_MARQUE: { regle: string; garde: string }[] = [
  {
    regle: "Aucun témoignage, logo client, note ou compteur de réussites. Zéro vente à ce jour.",
    garde: "tests/preuve-sociale.test.ts",
  },
  {
    regle:
      "Aucune conversion attribuée à un nom propre. C'est la forme la plus convaincante, " +
      "et elle nommait une entreprise réelle dans un dépôt public — en étant fausse.",
    garde: "tests/preuve-sociale.test.ts",
  },
  {
    regle:
      "Aucun label, programme, accélérateur ni « lauréat ». Un témoignage inventé se démonte " +
      "en conversation ; une affiliation se vérifie auprès de l'organisme, sans nous prévenir.",
    garde: "tests/vitrine-fuite.test.ts",
  },
  {
    regle: "Aucun superlatif invérifiable — « les meilleurs », « leader », « révolutionnaire ».",
    garde: "tests/vitrine-fuite.test.ts",
  },
  {
    regle: "Aucun positionnement par emprunt de marque (« le X de Y »).",
    garde: "tests/promesse.test.ts",
  },
  {
    regle:
      "Aucune donnée réelle : ni nom d'entreprise, ni numéro hors des plages ARCEP de fiction.",
    garde: "tests/donnees-reelles.test.ts",
  },
];

/**
 * Ce qui REMPLACE la preuve sociale, et qui tient debout à zéro vente.
 *
 * ⚠ Aucune de ces trois n'est une performance. Ce sont des RÈGLES que le
 * logiciel applique : vérifiables aujourd'hui, contrairement à un résultat.
 */
export const A_LA_PLACE_DE_LA_PREUVE = [
  "SES chiffres à lui, calculés sur sa fiche — pas une étude de cas.",
  "Une démonstration en direct : on fait sonner l'agent pendant le rendez-vous.",
  "Une garantie chiffrée, avec ses trois bords dits à l'oral (durée, périmètre, critère).",
];
