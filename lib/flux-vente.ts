/**
 * ─────────────────────────────────────────────────────────────────────
 * LE FIL DE VENTE — un seul chemin qui enchaîne ce qu'Alpha sait déjà faire.
 *
 * Chaque brique existe (ICP, sourcing, audit, liste du jour, campagnes,
 * devis, suivi) mais éparpillée sur des écrans. Ce module NE crée aucune
 * capacité : il ORDONNE celles qui existent, façon parcours guidé — de la
 * cible jusqu'à l'encaissement. « Montrer le fil, pas réécrire les écrans. »
 *
 * ⚠ Chaque étape pointe vers un ÉCRAN RÉEL. Un fil qui renvoie vers une page
 * morte est pire que pas de fil : il promet un geste qui n'aboutit pas. Un
 * test croise chaque `route` avec les dossiers de `app/(app)`.
 *
 * ⚠ LA LIVRAISON N'EST PAS À NOUS. Doctrine : Alpha fait tout AVANT et AUTOUR
 * de la vente ; la prestation vendue, c'est le CLIENT qui la livre. La dernière
 * étape SUIT le paiement et pose le jalon de livraison — elle ne prétend pas
 * livrer à sa place.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface EtapeVente {
  id: string;
  /** Position dans le fil, à partir de 1. */
  ordre: number;
  /** Le verbe du moment, court. */
  titre: string;
  /** Ce que l'étape PRODUIT — pas ce qu'elle contient. */
  produit: string;
  /** L'écran réel où le geste se fait. */
  route: string;
  /** Le libellé du bouton qui y mène. */
  routeLabel: string;
  /** Précision de doctrine, quand l'étape en porte une. */
  note?: string;
}

export const FLUX_VENTE: EtapeVente[] = [
  {
    id: "icp",
    ordre: 1,
    titre: "Ta cible",
    produit: "Le marché visé, son angle, le message qu'Alpha écrit — avant tout branchement.",
    route: "/demarrage",
    routeLabel: "Choisir mon marché",
  },
  {
    id: "sourcer",
    ordre: 2,
    titre: "Trouver",
    produit: "Des fiches prospects dans le CRM (import terrain, feuille, ou collecteur).",
    route: "/pipeline",
    routeLabel: "Importer des prospects",
    note: "La collecte se fait DEHORS (permis, Maps, feuille) puis s'importe — Alpha trie, il ne scrape pas dans le produit.",
  },
  {
    id: "auditer",
    ordre: 3,
    titre: "Qualifier",
    produit: "Un audit par prospect : ce qui cloche, l'accroche, le potentiel.",
    route: "/audits",
    routeLabel: "Auditer",
  },
  {
    id: "choisir",
    ordre: 4,
    titre: "La liste du jour",
    produit: "Qui on contacte aujourd'hui, dans le bon ordre, sans se noyer.",
    route: "/aujourdhui",
    routeLabel: "Ouvrir la liste",
  },
  {
    id: "campagne",
    ordre: 5,
    titre: "Lancer les touches",
    produit: "Les approches partent — email, LinkedIn, voix — à la cadence tenable.",
    route: "/campaigns",
    routeLabel: "Lancer une campagne",
  },
  {
    id: "proposition",
    ordre: 6,
    titre: "Devis",
    produit: "Une proposition chiffrée, émise APRÈS le cadrage (visio + date décidées).",
    route: "/prospects",
    routeLabel: "Ouvrir une fiche",
    note: "Le devis ne se fabrique qu'après le cadrage — c'est ce qui protège le dernier mètre.",
  },
  {
    id: "suivi",
    ordre: 7,
    titre: "Paiement & livraison",
    produit: "Le jalon : signé → encaissé → livré. On suit, on ne relâche pas.",
    route: "/milestones",
    routeLabel: "Suivre les jalons",
    note: "La LIVRAISON est au client (doctrine) : Alpha suit le paiement et pose le jalon, il ne livre pas la prestation à sa place.",
  },
];
