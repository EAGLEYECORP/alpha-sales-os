/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PROPOSITIONS — comment un orchestrateur agit sans pouvoir agir.
 *
 * ── LE PROBLÈME POSÉ ──
 *
 * On veut qu'un agent (moi, ou un autre) surveille le pipe en continu,
 * repère ce qui bloque et propose la suite. On veut AUSSI que rien ne parte
 * sans revue humaine — c'est la doctrine de la maison depuis le début, et
 * c'est la seule position tenable maintenant qu'il y a un client qui paie.
 *
 * ── POURQUOI ON NE DONNE PAS LE DROIT D'AGIR ──
 *
 * Ce ne sont pas des scrupules, ce sont trois faits :
 *
 *  1. Un agent n'a pas de CONTINUITÉ. Il ne se souvient pas de ce qu'il a
 *     envoyé hier sauf si on le lui redit. Un système qui envoie sans mémoire
 *     fiable finit par relancer deux fois la même personne.
 *  2. Un agent n'a pas de RESPONSABILITÉ. Quand un mauvais email part chez un
 *     client réel, c'est l'opérateur qui répond, pas le modèle.
 *  3. Une erreur d'agent est SILENCIEUSE et RAPIDE. Un humain qui se trompe
 *     s'arrête ; un agent qui se trompe recommence quinze fois avant qu'on
 *     s'en aperçoive.
 *
 * La proposition résout les trois : l'agent produit un ACTE ÉCRIT, daté,
 * attribué, qu'un humain approuve ou rejette. L'agent garde son utilité
 * (voir, comprendre, préparer) et perd exactement le pouvoir qu'il ne peut
 * pas assumer.
 *
 * ── CE QUE ÇA CHANGE EN PRATIQUE ──
 *
 * L'opérateur ne lit plus son pipe pour trouver quoi faire : il lit une file
 * de propositions et dit oui ou non. C'est plus rapide que de décider, et ça
 * laisse une trace de qui a proposé quoi.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Ce qu'une proposition peut demander.
 *
 * Liste FERMÉE et volontairement courte. Un type ouvert (« action: string »)
 * ferait de l'agent le concepteur de ses propres pouvoirs — exactement ce
 * qu'on refuse. Ajouter un type est une décision humaine, dans un commit.
 */
export const TYPES_PROPOSITION = [
  /** Écrire un email — texte fourni, envoi manuel. */
  "email",
  /** Appeler quelqu'un — script fourni, déclenchement manuel. */
  "appel",
  /** Faire avancer une fiche d'une étape. */
  "etape",
  /** Poser ou déplacer un rendez-vous. */
  "rendez-vous",
  /** Écrire une note dans le Cerveau. */
  "note",
  /** Signaler quelque chose sans rien demander — le mode « moniteur ». */
  "alerte",
] as const;

export type TypeProposition = (typeof TYPES_PROPOSITION)[number];

export type StatutProposition = "en-attente" | "approuvee" | "rejetee" | "expiree";

export interface Proposition {
  id: string;
  type: TypeProposition;
  /** Qui propose — nom de la clé API. Jamais « le système ». */
  auteur: string;
  createdAt: string;
  /** La fiche concernée, s'il y en a une. */
  prospectId?: string;
  /** Une ligne : ce qui est proposé. C'est ce que l'opérateur lit en premier. */
  titre: string;
  /**
   * POURQUOI. Obligatoire, et c'est le champ le plus important : une
   * proposition sans raison vérifiable ne s'approuve pas, elle se subit. On
   * exige des FAITS de la fiche, pas une opinion.
   */
  pourquoi: string;
  /** Le contenu exact (corps d'email, script d'appel, texte de note). */
  contenu?: string;
  /** Étape visée, pour le type « etape ». */
  etape?: string;
  /** Date visée, pour « rendez-vous » (ISO). */
  quand?: string;
  statut: StatutProposition;
  /** Qui a tranché, et quand. */
  decidePar?: string;
  decideLe?: string;
  /** Motif du rejet — c'est ce qui apprend à l'agent, s'il le relit. */
  motifRejet?: string;
}

export interface ErreurProposition {
  champ: string;
  message: string;
}

/**
 * Durée de vie d'une proposition non traitée, en heures.
 *
 * Une proposition vieille de trois jours n'est plus une proposition : le
 * contexte a bougé, le prospect a peut-être répondu. L'approuver ferait partir
 * un message qui ne correspond plus à rien. Elle expire donc, et il faut la
 * reproposer sur des faits à jour.
 */
export const EXPIRATION_HEURES = 48;

const propre = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

/**
 * Valide une proposition entrante.
 *
 * On refuse ce qui empêcherait un humain de décider vite et juste. Le seuil
 * sur `pourquoi` n'est pas cosmétique : une justification d'un mot force à
 * rouvrir la fiche, et une file qu'on ne peut pas trancher au vol ne sera pas
 * traitée du tout.
 */
export function validerProposition(p: Partial<Proposition>): ErreurProposition[] {
  const err: ErreurProposition[] = [];
  const titre = propre(p.titre);
  const pourquoi = propre(p.pourquoi);

  if (!p.type || !(TYPES_PROPOSITION as readonly string[]).includes(p.type)) {
    err.push({ champ: "type", message: `Type inconnu. Types acceptés : ${TYPES_PROPOSITION.join(", ")}.` });
  }
  if (titre.length < 5) err.push({ champ: "titre", message: "Dis en une ligne ce que tu proposes." });
  if (titre.length > 120) err.push({ champ: "titre", message: "Trop long : le titre se lit d'un coup d'œil." });
  if (pourquoi.length < 20) {
    err.push({
      champ: "pourquoi",
      message: "Justifie avec des FAITS de la fiche. Une proposition sans raison vérifiable ne s'approuve pas, elle se subit.",
    });
  }
  // Un email ou un appel sans contenu n'est pas approuvable : on validerait
  // une intention, et le texte réel partirait sans avoir été relu.
  if ((p.type === "email" || p.type === "appel") && propre(p.contenu).length < 30) {
    err.push({
      champ: "contenu",
      message: "Fournis le texte EXACT. Approuver une intention revient à envoyer un texte que personne n'a lu.",
    });
  }
  if (p.type === "etape" && !propre(p.etape)) {
    err.push({ champ: "etape", message: "Précise l'étape visée." });
  }
  if (p.type === "rendez-vous" && !propre(p.quand)) {
    err.push({ champ: "quand", message: "Un rendez-vous sans date n'en est pas un." });
  }
  return err;
}

/** Une proposition non traitée est-elle périmée ? */
export function estExpiree(p: Proposition, now: Date = new Date()): boolean {
  if (p.statut !== "en-attente") return false;
  const age = now.getTime() - new Date(p.createdAt).getTime();
  return age > EXPIRATION_HEURES * 3_600_000;
}

/**
 * Le statut réel, expiration comprise.
 *
 * Comme pour les essais : le statut suit la DATE, pas un champ qu'un cron
 * aurait dû mettre à jour. Un cron qui ne tourne pas ne doit pas rendre
 * approuvable une proposition périmée.
 */
export function statutReel(p: Proposition, now: Date = new Date()): StatutProposition {
  return estExpiree(p, now) ? "expiree" : p.statut;
}

/** Les propositions réellement à trancher, les plus récentes d'abord. */
export function aTrancher(toutes: Proposition[], now: Date = new Date()): Proposition[] {
  return toutes
    .filter((p) => statutReel(p, now) === "en-attente")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Peut-on approuver cette proposition ?
 *
 * Séparé de l'action pour être testable seul — et parce que l'interface doit
 * pouvoir DÉSACTIVER le bouton avec la raison, plutôt que d'échouer au clic.
 */
export function peutApprouver(p: Proposition, now: Date = new Date()): { ok: boolean; raison?: string } {
  const s = statutReel(p, now);
  if (s === "expiree") {
    return { ok: false, raison: `Périmée (plus de ${EXPIRATION_HEURES} h). Le contexte a bougé — à reproposer sur des faits à jour.` };
  }
  if (s !== "en-attente") return { ok: false, raison: `Déjà ${s}.` };
  // Une alerte ne se « fait » pas : elle s'accuse réception. On l'autorise,
  // mais l'appelant doit savoir qu'il n'y a aucune action derrière.
  return { ok: true };
}

/**
 * Le résumé de la file, pour l'écran d'accueil.
 * On compte ce qui EXIGE une décision, pas ce qui existe.
 */
export function resumeFile(toutes: Proposition[], now: Date = new Date()) {
  const enAttente = aTrancher(toutes, now);
  return {
    enAttente: enAttente.length,
    // Les alertes ne bloquent rien : les compter avec le reste ferait
    // paraître la file plus lourde qu'elle n'est.
    aDecider: enAttente.filter((p) => p.type !== "alerte").length,
    alertes: enAttente.filter((p) => p.type === "alerte").length,
    expirees: toutes.filter((p) => statutReel(p, now) === "expiree").length,
  };
}
