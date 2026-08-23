/**
 * ─────────────────────────────────────────────────────────────────────
 * LA DOCTRINE PAR DÉFAUT — module SERVEUR.
 *
 * Ce texte récite l'offre en clair : la grille par brique, le prix du pack,
 * l'escalier avec les taux de chaque compte. Il vivait dans `lib/seed.ts`,
 * importé par `lib/store.ts`, donc compilé dans le bundle de chaque page.
 *
 * C'est le troisième endroit de cette passe où le même secret repartait par
 * un autre chemin : après `lib/accounts`, après `lib/knowledge`. La leçon
 * tient en une phrase — une donnée retirée d'un fichier reste publiée si une
 * PHRASE la répète ailleurs dans le graphe du client.
 *
 * Il descend par `/api/knowledge/seed` (route interne) et sert de valeur
 * initiale à `settings.businessRules`, que l'opérateur édite ensuite. Les
 * routes IA, elles, l'importent directement : elles tournent côté serveur.
 *
 * ⚠ Ne JAMAIS l'importer depuis un composant client.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * La doctrine à injecter dans un prompt, avec REPLI SERVEUR.
 *
 * ⚠ Ce repli n'existait pas, et c'est un défaut qui précède cette passe : les
 * routes IA prenaient la doctrine dans le CORPS de la requête, sans rien
 * derrière. Un navigateur qui envoie une chaîne vide — store neuf, réglages
 * effacés, ou simplement le socle pas encore descendu — obtenait une IA qui
 * ignore « jamais de prix avant la démo ». Silencieusement : la réponse arrive
 * quand même, elle est juste moins bonne, et rien ne le signale.
 *
 * On ne fait donc plus confiance au client pour porter la doctrine. S'il en
 * envoie une (l'opérateur l'a éditée dans ses réglages), elle gagne ; sinon,
 * c'est celle-ci.
 */
export function doctrineOrDefault(depuisClient?: string): string {
  return (depuisClient ?? "").trim() || DEFAULT_BUSINESS_RULES;
}

export const DEFAULT_BUSINESS_RULES = `1. Jamais de prix avant la démo. Un chiffre lâché trop tôt transforme la conversation en négociation.
2. Alpha Voice annonce qu'il est une IA dès la première phrase (AI Act, art. 50). Jamais contourné, jamais adouci.
3. La décision EST le produit. On vend une décision, pas un outil.
4. Chiffrer ce que coûte l'inaction — avec SES chiffres à lui. Jamais un montant inventé : un chiffre faux détruit la confiance plus vite qu'un silence.
5. OBSTACLES (avant l'offre) ≠ OBJECTIONS (après l'offre). On épluche : circonstances → les autres → soi. On n'argumente pas.
6. Les 3 croyances à 10/10 avant de demander la signature : ça fonctionne, tu me soutiens, ça marche POUR MOI.
7. Chaque contact se termine par un next step DATÉ. Sans exception.
8. L'escalier, sur CHAQUE prospect, une marche à la fois : visibilité → EAGLEYE (100 %, c'est notre société) · volume d'appels élevé → ScintIA Callflow, 990 € HT de setup (30 % + 10 % du mensuel) · automatisation demandée en plus → EAGLEYE (100 %) · chantier > 40 k → Nuwacom (15 %, puis 100 % de la maintenance).
9. Cibles : toute organisation dont la vente dépend de personnes plutôt que d'un système — équipes terrain (toiture, isolation, photovoltaïque en porte-à-porte), centres d'appels, agences B2B, réseaux et franchises, commerce local, assurance en transformation.
10. Offres EAGLEYE (les nôtres, 100 % pour nous) : visibilité/growth, Alpha Sales OS à la carte (1 200 à 3 500 € HT d'installation + 120 à 364 €/mois par brique) ou le pack complet à 10 000 € HT + 1 000 €/mois, et l'OS PERSONNALISÉ construit sur le métier du client (chiffré au cadrage). Appels sortants : 364 €/mois les 1 000 appels, sans engagement. Les 30 % qu'on peut proposer à un client, c'est une part de SON CA généré — pas une commission reversée à un tiers.
11. Répartition à annoncer au cadrage : Alpha Sales OS fait la prospection, la qualification, les relances, les scripts, le suivi et la mesure. LE CLIENT garde la LIVRAISON de sa prestation et la RÉASSURANCE HUMAINE (la présence au moment de signer). On ne promet jamais de livrer à sa place ni de remplacer sa parole.
12. Cadrage obligatoire avant tout devis : visio, appel ou SMS, avec une date ET une heure décidées.
13. La fréquence de relance suit SA réactivité, jamais le calendrier. 3 touches ignorées = changer de canal, pas insister.
14. Un perdu = nurture 90 jours avec une raison NEUVE à chaque fois. Un signé = demande de referral dès la semaine 1.`;
