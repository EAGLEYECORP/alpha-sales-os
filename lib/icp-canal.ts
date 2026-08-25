import { PRESENCE_LINKEDIN } from "./linkedin-ciblage";
import { VERTICALS } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEUX CANAUX, DEUX ICP — et ils ne visent pas les mêmes personnes.
 *
 * ── LA CONFUSION QUI COÛTE CHER ──
 *
 * « Le bon ICP pour les posts LinkedIn » et « le bon ICP pour les appels »
 * sont posés comme une seule question. Ce sont deux questions, et les traiter
 * comme une seule produit les deux échecs classiques :
 *
 *  · on écrit pour des artisans **sur LinkedIn**, où ils ne sont pas → des
 *    posts que personne ne lit ;
 *  · on appelle des gens qui n'ont jamais entendu parler de nous, et on croit
 *    que le contenu les a « réchauffés ». Il ne les a pas touchés du tout.
 *
 * ── CE QUE FAIT VRAIMENT LE CONTENU POUR LE CANAL TÉLÉPHONE ──
 *
 * Il ne génère pas les appels. Il les RATTRAPE. Le gérant qu'on appelle
 * mardi ne lit pas LinkedIn — mais s'il est intéressé, il tape « EAGLEYE
 * CORP » dans Google mercredi matin avant de rappeler. Ce qu'il trouve à ce
 * moment-là décide s'il rappelle.
 *
 * C'est la vraie fonction du contenu ici : être là AU MOMENT DE LA
 * VÉRIFICATION. Pas de l'acquisition — de la confirmation.
 * ─────────────────────────────────────────────────────────────────────
 */

export type CanalId = "contenu-social" | "appel-terrain";

export interface IcpCanal {
  id: CanalId;
  label: string;
  /** Qui on atteint réellement là. */
  qui: string;
  /** Ce qu'on cherche à déclencher. */
  but: string;
  /** Qui on n'atteint PAS, et pourquoi ça compte. */
  hors: string;
  /** Les verticales du playbook qui fonctionnent sur ce canal. */
  verticales: string[];
  /** L'angle qui marche ici — il diffère d'un canal à l'autre. */
  angle: string;
  /** Le signe qu'on s'est trompé de canal. */
  symptomeDErreur: string;
}

/** Les verticales par présence LinkedIn — la donnée vient du module de ciblage. */
const verticalesOu = (niveaux: ("forte" | "moyenne" | "faible")[]) =>
  VERTICALS.filter((v) => niveaux.includes(PRESENCE_LINKEDIN[v.id] ?? "moyenne")).map((v) => v.label);

export const ICP_PAR_CANAL: IcpCanal[] = [
  {
    id: "contenu-social",
    label: "Contenu LinkedIn et réseaux",
    qui: "Le dirigeant de PME de services, entre 5 et 250 personnes, qui LIT sur son téléphone — immobilier, santé, formation, centres d'appels, équipes commerciales. C'est aussi lui qu'on trouve en sourcing LinkedIn : les deux se recouvrent, et c'est normal.",
    but: "Exister avant et après. Attirer ceux qui se reconnaissent, et surtout donner du CONTEXTE à celui qui nous cherche après un appel ou une invitation.",
    hors: "Les artisans, garagistes, restaurateurs, ambulanciers et auto-écoles. Ils ne sont pas sur LinkedIn — c'est exactement la douleur qu'on leur vend : ils sont sur le terrain, pas devant un écran. Écrire pour eux ici, c'est écrire pour personne.",
    verticales: verticalesOu(["forte", "moyenne"]),
    angle:
      "Le métier de la vente, montré de l'intérieur : ce qu'on a mesuré, ce qui a raté, ce qu'on a arrêté de faire. Pas de conseil générique — un fait par publication.",
    symptomeDErreur:
      "Des vues sans conversation. Si personne ne commente et que personne ne se reconnaît, l'audience n'est pas là — ce n'est pas le texte qui est faible.",
  },
  {
    id: "appel-terrain",
    label: "Appel sortant terrain",
    qui: "Le patron d'une entreprise locale dont le téléphone EST le chiffre d'affaires, et qui croule sous les demandes : garage, couvreur, plombier, restaurant, auto-école, cabinet. 5 à 30 personnes, le décideur décroche lui-même.",
    but: "Un rendez-vous. Rien d'autre. On ne vend pas au téléphone, on obtient vingt minutes.",
    hors: "Les enseignes nationales et franchises (téléphone mutualisé, décision ailleurs), et tout ce qui a déjà un standard ou un secrétariat externalisé — l'offre n'a plus d'objet.",
    verticales: verticalesOu(["faible", "moyenne"]),
    angle:
      "Le miroir : le client qui tombe sur le répondeur ne laisse pas de message, il appelle le suivant — et vous ne saurez jamais qu'il a appelé. La perte invisible, posée en QUESTION, jamais en affirmation.",
    symptomeDErreur:
      "Des appels qui se terminent en débat sur la méthode. C'est le signe qu'on a asséné un chiffre au lieu de faire dire la douleur.",
  },
];

export const canalById = (id: CanalId) => ICP_PAR_CANAL.find((c) => c.id === id) ?? null;

/**
 * Le recouvrement entre les deux canaux, dit franchement.
 *
 * Une seule verticale est vraiment servie par les deux (l'immobilier), et
 * quelques-unes à moitié. Le reste est disjoint. C'est LA raison pour laquelle
 * un seul ICP ne peut pas piloter les deux.
 */
export function recouvrement(): { communes: string[]; verdict: string } {
  const a = new Set(ICP_PAR_CANAL[0].verticales);
  const communes = ICP_PAR_CANAL[1].verticales.filter((v) => a.has(v));
  return {
    communes,
    verdict: communes.length
      ? `${communes.length} verticale(s) servie(s) par les deux canaux. Le reste est disjoint : un seul ICP ne peut pas piloter les deux.`
      : "Aucun recouvrement : ceux qu'on appelle ne lisent pas ce qu'on écrit, et inversement.",
  };
}

// ── LA SURFACE DE PREUVE ───────────────────────────────────────────────

/**
 * Ce qu'un prospect trouve quand il cherche notre nom.
 *
 * ⚠ C'est le moment le plus décisif du cycle et le moins piloté. Le gérant
 * appelé mardi tape « EAGLEYE CORP » mercredi matin. S'il ne trouve rien, il
 * ne rappelle pas — et personne, chez nous, ne saura jamais pourquoi.
 */
export interface EtatSurface {
  /** Le site public est en ligne sur le domaine. */
  siteEnLigne?: boolean;
  /** Les mentions légales et CGV sont publiées (un site marchand sans elles inquiète). */
  legalPublie?: boolean;
  /** Une page LinkedIn entreprise existe et n'est pas vide. */
  pageLinkedin?: boolean;
  /** Nombre de publications des 30 derniers jours. */
  publications30j?: number;
  /** Une fiche d'établissement Google existe. */
  ficheGoogle?: boolean;
  /** Nombre d'études de cas publiées (client réel, accord obtenu). */
  etudesDeCas?: number;
  /** Le visage du dirigeant est visible sur le site. */
  visageVisible?: boolean;
}

export type Priorite = "bloquant" | "important" | "confort";

export interface ElementSurface {
  id: string;
  quoi: string;
  /** Pourquoi ça compte AU MOMENT de la vérification. */
  pourquoi: string;
  priorite: Priorite;
  present: boolean;
}

/**
 * Évalue la surface de preuve et dit ce qui manque, par ordre de gravité.
 *
 * Volontairement factuel : chaque ligne se coche ou se décoche sur un fait
 * vérifiable, pas sur une impression. Une liste de conseils ne se traite
 * jamais ; une liste de cases vides, si.
 */
export function evaluerSurface(e: EtatSurface = {}): {
  elements: ElementSurface[];
  manquants: ElementSurface[];
  verdict: string;
} {
  const pubs = e.publications30j ?? 0;

  const elements: ElementSurface[] = [
    {
      id: "site",
      quoi: "Un site à notre nom, en ligne, qui dit ce qu'on fait",
      pourquoi: "Sans lui, la recherche ne rend rien et l'appel meurt là. C'est le seul élément dont l'absence est rédhibitoire.",
      priorite: "bloquant",
      present: !!e.siteEnLigne,
    },
    {
      id: "legal",
      quoi: "Mentions légales, CGV et politique de confidentialité publiées",
      pourquoi: "Un dirigeant qui envisage de payer regarde qui il paie. Un site sans mentions légales se lit comme une coquille — et en France c'est une obligation, pas une bonne pratique.",
      priorite: "bloquant",
      present: !!e.legalPublie,
    },
    {
      id: "visage",
      quoi: "Le visage et le nom du dirigeant, visibles",
      pourquoi: "Une entreprise anonyme se vérifie mal. Un vrai visage transforme un fournisseur inconnu en personne joignable — et c'est gratuit.",
      priorite: "important",
      present: !!e.visageVisible,
    },
    {
      id: "linkedin",
      quoi: "Une page LinkedIn entreprise renseignée",
      pourquoi: "C'est le deuxième réflexe après Google. Une page vide est pire qu'une page absente : elle donne l'air d'une activité arrêtée.",
      priorite: "important",
      present: !!e.pageLinkedin,
    },
    {
      id: "activite",
      quoi: "Une trace d'activité récente (au moins 4 publications sur 30 jours)",
      pourquoi: "Ce n'est pas l'audience qui compte ici, c'est la DATE. Une dernière publication d'il y a huit mois laisse penser que la boîte a fermé.",
      priorite: "important",
      present: pubs >= 4,
    },
    {
      id: "google",
      quoi: "Une fiche d'établissement Google",
      pourquoi: "Elle fait apparaître l'adresse, le téléphone et l'ancienneté à droite de la recherche. C'est le raccourci de crédibilité le moins cher qui existe.",
      priorite: "confort",
      present: !!e.ficheGoogle,
    },
    {
      id: "cas",
      quoi: "Au moins une étude de cas avec un client réel",
      pourquoi: "C'est la preuve qui manque le plus, et la seule qui ne se fabrique pas. Zéro client signé = zéro étude de cas disponible ; inventer en fabriquerait une fausse.",
      priorite: "important",
      present: (e.etudesDeCas ?? 0) > 0,
    },
  ];

  const manquants = elements
    .filter((x) => !x.present)
    .sort((a, b) => rang(a.priorite) - rang(b.priorite));

  const bloquants = manquants.filter((m) => m.priorite === "bloquant").length;
  const verdict = bloquants
    ? `${bloquants} élément(s) BLOQUANT(s) : celui qui cherche notre nom ne trouve pas de quoi se décider. Tout appel passé avant est en partie perdu.`
    : manquants.length
      ? `Le socle tient. ${manquants.length} élément(s) à compléter pour que la vérification joue en notre faveur.`
      : "La surface de preuve est complète.";

  return { elements, manquants, verdict };
}

const rang = (p: Priorite) => (p === "bloquant" ? 0 : p === "important" ? 1 : 2);

/**
 * Le rythme de publication tenable, et pourquoi il est bas.
 *
 * ⚠ Ce n'est PAS un objectif d'audience. C'est le minimum pour qu'une
 * recherche tombe sur quelque chose de daté de ce mois-ci. Viser plus haut
 * produit trois semaines de publication quotidienne puis six mois de silence —
 * et le silence est précisément ce qu'on cherche à éviter.
 */
export const PUBLICATIONS_MIN_30J = 4;
