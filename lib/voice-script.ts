import { VERTICALS, type VerticalPlaybook } from "./playbook";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA VOICE — le script, la divulgation, et les garde-fous.
 *
 * Ce module est la source unique de ce que l'agent vocal dit. Il est
 * partagé entre l'app (qui configure et déclenche) et le service Python
 * (qui parle) : un seul texte, pas deux versions qui divergent.
 *
 * ── LA CONTRAINTE QUI STRUCTURE TOUT ──
 *
 * L'article 50 du règlement européen sur l'IA est applicable depuis le
 * 2 août 2026. Un système qui interagit directement avec une personne
 * physique doit lui faire comprendre qu'elle parle à une IA. Pour un
 * agent qui appelle, la Commission précise qu'il doit s'identifier comme
 * artificiel ET dire pour le compte de qui il agit.
 *
 * Conséquence de conception : la divulgation n'est pas une option de
 * configuration. Elle est concaténée en tête de chaque script par
 * `buildVoiceScript`, et il n'existe aucun chemin de code qui produise un
 * script sans elle. Un test le verrouille.
 *
 * Ce n'est pas de la prudence : c'est ce qui rend l'outil utilisable en
 * clientèle plutôt qu'en démonstration privée.
 *
 * ── CE QUE CET AGENT FAIT, ET CE QU'IL NE FAIT PAS ──
 *
 * Il fait : la DÉMONSTRATION. Le prospect entend, sur son propre
 * scénario métier, ce que ses clients entendraient. C'est la doctrine
 * maison appliquée — « émotion d'abord, démo avant le prix » — et c'est
 * ce qui a converti la Carrosserie des Brotteaux : visite terrain, démo
 * live, puis prix.
 *
 * Il ne fait pas : du démarchage à froid vers des inconnus. Techniquement
 * il en serait capable ; le mode existe et il est bridé (voir
 * `CallMode`). La raison n'est pas juridique — c'est qu'on vend une IA
 * qui répond bien aux clients de nos prospects, et que notre propre
 * premier contact ne peut pas être une IA qui démarche.
 * ─────────────────────────────────────────────────────────────────────
 */

export type CallMode =
  /** L'agent joue le standard du prospect. Le prospect appelle et entend son propre accueil. */
  | "demo-entrante"
  /** L'agent appelle le prospect pour lui faire vivre la démonstration. Sur rendez-vous. */
  | "demo-sortante"
  /** Rappel d'un prospect qui a laissé ses coordonnées. Il a initié le contact. */
  | "rappel-entrant"
  /** Prospection commerciale B2B sortante — sous conditions strictes (voir la porte de conformité). */
  | "prospection-b2b";

export interface CallModeMeta {
  id: CallMode;
  label: string;
  /** Ce que le mode permet, en une phrase. */
  what: string;
  /** Pourquoi il est licite, et à quelle condition. */
  legal: string;
  /** Autorisé dans l'app ? Le démarchage à froid ne l'est pas — par choix. */
  allowed: boolean;
}

export const CALL_MODES: CallModeMeta[] = [
  {
    id: "demo-entrante",
    label: "Démo entrante — le prospect appelle",
    what: "Un numéro de démonstration configuré au métier du prospect. Il appelle, et il entend ce que ses propres clients entendraient.",
    legal:
      "L'appelant initie le contact : aucun démarchage. La divulgation IA reste due dès la première phrase (art. 50), et elle est dans le script.",
    allowed: true,
  },
  {
    id: "demo-sortante",
    label: "Démo sortante — l'agent appelle, sur rendez-vous",
    what: "Pendant un rendez-vous, l'agent appelle le prospect pour qu'il vive la démonstration depuis son propre téléphone.",
    legal:
      "Le prospect est présent, prévenu et consentant : c'est une démonstration, pas une sollicitation. Divulgation due, et donnée.",
    allowed: true,
  },
  {
    id: "rappel-entrant",
    label: "Rappel d'un contact entrant",
    what: "Rappelle quelqu'un qui a laissé ses coordonnées — formulaire, appel manqué, demande d'audit.",
    legal:
      "La personne a initié la relation. Licite en B2B au titre de l'intérêt légitime, avec divulgation IA et droit d'opposition immédiat.",
    allowed: true,
  },
  {
    id: "prospection-b2b",
    label: "Prospection B2B — sortante, sous conditions",
    what: "Premier contact commercial vers une ENTREPRISE, pour proposer un audit ou une démonstration. Se lance fiche par fiche, jamais en masse.",
    legal:
      "Licite au titre de l'intérêt légitime (RGPD) — hors champ Bloctel, réservé aux consommateurs. Conditions cumulatives : cible professionnelle confirmée, coordonnées de source publique, divulgation IA (art. 50) dès la 1re phrase, droit d'opposition immédiat et enregistré, horaires ouvrés, aucune relance non sollicitée.",
    allowed: true,
  },
];

/**
 * Le démarchage à froid par agent vocal — délibérément absent de
 * CALL_MODES. Il serait techniquement identique à `demo-sortante` ; la
 * décision de ne pas l'exposer est documentée dans docs/MARCHE.md §4.2 et
 * ce commentaire existe pour qu'on ne la réintroduise pas par distraction.
 */
export const COLD_CALLING_REFUSED =
  "Le démarchage à froid par agent vocal n'est pas exposé : on vend une IA qui répond bien aux clients de nos prospects, notre premier contact ne peut pas être une IA qui démarche.";

export interface VoiceConfig {
  /** Raison sociale au nom de laquelle l'agent parle. */
  onBehalfOf: string;
  /** Nom donné à l'agent. Il ne doit pas laisser croire à un humain. */
  agentName: string;
  /** Verticale du playbook, pour le vocabulaire métier. */
  verticalId?: string | null;
  /** Nom de l'entreprise dont l'agent joue le standard (mode démo). */
  company?: string;
  mode: CallMode;
  /**
   * Brief du prospect issu du deep-dive (`briefForScript`). C'est CE bloc qui
   * rend l'appel personnel : ce qu'on sait de lui, ce qu'on doit apprendre,
   * l'angle et l'objectif. Sans lui, l'agent récite un script générique — et
   * un script générique ne convertit pas (cf. juillet 2026).
   */
  prospectBrief?: string;
}

/**
 * La divulgation, mot pour mot.
 *
 * Trois éléments imposés par l'article 50 : que c'est une IA, pour le
 * compte de qui, et de façon compréhensible par un interlocuteur
 * raisonnablement informé — donc en français simple, pas en jargon.
 */
export function disclosure(cfg: VoiceConfig): string {
  return `Bonjour, je suis ${cfg.agentName}, un assistant vocal — une intelligence artificielle, pas une personne. J'appelle pour le compte de ${cfg.onBehalfOf}.`;
}

/** Ce qui doit figurer dans toute divulgation. Sert au test et à l'audit. */
export const DISCLOSURE_REQUIREMENTS = [
  { id: "artificiel", label: "Se déclare artificiel", pattern: /intelligence artificielle|assistant vocal/i },
  { id: "pas-humain", label: "Dit ne pas être une personne", pattern: /pas une personne|pas un humain/i },
  { id: "mandant", label: "Nomme celui pour qui il agit", pattern: /pour le compte de/i },
];

const vertical = (id?: string | null): VerticalPlaybook | null => VERTICALS.find((v) => v.id === id) ?? null;

/**
 * Construit le script complet. La divulgation est TOUJOURS en tête —
 * il n'existe pas de paramètre pour la retirer, et c'est voulu.
 */
export function buildVoiceScript(cfg: VoiceConfig): string {
  const v = vertical(cfg.verticalId);
  const company = cfg.company?.trim() || "l'entreprise";

  const corps: string[] = [];

  if (cfg.mode === "demo-entrante") {
    corps.push(
      `Tu joues l'accueil téléphonique de ${company}.`,
      `Ton rôle : accueillir, comprendre la demande, et proposer un rendez-vous ou prendre un message. Tu ne vends rien.`,
      v ? `Contexte métier : ${v.structuralPain}` : "",
      `Questions utiles à poser : ${(v?.diagnostic ?? ["Quelle est votre demande ?"]).slice(0, 2).join(" / ")}`,
      `Si la personne demande un humain, tu proposes immédiatement de prendre ses coordonnées pour un rappel. Tu n'insistes jamais.`
    );
  } else if (cfg.mode === "demo-sortante") {
    corps.push(
      `Tu fais une DÉMONSTRATION à ${company}, qui est au courant et qui t'attend.`,
      `Tu montres, en trente secondes, ce que vivrait un de leurs clients qui appelle : accueil, compréhension de la demande, prise de rendez-vous.`,
      v ? `Vocabulaire du métier : ${v.criterion}` : "",
      `Tu ne parles JAMAIS de prix. Tu ne cherches pas à convaincre : tu montres, et tu rends la main.`
    );
  } else if (cfg.mode === "prospection-b2b") {
    corps.push(
      `Tu appelles ${company}, une ENTREPRISE, dans le cadre d'une prospection commerciale B2B pour le compte de ${cfg.onBehalfOf}.`,
      `Après la divulgation, tu dis en UNE phrase pourquoi tu appelles : proposer un audit de leur accueil téléphonique. Puis tu poses une seule question courte et tu écoutes.`,
      v ? `Angle métier : ${v.structuralPain}` : "",
      `Tu précises, si on te le demande, que leurs coordonnées PROFESSIONNELLES proviennent de sources publiques (annuaires, site web).`,
      `Droit d'opposition, prioritaire : dès que la personne montre qu'elle ne veut pas être appelée — même à demi-mot — tu confirmes qu'elle ne sera plus contactée, tu la remercies et tu raccroches. Immédiat, définitif, sans insister.`,
      `Tu ne parles JAMAIS de prix. Tu ne relances pas. Au mieux, tu proposes un rendez-vous court avec un humain, et tu rends la main.`
    );
  } else {
    corps.push(
      `Tu rappelles une personne qui a laissé ses coordonnées à ${cfg.onBehalfOf}.`,
      `Tu rappelles pourquoi tu appelles, tu vérifies que le moment est bon, et tu proposes un créneau avec un humain.`,
      `Si la personne dit qu'elle ne souhaite plus être contactée, tu le confirmes, tu remercies et tu raccroches. Aucune relance.`
    );
  }

  const brief = cfg.prospectBrief?.trim();

  return [
    "## Première phrase — obligatoire, mot pour mot, avant toute autre chose",
    disclosure(cfg),
    "",
    "## Ton rôle",
    ...corps.filter(Boolean),
    ...(brief ? ["", "## Ce dossier précis (deep-dive)", brief] : []),
    "",
    "## Règles absolues",
    "- Si on te demande si tu es un robot ou une IA : tu réponds OUI, immédiatement et sans détour.",
    "- Tu ne prétends jamais être humain, même en plaisantant.",
    "- Tu ne donnes aucun prix, aucun engagement contractuel, aucune donnée personnelle.",
    "- Si la personne demande à ne plus être appelée, tu confirmes et tu raccroches. C'est définitif.",
    "- Tu parles français, phrases courtes, ton naturel. Tu laisses parler.",
    "- Si tu ne sais pas : tu le dis et tu proposes un rappel humain. Tu n'inventes rien.",
  ].join("\n");
}

/** Le script porte-t-il toutes les mentions dues ? Utilisé avant chaque appel. */
export function auditScript(script: string): { ok: boolean; manquantes: string[] } {
  const manquantes = DISCLOSURE_REQUIREMENTS.filter((r) => !r.pattern.test(script)).map((r) => r.label);
  return { ok: manquantes.length === 0, manquantes };
}

/** Numéro français au format E.164, seul format accepté par SIP. */
export function toE164(phone: string): string | null {
  const d = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(d)) return d;
  const digits = d.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+33${digits.slice(1)}`;
  if (/^33\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * Un appel sortant est-il permis maintenant ?
 *
 * Les horaires ne sont pas une obligation légale en B2B — l'encadrement
 * vise le consommateur. Mais un agent vocal qui appelle une entreprise
 * fermée ne fait que tomber sur un répondeur, et un agent qui appelle un
 * dimanche donne l'image exacte qu'on cherche à éviter.
 */
export function callAllowedNow(now = new Date()): { allowed: boolean; why: string } {
  const day = now.getDay();
  const h = now.getHours();
  if (day === 0 || day === 6)
    return { allowed: false, why: "Week-end — un agent vocal qui appelle une entreprise fermée n'atteint qu'un répondeur." };
  if (h < 9 || h >= 18)
    return { allowed: false, why: "Hors 9h–18h : l'entreprise est fermée, et l'horaire donne une mauvaise image." };
  if (h >= 12 && h < 14)
    return { allowed: false, why: "Pause déjeuner — taux de décroché au plancher." };
  return { allowed: true, why: "Fenêtre professionnelle ouverte." };
}

/** Tag de fiche marquant un droit d'opposition exercé — ne plus appeler. */
export const DO_NOT_CALL_TAG = "ne-pas-appeler";

export interface OutboundGateInput {
  mode: CallMode;
  /** La cible est-elle confirmée professionnelle (B2B) ? */
  isProfessional?: boolean;
  /** La fiche a-t-elle exercé son droit d'opposition (tag ne-pas-appeler) ? */
  optedOut?: boolean;
  now?: Date;
}

/**
 * La porte de conformité de la prospection sortante — les conditions DURES,
 * non contournables (l'horaire, lui, est traité à part car forçable
 * explicitement). Les autres modes (démo/rappel) ne sont pas de la
 * prospection à froid et passent, sous réserve du droit d'opposition.
 */
export function outboundComplianceGate(i: OutboundGateInput): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (i.optedOut) {
    blockers.push("Droit d'opposition exercé (« ne pas appeler ») — cette fiche ne doit jamais être rappelée.");
  }
  if (i.mode === "prospection-b2b" && !i.isProfessional) {
    blockers.push("Cible non confirmée comme professionnelle. La prospection vocale vers un particulier n'est pas autorisée.");
  }
  return { ok: blockers.length === 0, blockers };
}
