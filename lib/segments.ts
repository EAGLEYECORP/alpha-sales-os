import type { EagleyeOffer } from "./offer-match";
import {
  ALPHA_VOICE_PALIERS,
  ALPHA_VOICE_SETUP_HT,
  OUTBOUND_SETUP_HT,
  OUTBOUND_UNIT_CALLS,
  OUTBOUND_UNIT_HT,
} from "./offres-publiques";

/**
 * Séparateur de milliers, à la main et sans dépendre d'ICU.
 *
 * ⚠ Pas `toLocaleString("fr-FR")` ici : selon la version d'ICU, il rend une
 * espace fine insécable (U+202F) ou une espace normale. Ces chaînes partent
 * dans des documents commerciaux et sont comparées par des tests — un
 * caractère invisible qui change avec la version de Node est exactement le
 * genre de différence qu'on met une heure à voir.
 */
const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * ─────────────────────────────────────────────────────────────────────
 * SEGMENTS — à QUI Alpha Sales OS s'adresse vraiment.
 *
 * L'erreur d'origine : avoir écrit l'ICP autour d'un seul profil (le petit
 * artisan lyonnais). C'était le premier marché, ce n'est plus le marché.
 *
 * Une fois les briques posées — Alpha Voice, Alpha Live, le Cerveau, les
 * campagnes — l'OS sert des organisations très différentes, et chacune
 * achète pour une raison différente :
 *
 *   · une ÉQUIPE TERRAIN achète Alpha Live (l'assistance pendant le RDV) ;
 *   · un CENTRE D'APPELS achète Alpha Voice (le volume qualifié) ;
 *   · une AGENCE achète l'OS complet (le pipeline reproductible) ;
 *   · un COMMERCE LOCAL achète Alpha Voice (ne plus rater d'appel).
 *
 * Confondre ces segments produit un pitch tiède qui ne parle à personne.
 * Chaque segment porte donc SA douleur, SES déclencheurs, SA brique d'entrée
 * et SON argument — et surtout ses DISQUALIFIANTS, parce que dire non vite
 * vaut mieux que traîner un dossier qui ne signera pas.
 *
 * ⚠ Honnêteté sur les chiffres : les fourchettes de taille et de budget sont
 * des ORDRES DE GRANDEUR issus du terrain, pas des statistiques de marché.
 * Elles servent à trancher vite, pas à faire une étude.
 * ─────────────────────────────────────────────────────────────────────
 */

export type SegmentId =
  | "equipe-terrain"
  | "centre-appels"
  | "agence-b2b"
  | "commerce-local"
  | "reseau-franchise"
  | "assurance-transformation";

export interface Segment {
  id: SegmentId;
  label: string;
  /** Qui c'est, en une phrase qu'eux-mêmes reconnaîtraient. */
  who: string;
  /** Taille d'équipe commerciale typique. */
  teamSize: string;
  /** Exemples concrets de métiers. */
  examples: string[];
  /** La douleur centrale — celle qui fait décrocher le téléphone. */
  corePain: string;
  /** Les autres douleurs, par ordre de fréquence. */
  pains: string[];
  /** La brique par laquelle ils ENTRENT (pas tout l'OS d'un coup). */
  entryBricks: string[];
  /** L'offre qui leur correspond dans le routeur. */
  offer: EagleyeOffer;
  /** Ce qu'on guette pour savoir que c'est le bon moment. */
  triggers: string[];
  /** L'accroche — elle nomme LEUR problème, pas notre produit. */
  angle: string;
  /** Qui écarter, et pourquoi ça coûte cher de ne pas le faire. */
  disqualifiers: string[];
  /** Ordre de grandeur du deal (€ HT), terrain. */
  dealRange: string;
  /** Qui signe. */
  buyer: string;
}

export const SEGMENTS: Segment[] = [
  {
    id: "equipe-terrain",
    label: "Équipe commerciale terrain (porte-à-porte, RDV physiques)",
    who: "Une équipe de commerciaux qui va sur le terrain toute la journée, et dont la performance dépend entièrement de ce qu'ils disent devant le client.",
    teamSize: "3 à 50 commerciaux",
    examples: [
      "Toiture, isolation, rénovation énergétique",
      "Photovoltaïque et pompes à chaleur",
      "Fenêtres, vérandas, aménagement extérieur",
      "Sécurité et alarme résidentielle",
      "Télécom et énergie en porte-à-porte",
    ],
    corePain:
      "L'écart entre le meilleur commercial et le plus faible est énorme, et personne ne sait pourquoi. Le savoir du meilleur reste dans sa tête.",
    pains: [
      "Un nouveau met 3 à 6 mois à devenir rentable — et beaucoup partent avant",
      "Les objections terrain se répètent, mais chacun improvise sa réponse",
      "Ce qui s'est dit en rendez-vous n'est jamais écrit : le suivi repose sur la mémoire",
      "Le manager découvre qu'un deal est mort une semaine après",
      "Les leads coûtent cher et une partie n'est jamais rappelée",
    ],
    entryBricks: ["alpha-live", "crm"],
    offer: "alpha-sales-os",
    triggers: [
      "Recrutement de commerciaux en cours (annonces en ligne)",
      "Turnover élevé dans l'équipe de vente",
      "Achat de leads à un fournisseur (donc coût par lead connu et douloureux)",
      "Ouverture d'une nouvelle zone géographique",
      "Un directeur commercial vient d'arriver",
    ],
    angle:
      "« Votre meilleur commercial sait quoi dire. Les huit autres improvisent. On met ce qu'il sait dans l'oreille de tout le monde, pendant le rendez-vous. »",
    disqualifiers: [
      "Moins de 3 commerciaux : le gain de reproductibilité ne justifie pas l'installation",
      "Équipe 100 % indépendante non pilotée (aucun levier de déploiement)",
      "Vente en une visite sans aucun suivi — il n'y a pas de pipeline à outiller",
    ],
    dealRange: "10 000 € VIP, ou 30 % + installation",
    buyer: "Directeur commercial · dirigeant · responsable réseau",
  },
  {
    id: "centre-appels",
    label: "Centre d'appels / plateau téléphonique",
    who: "Une structure dont le métier EST le téléphone : qualification, prise de rendez-vous, ou service client à volume.",
    teamSize: "5 à 200 postes",
    examples: [
      "Plateaux de qualification et prise de RDV",
      "Centres de relation client externalisés",
      "Services de permanence téléphonique",
      "Cellules de relance et recouvrement amiable",
    ],
    corePain:
      "Le coût par contact utile est le seul chiffre qui compte, et il est plombé par les appels qui ne donnent rien : répondeurs, faux numéros, personnes injoignables.",
    pains: [
      "Les téléopérateurs brûlent leur énergie sur des appels sans réponse",
      "La qualité de conversation baisse après quelques heures — la fatigue est réelle",
      "Former un nouveau prend des semaines et le script dérive",
      "Le contrôle qualité se fait par écoute d'échantillons : on rate l'essentiel",
      "Les pics d'activité ne se couvrent qu'en surdimensionnant l'effectif",
    ],
    entryBricks: ["alpha-voice", "pilotage"],
    offer: "alpha-voice",
    triggers: [
      "Pics saisonniers récurrents mal absorbés",
      "Difficulté de recrutement sur les postes de téléopérateur",
      "Coût par contact utile suivi et discuté en interne",
      "Externalisation d'une partie du volume déjà envisagée",
    ],
    angle:
      "« Vos équipes passent la moitié de leur journée sur des appels qui ne décrochent pas. On leur laisse les conversations qui comptent. »",
    disqualifiers: [
      "Métier réglementé où l'agent doit être une personne physique identifiée",
      "Volume trop faible pour amortir l'installation (moins de ~500 appels/mois)",
      "Refus de principe de l'IA côté direction — le convaincre coûte plus que le deal",
    ],
    /**
     * ⚠ CES DEUX NOMBRES ÉTAIENT RECOPIÉS À LA MAIN, dans une phrase que lit
     * un PROSPECT. C'était la dernière deuxième-source de prix du dépôt.
     *
     * Le commentaire qui était ici disait « la vraie correction est de faire
     * remonter les prix publics du sortant dans `offres-publiques`, comme
     * pour Alpha Voice — pas fait ». C'est fait maintenant. Il n'y avait
     * d'ailleurs qu'un seul nombre à déplacer : `OUTBOUND_UNIT_HT` était déjà
     * là, seul son setup manquait.
     *
     * Pourquoi on ne pouvait pas simplement importer `bricks` : il est
     * SERVEUR (catalogue + marges), ce fichier-ci descend dans le navigateur,
     * et `tests/vitrine-fuite` refuse le mélange. Il avait raison.
     */
    dealRange: `${milliers(OUTBOUND_SETUP_HT)} € installation + ${OUTBOUND_UNIT_HT} €/mois par tranche de ${milliers(OUTBOUND_UNIT_CALLS)} appels`,
    buyer: "Directeur de production · responsable de plateau · DSI",
  },
  {
    id: "agence-b2b",
    label: "Agence & société de services B2B",
    who: "Une structure qui vend des prestations à d'autres entreprises, avec un cycle de vente long et un panier élevé.",
    teamSize: "1 à 30 personnes, dont 1 à 5 au commercial",
    examples: [
      "Agences web, marketing, communication",
      "Cabinets de conseil et d'expertise",
      "Sociétés de services informatiques",
      "Courtiers et apporteurs d'affaires",
    ],
    corePain:
      "Le closing dépend d'une seule personne — souvent le fondateur. Tant que c'est vrai, le chiffre plafonne à son nombre d'heures.",
    pains: [
      "Des leads arrivent et se perdent faute de relance systématique",
      "Aucune visibilité chiffrée sur le pipe : ni CAC, ni taux de passage",
      "Le fondateur est le goulot de toutes les ventes",
      "La prospection s'arrête dès qu'il y a de la livraison à faire — puis le creux arrive",
    ],
    entryBricks: ["crm", "campagnes", "cerveau"],
    offer: "alpha-sales-os",
    triggers: [
      "Recrute un commercial pour la première fois",
      "Se plaint publiquement de son CRM ou de sa prospection",
      "Lance une nouvelle offre ou attaque un nouveau marché",
      "Croissance récente qui rend le suivi artisanal intenable",
    ],
    angle:
      "« Vous avez des leads. Le problème n'est pas d'en avoir plus — c'est de n'en perdre aucun pendant que vous livrez. »",
    disqualifiers: [
      "Aucun commercial et aucune intention de vendre activement",
      "Déjà équipé d'un OS complet et satisfait",
      "Cherche l'outil le moins cher — ce ne sera jamais nous",
    ],
    dealRange: "10 000 € VIP, ou à la carte à partir de 2 000 €",
    buyer: "Fondateur · directeur commercial · patron d'agence",
  },
  {
    id: "commerce-local",
    label: "Commerce de proximité dépendant du téléphone",
    who: "Un commerce où chaque appel manqué est un client perdu, et où le gérant décroche entre deux interventions.",
    teamSize: "1 à 10 personnes",
    examples: [
      "Garages, carrosseries, dépannage",
      "Artisans du bâtiment, plomberie, serrurerie",
      "Auto-écoles, agences immobilières locales",
      "Santé, dentaire, ambulances",
    ],
    corePain:
      "Le téléphone sonne pendant qu'ils travaillent. Ce qui n'est pas décroché part chez le concurrent, sans qu'ils le sachent jamais.",
    pains: [
      "Impossible de décrocher en intervention",
      "Aucune permanence le soir, le week-end, pendant les congés",
      "Les demandes web ne sont rappelées que le lendemain, ou jamais",
      "Aucune trace de qui a appelé ni pourquoi",
    ],
    entryBricks: ["alpha-voice"],
    offer: "alpha-voice",
    triggers: [
      "Appels manqués constatés ou déclarés",
      "Le gérant décroche lui-même entre deux chantiers",
      "Avis Google qui mentionnent l'injoignabilité",
      "Ouverture récente ou reprise de fonds",
    ],
    angle:
      "« Chaque appel manqué est un client qui appelle le concurrent. Vous ne saurez jamais qu'il a existé. »",
    disqualifiers: [
      "Déjà plein, liste d'attente, refuse du monde",
      "Sur le départ ou en cessation",
      "Aucune marge : le prix sera toujours l'objection",
    ],
    /**
     * ⚠ DÉRIVÉ, PAS RECOPIÉ. Ce champ portait « 990 € HT installation +
     * abonnement au volume » en dur, et il s'affiche sur la fiche prospect
     * (`app/(app)/prospects/[id]/page.tsx`). C'était une DEUXIÈME source de
     * prix à côté de `lib/offres-publiques.ts` : elle est restée vraie par
     * chance quand la grille est passée de cinq paliers à deux, mais elle
     * aurait menti au premier changement de setup.
     *
     * Un prix ne s'écrit qu'à un endroit. Ailleurs, il se calcule.
     */
    dealRange: `${ALPHA_VOICE_SETUP_HT} € HT installation + ${ALPHA_VOICE_PALIERS[0].prixHT} à ${
      ALPHA_VOICE_PALIERS[ALPHA_VOICE_PALIERS.length - 1].prixHT
    } €/mois selon le volume`,
    buyer: "Gérant — il décide et il signe",
  },
  {
    id: "reseau-franchise",
    label: "Réseau, franchise, groupement",
    who: "Une tête de réseau qui doit faire appliquer les mêmes standards commerciaux dans des dizaines de points de vente qu'elle ne contrôle pas directement.",
    teamSize: "10 à 500 points de vente",
    examples: [
      "Franchises de services aux particuliers",
      "Groupements d'artisans et d'indépendants",
      "Réseaux d'agences immobilières",
      "Concessions et distribution spécialisée",
    ],
    corePain:
      "Le discours commercial se dilue à mesure qu'on s'éloigne du siège. Personne ne sait ce qui se dit vraiment sur le terrain.",
    pains: [
      "Écarts de performance énormes entre points de vente, mal expliqués",
      "Les bonnes pratiques d'un franchisé ne remontent jamais aux autres",
      "Le siège découvre les problèmes dans les chiffres trimestriels",
      "Chaque point de vente bricole ses propres outils",
    ],
    entryBricks: ["crm", "closer", "pilotage"],
    offer: "alpha-sales-os",
    triggers: [
      "Ouverture de nouveaux points de vente",
      "Écarts de performance discutés en comité",
      "Refonte de l'accompagnement franchisé",
      "Convention réseau annuelle à venir",
    ],
    angle:
      "« Vous savez ce que vos meilleurs points de vente font mieux. Le problème, c'est de le faire faire aux autres. »",
    disqualifiers: [
      "Aucun levier sur les franchisés (adhésion purement volontaire, budget local)",
      "Réseau en restructuration : personne ne décide",
      "Moins de 10 points de vente — l'effet de réseau ne joue pas encore",
    ],
    dealRange: "10 000 € VIP au siège, puis déploiement par point de vente",
    buyer: "Directeur réseau · directeur commercial · animateur de réseau",
  },
  {
    id: "assurance-transformation",
    label: "Assurance & services financiers en transformation",
    who: "Une compagnie, un courtier ou une mutuelle dont les process de souscription et de relance sont encore largement manuels.",
    teamSize: "25 à 2 000 salariés",
    examples: [
      "Compagnies d'assurance et mutuelles",
      "Courtiers grossistes",
      "Bancassurance et services financiers",
    ],
    corePain:
      "Les parcours sont fragmentés entre des systèmes qui ne se parlent pas, et chaque friction coûte des contrats sans qu'on puisse la chiffrer.",
    pains: [
      "Souscription, sinistres et relances encore manuels — lents et coûteux",
      "Systèmes hérités qui ne communiquent pas",
      "Aucune mesure de bout en bout du parcours client",
      "Pression réglementaire et concurrence des assurtechs",
    ],
    entryBricks: ["crm", "cerveau", "pilotage"],
    offer: "visibilite-growth",
    triggers: [
      "Nomination d'un directeur transformation ou innovation",
      "Programme de digitalisation annoncé ou budget voté",
      "Fusion ou rapprochement de mutuelles",
      "Recrutements data / digital publiés",
    ],
    angle:
      "« Votre concurrent traite un dossier en minutes, vous en jours. La transformation, ce n'est pas un logiciel de plus — c'est le parcours refait. »",
    disqualifiers: [
      "Budget projet sous 40 000 € HT → c'est faisable par nous, ça reste chez EAGLEYE",
      "Aucun sponsor au comité de direction",
      "Refonte de core system en cours qui gèle tout le reste",
    ],
    dealRange: "> 40 000 € HT via Nuwacom (15 %), sinon EAGLEYE",
    buyer: "Directeur transformation · DSI · directeur général",
  },
];

export const segmentById = (id: SegmentId): Segment | undefined => SEGMENTS.find((s) => s.id === id);

/** Les segments servis par une brique donnée — sert la vente à la carte. */
export function segmentsForBrick(brickId: string): Segment[] {
  return SEGMENTS.filter((s) => s.entryBricks.includes(brickId));
}

/** Les segments qu'un compte peut adresser (contraints par ses offres). */
export function segmentsForAccount(allowedOffers: EagleyeOffer[]): Segment[] {
  if (!allowedOffers.length) return SEGMENTS;
  return SEGMENTS.filter((s) => allowedOffers.includes(s.offer));
}

/**
 * Devine le segment d'un prospect à partir de son secteur et de sa taille.
 * Renvoie `null` plutôt qu'un mauvais segment : un pitch adressé au mauvais
 * profil est pire qu'un pitch générique — il prouve qu'on n'a pas compris.
 */
export function guessSegment(input: {
  sector?: string;
  /** Texte libre où le VRAI métier atterrit à l'import (notes, société, pitch). */
  text?: string;
  headcount?: number;
  salesTeamSize?: number;
}): Segment | null {
  const t = [input.sector, input.text].filter(Boolean).join(" ").toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => t.includes(n));

  if (has("call center", "centre d'appel", "centre d appel", "plateau", "téléopé", "teleope", "relation client"))
    return segmentById("centre-appels") ?? null;
  if (has("assur", "mutuelle", "courtier", "bancassur")) return segmentById("assurance-transformation") ?? null;
  if (has("franchise", "réseau", "reseau", "groupement", "concession")) return segmentById("reseau-franchise") ?? null;
  if (has("toiture", "isolation", "photovolta", "pompe à chaleur", "rénovation énergétique", "porte-à-porte", "porte a porte", "fenêtre", "véranda"))
    return segmentById("equipe-terrain") ?? null;
  if (has("agence", "conseil", "marketing", "communication", "saas", "logiciel", "informatique"))
    return segmentById("agence-b2b") ?? null;
  if (
    has(
      "garage", "carrosserie", "artisan", "plomb", "serrur", "auto-école", "auto ecole",
      "immobilier", "dentaire", "ambulance", "restaurant", "restauration", "pub", "bar ",
      "brasserie", "boulang", "coiffure", "esthé", "menuiser", "électricien", "electricien",
      "traiteur", "hôtel", "hotel", "cabinet", "taxi", "vtc",
    )
  )
    return segmentById("commerce-local") ?? null;

  // Sans secteur parlant, la taille de l'équipe commerciale tranche.
  const team = input.salesTeamSize ?? 0;
  if (team >= 3) return segmentById("equipe-terrain") ?? null;
  return null;
}

/**
 * Le segment d'un prospect RÉEL.
 *
 * Pourquoi ce détour : `Prospect.sector` est un enum de cinq valeurs hérité du
 * marché d'origine (restaurant / pub / ambulance / artisan / autre). Un centre
 * d'appels ou un poseur de toiture importé depuis un CSV arrive donc en
 * « autre », et son vrai métier atterrit dans les NOTES (`lib/csv.ts` y écrit
 * « Métier : … »). Deviner sur le seul `sector` renverrait null sur la quasi-
 * totalité des fiches réelles — le module serait juste en théorie et inutile
 * en pratique.
 */
export function guessSegmentForProspect(p: {
  sector?: string;
  company?: string;
  notes?: string;
  problems?: string[];
  salesTeamSize?: number;
}): Segment | null {
  return guessSegment({
    sector: p.sector,
    text: [p.company, p.notes, ...(p.problems ?? [])].filter(Boolean).join(" "),
    salesTeamSize: p.salesTeamSize,
  });
}
