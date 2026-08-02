/**
 * ─────────────────────────────────────────────────────────────────────
 * Guides contextuels — un par page. Le rôle de l'écran, comment bien
 * s'en servir, et le réflexe doctrine à retenir. Affichés par
 * <PageGuide/> : carte-coach au premier passage, bouton « ? » ensuite.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface PageGuide {
  /** Préfixe de pathname ("/" = exact). Le plus long préfixe gagne. */
  path: string;
  title: string;
  /** Le rôle de la page en une ou deux phrases. */
  role: string;
  /** Comment l'utiliser, dans l'ordre. */
  steps: string[];
  /** Le réflexe doctrine à retenir. */
  tip: string;
}

export const PAGE_GUIDES: PageGuide[] = [
  {
    path: "/",
    title: "Dashboard — ton cockpit",
    role: "La journée commence ici : les 4 vitaux (MRR, pipe pondéré, Taxe d'Ignorance, commission) et surtout les Routines — la liste exacte de ce qui fait avancer le pipe aujourd'hui.",
    steps: [
      "Lis les 4 vitaux : si la Taxe d'Ignorance monte, il y a de l'argent à aller chercher.",
      "Déroule les Routines de haut en bas — chaque ligne est cliquable et t'amène à l'action.",
      "Termine par le funnel : où ça coince entre deux étapes ? C'est là que tu travailles.",
    ],
    tip: "Si ce n'est pas dans les Routines, ce n'est pas prioritaire aujourd'hui.",
  },
  {
    path: "/demarrage",
    title: "Prise en main — le chemin, dans l'ordre",
    role: "La réponse à « je fais quoi maintenant ? ». Seize étapes en quatre phases — brancher, charger, lancer, tenir — dont la plupart se cochent toutes seules à partir de tes vraies données.",
    steps: [
      "Lis l'encadré du haut : c'est la seule chose à faire maintenant. Le bouton t'y emmène.",
      "Fais-la, reviens, clique « Réévaluer ». L'étape suivante s'ouvre d'elle-même.",
      "N'ouvre pas la phase suivante avant d'avoir fini la précédente : l'ordre est ce qui rend la suite possible.",
    ],
    tip: "Une case qu'on coche soi-même ment ; un compteur de fiches ne ment pas. Si une étape reste rouge alors que tu l'as faite, c'est la donnée qui a raison.",
  },
  {
    path: "/pilote",
    title: "Pilote automatique — ce qui tourne, ce qui t'attend",
    role: "La réponse à « est-ce que ça tourne tout seul ? ». En haut : l'état des six organes autonomes. À droite : la file de décision, chiffrée en minutes — tes 20 % humains.",
    steps: [
      "Regarde le verdict : tous les organes au vert = tout ce qui peut être autonome l'est.",
      "Vide la file de décision de haut en bas — chaque ligne t'emmène au bon endroit.",
      "Un organe rouge ? La cause est écrite en clair : corrige-la dans Réglages.",
    ],
    tip: "Objectif : moins de 45 minutes de décision par jour. Au-delà de 90, la file s'est accumulée — traite d'abord les urgentes.",
  },
  {
    path: "/pipeline",
    title: "Pipeline — la vérité du deal flow",
    role: "Toutes tes fiches, par étape du cycle. Une carte = un deal ; sa colonne = où il en est VRAIMENT (pas où tu aimerais qu'il soit).",
    steps: [
      "Glisse les cartes d'étape en étape quand la réalité change — jamais avant.",
      "Red Zone = une objection est posée : traite-la avant tout nouveau contact.",
      "Ouvre une carte pour la fiche complète (audit, croyances, historique).",
    ],
    tip: "Chaque carte doit porter un next step DATÉ. Une carte sans date est un deal qui meurt.",
  },
  {
    path: "/closer",
    title: "Closer OS — ton compagnon terrain",
    role: "Pensé pour le téléphone, dans la rue : la tournée du jour (tes RDV dans l'ordre), le brief tactique, et à un tap le Mode Closing ou le Sparring.",
    steps: [
      "Onglet Tournée : suis l'ordre horaire, « Y aller » ouvre Maps, déplie une étape pour son contexte.",
      "Avant un RDV chaud : Sparring (l'IA joue le prospect) puis Mode Closing pendant le RDV.",
      "Onglet Priorités : qui closer en premier quand tu as du temps libre — trié par chaleur.",
    ],
    tip: "Garde ton énergie pour LE closing du jour : valeur × chaleur, le brief te le nomme.",
  },
  {
    path: "/appels",
    title: "Session d'appels — la liste du matin",
    role: "Une verticale à la fois : son script terrain (ouverture, diagnostic, miroir, interdits, Red Zone) et les prospects à appeler, chacun avec SON angle — la raison de l'appeler lui, maintenant.",
    steps: [
      "Choisis la verticale : on n'alterne pas les métiers dans une même session, la voix se cale sur un seul registre.",
      "Relis le script une fois en haut de session, puis descends la liste : les prioritaires sont déjà en tête.",
      "Après chaque appel, clique le statut — la touche est consignée et le next step daté posé automatiquement.",
    ],
    tip: "Le critère, jamais le volume. Et deux questions de diagnostic, puis tu te tais : le silence fait le travail.",
  },
  {
    path: "/newsletter",
    title: "Newsletter — le moteur du « tout le temps »",
    role: "Une lettre régulière qui apporte une observation de terrain et ne vend rien. Son seul appel à l'action : « voulez-vous l'audit de votre accueil ? ». C'est elle qui fabrique le flux d'entrée.",
    steps: [
      "Choisis l'audience (secteur, ville) — tu vois le nombre exact de destinataires.",
      "Écris l'observation, pas l'argumentaire. « Aperçu réel » montre le rendu final et le score anti-spam.",
      "Confirme : tu relis la liste complète avant que quoi que ce soit ne parte.",
    ],
    tip: "L'audit ne part jamais avec la lettre. Il s'envoie depuis la fiche, après un « oui » — c'est ce qui en fait un cadeau.",
  },
  {
    path: "/linkedin",
    title: "Machine LinkedIn — assistée, jamais automatisée",
    role: "La séquence de la campagne : invitation, puis message deux jours après, puis relance. L'app prépare le texte et ouvre le bon profil ; c'est toi qui colles et envoies — donc zéro risque de restriction.",
    steps: [
      "Règle le périmètre (ville / arrondissement) : une campagne = un territoire.",
      "« Copier + ouvrir » : le message est dans le presse-papier, LinkedIn s'ouvre, la touche est consignée.",
      "Relis avant d'envoyer — surtout le prénom. Puis arrête-toi au quota du jour.",
    ],
    tip: "L'audit ne part jamais d'office : il s'envoie quand la personne a dit oui. C'est ça, la différence avec du spam.",
  },
  {
    path: "/agent",
    title: "Agent ALPHA — ton copilote IA",
    role: "Il lit tout ton pipe et répond : scripts, résumés, prochaine action, traitement d'objection. IA locale (Ollama) d'abord, gratuite.",
    steps: [
      "Pose une question précise (« que faire sur Fabre ? ») ou utilise les actions rapides.",
      "Tout ce qu'il produit est un BROUILLON : relis, ajuste, puis envoie toi-même.",
    ],
    tip: "L'IA ne parle jamais à un prospect à ta place — elle prépare, TU décides.",
  },
  {
    path: "/templates",
    title: "Templates — la bibliothèque de scripts",
    role: "Tes messages types par canal et par étape, variables incluses. « Copier » copie le TEXTE brut (WhatsApp, LinkedIn, appels).",
    steps: [
      "Choisis le template par étape du cycle — pas par envie du moment.",
      "Pour un email : passe par la FICHE prospect → il part habillé (DA, tracking, RGPD) automatiquement.",
      "Adapte toujours 1–2 détails au prospect : un template pur sent le template.",
    ],
    tip: "Compose où tu veux, mais ENVOIE depuis l'app — sinon ni tracking ni DA ni pied RGPD.",
  },
  {
    path: "/campaigns",
    title: "Campagnes — l'envoi par lot, sous contrôle",
    role: "Des brouillons générés en masse, mais RIEN ne part sans ta relecture message par message. Quotas anti-spam intégrés.",
    steps: [
      "Crée la campagne sur un segment précis (secteur + ville, pas « tout le monde »).",
      "Relis CHAQUE brouillon — corrige ou écarte, puis valide l'envoi.",
      "Suis ouvertures/clics ici ; les réponses arrivent dans l'Activité et la fiche.",
    ],
    tip: "40 emails/heure max au début : la réputation d'envoi se chauffe, elle ne se force pas.",
  },
  {
    path: "/kpis",
    title: "KPIs — les taux qui disent la vérité",
    role: "Les taux de passage entre étapes, la confiance par étape, l'efficacité de conversation. C'est ici qu'on voit si la machine convertit.",
    steps: [
      "Regarde les TAUX plus que les volumes : 100 contacts → combien d'audits ?",
      "Un taux qui chute entre deux étapes = le script ou le ciblage de cette étape à revoir.",
    ],
    tip: "L'efficacité de conversation bat le volume : mieux vaut 10 vraies conversations que 100 envois muets.",
  },
  {
    path: "/milestones",
    title: "Jalons — 10, 100, 1 000, 10 000…",
    role: "La progression du pipe en paliers. Chaque palier débloque le suivant : le pipeline est une boucle infinie, jamais un stock qui s'épuise.",
    steps: [
      "Vise le prochain palier, pas le sommet — 10 avant 100, toujours.",
      "Un « STOP » libère une place : remplace-le par une cible de niveau supérieur.",
    ],
    tip: "Un client signé redevient un prospect — pour l'upsell. La boucle ne s'arrête jamais.",
  },
  {
    path: "/preuves",
    title: "Salle des Preuves — la valeur, démontrée",
    role: "Tout ce que l'OS a réellement produit, en euros : CA encaissé, Taxe d'Ignorance rendue aux clients, commission, closing. Extrait du CRM — jamais projeté, jamais inventé.",
    steps: [
      "Ouvre cette page avant chaque post, RDV important ou négociation : tes arguments sont là.",
      "« Carte de preuve publique » : un document anonymisé prêt à capturer pour LinkedIn/X.",
      "Après chaque livraison réussie : demande le témoignage — il apparaît ici.",
    ],
    tip: "La preuve bat la promesse. Un chiffre daté issu du CRM vaut dix slogans.",
  },
  {
    path: "/offre",
    title: "Offre & Tarifs — la grille et la calculatrice",
    role: "Ta grille : setup variable selon la taille + commission sur les ventes apportées. La calculatrice chiffre l'offre face à la Taxe d'Ignorance.",
    steps: [
      "Calibre le setup sur la taille de l'entreprise — la grille te guide.",
      "Compare TOUJOURS l'offre à la taxe mensuelle du prospect : l'écart fait le oui.",
    ],
    tip: "Jamais de prix par écrit avant la démo mobile. L'émotion d'abord, le chiffre ensuite.",
  },
  {
    path: "/meetings",
    title: "Rendez-vous — un RDV, un objectif",
    role: "Chaque RDV a un objectif d'étape UNIQUE (audit, démo, closing, suivi). Pas d'objectif clair = pas de RDV.",
    steps: [
      "Crée le RDV depuis la fiche avec le bon type — il nourrit la tournée du Closer OS.",
      "Confirme sous 48 h (la routine te le rappelle), débriefe DANS l'app juste après.",
    ],
    tip: "Un RDV sans next step daté à la fin n'a pas eu lieu. Consigne-le à chaud.",
  },
  {
    path: "/nurture",
    title: "Relances — les perdus ne sont pas morts",
    role: "Séquences de réactivation : perdus 90 jours, silencieux, anciens clients. Le pipe se nourrit aussi de son passé.",
    steps: [
      "Active une séquence par audience — chaque étape a son message et son délai.",
      "Une réponse = retour immédiat dans le pipe actif, la séquence s'arrête.",
    ],
    tip: "« Non » veut souvent dire « pas maintenant ». 90 jours plus tard, le contexte a changé.",
  },
  {
    path: "/intel",
    title: "Concurrents — savoir contre qui tu joues",
    role: "Fiches concurrents et contre-arguments. Pour répondre à « j'ai déjà quelqu'un » sans jamais dénigrer.",
    steps: [
      "Renseigne les concurrents rencontrés sur le terrain, avec leurs vrais points forts.",
      "Prépare le contre-argument CHIFFRÉ, pas la critique.",
    ],
    tip: "On ne dénigre jamais : on chiffre l'écart et on laisse le prospect conclure.",
  },
  {
    path: "/activity",
    title: "Activité — le journal de bord",
    role: "Tout ce qui s'est passé, horodaté : envois, réponses, changements d'étape, actions IA. Ta mémoire et ta preuve.",
    steps: [
      "Reviens ici quand tu as un doute (« on en est où avec X ? »).",
      "Les réponses entrantes y atterrissent — traite-les le jour même.",
    ],
    tip: "Le CRM fait foi : si ce n'est pas consigné, ce n'est pas arrivé.",
  },
  {
    path: "/recette",
    title: "Recette — le test bout-en-bout",
    role: "Le banc d'essai : tu t'ajoutes en prospect, tu t'envoies la boucle complète (envoi → ouverture → clic → réponse → STOP) jusqu'au GOOD TO GO.",
    steps: [
      "Déroule les étapes dans l'ordre — chaque signal se détecte automatiquement.",
      "Rejoue la Recette après tout changement d'infra (SMTP, Vercel, n8n).",
    ],
    tip: "On ne prospecte jamais sur une boucle non testée. GOOD TO GO d'abord.",
  },
  {
    path: "/settings",
    title: "Réglages — la salle des machines",
    role: "Connexions (n8n, Sheets, Supabase), envoi, sécurité (PIN local), import/export, et l'assistant d'installation relançable.",
    steps: [
      "Statuts au vert = boucle fermée ; un rouge → l'assistant te guide pour réparer.",
      "Le PIN local protège un laptop ouvert — note-le quelque part.",
    ],
    tip: "Tes secrets restent dans .env.local, sur TA machine. Jamais ailleurs.",
  },
  {
    path: "/prospects/",
    title: "La fiche — le dossier de vente complet",
    role: "Tout le deal en un écran : audit (la Taxe d'Ignorance), croyances, objections, historique, templates contextualisés et barre d'envoi trackée.",
    steps: [
      "Commence par l'onglet Audit : importe une recherche (Perplexity ou autre) ou remplis à la main — la taxe se calcule.",
      "Les 3 Croyances à 10/10 avant de signer — la doctrine te bloquera sinon.",
      "Envoie DEPUIS la fiche : l'email part habillé, tracké, avec l'audit cadeau joignable.",
    ],
    tip: "L'audit n'est pas un argument, c'est un CADEAU. La générosité ouvre la conversation.",
  },
];

/** Le guide de la page courante — plus long préfixe gagnant, "/" = exact. */
export function guideFor(pathname: string): PageGuide | null {
  let best: PageGuide | null = null;
  for (const g of PAGE_GUIDES) {
    const match = g.path === "/" ? pathname === "/" : pathname.startsWith(g.path);
    if (match && (!best || g.path.length > best.path.length)) best = g;
  }
  return best;
}
