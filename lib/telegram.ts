/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PONT TELEGRAM — « dire à Alpha quoi faire » depuis le téléphone.
 *
 * Décidé le 22/09/2026. Le propriétaire veut un canal simple : il tape une
 * commande sur Telegram, Alpha (l'app) l'exécute. Ce module porte la LOGIQUE
 * pure et testable ; la route `app/api/telegram/route.ts` fait l'I/O (vérifier
 * le secret, lire l'expéditeur, écrire en base, répondre via l'API Telegram).
 *
 * ⚠ DEUX CERVEAUX, NE PAS LES CONFONDRE.
 * · Ce pont-ci = le cerveau OPÉRATIONNEL de l'APP : statut, notes, commandes
 *   qui se rangent dans une file. Il ne SOURCE pas de leads et n'écrit à
 *   personne — l'app ne peut pas faire ce travail agentique.
 * · Le cerveau AGENTIQUE (sourcer, rédiger, raisonner) = Claude / Cowork, une
 *   session qui écoute. Telegram n'y accède qu'avec un relais distinct.
 * Promettre que ce webhook « source des leads » serait mentir sur ce qu'il est.
 *
 * ⚠ SÛRETÉ. C'est une surface du PROPRIÉTAIRE, appelée par Telegram sans
 * session. Elle est gardée par UN secret d'en-tête ET l'identité de
 * l'expéditeur — jamais l'un sans l'autre. Aucune commande de v1 ne DÉPENSE
 * (pas d'envoi email/SMS/appel) ni n'écrit à un vrai prospect : le jour où on
 * en ajoutera une, elle passera par les gardes existants (`/api/send`, palier,
 * mentions), pas par ici en douce.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Un message Telegram réduit à ce dont on a besoin (le reste est ignoré). */
export interface MessageTelegram {
  /** L'id numérique de l'expéditeur (chat.id / from.id). */
  chatId: string;
  /** Le texte du message, tel quel. */
  texte: string;
}

/** Une commande analysée : le verbe et le reste. */
export interface CommandeTelegram {
  /** Le verbe sans le `/` ni le `@nom_du_bot` (en minuscules). */
  verbe: string;
  /** Tout ce qui suit le verbe, brut, sans espaces de bord. */
  args: string;
}

/** Les verbes que v1 reconnaît. Tout le reste renvoie l'aide. */
export const VERBES_CONNUS = ["aide", "ping", "statut", "note"] as const;
export type VerbeConnu = (typeof VERBES_CONNUS)[number];

/**
 * Découpe `"/note rappeler PROMOVAL demain"` → `{ verbe:"note", args:"rappeler PROMOVAL demain" }`.
 *
 * ⚠ Telegram ajoute `@nom_du_bot` aux commandes dans les groupes
 * (`/statut@alpha_bot`) : on le retire, sinon aucune commande ne matcherait
 * hors conversation privée.
 */
export function analyserCommande(texte: string): CommandeTelegram {
  const t = (texte ?? "").trim();
  if (!t.startsWith("/")) return { verbe: "", args: t };
  const espace = t.indexOf(" ");
  const tete = espace === -1 ? t : t.slice(0, espace);
  const args = espace === -1 ? "" : t.slice(espace + 1).trim();
  // `/verbe@bot` → `verbe`
  const verbe = tete.slice(1).split("@")[0].toLowerCase();
  return { verbe, args };
}

/**
 * L'expéditeur est-il LE propriétaire ? Comparaison stricte de chaînes.
 *
 * ⚠ `ownerId` absent = PERSONNE n'est propriétaire (fail-closed). On ne devine
 * pas une identité de commande ; sans id déclaré, le pont refuse tout le monde,
 * comme le cron refuse sans secret.
 */
export function estProprietaire(chatId: string, ownerId: string | undefined): boolean {
  const o = (ownerId ?? "").trim();
  if (!o) return false;
  return String(chatId).trim() === o;
}

/** L'état de configuration du pont — pour `/statut` et la sonde GET. Jamais de valeur. */
export interface EtatTelegram {
  /** Le token du bot est-il posé ? (sans quoi on ne peut pas répondre) */
  botConfigure: boolean;
  /** Le secret d'en-tête est-il posé ? (sans quoi la route se ferme) */
  secretConfigure: boolean;
  /** Le propriétaire est-il déclaré ? (sans quoi personne n'est autorisé) */
  proprietaireDeclare: boolean;
  /** La persistance des notes est-elle possible ? (service role Supabase) */
  notesPersistables: boolean;
}

type EnvTelegram = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_OWNER_CHAT_ID?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  // Signature d'index : `process.env` (ProcessEnv) est ainsi assignable
  // directement, sans recopier les cinq champs à l'appel.
  [autre: string]: string | undefined;
};

export function etatTelegram(env: EnvTelegram): EtatTelegram {
  const rempli = (v: string | undefined) => Boolean(v && v.trim());
  return {
    botConfigure: rempli(env.TELEGRAM_BOT_TOKEN),
    secretConfigure: rempli(env.TELEGRAM_WEBHOOK_SECRET),
    proprietaireDeclare: rempli(env.TELEGRAM_OWNER_CHAT_ID),
    notesPersistables: rempli(env.SUPABASE_SERVICE_ROLE_KEY) && rempli(env.NEXT_PUBLIC_SUPABASE_URL),
  };
}

/**
 * Le texte d'aide — la seule source de la liste des commandes, pour qu'elle ne
 * dérive pas de ce que la route sait réellement traiter.
 */
export function texteAide(): string {
  return [
    "Alpha — commandes :",
    "/ping — je réponds si je suis en ligne",
    "/statut — ce qui est configuré (envoi, autopilote…)",
    "/note <texte> — je range une consigne dans ta file (à traiter ensuite)",
    "/aide — ce message",
    "",
    "⚠ Je fais l'OPÉRATIONNEL de l'app. Sourcer des leads / écrire un message sur",
    "mesure, c'est le cerveau agentique (Claude/Cowork), pas ce canal.",
  ].join("\n");
}

/** Rend le statut lisible pour `/statut`, à partir de l'état de config. */
export function texteStatut(e: EtatTelegram, envoiPret: boolean, autopiloteArme: boolean): string {
  const oui = (b: boolean) => (b ? "✅" : "—");
  return [
    "Statut Alpha :",
    `${oui(envoiPret)} Envoi email (SMTP)`,
    `${oui(autopiloteArme)} Autopilote armé`,
    `${oui(e.notesPersistables)} File de notes`,
  ].join("\n");
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA COMPRÉHENSION EN LANGAGE NATUREL — le vrai canal opérateur ↔ Alpha.
 *
 * Un message qui n'est pas une commande `/` est une instruction en langage
 * naturel. On la fait CLASSER par le moteur IA (côté route), et le CODE décide
 * quoi en faire — jamais le modèle. C'est la garde centrale : une intention
 * « action » (sourcer, envoyer, dépenser) NE S'EXÉCUTE PAS toute seule ; elle
 * se confirme. Le modèle propose, la route dispose, et la route ne sait faire
 * que des choses sûres (répondre, ranger une note).
 * ─────────────────────────────────────────────────────────────────────
 */

export type IntentionType = "question" | "note" | "action";

export interface IntentionComprise {
  type: IntentionType;
  /** Ce qu'on répond à l'opérateur (déjà rédigé par le modèle). */
  reponse: string;
  /** Pour une note : la consigne reformulée courte, à ranger. */
  resume?: string;
}

/**
 * Le prompt système — une seule source, testable. Il contraint le modèle à
 * rendre un JSON strict et lui INTERDIT d'inventer ou de prétendre avoir agi.
 */
export const PROMPT_COMPREHENSION = [
  "Tu es Alpha Sales OS, l'assistant d'un opérateur commercial (maître d'ouvrage, promoteurs Lyon).",
  "On te donne UNE instruction en langage naturel. Réponds UNIQUEMENT par un JSON :",
  '{"type": "question"|"note"|"action", "reponse": "...", "resume": "..."}',
  "- question : il demande une info ou un conseil → 'reponse' = 2 à 4 phrases, français, concret, honnête.",
  "- note : il te confie une consigne/idée à garder → 'resume' = la consigne reformulée en une phrase, 'reponse' = une confirmation courte.",
  "- action : il demande une action qui DÉPENSE ou ENVOIE (sourcer des leads, lancer une campagne, envoyer un email/SMS, appeler) → 'reponse' dit que tu as COMPRIS et que ça se lance depuis l'app ou après confirmation. NE prétends JAMAIS l'avoir fait.",
  "Règles : jamais de chiffre inventé, jamais de promesse de résultat, jamais de témoignage. Bref.",
].join("\n");

/**
 * Valide et normalise la sortie du modèle en une intention SÛRE. Un modèle qui
 * rend n'importe quoi ne casse rien : on retombe sur une question neutre.
 */
export function interpreterIntention(data: unknown): IntentionComprise {
  const repliNeutre: IntentionComprise = {
    type: "question",
    reponse: "Je n'ai pas bien saisi. Reformule, ou utilise /statut, /note <texte>, /aide.",
  };
  if (!data || typeof data !== "object") return repliNeutre;
  const o = data as Record<string, unknown>;
  const type = o.type;
  const reponse = typeof o.reponse === "string" ? o.reponse.trim() : "";
  if ((type !== "question" && type !== "note" && type !== "action") || !reponse) return repliNeutre;
  if (type === "note") {
    const resume = typeof o.resume === "string" ? o.resume.trim() : "";
    // ⚠ Une note sans résumé n'est pas rangeable : on la traite en question.
    return resume ? { type: "note", reponse, resume } : { type: "question", reponse };
  }
  // question | action : pas de résumé (rien à ranger).
  return { type, reponse };
}

/**
 * La réponse à une commande PURE (sans effet de bord). Les effets (persister
 * une note, lire l'état serveur) sont injectés par la route : ce module reste
 * testable sans base ni réseau.
 *
 * `note` renvoie `null` en texte : c'est le signal à la route qu'il faut
 * PERSISTER `args` puis confirmer — la logique d'écriture ne vit pas ici.
 */
export function reponsePour(cmd: CommandeTelegram): { verbe: VerbeConnu | "inconnu"; texte: string | null } {
  switch (cmd.verbe) {
    case "ping":
      return { verbe: "ping", texte: "Alpha en ligne ✅" };
    case "aide":
      return { verbe: "aide", texte: texteAide() };
    case "statut":
      // La route complète avec l'état réel ; ici on ne décide que du verbe.
      return { verbe: "statut", texte: null };
    case "note":
      if (!cmd.args) return { verbe: "note", texte: "Une note vide ne se range pas. Écris : /note <ta consigne>" };
      return { verbe: "note", texte: null };
    default:
      return { verbe: "inconnu", texte: texteAide() };
  }
}
