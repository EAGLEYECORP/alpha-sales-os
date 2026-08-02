import type { Meeting, Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * La prise en main — pas à pas, dans l'ordre, sans rien deviner.
 *
 * ALPHA a déjà trois couches d'onboarding : l'assistant qui BRANCHE, la
 * recette qui PROUVE, la visite guidée qui MONTRE. Il manquait la
 * quatrième, la seule qui dure : un chemin qui sait OÙ TU EN ES et qui
 * te dit la prochaine action — jour après jour, jusqu'au premier signé.
 *
 * Principe de conception : le plus d'étapes possible sont VÉRIFIÉES par
 * l'app, pas cochées à la main. Une case qu'on coche soi-même ment ; un
 * compteur de fiches, un événement email dans le CRM, un enregistrement
 * DNS publié — ça ne ment pas. Les étapes qui restent manuelles sont
 * celles qu'aucune donnée ne peut attester, et elles sont marquées.
 *
 * L'ordre n'est pas cosmétique : brancher avant de charger, charger
 * avant d'envoyer, envoyer avant de tenir le rythme. Chaque phase rend
 * la suivante possible. Sauter une phase, c'est faire du volume dans le
 * vide.
 * ─────────────────────────────────────────────────────────────────────
 */

export type PhaseId = "brancher" | "charger" | "lancer" | "tenir";

export interface Phase {
  id: PhaseId;
  title: string;
  /** Ce que cette phase produit — pas ce qu'elle contient. */
  outcome: string;
  /** Combien de temps ça prend, honnêtement. */
  duration: string;
}

export const PHASES: Phase[] = [
  {
    id: "brancher",
    title: "1 · Brancher",
    outcome: "La machine peut envoyer, écrire, recevoir. Rien ne part encore.",
    duration: "environ 1 h, une seule fois",
  },
  {
    id: "charger",
    title: "2 · Charger",
    outcome: "Du carburant dans le réservoir. C'est ici que tout se joue.",
    duration: "2 à 4 h, la partie la plus rentable de ton installation",
  },
  {
    id: "lancer",
    title: "3 · Lancer",
    outcome: "Les premières touches partent, sur les trois canaux.",
    duration: "la première semaine",
  },
  {
    id: "tenir",
    title: "4 · Tenir",
    outcome: "Le rythme s'installe. C'est la seule phase qui signe.",
    duration: "tous les jours, indéfiniment",
  },
];

export interface StepDef {
  id: string;
  phase: PhaseId;
  title: string;
  /** Pourquoi cette étape existe — la conséquence de ne pas la faire. */
  why: string;
  /** Les gestes exacts, dans l'ordre. */
  how: string[];
  href?: string;
  hrefLabel?: string;
  /** Estimation honnête, en minutes. */
  minutes: number;
  /**
   * false = ALPHA ne peut pas le vérifier, tu coches toi-même.
   * On le dit à l'écran : une case manuelle vaut ce que vaut ta rigueur.
   */
  auto: boolean;
}

export const STEPS: StepDef[] = [
  // ── 1. BRANCHER ──────────────────────────────────────────────────
  {
    id: "smtp",
    phase: "brancher",
    title: "Brancher l'envoi email",
    why: "Sans SMTP, aucun email ne peut partir. C'est le seul organe sans lequel rien d'autre ne sert.",
    how: [
      "Réglages → copie le modèle .env, colle-le dans .env.local.",
      "Remplis SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.",
      "Redémarre l'app. L'organe « Envoi email » doit passer au vert dans le Pilote.",
    ],
    href: "/settings",
    hrefLabel: "Ouvrir Réglages",
    minutes: 15,
    auto: true,
  },
  {
    id: "dns",
    phase: "brancher",
    title: "Publier SPF, DKIM et DMARC",
    why: "Sans ces enregistrements, les mails partent mais n'arrivent pas — et aucune alerte ne remonte. Tu croirais que le message est mauvais alors que personne ne l'a reçu.",
    how: [
      "Réglages → Délivrabilité du domaine → lis le verdict.",
      "Copie l'enregistrement proposé, publie-le chez ton registrar (OVH, Gandi, Cloudflare).",
      "Reviens, clique « Vérifier ». La propagation prend de quelques minutes à quelques heures.",
    ],
    href: "/settings",
    hrefLabel: "Voir la délivrabilité",
    minutes: 20,
    auto: true,
  },
  {
    id: "ia",
    phase: "brancher",
    title: "Brancher l'IA locale",
    why: "Sans IA, l'app bascule sur des templates hors-ligne : ça marche, mais tu perds la personnalisation par fiche — donc l'essentiel de l'avantage.",
    how: [
      "Installe Ollama, puis : ollama pull qwen2.5:3b",
      "Dans .env.local : OLLAMA_URL=http://localhost:11434 et OLLAMA_MODEL=qwen2.5:3b",
      "Redémarre. Teste sur l'Agent ALPHA : pose-lui une question sur une fiche.",
    ],
    href: "/agent",
    hrefLabel: "Tester l'Agent",
    minutes: 20,
    auto: true,
  },
  {
    id: "n8n",
    phase: "brancher",
    title: "Connecter le cerveau n8n",
    why: "n8n fait tourner ce qui doit tourner sans toi : synchro CRM, réponses entrantes, remontée du tracking. Sans lui, les automatisations dorment et tu ressaisis à la main.",
    how: [
      "Lance n8n en local, importe les workflows du dossier integrations/.",
      "Réglages → Connexion n8n → colle l'URL du webhook → « Tester la connexion ».",
      "Puis « Récupérer mes prospects » pour vérifier que le Sheet remonte.",
    ],
    href: "/settings",
    hrefLabel: "Connecter n8n",
    minutes: 30,
    auto: true,
  },
  {
    id: "inbound",
    phase: "brancher",
    title: "Armer les réponses entrantes",
    why: "C'est ce qui capte les réponses et détecte les STOP automatiquement. Sans ça, un désabonnement peut être ignoré — c'est un risque légal, pas seulement une impolitesse.",
    how: [
      "Définis WEBHOOK_SECRET dans .env.local.",
      "Pointe ton fournisseur (ou n8n) sur POST /api/webhooks/inbound avec l'en-tête x-webhook-secret.",
      "Envoie-toi une réponse de test : elle doit apparaître dans la fiche.",
    ],
    href: "/settings",
    hrefLabel: "Voir le webhook",
    minutes: 15,
    auto: true,
  },
  {
    id: "booking",
    phase: "brancher",
    title: "Créer le lien de réservation",
    why: "C'est LA pièce qui donne des rendez-vous en autonomie : le prospect pose le créneau lui-même pendant que tu es sur le terrain. Sans lui, chaque RDV coûte un aller-retour.",
    how: [
      "Crée un lien Cal.com ou Calendly (15 min, « Audit express »).",
      "Réglages → Agence → Lien de réservation → colle-le.",
      "Il apparaît alors dans les emails, les messages LinkedIn et l'audit cadeau.",
    ],
    href: "/settings",
    hrefLabel: "Coller le lien",
    minutes: 15,
    auto: true,
  },
  {
    id: "offre",
    phase: "brancher",
    title: "Fixer ton offre et tes règles",
    why: "Les règles business sont injectées mot pour mot dans chaque génération. Si elles sont floues, tout ce que l'IA écrit sera flou.",
    how: [
      "Réglages → Agence : nom, closer, objectif MRR, commission.",
      "Relis les Règles business ligne par ligne — c'est ta doctrine, pas un texte d'exemple.",
      "Vérifie tes paliers dans Offre & Tarifs.",
    ],
    href: "/offre",
    hrefLabel: "Vérifier l'offre",
    minutes: 20,
    auto: false,
  },
  {
    id: "recette",
    phase: "brancher",
    title: "Passer la recette de bout en bout",
    why: "La recette prouve que la boucle tourne vraiment : envoi, tracking, réponse, écriture CRM. Tant qu'elle n'est pas passée, tu supposes — tu ne sais pas.",
    how: [
      "Ouvre Recette et déroule les contrôles dans l'ordre.",
      "Envoie-toi un vrai email de test et ouvre-le : le compteur d'ouverture doit bouger.",
      "Un contrôle rouge ? Sa cause est écrite en clair — corrige avant d'avancer.",
    ],
    href: "/recette",
    hrefLabel: "Lancer la recette",
    minutes: 30,
    auto: false,
  },

  // ── 2. CHARGER ───────────────────────────────────────────────────
  {
    id: "fuel",
    phase: "charger",
    title: "Charger 300 fiches minimum",
    why: "C'est le vrai goulot, et de loin. Avec 25 fiches, aucun taux n'est fiable et le meilleur outil du monde tourne à vide. Avec 300, la machine a de quoi travailler pendant un mois.",
    how: [
      "Cible un périmètre étroit : Lyon + une verticale (garages, auto-écoles, cabinets…).",
      "Réglages → Données réelles : importe un CSV, ou colle un lien Google Sheets.",
      "Minimum vital par fiche : nom, secteur, ville, téléphone. L'email peut venir après.",
    ],
    href: "/settings",
    hrefLabel: "Importer des fiches",
    minutes: 180,
    auto: true,
  },
  {
    id: "qualite",
    phase: "charger",
    title: "Nettoyer ce qui bloquerait l'envoi",
    why: "Une base sale brûle la réputation du domaine : chaque adresse morte est un rebond, et les rebonds comptent contre toi pour longtemps.",
    how: [
      "Pipeline → repère les fiches sans email ni téléphone : elles ne servent à rien.",
      "Supprime les doublons évidents et les adresses génériques douteuses.",
      "Le bandeau « info critique manquante » du Dashboard te donne la liste à compléter.",
    ],
    href: "/pipeline",
    hrefLabel: "Ouvrir le pipeline",
    minutes: 45,
    auto: false,
  },

  // ── 3. LANCER ────────────────────────────────────────────────────
  {
    id: "first-email",
    phase: "lancer",
    title: "Envoyer la première salve email",
    why: "Le premier envoi tracké est ce qui transforme l'installation en activité. Il valide la chaîne complète en conditions réelles.",
    how: [
      "Newsletter → choisis l'audience, relis le corps du message, prévisualise.",
      "Commence à 5 envois par jour la première semaine — la boîte n'est pas chauffée.",
      "Monte de 5 par semaine jusqu'à 40. Plus vite, tu grilles le domaine.",
    ],
    href: "/newsletter",
    hrefLabel: "Ouvrir la Newsletter",
    minutes: 30,
    auto: true,
  },
  {
    id: "first-call",
    phase: "lancer",
    title: "Tenir la première session d'appels",
    why: "L'appel est le canal qui signe. Le mail ouvre la porte, la voix la franchit — et chaque bouton de statut écrit directement dans le CRM.",
    how: [
      "Appels → choisis une verticale, déplie le script, lis l'angle par cible.",
      "Bloque 45 minutes sans interruption. 15 appels valent mieux que 40 bâclés.",
      "Après chaque appel : clique le statut. Aucun appel ne se termine sans prochaine étape datée.",
    ],
    href: "/appels",
    hrefLabel: "Ouvrir les Appels",
    minutes: 45,
    auto: true,
  },
  {
    id: "first-linkedin",
    phase: "lancer",
    title: "Lancer la machine LinkedIn",
    why: "LinkedIn touche ceux qui n'ouvrent pas leurs mails. Le quota de 25 actions par jour n'est pas une prudence excessive : au-delà, les comptes se font restreindre.",
    how: [
      "LinkedIn → filtre sur ton périmètre, la file se construit toute seule.",
      "« Copier + ouvrir » : le texte est dans le presse-papier, le profil s'ouvre. Colle, envoie.",
      "Invitation d'abord, message à J+2, relance à J+4. Jamais de lien dans l'invitation.",
    ],
    href: "/linkedin",
    hrefLabel: "Ouvrir LinkedIn",
    minutes: 30,
    auto: true,
  },
  {
    id: "first-meeting",
    phase: "lancer",
    title: "Décrocher le premier rendez-vous",
    why: "C'est la première preuve que la machine produit autre chose que de l'activité. Tout ce qui précède n'existe que pour ça.",
    how: [
      "Prépare-le dans Closer OS : score de chaleur, angle, itinéraire.",
      "Passe en Mode closing pendant l'entretien, garde le sparring d'objections à portée.",
      "Sors avec une prochaine étape datée. Toujours.",
    ],
    href: "/closer",
    hrefLabel: "Ouvrir le Closer OS",
    minutes: 60,
    auto: true,
  },

  // ── 4. TENIR ─────────────────────────────────────────────────────
  {
    id: "rythme",
    phase: "tenir",
    title: "Tenir le volume 5 jours de suite",
    why: "Un client demande 50 à 200 touches utiles. Cinq jours tenus, c'est ce qui sépare une machine d'une bonne intention. C'est aussi le seul moyen d'obtenir des chiffres qui veulent dire quelque chose.",
    how: [
      "Chaque matin : Pilote → Volume du jour. Il dit ce qui est exécutable, canal par canal.",
      "Vide la file de décision de haut en bas. Objectif : moins de 45 minutes.",
      "Le soir, ce qui n'est pas consigné n'existe pas. Consigne.",
    ],
    href: "/pilote",
    hrefLabel: "Ouvrir le Pilote",
    minutes: 90,
    auto: true,
  },
  {
    id: "premier-signe",
    phase: "tenir",
    title: "Signer le premier client",
    why: "Le premier signé change tout : il alimente la Salle des Preuves, et une preuve chiffrée vaut plus que n'importe quel argumentaire.",
    how: [
      "Pipeline → passe la fiche en « signé » quand l'argent est encaissé, pas quand la parole est donnée.",
      "Preuves → le chiffre apparaît. Il ne compte que l'encaissé.",
      "Demande le témoignage dans les 7 jours, pendant que le résultat est frais.",
    ],
    href: "/preuves",
    hrefLabel: "Voir les Preuves",
    minutes: 0,
    auto: true,
  },
];

/** Seuil de carburant en dessous duquel aucun taux n'est interprétable. */
export const FUEL_TARGET = 300;
/** Jours de rythme tenus qui valident la phase 4. */
export const RHYTHM_DAYS = 5;
/** Touches quotidiennes en dessous desquelles la journée ne compte pas. */
export const RHYTHM_MIN_TOUCHES = 20;

const TOUCH_KINDS = new Set(["appel", "visite", "email", "whatsapp", "linkedin", "demo", "meeting"]);

/** Jours distincts, dans les 14 derniers, où le volume a réellement été tenu. */
export function rhythmDays(prospects: Prospect[], now = new Date()): number {
  const floor = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const perDay = new Map<string, number>();
  for (const p of prospects) {
    for (const e of p.events) {
      const day = e.date.slice(0, 10);
      if (day >= floor && TOUCH_KINDS.has(e.kind)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
  }
  let n = 0;
  for (const count of perDay.values()) if (count >= RHYTHM_MIN_TOUCHES) n++;
  return n;
}

const hasEvent = (prospects: Prospect[], kind: string) =>
  prospects.some((p) => p.events.some((e) => e.kind === kind));

export interface PathContext {
  prospects: Prospect[];
  meetings: Meeting[];
  bookingUrl?: string;
  /** Capacités vues par le serveur (/api/health). null = pas encore chargé. */
  health: {
    email?: { configured?: boolean };
    ai?: { configured?: boolean };
    inboundWebhook?: { configured?: boolean };
  } | null;
  /** Verdict DNS (/api/deliverability/dns). null = pas encore chargé. */
  dns: { manquants: number; inconnus: number } | null;
  n8n: boolean;
  /** Étapes cochées à la main (celles qu'aucune donnée n'atteste). */
  manual: string[];
  now?: Date;
}

export interface PathStep extends StepDef {
  done: boolean;
  /** Ce que l'app constate — affiché tel quel, jamais inventé. */
  detail: string;
  /** Avancement 0–1 pour les étapes qui se comptent. */
  progress?: number;
}

export interface PathPhase extends Phase {
  steps: PathStep[];
  done: number;
  total: number;
}

export interface Path {
  phases: PathPhase[];
  done: number;
  total: number;
  /** La seule chose à faire maintenant. null = tout est fait. */
  next: PathStep | null;
  /**
   * Position de cette étape dans le chemin (1-based). Ce n'est PAS le
   * nombre d'étapes faites + 1 : on peut avoir coché des étapes tardives
   * (un appel consigné avant d'avoir branché le SMTP) et rester bloqué au
   * début. Annoncer « étape 4 » alors qu'on est à la première serait un
   * mensonge d'affichage.
   */
  nextIndex: number;
  /** Minutes restantes sur les étapes non faites. */
  minutesLeft: number;
}

/**
 * Évalue le chemin. Une étape auto n'est jamais « faite » tant que la
 * donnée qui l'atteste n'est pas chargée : on préfère afficher « en
 * attente » que d'annoncer un succès qu'on n'a pas constaté.
 */
export function buildPath(ctx: PathContext): Path {
  const { prospects, meetings, health, dns, n8n, manual } = ctx;
  const checked = new Set(manual);
  const fuel = prospects.length;
  const rhythm = rhythmDays(prospects, ctx.now);

  const evaluate = (s: StepDef): { done: boolean; detail: string; progress?: number } => {
    switch (s.id) {
      case "smtp":
        if (!health) return { done: false, detail: "état du serveur non chargé" };
        return health.email?.configured
          ? { done: true, detail: "SMTP configuré" }
          : { done: false, detail: "SMTP absent — rien ne peut partir" };
      case "dns":
        if (!dns) return { done: false, detail: "vérification DNS non chargée" };
        if (dns.inconnus > 0) return { done: false, detail: "vérification non concluante — relance-la" };
        return dns.manquants === 0
          ? { done: true, detail: "SPF, DMARC et MX en place" }
          : { done: false, detail: `${dns.manquants} enregistrement(s) DNS manquant(s)` };
      case "ia":
        if (!health) return { done: false, detail: "état du serveur non chargé" };
        return health.ai?.configured
          ? { done: true, detail: "modèle branché" }
          : { done: false, detail: "moteur de templates hors-ligne" };
      case "n8n":
        return n8n ? { done: true, detail: "n8n connecté" } : { done: false, detail: "non connecté" };
      case "inbound":
        if (!health) return { done: false, detail: "état du serveur non chargé" };
        return health.inboundWebhook?.configured
          ? { done: true, detail: "webhook armé" }
          : { done: false, detail: "WEBHOOK_SECRET absent" };
      case "booking":
        return ctx.bookingUrl?.trim()
          ? { done: true, detail: "lien de réservation en place" }
          : { done: false, detail: "aucun lien — pas de RDV en autonomie" };
      case "fuel":
        return {
          done: fuel >= FUEL_TARGET,
          detail: `${fuel} fiche${fuel > 1 ? "s" : ""} sur ${FUEL_TARGET}`,
          progress: Math.min(1, fuel / FUEL_TARGET),
        };
      case "first-email":
        return hasEvent(prospects, "email")
          ? { done: true, detail: "premier email consigné" }
          : { done: false, detail: "aucun email envoyé" };
      case "first-call":
        return hasEvent(prospects, "appel")
          ? { done: true, detail: "premiers appels consignés" }
          : { done: false, detail: "aucun appel consigné" };
      case "first-linkedin":
        return hasEvent(prospects, "linkedin")
          ? { done: true, detail: "première salve LinkedIn consignée" }
          : { done: false, detail: "aucune action LinkedIn" };
      case "first-meeting":
        return meetings.length > 0
          ? { done: true, detail: `${meetings.length} rendez-vous au calendrier` }
          : { done: false, detail: "aucun rendez-vous" };
      case "rythme":
        return {
          done: rhythm >= RHYTHM_DAYS,
          detail: `${rhythm} jour${rhythm > 1 ? "s" : ""} tenu${rhythm > 1 ? "s" : ""} sur ${RHYTHM_DAYS} (14 derniers jours, ≥ ${RHYTHM_MIN_TOUCHES} touches)`,
          progress: Math.min(1, rhythm / RHYTHM_DAYS),
        };
      case "premier-signe": {
        const signed = prospects.filter((p) => p.stage === "signe").length;
        return signed > 0
          ? { done: true, detail: `${signed} client${signed > 1 ? "s" : ""} signé${signed > 1 ? "s" : ""}` }
          : { done: false, detail: "aucun client signé" };
      }
      default:
        return checked.has(s.id)
          ? { done: true, detail: "coché à la main" }
          : { done: false, detail: "à cocher toi-même" };
    }
  };

  const steps: PathStep[] = STEPS.map((s) => ({ ...s, ...evaluate(s) }));

  const phases: PathPhase[] = PHASES.map((ph) => {
    const own = steps.filter((s) => s.phase === ph.id);
    return { ...ph, steps: own, done: own.filter((s) => s.done).length, total: own.length };
  });

  const pending = steps.filter((s) => !s.done);
  const next = pending[0] ?? null;

  return {
    phases,
    done: steps.length - pending.length,
    total: steps.length,
    next,
    nextIndex: next ? steps.findIndex((s) => s.id === next.id) + 1 : steps.length,
    minutesLeft: pending.reduce((sum, s) => sum + s.minutes, 0),
  };
}
