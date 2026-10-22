/**
 * ─────────────────────────────────────────────────────────────────────
 * LES AGENTS D'ALPHA — l'ombrelle de marque (décidé par Zakaria le 20/10/2026).
 *
 * Un NOM par agent, TOUJOURS EN CAPITALES, et une seule définition : la
 * vitrine l'importe, les posts et les vidéos la recopient à la lettre
 * (`.claude/skills/alpha-motion/SKILL.md`). Un nom écrit à la main ailleurs
 * finit en « Alpha Voice » dans un post et « ALPHA VOICE » dans le suivant.
 *
 * ⚠⚠ L'OMBRELLE NE RENOMME AUCUN ÉCRAN. C'est la décision, et elle est
 * explicite : « renomme pas dans l'app, mais mets-les sous l'ombrelle ». Les
 * écrans gardent leurs libellés (« Le Cerveau », « Campagnes ») ; chaque agent
 * DÉSIGNE des briques et des écrans qui existent déjà, et un test refuse un
 * écran ou une brique inconnus.
 *
 * ⚠ CHAQUE AGENT DIT CE QU'IL N'A PAS LE DROIT DE FAIRE, et nomme le fichier
 * qui l'en empêche. C'est la moitié qui rend l'autre crédible — la règle du
 * post du 20/10 : « plus un agent réfléchit, moins il a le droit d'agir ».
 * Une interdiction sans fichier serait un argument de vente ; avec, c'est une
 * garantie qu'on peut lire. Un test ouvre chaque fichier.
 *
 * ⚠ AUCUN IMPORT, et c'est voulu : la vitrine est un composant client, et
 * tout ce qu'elle importe part dans le navigateur. La DISPONIBILITÉ est donc
 * déclarée ici, et `tests/agents-alpha.test.ts` la confronte aux vraies règles
 * d'accès (`peutOuvrir`, `cheminOuvertParCle`) — même schéma que les prix
 * publics recopiés et vérifiés.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les deux camps de la règle, la mémoire commune, et le pilote. */
export type CampAgent = "agit" | "reflechit" | "memoire" | "pilote";

/**
 * Où l'agent s'utilise :
 *  · `en-ligne` — ouvert au compte gratuit ;
 *  · `en-ligne-avec-vos-cles` — en ligne, avec SA clé (IA ou email) ;
 *  · `chez-vous` — dans l'installation sur son serveur seulement.
 */
export type DisponibiliteAgent = "en-ligne" | "en-ligne-avec-vos-cles" | "chez-vous";

/**
 * Par où l'agent ENTRE :
 *  · `ecran` (défaut) — on l'ouvre en cliquant ; la disponibilité se déduit des
 *    écrans, que le contrôle d'accès sait classer ;
 *  · `cle-de-l-hote` — il ne s'ouvre pas, on le BRANCHE : une clé d'API ou un
 *    jeton OAuth, posés par celui qui héberge. L'écran où l'on relit son travail
 *    est ouvert à tous, mais ce n'est pas lui la porte — le déduire de l'écran
 *    annoncerait « en ligne, gratuit » pour un agent qu'un inscrit ne peut pas
 *    brancher (les clés vivent dans l'environnement du serveur, le jeton OAuth
 *    n'est donné qu'au compte maître).
 */
export type EntreeAgent = "ecran" | "cle-de-l-hote";

export interface AgentAlpha {
  /** Le nom de marque. TOUJOURS EN CAPITALES — un test l'exige. */
  nom: string;
  camp: CampAgent;
  /** Les écrans où il vit — des chemins qui EXISTENT, jamais renommés. */
  ecrans: string[];
  /** Absent = `ecran`. Voir `EntreeAgent`. */
  entree?: EntreeAgent;
  /** Ce qu'il fait. Vrai dans le code, dit sans promesse de résultat. */
  fait: string;
  /** Ce qu'il n'a pas le droit de faire. */
  interdit: string;
  /** Le fichier qui applique `interdit`. */
  preuve: string;
  disponibilite: DisponibiliteAgent;
}

/** La règle qui organise les camps — la phrase d'accroche du 20/10/2026. */
export const REGLE_DES_AGENTS = "Plus un agent réfléchit, moins il a le droit d'agir.";

export const LIBELLE_CAMP: Record<CampAgent, string> = {
  agit: "Agit, sans improviser",
  reflechit: "Réfléchit, n'envoie rien",
  memoire: "La mémoire de tous",
  pilote: "Le pilote",
};

export const LIBELLE_DISPONIBILITE: Record<DisponibiliteAgent, string> = {
  "en-ligne": "En ligne, gratuit",
  "en-ligne-avec-vos-cles": "En ligne, avec vos clés",
  "chez-vous": "Chez vous",
};

export const AGENTS_ALPHA: readonly AgentAlpha[] = [
  {
    nom: "ALPHA SCOUT",
    camp: "reflechit",
    ecrans: ["/linkedin", "/audits", "/appels"],
    fait:
      "Trie ce que vous lui donnez et lit les annonces légales de chaque entreprise par son SIREN : il écarte qui est en liquidation, radiée ou dissoute, et remonte celle qui vient de changer de dirigeant, d'adresse ou de propriétaire.",
    interdit:
      "Collecter lui-même, ou rattacher une annonce par le nom. La collecte reste dehors ; une annonce ne s'attache qu'au SIREN exact, et le changement qu'elle révèle ne se cite pas au prospect.",
    preuve: "lib/signaux-publics.ts",
    disponibilite: "en-ligne",
  },
  {
    nom: "ALPHA VOICE",
    camp: "agit",
    ecrans: ["/voice"],
    fait:
      "Appelle, qualifie et vous passe la main dès qu'un prospect se montre intéressé — un non se traite sans mobiliser personne.",
    interdit:
      "Taire qu'il est une IA, improviser, appeler hors des fenêtres horaires ou au-delà du plafond légal. Sa première phrase est dite par le code.",
    preuve: "lib/voice-script.ts",
    disponibilite: "chez-vous",
  },
  {
    nom: "ALPHA CAMPAGNES",
    camp: "agit",
    ecrans: ["/campaigns", "/outbox"],
    fait: "Envoie les premiers messages à froid, au rythme d'un palier quotidien qui ne monte qu'avec les semaines.",
    interdit: "Écrire à la volée. Le texte est fixe, porte la mention IA, et ne part pas sans moyen de refus.",
    preuve: "lib/mail-autopilote.ts",
    // Vérifié par le contrôle d'accès, pas supposé : la clé email du client l'ouvre en ligne.
    disponibilite: "en-ligne-avec-vos-cles",
  },
  {
    nom: "AGENT ALPHA",
    camp: "reflechit",
    ecrans: ["/agent"],
    fait: "Lit tout le pipe, prépare votre journée, analyse une affaire et écrit le message.",
    interdit: "Envoyer quoi que ce soit lui-même : il prépare, vous relisez, vous envoyez.",
    preuve: "lib/os-map.ts",
    disponibilite: "en-ligne-avec-vos-cles",
  },
  {
    nom: "ALPHA LIVE",
    camp: "reflechit",
    ecrans: ["/overlay"],
    fait: "Pendant le rendez-vous, reconnaît l'objection et vous souffle la réponse à l'écran.",
    interdit: "Parler à votre interlocuteur : rien ne s'affiche de son côté, c'est vous qui parlez.",
    preuve: "components/live/alpha-live.tsx",
    disponibilite: "en-ligne",
  },
  {
    nom: "ALPHA ASSIST",
    camp: "reflechit",
    // L'écran où l'on relit ce qu'il propose — pas sa porte (voir `EntreeAgent`).
    ecrans: ["/controle"],
    entree: "cle-de-l-hote",
    fait:
      "Votre propre IA, branchée à ALPHA par un serveur MCP ou une clé d'API : elle lit l'état du pipe et dépose ses propositions dans la file que vous relisez.",
    interdit:
      "Agir. Elle ne peut que déposer une proposition, d'un type choisi dans une liste fermée — rien ne part avant qu'un humain l'approuve dans l'app.",
    preuve: "lib/propositions.ts",
    disponibilite: "chez-vous",
  },
  {
    nom: "ALPHA CERVEAU",
    camp: "memoire",
    ecrans: ["/cerveau"],
    fait: "La mémoire que tous les agents lisent : vos documents, vos objections, ce que vos débriefs ont appris.",
    interdit: "Mettre une phrase de livre au rang d'un fait mesuré : chaque source externe porte son niveau de preuve.",
    preuve: "lib/references.ts",
    disponibilite: "en-ligne",
  },
  {
    nom: "ALPHA CEO",
    camp: "pilote",
    ecrans: ["/ceo"],
    fait:
      "Sépare ce qui peut s'automatiser de ce qui doit rester une décision humaine, et cherche ce qui est en panne sans le dire.",
    interdit: "Prendre une décision humaine à votre place : il la prépare et s'arrête avant.",
    preuve: "lib/alpha-ceo.ts",
    disponibilite: "chez-vous",
  },
];
