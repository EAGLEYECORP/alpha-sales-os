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
 * par TOUTES les pages client. Mesuré sur le build : `z.tazi@scintia.ai` et
 * `https://sales.scintiacallflow.ai/` étaient dans un chunk téléchargeable
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
    body: "Après l'audit, on route le prospect :\n\n- Appels manqués / métier téléphone → **ScintIA Callflow**\n- Leads & deals à structurer → **Alpha Sales OS**\n- Invisible en ligne (pas de site, peu d'avis) → **Visibilité / Growth** (offre personnalisée)\n\nPersonne ne sort les mains vides. Voir [[Play — Permis Lyon]].",
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
 * Notes propres au compte ScintIA — le pipe réel de juillet 2026.
 *
 * Ce ne sont pas des exemples : ce sont les chiffres du dossier commercial.
 * Ils servent de contexte à CHAQUE échange fait au nom de ScintIA — l'agent
 * sait ce qui a marché, ce qui a échoué, et pourquoi.
 */
export const seedScintia: KnowledgeNote[] = [
  {
    id: "sc-juillet-chiffres",
    accountId: "scintia",
    title: "Juillet 2026 — ce que le mois a réellement produit",
    body:
      "78 prospects travaillés · 51 dans l'univers · 132 appels · 18 audits · 24 SMS.\n" +
      "Résultat : 6 RDV obtenus, 7 opportunités, 5 940 € de pipeline installation, **0 gagné**.\n\n" +
      "Taux travaillés → RDV : 11,8 %.\n\n" +
      "La lecture qui compte : voir [[Juillet 2026 — l'audit fait la différence]].",
    tags: ["scintia", "chiffres", "juillet-2026"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-juillet-lecon",
    accountId: "scintia",
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
    tags: ["scintia", "doctrine", "audit"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-callflow-tarifs",
    accountId: "scintia",
    title: "Callflow — tarifs publics",
    body:
      "Installation : **990 € HT**.\n\n" +
      "Paliers minutes (abonnement mensuel) :\n" +
      "- 250 min — 59 € (~100 appels courts)\n" +
      "- 500 min — 115 € (~200 appels)\n" +
      "- 750 min — 169 € (~300 appels)\n" +
      "- 1 000 min — 219 € (~400 appels)\n" +
      "- 1 500 min — 319 € (~600 appels)\n\n" +
      "Commission EAGLEYE : 30 % du setup + 10 % du mensuel.\n" +
      "Jamais de prix avant la démo. Voir [[Cadence de relance Callflow]].",
    tags: ["scintia", "tarifs", "callflow"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-cadence",
    accountId: "scintia",
    title: "Cadence de relance Callflow",
    body:
      "Exigée par ScintIA, non négociable :\n\n" +
      "Après le premier appel sans réponse → **5 rappels sur 2 jours** (3 h, 8 h, 24 h, 32 h, 48 h).\n\n" +
      "**Dès qu'il répond** : Alpha Voice ARRÊTE d'appeler, met à jour le pipeline, et passe " +
      "la main à l'humain (closer).\n\n" +
      "Opposition (« ne me rappelez plus ») ou numéro invalide : arrêt DÉFINITIF immédiat, " +
      "prioritaire sur la cadence.",
    tags: ["scintia", "doctrine", "cadence"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-closing",
    accountId: "scintia",
    title: "ScintIA — rituel de closing",
    body:
      "Quand le prospect est prêt : envoyer la **PROPOSITION COMMERCIALE** depuis " +
      "`z.tazi@scintia.ai`, via le panel `https://sales.scintiacallflow.ai/`.\n\n" +
      "Se tromper de rituel (envoyer un devis EAGLEYE sur un deal ScintIA) fait perdre " +
      "le deal au dernier mètre.\n\n" +
      "ScintIA vend Callflow comme un **produit** — c'est leur seule offre. " +
      "Tout le reste (visibilité, digitalisation < 40 k) revient à EAGLEYE.",
    tags: ["scintia", "closing"],
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    source: "playbook",
  },
];

/** Le socle complet, dans l'ordre d'insertion. */
export const SEED_NOTES: KnowledgeNote[] = [...seedKnowledge, ...seedScintia];
