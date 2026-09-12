/**
 * ─────────────────────────────────────────────────────────────────────
 * LES MODES DU TÉLÉPHONE — cinq entrées à la fois, mais lesquelles ?
 *
 * ⚠⚠ CE QUE LA BARRE DU BAS COÛTAIT, ET ÇA NE RESSEMBLAIT PAS À UN DÉFAUT.
 *
 * Elle portait cinq entrées FIGÉES — aujourd'hui, à décider, closer, moniteur,
 * débrief — choisies pour un usage précis : le commercial en tournée qui
 * consulte. Le commentaire du rail le dit lui-même, « on règle depuis un
 * ordinateur, on regarde depuis un téléphone ».
 *
 * Cette phrase était vraie quand elle a été écrite, et elle a cessé de l'être.
 * Le produit fait aujourd'hui tourner l'autopilote sur le SERVEUR : il n'y a
 * plus de machine à laisser allumée, et le téléphone n'est plus un écran de
 * consultation — c'est le poste de travail. Or depuis la barre, on ne pouvait
 * atteindre NI le pipeline, NI les campagnes, NI Alpha CEO. Trois des écrans
 * les plus utilisés du produit demandaient d'ouvrir la palette et de taper.
 *
 * ── POURQUOI DES MODES, ET PAS UNE BARRE PLUS LONGUE ──
 *
 * Une barre de pouce tient cinq entrées. À six, on vise mal et on ouvre le
 * mauvais écran — c'est déjà écrit dans le rail, et c'est toujours vrai. On ne
 * rallonge donc pas : on change ce que les cinq DÉSIGNENT.
 *
 * Un mode = un moment du métier. On ne passe pas sa journée à faire les cinq :
 * on prospecte le matin, on relance l'après-midi, on débriefe le soir. Le mode
 * courant est mémorisé par navigateur, comme le repli du rail.
 *
 * ⚠ LES MODES NE CRÉENT AUCUN ÉCRAN ET N'EN CACHENT AUCUN. Ils réordonnent
 * l'accès. Tout reste atteignable par la palette, et un test l'exige — sinon
 * on aurait inventé une deuxième navigation, qui divergerait de la première.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ModeMobile {
  id: string;
  /** Ce qu'on lit sur le bouton. Court : il tient dans une pastille. */
  label: string;
  /** Ce que ce mode sert — affiché sous le label dans le sélecteur. */
  quoi: string;
  /**
   * Les chemins de la barre du bas, dans l'ordre d'affichage.
   * ⚠ CINQ MAXIMUM, et un test le tient. La contrainte est physique, pas
   * esthétique : au-delà, la cible de doigt passe sous le seuil où on vise
   * juste, et on ouvre l'écran d'à côté.
   */
  routes: string[];
  /**
   * La brique qui ouvre ce mode. Absente = socle, ouvert à tout le monde.
   *
   * ⚠ On ne recopie pas la règle d'accès : `briquesPourChemin` reste la seule
   * source. Ce champ dit à quel TITRE le mode existe ; c'est `etatChemin` qui
   * décide s'il est ouvert, grisé ou masqué, écran par écran.
   */
  brique?: string;
  /**
   * Réservé au compte MAÎTRE, et MASQUÉ — pas grisé.
   *
   * ⚠ C'est la doctrine du rail, reprise mot pour mot : « on grise ce qui est
   * à vendre, on masque ce qui est à nous ». Alpha CEO parle de NOTRE
   * exploitation. Le griser reviendrait à annoncer à un client qu'il existe
   * une console qu'il ne pourra jamais acheter.
   */
  maitreSeul?: boolean;
}

/**
 * ⚠ CINQ ENTRÉES, PAS SIX. Le chiffre vient du rail, où il est déjà motivé.
 * Le répéter ici plutôt que l'importer est assumé : ce sont deux barres
 * différentes qui partagent une contrainte de doigt, pas une règle métier.
 */
export const MAX_ENTREES_BARRE = 5;

export const MODES: ModeMobile[] = [
  {
    id: "terrain",
    label: "Terrain",
    quoi: "La tournée du jour : qui appeler, quoi décider, quoi débriefer.",
    /**
     * ⚠ C'EST L'ANCIENNE BARRE, À L'IDENTIQUE, ET C'EST VOULU. Elle devient le
     * mode par DÉFAUT : quelqu'un qui ne touche jamais au sélecteur retrouve
     * exactement ce qu'il avait. Une nouveauté qui déplace ce que les gens
     * savent déjà faire se paie en désorientation, pas en adoption.
     */
    routes: ["/aujourdhui", "/decisions", "/closer", "/moniteur", "/debrief"],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    quoi: "L'état des affaires : où en est chacune, laquelle relancer.",
    routes: ["/pipeline", "/aujourdhui", "/nurture", "/meetings", "/controle"],
  },
  {
    id: "campagnes",
    label: "Campagnes",
    quoi: "Ce qui part : séquences, boîte d'envoi, LinkedIn, relances.",
    /**
     * ⚠ Mode PAYANT. Il apparaît quand même, GRISÉ, chez un compte gratuit —
     * et chaque entrée mène à son explication. Voir la porte fermée vaut mieux
     * que ne pas savoir qu'elle existe ; c'est déjà la règle de `/controle`.
     */
    brique: "campagnes",
    routes: ["/campaigns", "/outbox", "/linkedin", "/templates", "/nurture"],
  },
  {
    id: "closer",
    label: "Closer",
    quoi: "Avant et après le rendez-vous : préparer, débriefer, conclure.",
    routes: ["/closer", "/meetings", "/debrief", "/decisions", "/preuves"],
  },
  {
    id: "machine",
    label: "Alpha CEO",
    quoi: "Est-ce que ça tourne vraiment ? Diagnostic, moniteur, recette.",
    /**
     * ⚠ Le mode porte le nom de l'écran que le propriétaire cherche. Il
     * s'appelle `machine` en interne parce qu'il contient aussi le moniteur et
     * la recette — mais personne ne tape « machine » : on tape « CEO ».
     */
    maitreSeul: true,
    routes: ["/ceo", "/moniteur", "/pilote", "/recette", "/kpis"],
  },
];

export const MODE_DEFAUT = "terrain";

/** La clé de persistance, par navigateur — comme le repli du rail. */
export const CLE_MODE = "alpha_mode_mobile";

/**
 * Les modes qu'un compte a le droit de VOIR.
 *
 * ⚠ `maitreSeul` MASQUE ; `brique` ne masque pas, il grise. Les deux
 * traitements sont distincts et c'est le sujet de toute cette fonction : on
 * retire de la liste ce qui n'est pas à vendre, on garde ce qui l'est.
 */
export function modesVisibles(maitre: boolean): ModeMobile[] {
  return MODES.filter((m) => !m.maitreSeul || maitre);
}

/**
 * Le mode à appliquer, à partir de ce qui est mémorisé.
 *
 * ⚠ UN MODE MÉMORISÉ QUI N'EST PLUS VISIBLE NE DOIT PAS RENDRE UN ÉCRAN VIDE.
 * Le cas arrive vraiment : le propriétaire choisit « Alpha CEO » sur son
 * téléphone, puis ouvre l'app avec un compte client sur le même navigateur.
 * Sans ce repli, la barre du bas n'aurait plus aucune entrée — et une barre
 * vide ne ressemble pas à un droit manquant, elle ressemble à une panne.
 */
export function modeActif(memorise: string | null, maitre: boolean): ModeMobile {
  const visibles = modesVisibles(maitre);
  return (
    visibles.find((m) => m.id === memorise) ??
    visibles.find((m) => m.id === MODE_DEFAUT) ??
    visibles[0]
  );
}
