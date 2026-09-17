import { PRIX_PUBLICS } from "./public-catalogue";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CADRAGE AVANT LE DEVIS — et l'estimation publique qui n'en est PAS un.
 *
 * ══ ⚠⚠ LA RÈGLE EXISTAIT, EN PROSE, DANS UNE CHAÎNE ══
 *
 * « Cadrage OBLIGATOIRE avant devis : visio, appel ou SMS, avec date + heure
 * DÉCIDÉES et validation de la suite. » Écrit dans la doctrine depuis des
 * semaines — et le seul endroit du code qui en parlait était une **chaîne de
 * caractères** (`lib/paliers.ts`), à l'intérieur d'une phrase de vente.
 * Invisible pour le code. Le défaut déjà payé par `forbidden`, par
 * `structuralPain` et par la règle de routage.
 *
 * ══ POURQUOI LA RÈGLE EXISTE, ET CE QU'ELLE PROTÈGE ══
 *
 * Un devis annoncé sans avoir regardé le cas est un devis qu'on ne tiendra
 * pas. Il se renégocie à la livraison, dans le pire sens : le client a déjà le
 * chiffre en tête, et tout ce qui s'y ajoute ressemble à de la mauvaise foi.
 * Le cadrage n'est pas une politesse commerciale, c'est ce qui rend le montant
 * défendable.
 *
 * ══ L'ESTIMATION PUBLIQUE — ce qu'on a le droit de montrer AVANT ══
 *
 * Interdire toute idée de prix avant le cadrage ferait fuir la moitié des
 * visiteurs : personne ne prend un rendez-vous pour découvrir un ordre de
 * grandeur. La sortie n'est pas de relâcher la règle, c'est de distinguer
 * DEUX objets :
 *
 *  · une **ESTIMATION** — calculée sur la grille publique, exacte pour un
 *    périmètre SUPPOSÉ, et qui ne peut jamais devenir un engagement ;
 *  · un **DEVIS** — chiffré, daté, engageant, et qui exige le cadrage.
 *
 * ⚠⚠ `Estimation.estUnDevis` est typé `false` LITTÉRALEMENT. Ce n'est pas de
 * la prudence rédactionnelle : c'est la règle rendue impossible à contourner
 * par distraction. Une estimation ne peut pas se transformer en devis en
 * changeant un booléen — il faut passer par `emettreDevis`, qui exige le
 * cadrage.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'on sait du cadrage d'un prospect. */
export interface EtatCadrage {
  /** Date ET heure DÉCIDÉES, en ISO. `null` = pas de créneau arrêté. */
  creneauIso: string | null;
  /** Le cadrage a-t-il eu lieu ? Un créneau posé n'est pas un cadrage fait. */
  reelementTenu: boolean;
  /** Qui a validé la suite. `null` = personne. */
  validePar: string | null;
}

/**
 * L'état de départ : aucun cadrage. Il REFUSE le devis, et c'est voulu.
 *
 * ⚠ Il existe pour que « absent » et « vide » soient le même objet. Deux façons
 * de dire « on ne sait rien » finissent par recevoir deux traitements, et c'est
 * la plus permissive qui gagne.
 */
export const CADRAGE_VIDE: EtatCadrage = { creneauIso: null, reelementTenu: false, validePar: null };

/**
 * Lit un cadrage venu de l'EXTÉRIEUR (corps JSON, fiche réhydratée d'un vieux
 * `localStorage`, import) et le ramène à un `EtatCadrage` sûr.
 *
 * ⚠⚠ L'INCONNU VAUT REFUS. Chaque champ illisible retombe sur la valeur qui
 * BLOQUE, jamais sur celle qui laisse passer. C'est le même arbitrage que
 * `presence-agent` : ne pas émettre coûte dix secondes de saisie, émettre un
 * devis non cadré coûte une renégociation à la livraison.
 *
 * ⚠ `JSON.parse` rend `any` : sans ce filtre, `{ reelementTenu: "non" }`
 * passerait pour vrai (chaîne non vide). Le dépôt a déjà payé cette famille
 * avec « undefined enregistrement(s) DNS manquant(s) » et avec le 403 de
 * transcription lu comme « pas configuré ».
 */
export function lireCadrage(recu: unknown): EtatCadrage {
  if (typeof recu !== "object" || recu === null) return CADRAGE_VIDE;
  const o = recu as Record<string, unknown>;

  // Un créneau doit être une date PARSABLE. « bientôt », « jeudi », "" ne sont
  // pas des créneaux décidés — et la règle dit « date ET heure ».
  const brut = typeof o.creneauIso === "string" ? o.creneauIso.trim() : "";
  const creneauIso = brut && !Number.isNaN(Date.parse(brut)) ? brut : null;

  return {
    creneauIso,
    reelementTenu: o.reelementTenu === true,
    validePar: typeof o.validePar === "string" && o.validePar.trim() ? o.validePar.trim() : null,
  };
}

/**
 * Le créneau est-il PASSÉ ? `maintenant` est injecté, jamais lu de l'horloge
 * ici : une fonction qui lit `Date.now()` rend un test qui devient vert tout
 * seul le jour où la date fixe est dépassée.
 *
 * ⚠⚠ À QUOI ÇA SERT. « Le cadrage a eu lieu » est un point DÉCLARATIF, et la
 * doctrine des paliers est nette : un point déclaratif ne s'offre pas tant que
 * sa condition n'existe pas. Cocher « la visio s'est tenue » sur un créneau de
 * mardi prochain fabrique la preuve — et trois cases cochées en dix secondes
 * rendent la règle décorative, ce qui est pire que pas de règle du tout.
 *
 * ⚠ Elle n'entre PAS dans `peutEmettreDevis` : un devis part légitimement le
 * jour même du cadrage, et y mêler l'horloge ferait répondre différemment à la
 * même question selon l'heure d'exécution. Ici on borne la SAISIE, là-bas on
 * arbitre l'ÉMISSION.
 */
export function creneauPasse(c: EtatCadrage, maintenant: number): boolean {
  if (!c.creneauIso) return false;
  const t = Date.parse(c.creneauIso);
  return !Number.isNaN(t) && t <= maintenant;
}

export interface VerdictDevis {
  autorise: boolean;
  /** Ce qui manque, nommé. Vide quand c'est bon. */
  manquants: string[];
  motif: string;
}

/**
 * A-t-on le droit d'émettre un DEVIS sur ce dossier ?
 *
 * ⚠ Les trois conditions sont CUMULATIVES et distinctes. « Un rendez-vous est
 * posé » n'est pas « le cadrage a eu lieu », et « le cadrage a eu lieu » n'est
 * pas « on a validé qu'on y va ». Les confondre, c'est exactement ce qui
 * produit un devis envoyé après un appel de dix minutes où personne n'a rien
 * décidé.
 */
export function peutEmettreDevis(c: EtatCadrage): VerdictDevis {
  const manquants: string[] = [];
  if (!c.creneauIso) manquants.push("aucun créneau décidé (date ET heure)");
  if (!c.reelementTenu) manquants.push("le cadrage n'a pas encore eu lieu");
  if (!c.validePar?.trim()) manquants.push("la suite n'a été validée par personne");

  return {
    autorise: manquants.length === 0,
    manquants,
    motif:
      manquants.length === 0
        ? "Cadrage tenu et validé : le devis peut partir, chiffré et daté."
        : "Pas de devis sans cadrage — un montant annoncé sans avoir regardé le cas se renégocie à la livraison, " +
          "et c'est le client qui a raison de le reprocher. Ce qui manque : " +
          manquants.join(" · ") +
          ".",
  };
}

/**
 * Ce qu'une estimation publique rend — et ce qu'elle refuse d'être.
 *
 * ⚠ `estUnDevis: false` est un TYPE, pas une valeur. Le compilateur refuse
 * qu'on le passe à `true`.
 */
export interface Estimation {
  sieges: number;
  setupHT: number;
  mensuelHT: number;
  /** Setup + douze mois — ce que le visiteur veut vraiment savoir. */
  annee1HT: number;
  estUnDevis: false;
  /** Ce qui peut faire bouger le chiffre. JAMAIS vide. */
  reserves: string[];
}

/** Au-delà, on ne calcule plus : on renvoie au cadrage. */
export const SIEGES_MAX_ESTIMATION = 50;

/**
 * L'estimation publique, calculée sur la grille PUBLIQUE uniquement.
 *
 * ⚠ Elle n'utilise que `PRIX_PUBLICS` — le socle, le siège, le setup du pack.
 * Le catalogue brique par brique reste hors de portée : `tests/vitrine-fuite`
 * refuse que la grille ligne à ligne descende dans un navigateur, et une
 * estimation publique qui l'emporterait serait une fuite déguisée en service.
 *
 * ⚠ Les réserves ne sont JAMAIS vides. Un chiffre nu, sur une page publique,
 * se lit comme un prix ferme — et c'est précisément l'erreur que le cadrage
 * existe pour empêcher.
 */
export function estimationPublique(sieges: number): Estimation | null {
  if (!Number.isInteger(sieges) || sieges < 1) return null;
  // Au-delà de la borne, la grille n'a jamais été éprouvée et le dossier
  // change de nature (achats, sécurité, pilote). Rendre un chiffre serait
  // inventer une expérience qu'on n'a pas.
  if (sieges > SIEGES_MAX_ESTIMATION) return null;

  const mensuelHT = PRIX_PUBLICS.packSocleHT + PRIX_PUBLICS.packSiegeHT * sieges;
  const setupHT = PRIX_PUBLICS.packSetupHT;

  return {
    sieges,
    setupHT,
    mensuelHT,
    annee1HT: setupHT + mensuelHT * 12,
    estUnDevis: false,
    reserves: [
      "Ce n'est pas un devis : c'est la grille publique appliquée à votre effectif. Le PÉRIMÈTRE se décide au cadrage, et c'est lui qui fait le prix.",
      "Alpha Voice n'est pas compris : il se facture à l'usage, parce qu'il remplace du temps humain et pas un poste de logiciel.",
      "Une installation à la carte, un OS sur mesure ou une reprise de données existante se chiffrent séparément.",
    ],
  };
}
