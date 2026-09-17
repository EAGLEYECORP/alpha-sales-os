/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA CEO — ce qui demande une main humaine, et ce qui est en panne.
 *
 * ══ CE QU'IL EST, ET LE PIÈGE DE SON PROPRE NOM ══
 *
 * La demande était : « automatiser et systémiser au max tous les points
 * humain-in-the-loop, en macro, et pouvoir y accéder en micro s'il y a
 * souci ». La référence donnée était « une version meilleure et plus légère
 * de paperclip AI ».
 *
 * ⚠ CETTE RÉFÉRENCE PORTE SON PROPRE AVERTISSEMENT, ET IL FAUT LE PRENDRE AU
 * SÉRIEUX. Le maximiseur de trombones est l'histoire canonique d'un
 * optimiseur qui détruit tout ce qui l'entoure en poursuivant un objectif
 * unique sans regarder ses contraintes. Un « Alpha CEO » qui optimiserait
 * « plus de rendez-vous » sans frein ferait exactement trois choses que la
 * doctrine interdit déjà, chacune pour une raison payée :
 *
 *   · appeler hors des fenêtres ouvertes (`prochaineFenetreOuverte`) — un
 *     vendredi 17h renvoyait cinq rappels au lundi matin, dont un à minuit ;
 *   · dépasser le plafond du décret n° 2022-1313 (4 sollicitations / 30 j) ;
 *   · envoyer plus vite que ce que la réputation du domaine encaisse.
 *
 * Alpha CEO **respecte ces gardes plus vite**, il ne les retire pas. C'est la
 * seule différence entre un pilote et un maximiseur.
 *
 * ══ LA DISTINCTION QUI STRUCTURE TOUT LE MODULE ══
 *
 * « Point humain » recouvre trois choses radicalement différentes, et les
 * confondre est la faute que ce fichier existe pour empêcher :
 *
 *  · **`automatisable`** — un humain le fait par HABITUDE ou par manque
 *    d'outil. Rien ne se perd à l'automatiser. C'est là qu'Alpha CEO gagne
 *    du temps, et c'est la minorité des cas.
 *
 *  · **`humain-par-decision`** — NOUS avons choisi qu'un humain tranche,
 *    parce que l'automatiser FABRIQUERAIT DE LA PREUVE. La doctrine le dit
 *    déjà, mot pour mot : « Aucun palier ne se valide seul, même tout vert.
 *    Automatique = le REFUS. » Cocher « j'ai entendu la phrase de l'article
 *    50 » sans qu'un appel ait décroché n'est pas un gain de temps : c'est un
 *    faux. Alpha CEO PRÉPARE la décision — il rassemble, il chiffre, il
 *    prévient — et s'arrête avant de la prendre.
 *
 *  · **`humain-par-contrainte`** — la loi ou un tiers l'exige. Ce n'est même
 *    pas notre choix. Le tampon d'un partenaire sur un texte qui engage SA
 *    réputation, la signature d'un contrat, un SIRET pour facturer. Aucune
 *    quantité d'ingénierie ne les supprime.
 *
 * ⚠ LES DEUX DERNIÈRES CATÉGORIES NE SONT PAS UN RETARD À RATTRAPER. Elles
 * sont le produit. Une session future qui « optimisera » un point
 * `humain-par-decision` en croyant finir le travail cassera précisément ce
 * qui distingue cet outil d'un envoyeur de masse.
 *
 * ══ ET LA MOITIÉ QUI COMPTE AUTANT : LES PANNES SILENCIEUSES ══
 *
 * Le défaut le plus fréquent de ce dépôt n'est pas un bug : c'est un
 * mécanisme juste, testé, branché à un seul endroit ou à aucun. Rien
 * n'échoue, donc rien n'alerte. Alpha CEO ne sert à rien s'il ne surveille
 * que les décisions : il doit d'abord détecter ce qui est cassé sans le dire.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { EtatEnveloppe } from "./essai";

export type NaturePoint = "automatisable" | "humain-par-decision" | "humain-par-contrainte";

/** Ce qu'on fait quand le point demande attention. */
export type Gravite =
  /** Rien ne se perd à attendre. */
  | "info"
  /** Ça coûte de l'argent ou du temps chaque jour où on ne le fait pas. */
  | "a-traiter"
  /** Ça coûte quelque chose qu'on ne récupère pas : réputation, conformité, données. */
  | "urgent";

export interface PointCEO {
  id: string;
  /** Ce que c'est, en une phrase qu'un humain pressé comprend. */
  quoi: string;
  nature: NaturePoint;
  /**
   * POURQUOI cette nature. Obligatoire sur les deux natures humaines : un
   * point marqué « humain » sans raison écrite finit automatisé par la
   * session suivante, qui croira corriger un oubli.
   */
  pourquoi: string;
  /** Le module qui porte la règle. Le micro commence ici. */
  module: string;
  /** Où l'humain va quand il veut mettre la main dedans. */
  ecran: string;
  gravite: Gravite;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE RELEVÉ — tous les points où un humain intervient aujourd'hui.
 *
 * ⚠ C'est une CARTE, pas une liste de tâches. Sa valeur n'est pas d'être
 * exhaustive une fois : c'est de rendre visible, d'un coup d'œil, lesquels
 * peuvent bouger et lesquels ne doivent pas. Un point ajouté au produit sans
 * être ajouté ici redevient invisible — et c'est exactement comme ça qu'un
 * mécanisme finit branché nulle part.
 * ─────────────────────────────────────────────────────────────────────
 */
export const POINTS: PointCEO[] = [
  // ── Ce qu'Alpha CEO peut prendre en charge ──
  {
    id: "relance-calee",
    quoi: "Caler chaque rappel sur une fenêtre d'appel ouverte, avec 3 h d'écart minimum.",
    nature: "automatisable",
    pourquoi:
      "Pur calcul de calendrier. Le faire à la main produit exactement les erreurs mesurées : un premier appel vendredi renvoyait cinq rappels sur le week-end, dont un à minuit.",
    module: "lib/call-cadence.ts",
    ecran: "/appels",
    gravite: "a-traiter",
  },
  {
    id: "prochaine-action",
    quoi: "Proposer la prochaine action datée sur chaque fiche sans next step.",
    nature: "automatisable",
    pourquoi:
      "La règle est déjà écrite (tout contact finit par une action datée) et la fiche porte de quoi la déduire. Ce qui manque n'est pas le jugement, c'est le geste.",
    module: "lib/master-rappel.ts",
    ecran: "/aujourdhui",
    gravite: "a-traiter",
  },
  {
    id: "changement-canal",
    quoi: "Changer de canal après 3 touches ignorées — sauf s'il OUVRE.",
    nature: "automatisable",
    pourquoi:
      "Règle mécanique et déjà testée. L'exception qui la rend juste (s'il ouvre, le canal passe, c'est la demande qui coince) est elle-même calculable.",
    module: "lib/reactivite.ts",
    ecran: "/aujourdhui",
    gravite: "info",
  },
  {
    id: "tri-file-appels",
    quoi: "Ordonner la file d'appels du jour selon les signaux vitaux et la fatigue.",
    nature: "automatisable",
    pourquoi: "Un tri sur des champs déjà calculés. Personne ne gagne à le refaire de tête chaque matin.",
    module: "lib/vital-signs.ts",
    ecran: "/aujourdhui",
    gravite: "info",
  },

  // ── Ce que NOUS avons décidé de garder humain ──
  {
    id: "validation-palier",
    quoi: "Valider le passage au palier de campagne suivant (10 → 100 → 1 000).",
    nature: "humain-par-decision",
    pourquoi:
      "La doctrine le dit mot pour mot : « Aucun palier ne se valide seul, même tout vert. Automatique = le REFUS. » Un palier engage de vraies minutes et de vraies personnes sur des hypothèses non mesurées (décroché 30 %, intérêt 20 %). Alpha CEO rassemble les points, chiffre le coût et dit ce qui manque — il ne coche rien.",
    module: "lib/paliers-campagne.ts",
    ecran: "/controle",
    gravite: "a-traiter",
  },
  {
    id: "points-declaratifs",
    quoi: "Cocher un point déclaratif (« j'ai entendu la phrase de l'article 50 »).",
    nature: "humain-par-decision",
    pourquoi:
      "Un point déclaratif ne s'offre même pas tant que sa condition n'existe pas : le cocher sans décroché FABRIQUERAIT la preuve. C'est le cas d'école de ce qu'automatiser détruit — le point ne vaut que parce qu'un humain a réellement entendu.",
    module: "lib/checkpoints.ts",
    ecran: "/controle",
    gravite: "info",
  },
  {
    id: "relecture-avant-envoi",
    quoi: "Relire les brouillons d'une campagne avant qu'ils partent.",
    nature: "humain-par-decision",
    pourquoi:
      "Ce qui part engage un domaine dont la réputation se construit en mois et se perd en soirée. Alpha CEO peut préparer, ordonner et signaler les brouillons douteux ; le bouton d'envoi reste une main.",
    module: "lib/store.ts",
    ecran: "/outbox",
    gravite: "a-traiter",
  },
  {
    id: "poids-calibration",
    quoi: "Ajuster les poids du tri d'après les résultats d'appel.",
    nature: "humain-par-decision",
    pourquoi:
      "Sur quarante appels, un ajustement automatique apprend le BRUIT et le grave dans le tri. Le module rend un verdict et nomme le fichier ; la constante se change à la main, et ça se voit dans un diff.",
    module: "lib/calibration.ts",
    ecran: "/controle",
    gravite: "info",
  },
  {
    id: "cadrage-avant-devis",
    quoi: "Tenir le cadrage (visio, appel ou SMS) avant d'émettre un devis.",
    nature: "humain-par-decision",
    pourquoi:
      "Un devis sans cadrage promet un périmètre qu'on découvre à la livraison. C'est une conversation, pas un formulaire — et c'est elle qui décide du prix.",
    module: "lib/client-onboarding.ts",
    ecran: "/pipeline",
    gravite: "a-traiter",
  },

  // ── Ce qu'aucune ingénierie ne supprime ──
  {
    id: "tampon-partenaire",
    quoi: "Faire relire un texte par le partenaire avant qu'il sorte sous SA marque.",
    nature: "humain-par-contrainte",
    pourquoi:
      "Ce qui se dit là engage une réputation qui n'est pas la nôtre. La conformité N'EST PAS l'accord : `auditScript` refuse un texte illicite, il ne dit rien de ce que le partenaire a relu. Et le tampon porte sur le TEXTE EXACT — le réécrire le périme.",
    module: "lib/validation-partenaire.ts",
    ecran: "/settings",
    gravite: "urgent",
  },
  {
    id: "article-50",
    quoi: "Annoncer, dès la première phrase, que c'est une IA et pour le compte de qui.",
    nature: "humain-par-contrainte",
    pourquoi:
      "Article 50 de l'AI Act européen. La phrase est prononcée par le CODE et non interruptible, et `auditScript` refuse un script non conforme. Ce n'est pas un réglage : c'est la condition pour avoir le droit d'appeler.",
    module: "lib/voice-script.ts",
    ecran: "/voice",
    gravite: "urgent",
  },
  {
    id: "statut-apporteur",
    quoi: "Obtenir le SIRET et le contrat signé avant de verser une commission.",
    nature: "humain-par-contrainte",
    pourquoi:
      "Payer sans facture est du travail dissimulé, et c'est l'entreprise donneuse d'ordre qui est sanctionnée. Le contrat ne se code pas : il se signe.",
    module: "lib/apporteur.ts",
    ecran: "/payouts",
    gravite: "urgent",
  },
  {
    id: "poignee-de-main",
    quoi: "La présence humaine au moment de signer.",
    nature: "humain-par-contrainte",
    pourquoi:
      "C'est écrit dans la répartition du travail depuis le début : Alpha ne livre pas le chantier et ne remplace pas la personne qui rassure. Il supprime tout ce qui est AVANT et AUTOUR.",
    module: "docs/OFFRE-ALPHA-VOICE.md",
    ecran: "/pipeline",
    gravite: "info",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PANNES SILENCIEUSES — ce qu'Alpha CEO doit aller chercher.
 *
 * ⚠ AUCUNE DE CELLES-CI NE PRODUIT D'ERREUR À L'ÉCRAN. C'est ce qui les
 * rend chères : le produit a l'air de fonctionner. Chacune a été payée au
 * moins une fois dans ce dépôt, ou est structurellement possible aujourd'hui.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface PanneCEO {
  id: string;
  /** Ce qui se passe, du point de vue de celui qui le subit. */
  symptome: string;
  /** Pourquoi personne ne le voit. C'est le champ qui compte. */
  pourquoiInvisible: string;
  /** Comment on le détecte, concrètement. */
  detection: string;
  gravite: Gravite;
  module: string;
}

export const PANNES: PanneCEO[] = [
  {
    id: "enveloppe-ouverture-pleine",
    symptome:
      "Les nouveaux inscrits reçoivent un essai dégradé : le produit s'ouvre, mais rien de ce qui part de notre infrastructure ne fonctionne.",
    pourquoiInvisible:
      "Tout est NORMAL. Le compte se crée, l'app s'ouvre, les écrans répondent, le locataire lit « ce n'est pas toi » sur /compte — et il est le seul à le lire. Chez nous, l'enveloppe se referme sans un mot : aucun journal, aucune erreur, aucune facture anormale puisque justement on a cessé de dépenser. Le signal de succès et le signal de fermeture sont le même silence.",
    detection:
      "`GET /api/health` (compte maître) → `enveloppe.niveau` vaut « pleine », ou « bientot-pleine » tant qu'on peut encore décider.",
    gravite: "a-traiter",
    module: "lib/essai.ts",
  },
  {
    id: "smtp-absent",
    symptome: "Personne ne peut créer de compte : le mail de confirmation n'arrive jamais.",
    pourquoiInvisible:
      "L'inscription RÉUSSIT côté Supabase. L'écran dit « vérifie tes emails », et c'est vrai — sauf que le SMTP par défaut ne délivre qu'au propriétaire du projet. L'inscrit croit avoir mal tapé son adresse.",
    detection: "Des comptes créés et jamais confirmés dans Supabase → Authentication → Users.",
    gravite: "urgent",
    module: "docs/SMTP-SUPABASE-AMEN.md",
  },
  {
    id: "spf-casse",
    symptome: "Les emails partent et finissent en indésirables.",
    pourquoiInvisible:
      "Ils sont ENVOYÉS : aucune erreur, aucun rebond, le journal est vert. Et un domaine avec DEUX enregistrements SPF est traité comme un domaine qui n'en a AUCUN — on casse en croyant améliorer.",
    detection: "En-tête d'un mail reçu chez Gmail : `spf=pass`, `dkim=pass`, `dmarc=pass`. Les trois, pas la réception.",
    gravite: "urgent",
    module: "docs/ENVOI.md",
  },
  {
    id: "migration-absente",
    symptome: "Un client paie et l'application le refuse.",
    pourquoiInvisible:
      "`schema.sql` est en `create table if not exists` : sur une base déjà créée il ne fait RIEN, et le SQL Editor annonce quand même « Success ». Le webhook écrit `subscriptions`, le contrôle d'accès lit `entitlements` — deux tables qui ne se parlent pas.",
    detection: "`subscriptions` non vide et `entitlements` vide : la migration 002 n'est pas passée.",
    gravite: "urgent",
    module: "supabase/migrations/002-entitlements.sql",
  },
  {
    id: "stockage-sature",
    symptome: "Les fiches disparaissent en fermant l'onglet.",
    pourquoiInvisible:
      "Une écriture localStorage qui rate ne ressemble pas à une panne : l'écran continue d'afficher les fiches. Elles ne sont simplement plus écrites. Une fiche terrain pèse ~1,3 Ko ; mille numéros font la moitié du quota.",
    detection: "`analyseStorage` rend un niveau `critique` ou `sature`.",
    gravite: "urgent",
    module: "lib/storage-health.ts",
  },
  {
    id: "pipe-non-charge",
    symptome: "Le pipe serveur se vide.",
    pourquoiInvisible:
      "Un navigateur qui a raté son chargement a une liste vide, et la synchro sortante calcule des SUPPRESSIONS. Rien ne distingue « je n'ai rien » de « il n'y a rien » — sauf l'état d'hydratation, qui n'est justement jamais persisté.",
    detection: "`peutSynchroniser` rend faux alors que le mode serveur est actif.",
    gravite: "urgent",
    module: "lib/hydratation.ts",
  },
  {
    id: "module-mort",
    symptome: "Une règle juste, testée, que personne ne consulte.",
    pourquoiInvisible:
      "C'est LE défaut récurrent du dépôt. Le module rend la bonne réponse, aucun appelant ne la lit. Rien n'échoue, donc rien n'alerte — et les tests du module passent tous.",
    detection: "Un export de `lib/` qu'aucun fichier n'importe. La question à poser : combien d'endroits posent cette règle, et répondent-ils tous pareil ?",
    gravite: "a-traiter",
    module: "CLAUDE.md",
  },
  {
    id: "agent-absent",
    symptome: "Le prospect décroche, et personne ne parle.",
    pourquoiInvisible:
      "`/api/voice/call` crée le dispatch LiveKit et rend `dispatched: true` que `voice/agent.py` tourne ou non. Un poste éteint un vendredi soir laisse donc le cron composer tout le week-end : la ligne sonne, la fiche est brûlée, le numéro perd sa réputation, les minutes sont facturées — et les journaux restent VERTS. LiveKit n'expose pas la liste des workers : on ne peut pas demander si un agent écoute, il faut qu'il le dise.",
    detection: "`GET /api/voice/presence` → `etat` vaut `silencieux` ou `inconnu` alors que l'autopilote est armé.",
    gravite: "urgent",
    module: "lib/presence-agent.ts",
  },
  {
    id: "ordonnanceur-muet",
    symptome: "L'autopilote existe, il est verrouillé, il est testé — et personne ne l'appelle jamais.",
    pourquoiInvisible:
      "Les routes répondent parfaitement quand on les interroge à la main : 200, un statut propre, aucune erreur. Ce qui manque n'est pas dans le code, c'est l'ORDONNANCEUR — et l'absence d'un déclencheur ne produit aucune trace. Le pipe ne bouge simplement pas, et on cherche le bug dans la file d'appels.",
    detection:
      "`GET /api/moniteur` → `autopilote: \"non-configure\"`, ou aucune ligne récente dans `cron.job_run_details` côté Supabase.",
    gravite: "a-traiter",
    module: "supabase/migrations/004-ordonnanceur.sql",
  },
  {
    id: "autopilote-en-simulation",
    symptome: "Le cron tourne, les journaux sont verts, et aucun appel ne part.",
    pourquoiInvisible:
      "C'est un état VOULU — sans `CAMPAIGN_AUTOPILOT=on` la route simule et rend ce qu'elle AURAIT fait, ce qui est exactement la garde qu'on veut au démarrage. Le piège est qu'elle répond `ok: true` : tout a l'air de fonctionner, et on peut rester des semaines en simulation en croyant démarcher.",
    detection: "`GET /api/moniteur` → `autopilote: \"simulation\"`, alors que des fiches attendent dans la file.",
    gravite: "info",
    module: "app/api/campaign/tick/route.ts",
  },
  {
    id: "prix-stripe-absent",
    symptome: "Le bouton « payer » tombe dans le vide.",
    pourquoiInvisible:
      "L'offre s'affiche normalement avec son prix : c'est la grille publique qui le porte. La variable `STRIPE_PRICE_*` manquante ne se voit qu'au clic, sur la dernière étape du tunnel.",
    detection: "`/api/health` → `billing.prices` faux alors que des offres sont en ligne.",
    gravite: "a-traiter",
    module: "lib/offres-publiques.ts",
  },
  {
    id: "fiche-demo-envoyee",
    symptome: "Un email part vers une adresse inventée, ou l'agent compose un numéro de fiction.",
    pourquoiInvisible:
      "Rien ne distingue une fiche de démonstration d'une vraie à l'œil. Le verrou a failli s'ouvrir tout seul le jour où la démo est devenue GÉNÉRÉE : il répondait par appartenance à une liste, et les fiches produites n'y étaient pas.",
    detection: "`/api/send` doit rendre 409 sur toute fiche `demo-` ou toute adresse en domaine réservé.",
    gravite: "urgent",
    module: "lib/seed.ts",
  },
  {
    id: "plafond-decret",
    symptome: "Une cible reçoit plus de 4 sollicitations sur 30 jours glissants.",
    pourquoiInvisible:
      "Chaque appel pris isolément est légitime. C'est le CUMUL qui dépasse, et personne ne compte de tête sur trente jours. La liste terrain est mêlée B2B/B2C, et c'est nous qui portons le risque.",
    detection: "`plafondRappels` arbitre, mais il ne mord que sur les cibles sans SIREN — c'est un filet, pas une mesure.",
    gravite: "urgent",
    module: "lib/call-cadence.ts",
  },
  {
    id: "compte-sans-session",
    symptome: "Un visiteur lit « compte suspendu, régularise » alors qu'il vient d'arriver.",
    pourquoiInvisible:
      "Le serveur a raison : sans session il rend `statut: \"suspendu\"`, qui est son discriminant interne. C'est l'ÉCRAN qui lisait ce discriminant comme une phrase adressée à un humain. Une valeur, deux sens.",
    detection: "Ouvrir l'application en navigation privée et lire le premier écran.",
    gravite: "urgent",
    module: "lib/use-droits.ts",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MACRO — ce qui demande attention MAINTENANT.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qu'Alpha CEO sait de l'installation, à un instant donné. */
export interface EtatSysteme {
  /**
   * L'enveloppe d'ouverture — CE QUE LES ESSAIS NOUS ONT DÉJÀ COÛTÉ.
   *
   * ⚠⚠ DEUX `null`, DEUX SENS, et il faut les tenir séparés.
   *  · le champ à `null` : la sonde n'est pas revenue (comme `sante`) ;
   *  · `enveloppe.niveau` à `null` : elle est revenue et n'a PAS su lire la
   *    somme — base injoignable, service role absent.
   * Les deux mènent à un angle mort, aucun ne déclenche d'alerte. Une console
   * qui crierait « enveloppe pleine » parce qu'elle n'a rien lu serait le
   * moniteur qui affiche du calme, à l'envers.
   */
  enveloppe: EtatEnveloppe | null;

  /** `null` = on n'a pas regardé. Distinct de `false`. */
  smtpConfigure: boolean | null;
  prixStripeConfigures: boolean | null;
  /** Niveau rendu par `analyseStorage`, ou `null` si non mesuré. */
  stockage: "ok" | "surveiller" | "critique" | "sature" | null;
  /** Le pipe serveur est-il chargé ? `null` si le mode n'est pas actif. */
  pipeSynchronisable: boolean | null;
  /** Nombre de brouillons en attente de relecture. */
  brouillonsEnAttente: number;
  /** Fiches sans prochaine action datée. */
  fichesSansProchaineAction: number;
  /** Un palier de campagne attend-il une validation ? */
  palierEnAttente: boolean;
  /**
   * L'autopilote, tel que le SERVEUR le connaît. `null` = pas regardé.
   *
   * ⚠ Trois états, et aucun n'est « en panne » : armé (les appels partent),
   * simulation (il calcule et n'appelle personne — voulu), non-configuré (il
   * ne tourne pas du tout). Les confondre fait chercher un bug là où il n'y a
   * qu'un réglage jamais posé.
   */
  autopilote: "arme" | "simulation" | "non-configure" | null;
  /**
   * L'agent vocal bat-il ? `null` = la sonde n'a pas répondu.
   *
   * ⚠ `agent-absent` était une panne DÉCRITE et non SURVEILLÉE — elle portait
   * sa détection en toutes lettres (« `GET /api/voice/presence` → `etat` vaut
   * `silencieux` ou `inconnu` alors que l'autopilote est armé ») et rien ne la
   * posait. C'est la panne la plus chère du relevé : le cron compose, le
   * prospect décroche, personne ne parle, et les journaux restent verts.
   */
  agentVocal: "vivant" | "silencieux" | "inconnu" | null;
  /**
   * Combien de fiches ont atteint le plafond du décret n° 2022-1313.
   *
   * ⚠ `null` = non mesuré, `0` = mesuré et aucune. Les confondre ferait lire
   * « aucune fiche au plafond » sur une absence de mesure, ce qui est
   * exactement le risque qu'on porte.
   */
  ciblesAuPlafond: number | null;
}

export interface Alerte {
  /** L'id du point ou de la panne concerné — le micro s'ouvre dessus. */
  id: string;
  quoi: string;
  gravite: Gravite;
  /** L'action, formulée à l'impératif. Une alerte sans verbe ne se traite pas. */
  action: string;
  /** Où aller. */
  ecran: string;
  /**
   * Cette alerte demande-t-elle une DÉCISION humaine qu'Alpha CEO ne prendra
   * jamais ? L'écran doit le montrer : sinon on attend qu'il agisse.
   */
  humain: boolean;
}

const parId = <T extends { id: string }>(liste: T[], id: string): T | undefined => liste.find((x) => x.id === id);

/**
 * Le diagnostic macro.
 *
 * ⚠ `null` NE PRODUIT AUCUNE ALERTE, et c'est la règle la plus importante de
 * cette fonction. « Je n'ai pas regardé » n'est pas « tout va bien », mais ce
 * n'est pas non plus une panne : inventer une alerte sur une absence de
 * mesure remplirait l'écran de rouge le premier jour, et on apprendrait à ne
 * plus le lire. L'angle mort se DIT ailleurs (`anglesMorts`), il ne
 * s'alarme pas.
 */
export function diagnostiquer(etat: EtatSysteme): Alerte[] {
  const out: Alerte[] = [];
  const pousser = (source: PointCEO | PanneCEO | undefined, action: string, humain = false) => {
    if (!source) return;
    out.push({
      id: source.id,
      quoi: "quoi" in source ? source.quoi : source.symptome,
      gravite: source.gravite,
      action,
      ecran: "ecran" in source ? source.ecran : "/controle",
      humain,
    });
  };

  /**
   * ⚠ DEUX NIVEAUX, DEUX GESTES — et « bientôt pleine » est le seul utile.
   * À l'épuisement, les essais suivants sont DÉJÀ dégradés et les comptes
   * concernés déjà partis avec une mauvaise première impression. L'alerte ne
   * sert que là où l'on peut encore décider, d'où `humain: true` : relever
   * l'enveloppe, pousser le BYOK ou assumer la fermeture est un arbitrage,
   * pas une tâche.
   */
  if (etat.enveloppe?.niveau === "pleine" || etat.enveloppe?.niveau === "bientot-pleine") {
    pousser(parId(PANNES, "enveloppe-ouverture-pleine"), etat.enveloppe.phrase, true);
  }

  if (etat.smtpConfigure === false) {
    pousser(parId(PANNES, "smtp-absent"), "Branche un SMTP personnalisé : sans lui, aucune inscription n'aboutit.");
  }
  if (etat.prixStripeConfigures === false) {
    pousser(parId(PANNES, "prix-stripe-absent"), "Renseigne les variables STRIPE_PRICE_* : le bouton payer tombe dans le vide.");
  }
  if (etat.stockage === "critique" || etat.stockage === "sature") {
    pousser(parId(PANNES, "stockage-sature"), "Le stockage local sature : passe le pipe sur le serveur ou allège avant de perdre des fiches.");
  }
  if (etat.pipeSynchronisable === false) {
    pousser(parId(PANNES, "pipe-non-charge"), "Le pipe n'est pas chargé : ne synchronise pas, recharge d'abord.");
  }
  if (etat.brouillonsEnAttente > 0) {
    pousser(
      parId(POINTS, "relecture-avant-envoi"),
      `${etat.brouillonsEnAttente} brouillon(s) attendent ta relecture.`,
      true
    );
  }
  /**
   * ⚠ « NON CONFIGURÉ » N'EST PAS UNE PANNE, ET POURTANT ÇA S'ALERTE.
   *
   * C'est la nuance de ce module : rien n'est cassé, tout est écrit, testé,
   * verrouillé — et il ne se passe rien, parce que personne n'a posé le
   * déclencheur. Aucune erreur nulle part. C'est précisément le genre de trou
   * qu'Alpha CEO existe pour nommer.
   */
  if (etat.autopilote === "non-configure") {
    pousser(
      parId(PANNES, "ordonnanceur-muet"),
      "Applique la migration 004 et pose CRON_SECRET : sans ordonnanceur, l'autopilote ne tourne jamais."
    );
  }
  if (etat.autopilote === "simulation") {
    pousser(
      parId(PANNES, "autopilote-en-simulation"),
      "L'autopilote calcule et n'appelle personne. Pose CAMPAIGN_AUTOPILOT=on quand tu veux qu'il parte — c'est un geste délibéré, et il doit le rester.",
      true
    );
  }
  /**
   * ⚠⚠ L'AGENT ABSENT NE SE SIGNALE QUE SI L'AUTOPILOTE EST ARMÉ, et la
   * condition est la moitié de la sonde.
   *
   * Un agent éteint pendant que rien ne compose n'est pas une panne : c'est
   * un poste de travail fermé, l'état normal la nuit et le week-end. Alerter
   * dessus remplirait l'écran de rouge en permanence, et on apprendrait à ne
   * plus le lire — donc à rater le jour où ça compte.
   *
   * Ce qui est une panne, c'est le CROISEMENT : la machine a le droit de
   * composer ET personne n'écoute. Là, chaque appel brûle une fiche, un
   * numéro, et des minutes facturées, pendant que tout répond 200.
   */
  if (etat.autopilote === "arme" && (etat.agentVocal === "silencieux" || etat.agentVocal === "inconnu")) {
    pousser(
      parId(PANNES, "agent-absent"),
      etat.agentVocal === "inconnu"
        ? "Aucun agent vocal ne s'est jamais annoncé alors que l'autopilote est ARMÉ : lance l'agent, ou désarme."
        : "L'agent vocal ne bat plus alors que l'autopilote est ARMÉ : chaque appel composé sonne dans le vide."
    );
  }

  /**
   * ⚠ Le plafond du décret est un RISQUE JURIDIQUE, pas une métrique. Il se
   * signale dès la première fiche concernée : « seulement deux » n'existe pas
   * quand c'est nous qui portons le risque sur une liste mêlée B2B/B2C.
   */
  if (etat.ciblesAuPlafond !== null && etat.ciblesAuPlafond > 0) {
    pousser(
      parId(PANNES, "plafond-decret"),
      `${etat.ciblesAuPlafond} fiche(s) ont atteint 4 sollicitations sur 30 jours glissants — ne les recontacte pas avant que la fenêtre glisse.`
    );
  }

  if (etat.palierEnAttente) {
    pousser(parId(POINTS, "validation-palier"), "Un palier de campagne attend TA validation — elle ne se prend jamais toute seule.", true);
  }
  if (etat.fichesSansProchaineAction > 0) {
    pousser(
      parId(POINTS, "prochaine-action"),
      `${etat.fichesSansProchaineAction} fiche(s) sans prochaine action datée — Alpha peut les proposer.`
    );
  }

  /**
   * ⚠ L'URGENT D'ABORD, ET L'ORDRE EST LA MOITIÉ DU PRODUIT. Une liste
   * d'alertes non triée se lit dans l'ordre d'écriture du code, donc au
   * hasard. Celui qui la parcourt traite ce qui est en haut : si le haut
   * n'est pas le plus coûteux, l'écran fait perdre du temps au lieu d'en
   * gagner.
   */
  const rang: Record<Gravite, number> = { urgent: 0, "a-traiter": 1, info: 2 };
  return out.sort((a, b) => rang[a.gravite] - rang[b.gravite]);
}

/**
 * Ce qu'on N'A PAS REGARDÉ — dit séparément des alertes.
 *
 * ⚠ Un angle mort n'est pas une panne, et le confondre avec une alerte est
 * le meilleur moyen de rendre l'écran illisible. Mais le TAIRE serait pire :
 * un tableau de bord tout vert qui n'a rien mesuré ment plus qu'un tableau
 * rouge. Zéro donnée → zéro chiffre, et l'angle mort se DIT.
 */
export function anglesMorts(etat: EtatSysteme): string[] {
  const out: string[] = [];
  if (etat.smtpConfigure === null) out.push("On ne sait pas si le SMTP délivre — donc pas si les inscriptions aboutissent.");
  if (etat.prixStripeConfigures === null) out.push("On ne sait pas si les prix Stripe sont branchés.");
  if (etat.stockage === null) out.push("Le stockage local n'a pas été mesuré.");
  if (etat.pipeSynchronisable === null) out.push("Le mode pipe serveur n'est pas actif, ou son état n'a pas été lu.");
  if (etat.autopilote === null) out.push("On ne sait pas si l'autopilote tourne — donc pas si la machine appelle.");
  if (etat.agentVocal === null) out.push("On ne sait pas si l'agent vocal écoute — donc pas si un appel composé aboutirait à une voix.");
  if (etat.ciblesAuPlafond === null) out.push("Les sollicitations sur 30 jours glissants n'ont pas été comptées (décret n° 2022-1313).");
  if (etat.enveloppe === null || etat.enveloppe.niveau === null)
    out.push("On ne sait pas où en est l'enveloppe d'ouverture — donc pas si les nouveaux essais partent déjà dégradés.");

  return out;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PANNES QU'AUCUNE SONDE NE PEUT VOIR — dites, et rangées À PART.
 *
 * ⚠ POURQUOI CE N'EST PAS DANS `anglesMorts`. J'ai d'abord poussé cette
 * information dans la liste des angles morts, et un test existant l'a
 * refusée : `anglesMorts` répond à « qu'est-ce que je n'ai pas regardé
 * AUJOURD'HUI ? » — une liste qui se vide quand les sondes répondent. Y
 * ajouter une entrée qui ne se referme JAMAIS en fait un fond permanent, et
 * une liste qui ne descend jamais à zéro est une liste qu'on cesse de lire.
 * C'est la même règle que « les dossiers ouverts ne portent aucun blocage,
 * sinon l'écran devient un mur rouge que personne ne lit ».
 *
 * Ces cinq-là ne manquent pas d'une sonde qu'on aurait oublié d'écrire :
 * elles n'ont **aucun signal lisible depuis l'application**. Fabriquer une
 * sonde qui n'observe rien serait pire que l'absence — un voyant vert sur une
 * question jamais posée.
 *
 * Chacune porte SA raison : un angle mort sans motif se fait refermer au
 * hasard par la session suivante, qui croit finir le travail.
 * ─────────────────────────────────────────────────────────────────────
 */
export const SANS_SONDE_POSSIBLE: { id: string; pourquoi: string; commentVerifier: string }[] = [
  {
    id: "spf-casse",
    pourquoi: "C'est du DNS : il ne se lit pas depuis l'application, et une réponse mise en cache mentirait des heures.",
    commentVerifier: "Un contrôle DNS externe sur le domaine d'envoi, à la main.",
  },
  {
    id: "migration-absente",
    pourquoi:
      "La base ne le dit qu'au moment précis où on en a besoin (« colonne inconnue »). Le sonder demanderait d'interroger `information_schema` à chaque chargement d'écran.",
    commentVerifier: "Les requêtes de vérification en pied de chaque fichier de migration.",
  },
  {
    id: "module-mort",
    pourquoi: "C'est de l'analyse STATIQUE — qui importe quoi — et pas un état d'exécution. Sa place est un test, pas un diagnostic.",
    commentVerifier: "`tests/` — un export que rien n'importe est mort, et ça se voit à la compilation, pas à l'écran.",
  },
  {
    id: "fiche-demo-envoyee",
    pourquoi: "Elle se PRÉVIENT à l'envoi (`/api/send` refuse une adresse de démonstration). La constater après coup ne rattrape rien.",
    commentVerifier: "La garde d'envoi, et son test.",
  },
  {
    id: "compte-sans-session",
    pourquoi:
      "Sa propre `detection` dit « ouvrir l'application en navigation privée et lire le premier écran ». L'inventer en sonde reviendrait à se demander à soi-même ce qu'un inconnu voit.",
    commentVerifier: "Une fenêtre de navigation privée, sur l'URL de production.",
  },
];

/**
 * Le relevé par nature — pour l'écran macro qui montre ce qui PEUT bouger.
 *
 * ⚠ C'est la vue qui répond à la demande initiale (« automatiser au max »)
 * sans la trahir : elle montre que la majorité des points humains restants ne
 * sont pas un retard, mais une décision ou une contrainte.
 */
export function parNature(nature: NaturePoint): PointCEO[] {
  return POINTS.filter((p) => p.nature === nature);
}
