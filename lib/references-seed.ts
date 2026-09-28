import type { Reference } from "./references";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES RÉFÉRENCES LIVRÉES AVEC L'OS.
 *
 * ⚠ Server-only, comme `knowledge-seed.ts` : servi par `/api/references`,
 * jamais importé depuis un composant client. Ce n'est pas un secret, mais le
 * catalogue pèse et n'a aucune raison d'être téléchargé par une page publique.
 *
 * ── LE TRAVAIL RÉEL EST LE TRIAGE, PAS LA COPIE ──
 *
 * Recopier 35 leçons de vente prend dix minutes et ne vaut rien. Ce qui vaut,
 * c'est de dire lesquelles CONTREDISENT ce qu'on fait, et lesquelles sont
 * inapplicables tant qu'on n'a pas de client. C'est là qu'une référence évite
 * une erreur au lieu d'en fabriquer une nouvelle.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Cashvertising (Drew Eric Whitman), lu via une synthèse vidéo en 35 leçons.
 *
 * Un des meilleurs livres de copywriting direct, et un danger précis pour
 * cette maison : il a été écrit pour des annonceurs qui ONT des clients, des
 * témoignages et des chiffres. Nous en avons zéro. Appliquées telles quelles,
 * une partie de ses leçons produirait des preuves inventées — exactement ce
 * que la doctrine et les tests de la vitrine refusent.
 */
export const CASHVERTISING: Reference = {
  id: "cashvertising",
  titre: "Cashvertising",
  auteur: "Drew Eric Whitman",
  type: "transcription",
  annee: 2008,
  fiabilite: "praticien",
  pourquoi:
    "Le manuel de référence du copywriting direct : ce qui fait qu'une phrase déclenche un achat. On le garde pour la MÉCANIQUE (image mentale, spécificité, bénéfice), pas pour ses chiffres — plusieurs sont du folklore recopié (« il faut sept expositions », « les capitales ralentissent la lecture de 11,8 % ») et les études citées ont trente à soixante ans. Et surtout : une partie de ses leçons suppose qu'on a déjà des clients. Nous n'en avons aucun.",
  lecons: [
    // ── CE QUI MARCHE ICI, TOUT DE SUITE ────────────────────────────
    {
      id: "l01-film-mental",
      titre: "Diriger le film mental",
      quoi: "Une phrase générique ne produit aucune image. Une phrase qui engage les cinq sens en produit une nette, et c'est l'image qui déclenche l'envie. « Va chercher à manger » ne montre rien ; « sors la pizza brûlante, coupe une part » se voit.",
      statut: "applicable",
      tags: ["copywriting", "email", "script"],
    },
    {
      id: "l02-benefice-titre",
      titre: "Le plus gros bénéfice dans le titre",
      quoi: "60 % des gens ne lisent que l'accroche. Le bénéfice principal doit donc y être, et l'accroche doit aussi SÉLECTIONNER l'audience : « besoin de lampes ? » bat « on illumine votre vie » parce qu'on sait pour qui c'est.",
      statut: "applicable",
      tags: ["accroche", "objet-email", "vitrine"],
    },
    {
      id: "l06-resultat-final",
      titre: "Vendre le résultat final, pas l'objet",
      quoi: "Personne ne veut un four à micro-ondes : on veut manger vite et faire autre chose du temps gagné. Chaque caractéristique se pousse jusqu'à sa conséquence dans la vie du client, en redemandant « et alors, qu'est-ce que ça me fait ? » jusqu'à toucher le fond.",
      statut: "applicable",
      tags: ["benefice", "argumentaire"],
    },
    {
      id: "l08-specificite",
      titre: "La spécificité extrême écrase le concurrent",
      quoi: "« On utilise de bons ingrédients » ne dit rien. « Mozzarella au lait de bufflonne jamais râpée parce que le râpé rend trop d'eau, tomates San Marzano écrasées le matin » emporte la décision. Le détail vérifiable EST l'argument.",
      statut: "applicable",
      tags: ["copywriting", "differenciation"],
    },
    {
      id: "l10-life-force-8",
      titre: "Les huit désirs biologiques (Life Force 8)",
      quoi: "Survie, nourriture, absence de peur et de douleur, sexualité, confort, supériorité sociale, protection des proches, approbation sociale. Une offre qui ne se raccroche à aucun des huit se vend contre le vent. La nôtre touche « absence de peur » (le client perdu qu'on ne voit jamais) et « supériorité » (être celui qui répond en premier).",
      statut: "applicable",
      tags: ["psychologie", "angle"],
    },
    {
      id: "l12-usp",
      titre: "La proposition unique",
      quoi: "Quand le prospect ne peut pas te distinguer d'un concurrent, il n'a aucune raison de te préférer. Il faut donc DIRE ce qui te rend différent au lieu d'espérer qu'il le découvre — 99 % des entreprises le laissent deviner.",
      statut: "applicable",
      tags: ["positionnement"],
    },
    {
      id: "l19-visage",
      titre: "Montrer un visage",
      quoi: "Un visage qui regarde le lecteur est le meilleur capteur d'attention, et il transforme une entreprise anonyme en personne. C'est aussi le raccourci le plus court vers l'autorité : une vraie photo, prise correctement, sur tous les supports.",
      statut: "applicable",
      tags: ["visuel", "autorite", "vitrine"],
    },
    {
      id: "l20-adjectifs-visuels",
      titre: "Les adjectifs qui font voir",
      quoi: "« Gagne beaucoup d'argent » ne montre rien ; « encaisse 2 750 € par semaine » montre. Plus le mot est précis, plus l'image est nette et plus elle occupe de place dans la tête du lecteur.",
      statut: "applicable",
      tags: ["copywriting"],
    },
    {
      id: "l21-clair-pas-malin",
      titre: "Clair, pas malin",
      quoi: "Une accroche astucieuse qui ne dit pas ce qu'on vend perd les 60 % de lecteurs qui ne lisent que l'accroche. « Pages web pro livrées en 24 h pour 199 € » bat n'importe quel jeu de mots.",
      statut: "applicable",
      tags: ["copywriting", "ton"],
    },
    {
      id: "l22-sondage",
      titre: "Demander, au lieu de deviner",
      quoi: "Le meilleur moyen de savoir ce que veulent les clients est de leur demander. La question qui ouvre le plus : « si c'était votre entreprise, qu'est-ce que vous feriez autrement ? » Puis construire l'argumentaire sur les réponses, pas sur des suppositions.",
      statut: "applicable",
      tags: ["recherche", "icp"],
    },
    {
      id: "l25-simplicite",
      titre: "Si on ne te comprend pas, on ne t'achète pas",
      quoi: "Mots courts, une idée par phrase, et le pronom « vous » partout. Ça transforme une communication de masse en conversation. Simple n'est pas facile : ça se travaille.",
      statut: "applicable",
      tags: ["ton", "copywriting"],
    },
    {
      id: "l26-questions",
      titre: "La question ouvre une boucle",
      quoi: "Une question crée dans la tête du lecteur une boucle qu'il cherche à refermer, ce qui le maintient attentif. C'est le même mécanisme que la doctrine d'appel maison : poser, puis se taire.",
      statut: "applicable",
      tags: ["script", "appel"],
    },
    {
      id: "l30-exemples",
      titre: "Un exemple bat une statistique",
      quoi: "L'émotion décide de l'achat, et un exemple demande moins d'effort mental qu'un pourcentage : il s'accroche à l'expérience du lecteur. Les chiffres viennent en appui, jamais en tête.",
      statut: "applicable",
      tags: ["argumentaire", "deck"],
    },
    {
      id: "l04-tester-offres",
      titre: "Tester l'offre, pas seulement le message",
      quoi: "Une annonce sans réponse ne prouve pas que personne ne veut du produit : elle prouve que CE message, à CE prix, avec CETTE offre, ne prend pas. On change l'accroche, puis le prix, puis l'offre. Le marché ne se convainc pas, il se sonde.",
      statut: "applicable",
      tags: ["offre", "test"],
    },
    {
      id: "l33-blanc",
      titre: "L'espace vide autour du message",
      quoi: "Un message entouré de blanc se remarque davantage — environ 20 % de la surface est le bon dosage ; au-delà de 60 %, le coût de l'espace ne se rentabilise plus.",
      statut: "applicable",
      tags: ["design"],
    },
    {
      id: "l34-designer",
      titre: "Savoir se faire aider sur le visuel",
      quoi: "Savoir ouvrir Canva ne fait pas de toi un designer, et beaucoup de ventes se perdent uniquement sur la représentation graphique — surtout auprès de gens qui ne te connaissent pas.",
      statut: "applicable",
      tags: ["design"],
    },
    {
      id: "l35-accroches",
      titre: "Les amorces d'accroche éprouvées",
      quoi: "Il existe une vingtaine de structures d'accroche qui fonctionnent sur presque tout produit. Les réutiliser en remplaçant les mots est le chemin le plus court vers un titre correct.",
      statut: "applicable",
      tags: ["accroche"],
    },
    {
      id: "l18-images",
      titre: "Montrer le produit EN USAGE",
      quoi: "Une annonce illustrée est nettement mieux mémorisée qu'une annonce sans image, et montrer le produit en train de servir bat largement le produit posé seul. Le lecteur a besoin de la démonstration, pas du catalogue.",
      statut: "applicable",
      tags: ["visuel", "vitrine"],
    },
    {
      id: "l31-typographie",
      titre: "La typographie parle avant les mots",
      quoi: "Une police communique quelque chose qu'on l'ait voulu ou non, et les capitales sur toute une accroche ralentissent la lecture parce que le cerveau reconnaît les mots à leur forme.",
      statut: "applicable",
      tags: ["design", "vitrine"],
    },
    {
      id: "l07-couleur",
      titre: "La couleur change la perception",
      quoi: "La couleur d'un emballage modifie le poids, la qualité et même le goût perçus — le cas cité : un soda passé du rouge au vert, dont les ventes montent parce qu'il cessait de ressembler à un cola.",
      statut: "applicable",
      tags: ["design"],
    },

    // ── UTILISABLE, MAIS SOUS CONDITION ─────────────────────────────
    {
      id: "l03-prix-psychologie",
      titre: "Prix ronds = qualité, prix en 9 = affaire",
      quoi: "Un prix terminé en 99 se lit comme une remise ; un prix rond signale la qualité et c'est celui des marques haut de gamme. Une robe à 50 € est jugée meilleure que la même à 49,99 €.",
      statut: "sous-condition",
      reserve:
        "À rapprocher d'une incohérence RÉELLE chez nous : la doctrine vend 10 000 € (prix rond, signal qualité) pendant que le site affiche 79/149 €/mois (prix en 9, signal affaire). Ce ne sont pas deux tarifs, ce sont deux positionnements opposés. Cette leçon ne s'applique qu'une fois le modèle tranché.",
      tags: ["prix", "positionnement"],
    },
    {
      id: "l23-comparer",
      titre: "Comparer avec le concurrent",
      quoi: "Faire lire les arguments du concurrent à travers ton filtre : dire ce qu'il annonce, puis ce qu'il ne dit pas, puis ce que tu fais de mieux. L'auteur précise lui-même que l'attaque doit rester douce.",
      statut: "sous-condition",
      reserve:
        "⚠ Le droit français est bien plus strict que l'américain : la publicité comparative est encadrée (elle doit porter sur des caractéristiques objectives, vérifiables et représentatives) et le dénigrement d'un concurrent nommé est sanctionnable. À utiliser sur des faits vérifiables, jamais sur un jugement, et sans nommer un concurrent local.",
      tags: ["juridique", "argumentaire"],
    },
    {
      id: "l27-copie-longue",
      titre: "La copie longue vend plus",
      quoi: "Une page longue sert les deux profils : celui qui a besoin de tout lire trouve ses réponses, celui qui décide vite s'arrête quand il veut. Une page courte ne sert que le second.",
      statut: "sous-condition",
      reserve:
        "Vrai sur une PAGE DE VENTE, faux sur un email à froid : là, la longueur se lit comme un envoi en masse et coûte la réponse. La doctrine maison — une seule capacité à la bascule — reste prioritaire sur le premier contact.",
      tags: ["copywriting", "email"],
    },
    {
      id: "l28-garantie",
      titre: "La garantie satisfait ou remboursé",
      quoi: "La garantie fait pencher la balance entre le scepticisme et l'envie de croire. Les garanties longues (un an et plus) rassurent sans créer l'urgence de renvoyer que provoque un délai de 30 jours.",
      statut: "sous-condition",
      reserve:
        "Une garantie d'un an sur une prestation à 10 000 € est un risque de trésorerie réel, d'autant que la LIVRAISON est faite par le client (doctrine maison) : on ne peut pas garantir un résultat qu'on ne produit pas. À cadrer sur ce qu'on maîtrise — le système, pas les ventes du client.",
      tags: ["offre", "risque"],
    },
    {
      id: "l32-fond-blanc",
      titre: "Fond clair, texte foncé",
      quoi: "Un texte foncé sur fond clair se lit de plus loin qu'un texte clair sur fond foncé, mesuré sur papier.",
      statut: "sous-condition",
      reserve:
        "L'étude porte sur du papier imprimé. Sur écran, le contraste se règle autrement et l'app comme le site sont conçus en sombre par choix d'identité. À traiter comme un rappel de contraste, pas comme un ordre de repeindre.",
      tags: ["design"],
    },
    {
      id: "l29-faciliter-achat",
      titre: "Rendre l'achat facile",
      quoi: "Demander explicitement l'action, puis lever tous les frottements : moyens de paiement multiples, paiement échelonné, coordonnées visibles, étapes énoncées.",
      statut: "sous-condition",
      reserve:
        "La doctrine maison impose un CADRAGE OBLIGATOIRE avant tout devis : on ne VEUT pas d'achat en un clic sur l'offre principale. Cette leçon s'applique au parcours vers le rendez-vous (le rendre trivial), pas au parcours vers le paiement.",
      tags: ["conversion", "doctrine"],
    },

    // ── CE QUI CONTREDIT LA DOCTRINE ────────────────────────────────
    {
      id: "l11-peur",
      titre: "Vendre par la peur",
      quoi: "L'auteur recommande de planter une peur précise et imagée (les acariens dans l'oreiller), puis de présenter le produit comme la solution. La peur crée du stress et le stress pousse à agir.",
      statut: "conflit-doctrine",
      reserve:
        "CONTREDIT le playbook terrain : « Interdits à froid : les € perdus, la note Google » et « l'observation se pose en QUESTION, jamais en affirmation ». Chez nous la perte se fait DIRE par le prospect (« quand ça sonne et que personne ne peut prendre, il se passe quoi ? »), elle ne lui est pas assénée. Un chiffre de peur à froid déclenche un débat sur la méthode au lieu de la douleur.",
      tags: ["conflit", "appel", "ethique"],
    },
    {
      id: "l14-bombarder-benefices",
      titre: "Bombarder de bénéfices",
      quoi: "Empiler les bénéfices, un par caractéristique, pour saturer le lecteur de raisons d'acheter.",
      statut: "conflit-doctrine",
      reserve:
        "CONTREDIT « UNE seule capacité à la bascule » : une capacité se ressent, trois se comparent — et dès qu'on compare, on perd. La leçon vaut sur une page de vente longue, jamais au téléphone ni dans un premier email.",
      tags: ["conflit", "appel"],
    },
    {
      id: "l15-rarete",
      titre: "Rareté et date limite",
      quoi: "Sans date limite, l'annonce dit au lecteur qu'il peut décider plus tard — et plus tard n'arrive jamais. L'auteur recommande d'ajouter systématiquement une échéance ou une limite de places.",
      statut: "conflit-doctrine",
      reserve:
        "Double conflit. (1) MASTER RAPPEL : « la fréquence suit la RÉACTIVITÉ, jamais le calendrier » — une échéance posée d'office est exactement le calendrier qu'on refuse. (2) Une rareté fabriquée sur un logiciel, dont l'offre n'est pas limitée, est un mensonge : c'est une pratique commerciale trompeuse, et ça se retourne au premier prospect qui revient un mois après et retrouve la même « dernière chance ». Une échéance RÉELLE (un créneau de cadrage, une fin de trimestre) reste légitime.",
      tags: ["conflit", "relance", "ethique"],
    },
    {
      id: "l24-repetition",
      titre: "Il faut sept expositions",
      quoi: "L'auteur affirme qu'on ne commence à voir une annonce qu'après sept passages, et recommande de faire tourner des variantes plutôt que la même création.",
      statut: "conflit-doctrine",
      reserve:
        "La « règle de 7 » est du FOLKLORE publicitaire : aucune source primaire ne la soutient, elle est recopiée depuis les années 1930. Et elle contredit MASTER RAPPEL : « 3+ touches ignorées → CHANGER DE CANAL, le format a déjà été ignoré ». Ce qui est gardable, c'est la seconde moitié : varier le message plutôt que répéter le même.",
      tags: ["conflit", "relance", "folklore"],
    },

    // ── INAPPLICABLE TANT QU'ON N'A PAS DE CLIENT ───────────────────
    {
      id: "l05-modeles",
      titre: "S'associer à des figures désirables",
      quoi: "Montrer le produit avec des gens auxquels l'acheteur veut ressembler : les célébrités qui viennent chez le toiletteur, les banques qui font confiance à la société de sécurité.",
      statut: "bloque",
      reserve:
        "ZÉRO client signé à ce jour. Il n'y a personne à montrer. Fabriquer ou suggérer une clientèle qui n'existe pas est une preuve inventée — ce que les tests de la vitrine refusent déjà. À rouvrir au premier client qui accepte d'être cité.",
      tags: ["bloque", "preuve"],
    },
    {
      id: "l09-preuve-valeur",
      titre: "Prouver que ça vaut le prix",
      quoi: "L'acheteur paie quand il croit recevoir plus que ce qu'il donne. La preuve doit venir de l'extérieur : chiffres, témoignages, études, endossements — l'auteur insiste : tout SAUF ce que l'annonceur a fabriqué lui-même.",
      statut: "bloque",
      reserve:
        "C'est la leçon la plus utile et la plus inutilisable en l'état : on n'a aucune preuve externe. Ce qui reste honnête aujourd'hui, c'est de décrire le PRODUIT (« une seule alerte par jour », « 40 s pour débriefer ») — des faits vérifiables sur le produit, pas des résultats promis.",
      tags: ["bloque", "preuve"],
    },
    {
      id: "l13-credibilite-transferee",
      titre: "Transférer la crédibilité d'un tiers",
      quoi: "L'endossement par une personne ou une organisation respectée transfère sa crédibilité au produit — le mécanisme de l'ambassadeur de marque.",
      statut: "bloque",
      reserve:
        "Rien à transférer aujourd'hui. Les deux seules crédibilités réelles sont les PARTENAIRES (Nuwacom) — et les citer engage leur nom, donc ça se demande avant, pas après.",
      tags: ["bloque", "preuve", "partenaires"],
    },
    {
      id: "l16-preuve-sociale",
      titre: "Les témoignages",
      quoi: "Les témoignages sont crus, quel que soit le métier de l'acheteur, et il suffit souvent de les demander en posant quelques questions précises au client.",
      statut: "bloque",
      reserve:
        "Aucun client, donc aucun témoignage. Mais la MÉTHODE est à garder pour le jour J : les questions à poser (« comment on se compare à ceux d'avant ? », « nos prix sont-ils raisonnables ? ») se préparent maintenant, pas au moment de demander.",
      tags: ["bloque", "preuve"],
    },
    {
      id: "l17-longueur-force",
      titre: "La longueur fait la force",
      quoi: "Une page chargée de faits, de chiffres et de dizaines de témoignages donne l'impression qu'il doit y avoir du vrai là-dedans — l'exemple cité est une brochure « 101 histoires de réussite ».",
      statut: "bloque",
      reserve:
        "Le mécanisme repose sur des preuves qu'on n'a pas. Sans elles, « la longueur » devient du remplissage, et le remplissage se repère. Ce qui est utilisable dès maintenant : la longueur faite de SPÉCIFICITÉ vérifiable (leçon « spécificité extrême »), pas de témoignages absents.",
      tags: ["bloque", "preuve"],
    },
  ],
};

/** Le catalogue livré. S'ajoute à la main depuis le Cerveau, jamais d'office. */
export const REFERENCES_LIVREES: Reference[] = [CASHVERTISING];
