/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'ON PROMET — écrit UNE fois, vérifiable ligne par ligne.
 *
 * ══ POURQUOI CE MODULE, ET CE QU'IL REMPLACE ══
 *
 * Le positionnement vivait à quatre endroits : le README, la section mission
 * de la vitrine, et trois commentaires. Aucun ne faisait autorité. C'est
 * exactement comme ça qu'une doctrine dérive — et quand elle dérive, c'est la
 * version qu'on ne relit pas qui part chez un prospect.
 *
 * ══ ⚠⚠ CE QU'ON NE DIT PAS, ET POURQUOI ══
 *
 * La tentation était de se positionner comme « le <grand acteur> de la vente ».
 * Trois raisons de refuser, et aucune n'est une question de goût :
 *
 *  1. **Ça contredit notre seul argument vérifiable.** La vitrine défend que
 *     l'automatisation commerciale des PME françaises ne devrait pas dépendre
 *     d'acteurs américains — et `tests/vitrine-fuite` EXIGE que cet angle
 *     reste. Emprunter le nom d'un de ces acteurs comme positionnement se
 *     contredit dans la même page.
 *  2. **Ça invite la question qu'on perd.** « Quel modèle entraînez-vous ? »
 *     Aucun. On loue l'intelligence comme tout le monde. C'est légitime, et
 *     c'est la comparaison à ne pas provoquer.
 *  3. **« Le X de Y » signale DÉRIVÉ.** Avec zéro vente, ça rejoint la famille
 *     des affirmations invérifiables que ce dépôt refuse partout — au même
 *     titre que « les meilleurs du marché » ou une affiliation inventée.
 *
 * ══ CE QUI TIENT DEBOUT À LA PLACE ══
 *
 * Le modèle, tout le monde peut le louer — donc il n'est le moat de personne.
 * Ce que personne ne construit, parce que c'est ennuyeux et juridictionnel,
 * c'est la couche qui rend l'IA DÉPLOYABLE ici. Chaque preuve ci-dessous nomme
 * le module qui l'applique, et un test vérifie que ce module EXISTE : une
 * promesse dont on peut ouvrir le fichier n'est plus un argument de vente,
 * c'est un fait.
 * ─────────────────────────────────────────────────────────────────────
 */

/** La phrase longue — celle qui explique POURQUOI un meilleur modèle ne nous remplace pas. */
export const PROMESSE =
  "On ne fabrique pas l'intelligence. On fabrique ce qui permet de s'en servir pour vendre — en France, sans se mettre hors la loi.";

/** La phrase courte — celle qui tient sur une slide et qu'on retient. */
export const PROMESSE_COURTE = "Les humains closent. Alpha fait tourner la machine.";

/** Une garantie qu'on annonce, et le code qui l'applique. */
export interface Preuve {
  /** Ce qu'on affirme, en une phrase que le client comprend. */
  affirmation: string;
  /**
   * Le fichier qui l'APPLIQUE — chemin réel depuis la racine.
   *
   * ⚠ C'est ce champ qui transforme un argument en fait. Un test ouvre chaque
   * chemin : une preuve dont le module a disparu fait tomber le build, au lieu
   * de continuer à se dire sur une page publique.
   */
  module: string;
}

/**
 * Les garanties, dans l'ordre où elles rassurent.
 *
 * ⚠ AUCUNE N'EST UNE PERFORMANCE. Pas de taux, pas de gain, pas de « X fois
 * plus vite » : zéro vente, donc aucune mesure à citer. Ce sont des règles que
 * le logiciel APPLIQUE, et c'est vérifiable aujourd'hui — contrairement à un
 * résultat, qui demande un client.
 */
export const PREUVES: Preuve[] = [
  {
    affirmation:
      "Quand c'est l'IA qui mène l'échange, elle le dit. Quand un humain a relu et envoyé, on ne l'écrit pas — ce serait faux.",
    module: "lib/signature-ia.ts",
  },
  {
    affirmation:
      "La divulgation IA de l'appel est prononcée par le code dès la première phrase, et aucun chemin ne produit un script sans elle.",
    module: "lib/voice-script.ts",
  },
  {
    affirmation:
      "Le plafond légal de sollicitations est exécutable : la cadence s'arrête d'elle-même, elle ne compte pas sur la mémoire de celui qui appelle.",
    module: "lib/call-cadence.ts",
  },
  {
    affirmation:
      "Dans les secteurs où la prospection est interdite, le script est refusé — et le refus nomme le texte de loi et ce qui reste possible.",
    module: "lib/secteurs-interdits.ts",
  },
  {
    affirmation:
      "Les envois montent par paliers pour ne pas griller le domaine, et aucun forçage ne passe outre.",
    module: "lib/email-ramp.ts",
  },
  {
    affirmation:
      "En marque blanche, la raison sociale, l'adresse et la signature suivent le compte. Aucun repli ne remet la nôtre.",
    module: "lib/signature.ts",
  },
  {
    affirmation:
      "Pas de devis sans cadrage. Un ordre de grandeur, oui — un engagement chiffré, seulement après vous avoir écouté.",
    module: "lib/cadrage.ts",
  },
  {
    affirmation:
      "Zéro chiffre inventé : sans donnée, l'écran affiche un tiret et dit pourquoi, jamais un zéro qui ressemble à un résultat.",
    module: "lib/calibration.ts",
  },
];

/**
 * Ce que le partage du travail dit, et qui n'a pas bougé depuis le début.
 *
 * ⚠ La troisième ligne est celle qui fait vendre, et c'est la seule qui
 * s'énonce comme une LIMITE. Une page qui ne dit que ce qu'elle fait se lit
 * comme une brochure ; une frontière dite avant le prix ne se renégocie pas au
 * premier jalon.
 */
export const PARTAGE: { quoi: string; qui: "alpha" | "client" }[] = [
  { quoi: "Prospection, qualification, relances, scripts, suivi, pipeline, mesure", qui: "alpha" },
  { quoi: "La livraison de la prestation vendue", qui: "client" },
  { quoi: "La réassurance humaine — la présence, la voix, la poignée de main", qui: "client" },
];
