import type { Prospect } from "./types";
import { offreDeLaVerticale, verticalForProspect } from "./playbook";
import { pickMagnet } from "./lead-magnet";
import { OFFRES } from "./offer-match";
import type { ProfilOperateur } from "./profil-operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'ON ÉCRIT À UN PROSPECT — une seule fois, pour les deux canaux.
 *
 * ⚠ DEUX DÉFAUTS EN UN, ET C'EST LE MÊME QUE CÔTÉ VOIX.
 *
 * 1. L'ANGLE ÉTAIT FIGÉ SUR CALLFLOW. `mail-compose` et `linkedin-sequence`
 *    annonçaient tous les deux :
 *
 *      « je travaille avec les métiers où le téléphone est le premier point
 *        de contact »
 *      « il m'arrive de préparer […] un audit de son accueil téléphonique »
 *
 *    Quel que soit le routage. Un prospect classé « invisible en ligne »
 *    recevait donc une proposition d'audit téléphonique — et l'aimant qu'on
 *    lui aurait réellement envoyé (`pickMagnet`) s'appelle « Audit de votre
 *    visibilité locale ». Le mail vendait une chose, la pièce jointe une
 *    autre.
 *
 * 2. LES TROIS PHRASES ÉTAIENT DUPLIQUÉES MOT POUR MOT dans les deux
 *    fichiers. Corriger l'une laissait l'autre mentir.
 *
 * ── POURQUOI ÇA NE RÉINVENTE RIEN ──
 *
 * `pickMagnet` existe, suit déjà `deepDive` et se contraint déjà aux offres
 * autorisées du compte. Son commentaire le dit : « même logique de routage,
 * donc jamais de contradiction entre ce qu'on envoie et ce qu'on proposera
 * ensuite ». La contradiction existait quand même — parce que le corps du
 * message ne le consultait pas.
 *
 * On lit donc l'aimant, et rien d'autre : son TITRE est le nom réel du
 * document, son CIBLAGE est la phrase de critère. Aucune copie nouvelle à
 * maintenir, aucune à faire diverger.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ApprocheEcrite {
  /** « les … » — le critère, sans la liste de secteurs. */
  critere: string;
  /**
   * La phrase de critère, prête à écrire : « je m'adresse aux … ».
   *
   * ⚠⚠ ELLE DISAIT « JE TRAVAILLE AVEC … », ET À ZÉRO CLIENT C'EST FAUX
   * (relevé le 30/09/2026 en rédigeant les invitations du lot AURA).
   * « Je travaille avec les promoteurs de la région » se lit « j'ai des
   * promoteurs pour clients » : la preuve sociale inventée que la doctrine
   * refuse, glissée dans un verbe. Elle partait par QUATRE générateurs —
   * invitation, message LinkedIn, email, forme courte — qui la recopiaient
   * chacun. Une seule phrase ici, et un test refuse que « je travaille
   * avec » revienne dans ce qu'ils écrivent.
   * « Je m'adresse aux … » garde ce qui fait la force de la tournure (on a
   * CHOISI un critère, on n'écrit pas à tout le monde) sans rien affirmer
   * qu'on ne puisse montrer.
   */
  phraseCritere: string;
  /**
   * L'observation de MÉTIER du playbook, ou `null` si elle ne colle pas à
   * l'offre routée.
   *
   * ⚠ ELLE ÉTAIT AJOUTÉE SANS CONDITION, ET ELLE RAMENAIT LE TÉLÉPHONE.
   * Constaté sur le rendu réel, après la première correction : une fiche
   * routée « visibilité » recevait « je travaille avec les commerces et
   * artisans invisibles en ligne. **Les métiers où l'artisan est sur le
   * chantier toute la journée — donc jamais près du téléphone.** » Le bon
   * critère, immédiatement contredit par le suivant.
   *
   * Ce n'est pas un jugement de goût : les onze critères de `lib/playbook.ts`
   * parlent TOUS du téléphone (c'est vérifiable, et un test le vérifie). Ils
   * appartiennent à l'angle Alpha Voice et n'ont de sens que là.
   */
  critereMetier: string | null;
  /** La seule question posée. Verticale si elle colle à l'offre, sinon celle de l'offre. */
  question: string;
  /**
   * La phrase qui SIGNALE l'audit sans le proposer (posture pull), ou `null`
   * si aucun aimant ne convient à ce compte — auquel cas on n'annonce rien
   * plutôt que d'annoncer le mauvais document.
   */
  signal: string | null;
  /** Fin d'objet d'email, calée sur le sujet réel. */
  objet: string;
}

/**
 * Le ciblage de l'aimant, ramené à ce qui se dit à un prospect.
 *
 * `targets` est une note interne : « Métiers où le téléphone EST le canal
 * d'entrée : garages, artisans, santé, auto-écoles, immobilier. » Réciter la
 * liste des secteurs à un garage donne l'impression d'un publipostage — on
 * coupe donc au deux-points, ce qui laisse le critère seul. Transformation
 * mécanique : rien n'est réécrit à la main, donc rien ne peut diverger.
 */
function critereDepuisCiblage(targets: string): string {
  const avantListe = targets.split(":")[0].trim().replace(/\.$/, "");
  return avantListe.charAt(0).toLowerCase() + avantListe.slice(1);
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'EXPÉDITEUR D'UN TEXTE ÉCRIT, QUAND CE N'EST PAS LE COMPTE MAÎTRE.
 *
 * ⚠⚠ MESURÉ LE 22/10/2026 avec le vrai code : l'invitation LinkedIn d'un
 * inscrit qui vend un logiciel de paie disait « je suis Julie Martin,
 * d'EAGLEYE CORP. Je m'adresse aux métiers où le téléphone EST le canal
 * d'entrée ». La société venait du COMPTE (`accountId: "eagleye"`, que tout
 * inscrit porte), le critère et la question de NOS aimants. Et une invitation
 * se copie à la main : aucun serveur ne la relit.
 *
 * Présent ⇒ le texte parle de SON offre et signe de SA société (vide si elle
 * n'est pas renseignée — le nom seul, jamais le nôtre). Absent ⇒ le compte
 * maître, comme avant. C'est l'écran qui le décide, sur le verdict SERVEUR
 * (`useMaitreProuve`).
 * ─────────────────────────────────────────────────────────────────────
 */
export interface ExpediteurInscrit {
  profil: ProfilOperateur | null | undefined;
  agencyName: string;
  city: string;
}

/** « que » + voyelle → « qu' » (jamais devant un h : l'aspiré ne se devine pas). */
const que = (suite: string) => (/^[aeiouyàâéèêëîïôöûü]/i.test(suite) ? `qu'${suite}` : `que ${suite}`);

/**
 * L'approche écrite d'un inscrit : SON critère, SA question, aucun aimant.
 * Faute de profil, des formulations neutres — jamais des crochets : un texte
 * copié à la main partirait avec.
 */
export function approcheInscrit(profil: ProfilOperateur | null | undefined): ApprocheEcrite {
  const metier = profil?.metier.trim() ?? "";
  const role = profil?.cibleRole.trim() ?? "";
  const secteur = profil?.cibleSecteur.trim() ?? "";
  const critere = role ? `les ${role}${secteur ? ` (${secteur})` : ""}` : secteur ? `les entreprises (${secteur})` : "les entreprises de votre taille, sur un sujet précis";
  return {
    critere,
    phraseCritere: `je m'adresse ${critere.replace(/^les\b/, "aux")}`,
    critereMetier: null,
    question: metier
      ? `Est-ce ${que(metier)} est un sujet chez vous en ce moment ?`
      : "Quel est le sujet qui vous occupe le plus en ce moment ?",
    signal: null,
    objet: "une question",
  };
}

export function approcheEcrite(p: Prospect, accountId = "eagleye", inscrit?: ExpediteurInscrit | null): ApprocheEcrite {
  if (inscrit) return approcheInscrit(inscrit.profil);
  const v = verticalForProspect(p);
  const pick = pickMagnet(p, accountId);
  const offre = pick?.magnet.offer ?? null;

  /**
   * La verticale n'enrichit le message que si elle sert la MÊME offre que
   * l'aimant routé.
   *
   * ⚠ CETTE LIGNE TESTAIT `offre === "alpha-voice"`, ET C'ÉTAIT JUSTE — tant
   * que les neuf verticales du playbook parlaient toutes du téléphone qui
   * tombe dans le vide. « Le playbook parle téléphone » n'était pas une règle,
   * c'était un CONSTAT, et il servait de raccourci à la vraie question.
   *
   * La maîtrise d'ouvrage l'a rendu faux : elle sert l'OS de vente. Avec
   * l'ancien test, son critère (« le rythme des réservations conditionne le
   * lancement de l'opération ») aurait été jeté sur un routage alpha-sales-os
   * — où il est pourtant exactement à sa place — et servi sur un routage
   * alpha-voice, où il n'a rien à faire. Les deux erreurs en une ligne.
   *
   * On compare donc les offres, et l'ancien constat devient un DÉFAUT
   * documenté : une verticale sans `offre` sert Alpha Voice. Un test refuse
   * une verticale sans `offre` dont le critère ne parle pas du téléphone —
   * c'est ce qui empêche le défaut de mentir la prochaine fois.
   */
  const offreVerticale = offreDeLaVerticale(v) ?? "alpha-voice";
  const verticaleColle = offre !== null && offre === offreVerticale;
  const critere = pick
    ? `les ${critereDepuisCiblage(pick.magnet.targets)}`
    : // Sans aimant, on ne prétend pas viser un type de métier précis : on
      // dit le vrai, qui est déjà un critère.
      "les entreprises de votre taille, sur un sujet précis";

  return {
    critere,
    // « les » → « aux » : le critère est TOUJOURS écrit avec « les » (un test
    // garde la source des aimants), la contraction est donc mécanique.
    phraseCritere: `je m'adresse ${critere.replace(/^les\b/, "aux")}`,

    critereMetier: verticaleColle ? v?.criterion ?? null : null,

    // La question de la VERTICALE prime QUAND elle parle du même sujet : elle
    // est écrite dans son métier, et c'est ce qui fait ouvrir. Sinon celle de
    // l'offre — la même que l'agent vocal pose au téléphone, pour qu'un
    // prospect touché deux fois n'entende pas deux sujets.
    question:
      (verticaleColle ? v?.diagnostic[0] : undefined) ??
      (offre
        ? OFFRES[offre].question
        : "Aujourd'hui, comment les nouvelles demandes vous arrivent — et qu'est-ce qui se passe ensuite ?"),

    /**
     * ⚠ La phrase reste à la DEUXIÈME personne d'un bout à l'autre.
     *
     * Le texte d'origine disait « un audit de SON accueil téléphonique — ce
     * qu'ELLE capte ». En y injectant le titre réel de l'aimant, qui est écrit
     * « Audit de VOTRE accueil téléphonique », on obtenait un mélange des deux
     * (« un audit de votre accueil — ce qu'elle capte ») qui se remarque
     * immédiatement à la lecture. Vu sur le rendu réel, pas déduit.
     */
    signal: pick
      ? `Il m'arrive de préparer, pour une entreprise en particulier, un ${pick.magnet.title.toLowerCase()} — ce que vous captez, ce qui vous échappe, ce que ça représente. Je ne vous le propose pas : je vous dis juste que ça existe, au cas où ce soit utile à ${p.company} un jour.`
      : null,

    objet: pick ? pick.magnet.title.toLowerCase() : "une question",
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA FORME COURTE — WhatsApp, SMS, tout canal où l'on n'a que trois lignes.
 *
 * ⚠ POURQUOI ELLE VIT ICI ET PAS DANS L'ÉCRAN QUI S'EN SERT. L'onglet
 * « messages » d'une fiche portait SES TROIS textes en dur, écrits pour le
 * marché d'avant. Le pire disait : « j'ai préparé une maquette de {société}
 * sur mobile ». Servi à une SCCV qui construit soixante-huit logements, ça
 * annonce qu'on n'a pas regardé à qui on écrit.
 *
 * Les deux autres canaux avaient déjà leur module — `emailBody`,
 * `inviteText` — et les deux dérivent d'`approcheEcrite`. L'écran, lui,
 * n'appelait aucun des deux. C'est le défaut signature du dépôt : un
 * mécanisme juste, branché partout sauf à l'endroit qu'on regarde.
 *
 * Écrire la forme courte DANS l'écran aurait été la quatrième formulation.
 * Elle est donc ici, à côté des autres, et elle ne décide de rien : le
 * critère et la question viennent d'`approcheEcrite`, comme pour l'email et
 * pour l'invitation.
 *
 * ⚠ Aucune mention légale ajoutée : c'est un brouillon qu'on copie à la main.
 * Passé dans un envoi SMS automatisé, `verifieMentions` (lib/conformite.ts) le
 * REFUSE côté serveur — et c'est le bon endroit pour ce contrôle, pas ici.
 * ─────────────────────────────────────────────────────────────────────
 */
export function messageCourt(p: Prospect, accountId?: string, inscrit?: ExpediteurInscrit | null): string {
  const a = approcheEcrite(p, accountId, inscrit);
  const prenom = p.name.split(" ")[0]?.trim();
  const salut = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  // Zéro pitch, zéro chiffre, zéro prix : une phrase de critère et UNE
  // question. C'est la même discipline que l'invitation LinkedIn, qui est
  // plafonnée, et que l'appel à froid, qui n'a droit à aucune improvisation.
  return `${salut} je n'écris pas au hasard : ${a.phraseCritere}. Une question, celle qui m'intéresse vraiment : ${a.question}`;
}
