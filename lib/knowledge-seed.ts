import type { KnowledgeNote } from "./knowledge";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SOCLE DU CERVEAU — la doctrine maison, en clair.
 *
 * ── POURQUOI CE FICHIER EST SÉPARÉ DE `lib/knowledge.ts` ──
 *
 * Ces notes sont le playbook : rituels de closing avec les adresses
 * partenaires, prix de setup, taux de commission par offre, seuil de routage.
 * Elles vivaient dans `lib/knowledge.ts`, importé par `lib/store.ts` — donc
 * par TOUTES les pages client. Mesuré sur le build : l'email d'expédition et
 * le panel de vente d'un partenaire étaient dans un chunk téléchargeable
 * sans mot de passe, alors même qu'on venait de les sortir de `lib/accounts`.
 *
 * Sortir une donnée d'un fichier ne sert à rien si la même phrase est recopiée
 * dans un autre que le navigateur télécharge aussi. C'est la leçon de cette
 * passe : il faut suivre le GRAPHE d'imports, pas les fichiers.
 *
 * Le socle est donc servi par `/api/knowledge/seed` (route interne) et fusionné
 * dans le store au premier chargement d'une session authentifiée. Les notes que
 * l'utilisateur écrit ensuite lui appartiennent et restent dans son navigateur
 * — ce module ne les voit jamais.
 *
 * ⚠ Ne JAMAIS l'importer depuis un composant client. Vérifié par
 * `tests/vitrine-fuite.test.ts`.
 * ─────────────────────────────────────────────────────────────────────
 */

export const seedKnowledge: KnowledgeNote[] = [
  {
    id: "seed-offre",
    title: "Offre — Alpha Sales OS",
    body: "L'OS de vente intelligent pour forces de vente et agences. Installation 2 500 €, abonnement dès 290 €/mois.\n\nPromesse : zéro lead perdu, la machine tourne 24/7. On outille le closing, on ne remplit pas une base — on remplit un agenda.\n\nVoir [[Chiffres — preuve de concept]] et [[Routage d'offre]].",
    tags: ["offre", "alpha-sales-os"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-chiffres",
    title: "Chiffres — preuve de concept",
    body: "Preuve de concept = 2 500 € d'installation × 10 clients = **25 000 €** de cash.\n\n- MRR à 290 €/mois × 10 = 2 900 €/mois (~35 k€ ARR)\n- CAC ~275 €/client (≈ 91 % ton temps) · LTV ~5 980 € · LTV:CAC ~21:1\n- Break-even infra : 1 client\n\nLes « 5M » viennent des revendeurs white-label, pas d'une campagne à 10 signatures.",
    tags: ["chiffres", "economie"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-routage",
    title: "Routage d'offre",
    body: "Après l'audit, on route le prospect :\n\n- Appels manqués / métier téléphone → **Alpha Voice**\n- Leads & deals à structurer → **Alpha Sales OS**\n- Invisible en ligne (pas de site, peu d'avis) → **Visibilité / Growth** (offre personnalisée)\n\nPersonne ne sort les mains vides. Voir [[Play — Permis Lyon]].",
    tags: ["doctrine", "routage"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-permis",
    title: "Play — Permis Lyon",
    body: "ICP à déclencheur : un maître d'œuvre nommé sur un permis de construire EN COURS est en pleine activité — le bon moment pour l'approcher.\n\nn8n tire les permis (data.grandlyon.com) → pousse les MOE dans l'app → audit → [[Routage d'offre]] → séquence.",
    tags: ["play", "prospection", "lyon"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    source: "playbook",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PIPE DE JUILLET 2026 — RAPATRIÉ, PAS JETÉ.
 *
 * ⚠ Ces notes appartenaient au compte d'un revendeur. Le compte a disparu
 * avec l'accord ; les CHIFFRES, eux, sont à nous — c'est nous qui avons passé
 * les 132 appels. C'est aussi la seule mesure `mesure-maison` du dépôt (voir
 * `lib/references.ts` : la seule catégorie qui mérite le mot « vérité »).
 *
 * Les supprimer parce qu'un partenariat s'arrête aurait effacé la seule chose
 * que ce dépôt sait pour l'avoir constatée, et laissé les hypothèses seules.
 * Elles passent donc sous EAGLEYE, qui porte désormais l'offre.
 *
 * Ce qui a été SUPPRIMÉ, en revanche : le rituel de closing du revendeur
 * (email d'expédition, panel de vente). Ce n'est plus un chemin, c'est une
 * fausse piste — et l'agent le lirait comme une consigne.
 * ─────────────────────────────────────────────────────────────────────
 */
export const seedTerrain: KnowledgeNote[] = [
  {
    id: "sc-juillet-chiffres",
    accountId: "eagleye",
    title: "Juillet 2026 — ce que le mois a réellement produit",
    body:
      "78 prospects travaillés · 51 dans l'univers · 132 appels · 18 audits · 24 SMS.\n" +
      "Résultat : 6 RDV obtenus, 7 opportunités, 5 940 € de pipeline installation, **0 gagné**.\n\n" +
      "Taux travaillés → RDV : 11,8 %.\n\n" +
      "La lecture qui compte : voir [[Juillet 2026 — l'audit fait la différence]].",
    tags: ["terrain", "chiffres", "juillet-2026"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-juillet-lecon",
    accountId: "eagleye",
    title: "Juillet 2026 — l'audit fait la différence",
    body:
      "Par secteur (prospects · appels · audits · opportunités) :\n\n" +
      "- Auto-école : 3 · 7 · 2 · **3** — le meilleur ratio, de loin\n" +
      "- Immobilier : 8 · 10 · 4 · **2**\n" +
      "- Garage/Carrosserie : 18 · 34 · 1 · **2**\n" +
      "- Médical/Dentaire : 10 · 13 · 5 · 0\n" +
      "- Dépannage/Plomberie : 14 · **26** · **0** · **0**\n" +
      "- Ambulance : 8 · 14 · 1 · 0\n\n" +
      "**La leçon** : là où un AUDIT est parti, le taux monte. Là où il n'y a eu que " +
      "des appels, il reste à zéro. 26 appels en plomberie sans une seule pièce écrite " +
      "n'ont rien produit.\n\n" +
      "Conséquence opérationnelle : aucun prospect ne va en séquence sans audit écrit.",
    tags: ["terrain", "doctrine", "audit"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-voix-tarifs",
    accountId: "eagleye",
    title: "Alpha Voice — grille tarifaire (héritée, à décider)",
    body:
      "Installation : **990 € HT**.\n\n" +
      "Paliers minutes (abonnement mensuel) :\n" +
      "- 250 min — 59 € (~100 appels courts)\n" +
      "- 500 min — 115 € (~200 appels)\n" +
      "- 750 min — 169 € (~300 appels)\n" +
      "- 1 000 min — 219 € (~400 appels)\n" +
      "- 1 500 min — 319 € (~600 appels)\n\n" +
      "⚠ **Ces montants viennent de la grille publique de l'ancien partenaire.** " +
      "L'offre est revenue chez EAGLEYE (100 %, plus de commission reversée), mais le PRIX " +
      "n'a pas encore été décidé par nous. Vérifié en revanche : la marge tient — 74 à 76 % " +
      "sur notre coût de revient mesuré (0,0563 €/min). Bémol : le socle fixe est ~57 €/mois, " +
      "donc le premier palier à 59 € ne paie pas l'infrastructure à lui seul.\n\n" +
      "Jamais de prix avant la démo. Voir [[Cadence de relance téléphonique]].",
    tags: ["tarifs", "alpha-voice", "a-decider"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-cadence",
    accountId: "eagleye",
    title: "Cadence de relance téléphonique",
    body:
      "Après le premier appel sans réponse → **5 rappels sur 2 jours** (3 h, 8 h, 24 h, 32 h, 48 h).\n\n" +
      "**Dès qu'il répond** : Alpha Voice ARRÊTE d'appeler, met à jour le pipeline, et passe " +
      "la main à l'humain (closer).\n\n" +
      "Opposition (« ne me rappelez plus ») ou numéro invalide : arrêt DÉFINITIF immédiat, " +
      "prioritaire sur la cadence.\n\n" +
      "⚠ Ces 5 rappels étaient EXIGÉS par l'ancien partenaire. Personne ne les exige plus : " +
      "c'est devenu un choix, et il est agressif (6 contacts en 2 jours, à comparer au " +
      "plafond de 4/30 j du décret n° 2022-1313 sur les cibles non professionnelles). " +
      "Sans SIREN, le code plafonne à 4 de lui-même.",
    tags: ["doctrine", "cadence", "a-decider"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    source: "playbook",
  },
];

/** Le socle complet, dans l'ordre d'insertion. */
export const SEED_NOTES: KnowledgeNote[] = [...seedKnowledge, ...seedTerrain];
