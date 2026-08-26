import type { Prospect, Stage } from "./types";
import { getAccount } from "./accounts";
import { vitalSigns, type VitalSigns } from "./vital-signs";
import { cadenceFor, cibleDepuisProspect, plafondRappels, type CallAttempt } from "./call-cadence";
import type { Reactivite } from "./reactivite";

/**
 * ─────────────────────────────────────────────────────────────────────
 * MASTER RAPPEL — pour CE prospect, à CET instant : quoi faire, qui le fait,
 * et est-ce que ça tourne vraiment ?
 *
 * Trois sorties par prospect, et c'est tout l'objet du module :
 *   · HUMAIN — ce que Zakaria (ou le closer) doit faire lui-même.
 *   · ALPHA  — ce que l'OS exécute tout seul (relances, séquences, tracking).
 *   · CHECKS — la checklist de fonctionnement : est-ce que ça TOURNE, est-ce
 *              qu'on TRACE, et est-ce qu'Alpha REÇOIT bien la donnée dont il a
 *              besoin pour analyser ce prospect ? Un automatisme qu'on croit
 *              actif alors qu'il est muet coûte plus cher que pas d'automatisme.
 *
 * Règle de qualité (non négociable) : aller vite ne doit jamais coûter une
 * information nécessaire à un delivery parfait. Chaque action porte donc ses
 * `mustCapture` — ce qu'il faut avoir RÉCOLTÉ avant de passer à l'étape
 * suivante. On avance d'une étape à la fois, jamais deux.
 * ─────────────────────────────────────────────────────────────────────
 */

export type Owner = "humain" | "alpha";
export type Channel = "appel" | "email" | "visio" | "sms" | "dm" | "terrain" | "systeme";

export interface Action {
  id: string;
  owner: Owner;
  /** L'acte, formulé à l'impératif — pas une intention. */
  do: string;
  channel: Channel;
  /** ISO — quand ça doit être fait. */
  when: string;
  why: string;
  /** Ce qu'il faut ABSOLUMENT récolter à cette étape (qualité du delivery). */
  mustCapture?: string[];
}

export type CheckState = "actif" | "en-attente" | "absent";

export interface RunCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

/**
 * Le rituel de signature du compte qui porte le deal.
 *
 * Seul l'ACTE est ici. Les coordonnées qui vont avec (adresse d'expédition,
 * panel de vente, personne à impliquer, fuseau) sont servies par
 * `/api/catalogue` : ce module est calculé côté client, donc tout ce qu'il
 * touche part dans un fichier JavaScript téléchargeable. Voir
 * `lib/accounts-commercial.ts`.
 */
export interface ClosingStep {
  accountId: string;
  accountName: string;
  action: string;
}

/**
 * Le plan de COMMUNICATION : quoi lui dire, quand, comment, et à quelle
 * fréquence — le tout déduit de son COMPORTEMENT face à l'offre (son statut
 * dans le pipeline + sa réactivité), jamais d'une cadence fixe pour tous.
 */
export interface CommsPlan {
  /** Le canal qui a le plus de chances d'aboutir MAINTENANT. */
  channel: Channel;
  /** Intervalle entre deux touches, en jours. */
  everyDays: number;
  /** Le registre à tenir (il change tout à l'oral). */
  tone: string;
  /** La phrase / l'angle à sortir maintenant. */
  say: string;
  /** Ce qu'il ne faut surtout PAS faire avec ce prospect-là. */
  avoid: string[];
  /**
   * La réactivité mesurée (ouvertures, clics), quand elle a été fournie.
   *
   * `null` = personne ne l'a passée. Ce n'est PAS « il n'ouvre pas » : c'est
   * un angle mort, et le plan doit le dire au lieu de conclure.
   */
  reactivite: Reactivite | null;
}

export interface MasterPlan {
  prospectId: string;
  stage: Stage;
  signs: VitalSigns;
  /** Quoi dire, quand, comment, à quelle fréquence. */
  comms: CommsPlan;
  /** Ce que l'humain fait. */
  human: Action[];
  /** Ce qu'Alpha Sales OS fait tout seul. */
  alpha: Action[];
  /** La checklist « ça tourne / on trace / Alpha reçoit ». */
  checks: RunCheck[];
  /** Le rituel de signature du compte, si le prospect est prêt. */
  closing: ClosingStep | null;
  /** La phrase à lire en haut de la fiche. */
  headline: string;
}

const filled = (v: string | undefined | null) => Boolean((v ?? "").trim());

/** Il a décroché / répondu. */
const ANSWERED = /r[ée]pond|a rappel[ée]|rappelle|d[ée]croch|[ée]chang|discut|vu (?:à|a) \d|visite|rdv obtenu|accord/i;
/** Il refuse d'être recontacté. */
const OPPOSED = /ne plus (?:me |nous )?(?:appeler|contacter)|stop|opposition|ne pas rappeler|d[ée]sinscri/i;
/** Numéro mort. */
const INVALID = /num[ée]ro (?:invalide|faux|ne (?:fonctionne|marche) pas)|injoignable|t[ée]l[ée]phone ne (?:fonctionne|marche) pas/i;

/**
 * Les tentatives d'appel déduites de la timeline — pour que la cadence
 * fonctionne sans double saisie. On lit le RÉSULTAT dans le résumé de
 * l'événement : c'est ce que le commercial a écrit sur le terrain.
 *
 * En cas de doute on retombe sur « sans-reponse » : le pire serait de croire
 * qu'il a répondu (on arrêterait la cadence à tort et le dossier dormirait).
 */
export function attemptsFromEvents(p: Prospect): CallAttempt[] {
  return (p.events ?? [])
    .filter((e) => e.kind === "appel")
    .map((e) => {
      const s = e.summary ?? "";
      const outcome = OPPOSED.test(s)
        ? "opposition"
        : INVALID.test(s)
          ? "invalide"
          : ANSWERED.test(s)
            ? "repondu"
            : "sans-reponse";
      return { at: e.date, outcome } as CallAttempt;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Le plan complet d'un prospect.
 * `attempts` : historique d'appels (pour l'état de la cadence Callflow).
 * `accountId` : le compte qui porte le deal (détermine le rituel de closing).
 */
export function masterRappel(
  p: Prospect,
  opts: { now?: Date; attempts?: CallAttempt[]; accountId?: string; reactivite?: Reactivite } = {}
): MasterPlan {
  const now = opts.now ?? new Date();
  // Sans historique fourni, on le déduit de la timeline : zéro double saisie.
  const attempts = opts.attempts ?? attemptsFromEvents(p);
  const signs = vitalSigns(p, now);
  /**
   * La cadence se calcule sur la CIBLE, comme dans l'autopilote.
   *
   * Sans elle, le plan annonçait « rappel 3/5 » alors que `campaign-runner`
   * s'arrêtait à 4 sur une fiche sans SIREN (plafond du décret n° 2022-1313).
   * Le nombre affiché à l'humain était donc au-dessus de ce que le code
   * s'autorisait — et c'est l'humain qui compose.
   */
  const cadence = cadenceFor(attempts, now, cibleDepuisProspect(p));
  const plafond = plafondRappels(cibleDepuisProspect(p));
  const win = signs.bestWindow.at;

  const human: Action[] = [];
  const alpha: Action[] = [];

  // ── Ce qu'ALPHA fait, quel que soit le stade ──
  if (signs.fatigueLevel === "sature") {
    alpha.push({
      id: "pause",
      owner: "alpha",
      do: `Mettre les relances en PAUSE jusqu'au ${new Date(win).toLocaleDateString("fr-FR")}, puis reprendre avec une raison neuve.`,
      channel: "systeme",
      when: now.toISOString(),
      why: signs.bestWindow.why,
    });
  } else if (cadence.callNow) {
    alpha.push({
      id: "cadence-appel",
      owner: "alpha",
      do: `Passer le rappel ${cadence.recallsUsed + 1}/${plafond.max} (cadence Callflow).`,
      channel: "appel",
      when: now.toISOString(),
      why: cadence.reason,
      mustCapture: ["a-t-il décroché ?", "ce qu'il a dit", "objection éventuelle"],
    });
  } else if (cadence.nextCallAt && cadence.state === "attente") {
    alpha.push({
      id: "cadence-attente",
      owner: "alpha",
      do: `Rappel ${cadence.recallsUsed + 1}/${plafond.max} programmé.`,
      channel: "appel",
      when: cadence.nextCallAt,
      why: cadence.reason,
    });
  }

  if (cadence.handoffToHuman) {
    human.push({
      id: "reprise-humaine",
      owner: "humain",
      do:
        cadence.state === "repondu-passer-humain"
          ? "REPRENDRE LA MAIN : il a répondu. Alpha Voice s'est arrêté, à toi de jouer."
          : "Reprendre la main : 5 rappels sans réponse — changer de canal (terrain, LinkedIn, email).",
      channel: cadence.state === "repondu-passer-humain" ? "appel" : "terrain",
      when: now.toISOString(),
      why: cadence.reason,
      mustCapture: ["son contexte réel", "sa contrainte de timing", "qui décide avec lui"],
    });
  }

  alpha.push({
    id: "memoire",
    owner: "alpha",
    do: "Enregistrer l'échange dans la mémoire du prospect (deep-dive + infos neuves) et réinjecter au prochain contact.",
    channel: "systeme",
    when: now.toISOString(),
    why: "Le contexte qui grossit à chaque échange est ce qui rend la personnalisation possible à grande échelle.",
  });

  // ── Ce que fait l'HUMAIN, selon le stade du pipeline ──
  switch (p.stage) {
    case "prospect":
      human.push({
        id: "qualifier",
        owner: "humain",
        do: "Qualifier : obtenir le NOM du décideur et un contact direct.",
        channel: "appel",
        when: win,
        why: "On ne vend pas à une fonction. Sans décideur nommé, tout le reste est du vent.",
        mustCapture: ["nom du décideur", "téléphone ou email direct", "métier exact"],
      });
      alpha.push({
        id: "enrichir",
        owner: "alpha",
        do: "Lancer le deep-dive automatique (site, avis, réseaux, process) et pré-remplir la fiche.",
        channel: "systeme",
        when: now.toISOString(),
        why: "L'audit doit exister AVANT le premier vrai échange — c'est ce qui fait décrocher.",
      });
      break;

    case "contact":
      human.push({
        id: "audit-accord",
        owner: "humain",
        do: "Obtenir l'accord pour envoyer l'audit écrit + une date de rappel.",
        channel: "appel",
        when: win,
        why: "Juillet le prouve : là où un audit part, le taux monte ; sans pièce écrite, il reste à zéro.",
        mustCapture: ["volume d'appels/demandes manqués", "comment ils gèrent aujourd'hui", "date de rappel convenue"],
      });
      alpha.push({
        id: "envoi-audit",
        owner: "alpha",
        do: "Générer l'audit personnalisé et l'envoyer dès l'accord obtenu.",
        channel: "email",
        when: now.toISOString(),
        why: "L'audit part le jour même : un audit promis et non envoyé tue la crédibilité.",
      });
      break;

    case "audit":
      human.push({
        id: "audit-vers-rdv",
        owner: "humain",
        do: "Transformer l'audit envoyé en RENDEZ-VOUS daté (démo).",
        channel: "appel",
        when: win,
        why: "Un audit sans rendez-vous derrière ne produit rien. C'est l'étape où ça se perd le plus.",
        mustCapture: ["a-t-il lu l'audit ?", "ce qui l'a marqué", "date + heure de démo"],
      });
      alpha.push({
        id: "tracking-audit",
        owner: "alpha",
        do: "Suivre l'ouverture / la lecture de l'audit et alerter dès qu'il le consulte.",
        channel: "systeme",
        when: now.toISOString(),
        why: "Rappeler dans l'heure qui suit la lecture multiplie les chances — c'est le moment où il y pense.",
      });
      break;

    case "demo":
      human.push({
        id: "demo",
        owner: "humain",
        do: "Faire la démo — MONTRER avant de parler prix — puis obtenir l'accord de principe et une date de décision.",
        channel: "visio",
        when: p.nextStep?.date ?? win,
        why: "Le prix annoncé sans démo devient une négociation. Montré après la valeur, il devient une évidence.",
        mustCapture: ["ses 3 vrais irritants", "qui d'autre décide", "sa date de décision", "son budget"],
      });
      break;

    case "offre":
      human.push({
        id: "closing",
        owner: "humain",
        do: signs.blockers.length
          ? `Lever le dernier point avant de closer : ${signs.blockers[0]}`
          : "Closer : demander la signature, avec la date de démarrage.",
        channel: "visio",
        when: p.nextStep?.date ?? win,
        why: signs.blockers.length ? "On ne close pas sur un signal vital au rouge." : "Tous les signaux sont au vert.",
        mustCapture: ["accord explicite", "date de démarrage", "interlocuteur pour le delivery"],
      });
      break;

    case "redzone":
      human.push({
        id: "redzone",
        owner: "humain",
        do: `Traiter l'objection de fond, puis reproposer une date. ${signs.blockers[0] ?? ""}`.trim(),
        channel: "appel",
        when: win,
        why: "En Red Zone, relancer sans traiter l'objection ne fait que confirmer son refus.",
        mustCapture: ["l'objection RÉELLE (pas celle affichée)", "ce qui la lèverait"],
      });
      break;

    case "signe":
      human.push({
        id: "delivery",
        owner: "humain",
        do: "Lancer le delivery et fixer le point de satisfaction.",
        channel: "visio",
        when: now.toISOString(),
        why: "La vente ne finit pas à la signature : la satisfaction produit le témoignage et l'upsell.",
        mustCapture: ["accès techniques", "interlocuteur opérationnel", "critère de réussite à 30 jours"],
      });
      alpha.push({
        id: "suivi-satisfaction",
        owner: "alpha",
        do: "Programmer le suivi de satisfaction et la demande de témoignage.",
        channel: "systeme",
        when: now.toISOString(),
        why: "Le témoignage obtenu au pic de satisfaction est la meilleure preuve sociale pour les suivants.",
      });
      break;

    case "perdu":
      alpha.push({
        id: "nurture",
        owner: "alpha",
        do: "Basculer en nurture long : une valeur utile tous les 60 jours, aucune relance commerciale.",
        channel: "email",
        when: win,
        why: "Un perdu n'est pas un mort : il est mal timé. On reste présent sans peser.",
      });
      break;
  }

  // ── La checklist « est-ce que ça tourne ? » ──
  const checks: RunCheck[] = [];
  const reachable = filled(p.email) || filled(p.phone);
  checks.push({
    id: "joignable",
    label: "Prospect joignable",
    state: reachable ? "actif" : "absent",
    detail: reachable
      ? [filled(p.phone) ? "téléphone" : "", filled(p.email) ? "email" : ""].filter(Boolean).join(" + ")
      : "Ni téléphone ni email : aucune action automatique n'est possible.",
  });
  checks.push({
    id: "tracking-email",
    label: "Tracking email branché",
    state: filled(p.email) ? "actif" : "absent",
    detail: filled(p.email) ? "Ouvertures et réponses remontent sur la fiche." : "Sans email, pas de tracking d'ouverture.",
  });
  checks.push({
    id: "cadence",
    label: "Cadence d'appel",
    state: cadence.callNow || cadence.state === "attente" ? "actif" : cadence.state === "a-appeler" ? "en-attente" : "absent",
    detail: cadence.reason,
  });
  checks.push({
    id: "deep-dive",
    label: "Deep-dive présent",
    state: (p.auditScore ?? 0) >= 50 ? "actif" : (p.auditScore ?? 0) > 0 ? "en-attente" : "absent",
    detail: (p.auditScore ?? 0) >= 50 ? "Matière suffisante pour personnaliser." : "Audit incomplet : la personnalisation sera pauvre.",
  });
  checks.push({
    id: "prochaine-etape",
    label: "Prochaine étape datée",
    state: p.nextStep?.date ? "actif" : "absent",
    detail: p.nextStep?.date ? `${p.nextStep.action} — ${new Date(p.nextStep.date).toLocaleDateString("fr-FR")}` : "Aucune date : le dossier va dormir.",
  });
  // Alpha reçoit-il vraiment de la donnée sur ce prospect ?
  const fresh = signs.daysSinceLastTouch !== null && signs.daysSinceLastTouch <= 14;
  checks.push({
    id: "retour-donnee",
    label: "Alpha reçoit la donnée",
    state: fresh ? "actif" : signs.daysSinceLastTouch === null ? "absent" : "en-attente",
    detail:
      signs.daysSinceLastTouch === null
        ? "Aucun événement : Alpha n'a rien à analyser sur ce prospect."
        : `Dernier signal il y a ${signs.daysSinceLastTouch} j${signs.daysSinceInbound !== null ? ` · dernier signe de LUI il y a ${signs.daysSinceInbound} j` : " · aucun retour de sa part"}.`,
  });

  // ── Le rituel de signature, seulement s'il est prêt ──
  const account = getAccount(opts.accountId);
  const closing: ClosingStep | null =
    signs.readiness >= 70 && account.closing
      ? { accountId: account.id, accountName: account.name, ...account.closing }
      : null;

  const headline = closing
    ? `PRÊT À SIGNER — ${closing.action}`
    : (human[0]?.do ?? alpha[0]?.do ?? "Qualifier la fiche.");

  const comms = buildComms(p, signs, opts.reactivite ?? null);

  return { prospectId: p.id, stage: p.stage, signs, comms, human, alpha, checks, closing, headline };
}

/**
 * Quoi dire / quand / comment / à quelle fréquence — dérivé du comportement.
 *
 * Le principe : la fréquence suit la RÉACTIVITÉ, pas le calendrier. Un
 * prospect qui répond mérite du rythme ; un prospect saturé mérite du silence.
 * Appliquer la même cadence à tout le monde est la meilleure façon de brûler
 * la moitié du fichier.
 */
function buildComms(p: Prospect, s: VitalSigns, r: Reactivite | null): CommsPlan {
  const avoid: string[] = [];

  // ── Fréquence : dictée par la fatigue et la réactivité ──
  let everyDays: number;
  if (s.fatigueLevel === "sature") everyDays = Math.min(21, 7 + s.unansweredTouches * 3);
  else if (s.readiness >= 70) everyDays = 1; // un acheteur n'attend pas
  else if (s.daysSinceInbound !== null && s.daysSinceInbound <= 7) everyDays = 2; // il est vivant
  else if (s.momentum === "eteint") everyDays = 30; // réveil long, pas d'acharnement
  else everyDays = 5;

  // ── Canal : celui qui casse la routine quand l'actuel ne répond plus ──
  let channel: Channel;
  if (s.readiness >= 70) channel = "visio";
  else if (r?.lecture === "clic" || r?.lecture === "lu-sans-reponse") {
    /**
     * ── LA CORRECTION QUE LA RÉACTIVITÉ APPORTE ──
     *
     * Sans données d'ouverture, trois touches sans réponse déclenchaient un
     * changement de canal. Mais s'il OUVRE, le canal marche : c'est la
     * demande qui coince. Changer de registre à ce moment-là jette le seul
     * canal dont on a la preuve qu'il passe.
     *
     * L'inverse est vrai aussi : zéro signal sur plusieurs envois, et le
     * problème est probablement technique avant d'être commercial.
     */
    channel = "email";
    avoid.push(
      "Abandonner l'email parce qu'il ne répond pas : il l'OUVRE. Le canal passe, c'est la demande qui est trop grosse."
    );
  } else if (s.unansweredTouches >= 3) {
    channel = "terrain"; // le canal écrit a échoué : changer de registre
    avoid.push("Continuer sur le canal qui n'a rien donné — il a déjà ignoré ce format.");
    if (r?.lecture === "muet" && r.conseil) avoid.push(r.conseil);
  } else if (p.stage === "prospect" || p.stage === "contact") channel = "appel";
  else channel = "email";

  // ── Ton : ce qui change tout à l'oral ──
  const tone =
    s.fatigueLevel === "sature"
      ? "Léger et sans attente. Une valeur, aucune demande. On ne réclame rien."
      : s.readiness >= 70
        ? "Direct et assumé : il est prêt, on demande la décision sans tourner autour."
        : p.stage === "redzone"
          ? "Calme, on nomme l'objection à sa place. Aucune pression."
          : "Curieux et concret. On pose une question, on écoute, on ne pitche pas.";

  // ── Quoi dire MAINTENANT ──
  const pain = p.problems?.[0] ?? (p.objections ?? []).find((o) => o.status !== "traitee")?.label;
  // Un signal frais prime sur tout le reste : c'est la seule chose qu'on sait
  // de LUI aujourd'hui, et elle donne l'accroche exacte.
  const fraisEtChaud =
    r && (r.lecture === "clic" || r.lecture === "lu-sans-reponse") && (r.heuresDepuisSignal ?? Infinity) <= 48;
  const say =
    fraisEtChaud && r?.conseil
      ? r.conseil
      : s.readiness >= 70
      ? "« On a tout ce qu'il faut. Je vous envoie le document — on démarre quand ? »"
      : s.fatigueLevel === "sature"
        ? "Une raison NEUVE, jamais « je me permets de relancer » : un résultat obtenu ailleurs, une preuve, une actualité de son métier."
        : pain
          ? `Parler de SA douleur nommée : « ${pain} » — puis se taire et écouter.`
          : s.blockers[0]
            ? `Aller chercher ce qui manque : ${s.blockers[0]}`
            : "Poser LA question qui fait avancer d'une étape.";

  // ── Interdits ──
  if (s.fatigueLevel === "sature") avoid.push("Toute relance commerciale : il est saturé, une touche de plus le brûle.");
  if (!p.demoShownBeforePrice && p.stage !== "prospect") avoid.push("Donner un prix avant d'avoir montré la valeur.");
  if ((p.objections ?? []).some((o) => o.status === "bloquante"))
    avoid.push("Pousser vers la signature tant que l'objection bloquante n'est pas levée.");
  if (p.nextStep?.date) avoid.push("Doubler un rendez-vous déjà calé par une relance parasite.");

  return { channel, everyDays, tone, say, avoid, reactivite: r };
}

/** Les plans de tout le pipe, les plus prêts d'abord. */
export function masterRappelAll(
  prospects: Prospect[],
  opts: { now?: Date; accountId?: string; reactivite?: Record<string, Reactivite> } = {}
): MasterPlan[] {
  // La réactivité est indexée par prospect : chaque plan reçoit LA sienne,
  // et l'absence d'entrée reste un angle mort, pas un « il n'ouvre pas ».
  return prospects
    .map((p) => masterRappel(p, { ...opts, reactivite: opts.reactivite?.[p.id] }))
    .sort((a, b) => b.signs.readiness - a.signs.readiness);
}
