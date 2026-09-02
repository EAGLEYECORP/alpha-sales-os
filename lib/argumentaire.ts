import type { Prospect } from "./types";
import { getAccount } from "./accounts";
import { recovery } from "./recovery";
import { buildLadder, type LadderResult } from "./ladder";
import { vitalSigns } from "./vital-signs";
// L'offre vient du MÊME calcul que partout ailleurs (deep-dive → matchOffer,
// contraint aux offres du compte). Une table de correspondance marche→offre
// serait une deuxième source, et elle divergerait.
import { deepDive } from "./deep-dive";
import { OFFRES } from "./offer-match";
import { GARANTIES } from "./offre-alpha-voice";
import { citer } from "./citation";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ARGUMENTAIRE — la structure complète de l'échange, pour CE prospect.
 *
 * L'ordre est celui qui fait signer, et il n'est pas négociable :
 *   1. Se présenter (court, crédible, sans pitch).
 *   2. Poser LES questions qui lui font comprendre TOUT SEUL qu'il a un
 *      problème. On ne convainc pas quelqu'un — on lui fait constater.
 *   3. Ce qui se fait dans le marché (la norme dont il est sorti).
 *   4. Ce que ça lui coûte : par jour, par mois, par an. Des chiffres.
 *   5. Notre offre et son prix — SEULEMENT ici, après la valeur.
 *   6. Nos devoirs / ses droits (ce qui rend l'engagement sûr pour lui).
 *   7. Pourquoi il dirait non — anticipé, nommé, désamorcé.
 *   8. Pourquoi attendre coûte plus cher que décider.
 *   9. Comment payer si le budget est contraint.
 *
 * Tout est DÉRIVÉ de sa fiche : les pertes viennent de ses propres chiffres
 * (recovery), les objections de ses objections réelles, le prix du compte qui
 * porte le deal. Rien d'inventé — un chiffre non mesuré est annoncé comme une
 * estimation, jamais comme une promesse.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Losses {
  /** Vrai si les pertes sont calculées sur des chiffres RÉELS de la fiche. */
  measured: boolean;
  perDay: number;
  perMonth: number;
  perYear: number;
  /** La phrase à dire, avec la réserve d'honnêteté si c'est une hypothèse. */
  sentence: string;
}

export interface Objection {
  /** Ce qu'il dira. */
  says: string;
  /** Ce qu'il pense vraiment. */
  means: string;
  /** La réponse — courte, factuelle, sans combat. */
  answer: string;
}

export interface PaymentOption {
  label: string;
  detail: string;
}

export interface Argumentaire {
  prospectId: string;
  accountName: string;
  /** 1. Comment se présenter. */
  intro: string;
  /** 2. Les questions qui font constater le problème (pas plus de 3-4). */
  questions: string[];
  /**
   * 2bis. Les questions de DÉBLOCAGE DES FONDS — à poser après l'accord de
   * principe. C'est ce qui transforme un « oui » en date de virement.
   */
  budgetQuestions: string[];
  /** 3. La norme du marché dont il est sorti. */
  marketStandard: string[];
  /** 4. Ce que l'inaction lui coûte. */
  losses: Losses;
  /** 5. L'offre + le prix. */
  offer: { what: string; price: string; ladder: LadderResult };
  /**
   * 5bis. LA GARANTIE, quand l'offre routée est Alpha Voice.
   *
   * ⚠ Elle est ici, à CÔTÉ du prix, et pas dans une section « bonus » plus
   * bas : à zéro vente, c'est la garantie qui remplace la preuve sociale, et
   * un prix annoncé sans elle est un prix nu. La règle qui va avec est écrite
   * dans `DEROULE` (lib/offre-alpha-voice.ts) : le prix ne se dit jamais sans
   * la garantie qui l'accompagne.
   *
   * `null` quand l'offre routée n'est pas Alpha Voice — on n'invente pas une
   * garantie pour une offre qui n'en a pas.
   */
  garantie: { nom: string; promesse: string; limite: string } | null;
  /** 6. Nos devoirs. */
  ourDuties: string[];
  /** 6bis. Ses droits. */
  theirRights: string[];
  /** 7. Pourquoi il dirait non. */
  objections: Objection[];
  /** 8. Pourquoi ne rien faire coûte plus cher. */
  urgency: string;
  /** 9. Solutions de paiement si le budget est contraint. */
  payment: PaymentOption[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/**
 * Ce que l'inaction lui coûte, par jour / mois / an.
 * Si on a ses vrais chiffres (appels manqués, panier, taux), on calcule.
 * Sinon on prend des hypothèses PRUDENTES et on le DIT — un chiffre présenté
 * comme mesuré alors qu'il est supposé se retourne contre nous au cadrage.
 */
function computeLosses(p: Prospect): Losses {
  const a = p.deepAudit ?? {};
  const missed = a.missedCallsPerWeek;
  const ticket = a.avgTicket;
  const conv = a.conversionRate;

  // La taxe d'ignorance déjà saisie prime : c'est un chiffre validé terrain.
  if ((p.ignoranceTax ?? 0) > 0) {
    const perMonth = p.ignoranceTax;
    return {
      measured: true,
      perDay: Math.round(perMonth / 30),
      perMonth,
      perYear: perMonth * 12,
      sentence: `Aujourd'hui, ne rien changer vous coûte environ ${eur(perMonth)} par mois — soit ${eur(perMonth * 12)} sur l'année.`,
    };
  }

  const measured = missed !== undefined && ticket !== undefined;
  const r = recovery({
    missedPerWeek: missed ?? 0,
    avgTicket: ticket ?? 0,
    conversionPct: conv ?? 20, // hypothèse prudente si non mesurée
  });

  if (!measured || r.perMonth <= 0) {
    return {
      measured: false,
      perDay: 0,
      perMonth: 0,
      perYear: 0,
      sentence:
        "Je ne vous annonce pas de chiffre : je n'ai pas encore vos volumes. C'est exactement ce qu'on mesure ensemble — " +
        "et si la perte est négligeable, je vous le dirai.",
    };
  }

  return {
    measured: true,
    perDay: Math.round(r.perMonth / 30),
    perMonth: r.perMonth,
    perYear: r.perYear,
    sentence:
      `Sur ${missed} demandes manquées par semaine, à ${eur(ticket!)} de panier et ${conv ?? 20} % de conversion : ` +
      `environ ${eur(r.perMonth)} par mois, ${eur(r.perYear)} par an. C'est une estimation basée sur VOS chiffres, pas une promesse.`,
  };
}

/** Le prix, selon le compte qui porte le deal. */
function priceLine(accountId: string, p: Prospect): string {
  const a = getAccount(accountId);
  if (a.id === "nuwacom") {
    return "Chantier sur devis, établi APRÈS le cadrage — on chiffre ce dont vous avez besoin, pas un forfait.";
  }
  const setup = (p.setupValue ?? 0) > 0 ? eur(p.setupValue) : null;
  return setup
    ? `${setup} d'installation${(p.monthlyValue ?? 0) > 0 ? `, puis ${eur(p.monthlyValue)}/mois` : ""}.`
    : "Deux formats : 10 000 € en VIP (tout est pris en charge), ou 30 % + les frais d'installation sur devis.";
}

export function buildArgumentaire(p: Prospect, accountId = "eagleye", opts: { automationWanted?: boolean } = {}): Argumentaire {
  const account = getAccount(accountId);
  const ladder = buildLadder(p, opts);
  const losses = computeLosses(p);
  const signs = vitalSigns(p);
  const a = p.deepAudit ?? {};

  // ── 1. Se présenter : court, situé, sans pitch ──
  const intro =
    `« ${p.name?.trim() && !/^(g[ée]rant|cabinet|accueil|contact)$/i.test(p.name) ? p.name : "Bonjour"}, ` +
    `je suis Zakaria, de ${account.name}${account.city ? `, à ${account.city}` : ""}. ` +
    `Je travaille avec des ${p.sector === "artisan" ? "artisans" : "entreprises"} du secteur sur un point précis : ` +
    `les demandes qui arrivent et qui ne sont jamais traitées. Je vous vole deux minutes — dites-moi si ça vous parle ou pas. »`;

  /**
   * ── 2. Les questions qui font CONSTATER (jamais affirmer à sa place) ──
   *
   * ⚠ ELLES ÉTAIENT TOUTES ÉCRITES AU TÉLÉPHONE, ET CE MODULE ALIMENTE LE
   * BRIEF D'APPEL.
   *
   * `campaign-runner` colle `argu.questions` sous « Questions qui font
   * constater » dans le brief de l'agent vocal. Une fois le script rendu
   * conforme à l'offre routée, une fiche « visibilité » recevait donc :
   *
   *   Offre représentée : Visibilité / Growth
   *   Questions : « Quand vous êtes en intervention et que le téléphone
   *                 sonne, il se passe quoi ? »
   *
   * La même contradiction, d'un cran plus bas — et elle annulait la
   * correction faite au-dessus.
   *
   * La STRUCTURE, elle, ne dépendait pas du canal : ce qui se passe quand une
   * demande arrive · combien s'en perdent · ce que vaut un client · ce que
   * deviennent les perdus. Seule la formulation était verrouillée. Les trois
   * premières viennent donc de l'offre ; celle du panier n'a jamais été
   * spécifique et ne bouge pas.
   */
  const offre = deepDive(p, accountId).offer;
  const o = OFFRES[offre];

  const questions = [
    o.question ?? "Aujourd'hui, une nouvelle demande vous arrive comment — et il se passe quoi ensuite ?",
    // Le chiffre de la fiche prime sur la question générique : on ne redemande
    // pas ce qu'on a déjà noté, on le fait CONFIRMER et prolonger.
    offre === "alpha-voice" && a.missedCallsPerWeek !== undefined
      ? `Vous m'avez dit ${a.missedCallsPerWeek} appels manqués par semaine — sur ces appels, combien rappellent ?`
      : o.perte ?? "Sur dix demandes qui arrivent, combien aboutissent vraiment ?",
    a.avgTicket === undefined
      ? "Un client qui passe commande, ça représente combien en moyenne ?"
      : `À ${eur(a.avgTicket)} le client, une demande perdue c'est combien pour vous ?`,
    o.consequence ?? "Et ceux que vous perdez en route — vous pensez qu'ils font quoi ?",
  ];

  // ── Questions BUDGET : le déblocage réel, pas l'accord de principe ──
  // Un « oui » sans date de déblocage n'est pas une vente. Ces questions se
  // posent APRÈS l'accord de principe, jamais avant : posées trop tôt, elles
  // transforment une découverte en négociation.
  const budgetQuestions = [
    p.funding?.availableAt
      ? `Vous m'aviez dit que les fonds se débloquent vers le ${new Date(p.funding.availableAt).toLocaleDateString("fr-FR")} — c'est toujours d'actualité ?`
      : "Côté compta, à partir de quand vous pouvez débloquer les fonds ?",
    p.funding?.channel
      ? `On reste sur ${p.funding.channel} pour le règlement ?`
      : "Vous réglez par quel canal habituellement — virement, prélèvement, autre ?",
    p.funding?.approver
      ? `C'est toujours ${p.funding.approver} qui valide ?`
      : "Qui valide la dépense de votre côté, en dehors de vous ?",
    "Il y a une contrainte de calendrier — clôture, budget annuel, trésorerie — dont je devrais tenir compte ?",
  ];

  /**
   * ── 3. La norme du marché ──
   *
   * ⚠ CES TROIS LIGNES PARLENT DE TÉLÉPHONE, ET ELLES SORTAIENT SUR LES TROIS
   * OFFRES. Sur une fiche routée « visibilité », l'argumentaire affirmait que
   * « vos concurrents équipés répondent 24/7 » — hors sujet, et ça décrédibilise
   * tout le reste de l'échange.
   *
   * ⚠⚠ ET ON N'ÉCRIT PAS LES DEUX AUTRES. La tentation était d'inventer trois
   * lignes équivalentes pour la visibilité et pour Alpha Sales OS. Ce sont des
   * affirmations sur le MARCHÉ, dites à un prospect : CLAUDE.md pose que sans
   * vente ni mesure, les produire revient à fabriquer de la preuve. Zéro client
   * sur ces deux offres aujourd'hui.
   *
   * Le bloc est donc VIDE hors Alpha Voice, et l'écran qui l'affiche le dit. Un
   * argumentaire sans « norme du marché » se tient parfaitement : les questions
   * font constater, les pertes sont chiffrées sur SES données. Ce qui ne se
   * tiendrait pas, c'est une norme inventée qu'un prospect vérifie.
   *
   * Réserve valable aussi pour les lignes qui restent : elles n'ont aucune
   * source attachée. Elles étaient là avant, elles sont plausibles, et ce
   * n'est pas pareil que mesuré.
   *
   * ⚠⚠⚠ UNE DES TROIS EST TOMBÉE, ET C'ÉTAIT LA PLUS DANGEREUSE.
   *
   * « Vos concurrents équipés répondent 24/7 » affirmait au prospect un fait
   * sur SON marché, que nous n'avons jamais mesuré — et que lui peut vérifier
   * en trois appels. S'il en trouve deux qui ne décrochent pas le soir, ce
   * n'est pas cette ligne qui tombe : c'est tout l'échange.
   *
   * Le paragraphe juste au-dessus condamnait déjà l'idée (« une norme inventée
   * qu'un prospect vérifie ») ; la ligne restait parce qu'« elle était là
   * avant ». Elle est remplacée par le TEST lui-même : on ne lui affirme rien,
   * on lui donne le geste qui vérifie. Si le marché ne répond pas le soir,
   * l'argument s'établit tout seul et il est vrai ; si le marché répond,
   * mieux vaut le savoir avant de le dire.
   */
  const marketStandard =
    offre === "alpha-voice"
      ? [
          "Aujourd'hui un client qui n'obtient pas de réponse appelle le suivant dans les 5 minutes — il n'attend plus.",
          "Appelez trois de vos concurrents un soir à 21h : c'est exactement le test que fait votre client, et vous aurez la réponse avant moi.",
          "Un accueil qui décroche systématiquement, c'est devenu le minimum attendu — plus un avantage.",
        ]
      : [];

  // ── 5. L'offre ──
  const what = ladder.entry
    ? `${ladder.entry.label} — ${ladder.entry.pitch}`
    : "On commence par mesurer, puis on traite le point qui vous coûte le plus.";

  // ── 6. Devoirs / droits : ce qui rend l'engagement SÛR pour lui ──
  const ourDuties = [
    "On vous livre un audit écrit de votre situation, que vous signiez ou non.",
    // Reformulé, pas assoupli. « On installe et on paramètre » a déclenché le
    // garde `CLIENTELE_AFFIRMEE` : c'est un faux positif — la phrase décrit ce
    // qu'on fera POUR LUI, elle n'affirme aucun client. On tourne la phrase
    // autrement plutôt que de resserrer le motif, exactement comme pour
    // `lib/proof.ts` : un motif qui devine le contexte laisserait passer la
    // vraie faute (« les garages qu'on équipe »).
    "L'installation et le paramétrage sont pour nous : vous n'avez rien de technique à faire.",
    "On vous dit si notre solution ne sert à rien chez vous — on ne vend pas ce qui ne servira pas.",
    "Un interlocuteur unique, joignable, du début à la fin.",
  ];
  const theirRights = [
    "Vous décidez après le cadrage, jamais pendant l'appel.",
    "Vous gardez vos données et vos accès : rien ne vous enferme.",
    "Vous pouvez arrêter l'abonnement — on ne vous retient pas par le contrat.",
    "Aucun engagement tant que vous n'avez pas vu le devis écrit.",
  ];

  // ── 7. Pourquoi il dirait non ──
  const objections: Objection[] = [
    {
      says: "« Je vais y réfléchir. »",
      means: "Il n'a pas vu le coût de ne rien faire, ou il n'est pas le seul à décider.",
      answer:
        "« Bien sûr. Juste pour que votre réflexion soit complète : sur quoi vous voulez réfléchir — le prix, le moment, ou l'utilité ? »",
    },
    {
      says: "« C'est trop cher. »",
      means: "Le prix est comparé à zéro, pas à ce que la situation lui coûte déjà.",
      answer: losses.measured
        ? `« Comparé à quoi ? Aujourd'hui la situation vous coûte ${eur(losses.perMonth)} par mois. La question n'est pas le prix, c'est le solde. »`
        : "« Comparé à quoi ? Mesurons d'abord ce que ça vous coûte aujourd'hui — ensuite on parle du prix. »",
    },
    {
      says: "« On gère déjà en interne. »",
      // Le CONSTAT est le même sur les trois offres — quelqu'un s'en occupe
      // quand il peut. Seul l'exemple était verrouillé sur le téléphone.
      means: "Quelqu'un s'en occupe quand il peut — ce n'est pas un process, c'est de la bonne volonté.",
      answer:
        offre === "alpha-voice"
          ? "« Et quand cette personne est en congé, ou en intervention ? C'est là que ça se perd, et personne ne le voit passer. »"
          : "« Et quand cette personne est en congé, ou prise par autre chose ? C'est là que ça se perd, et personne ne le voit passer. »",
    },
    {
      says: "« Rappelez-moi dans 3 mois. »",
      means: "Ce n'est pas prioritaire aujourd'hui — ou il évite de dire non.",
      answer:
        "« Je peux. Simplement, d'ici là, la perte continue de tourner. On peut aussi mesurer maintenant, et vous décidez à ce moment-là en connaissance de cause. »",
    },
  ];
  // Ses objections RÉELLES passent devant les objections génériques.
  for (const o of (p.objections ?? []).filter((x) => x.status !== "traitee").slice(0, 3)) {
    objections.unshift({
      says: citer(o.label),
      means: "Objection réellement entendue sur ce dossier — à traiter en priorité.",
      answer: o.counter?.trim() || "À préparer AVANT le prochain échange : elle est déjà sortie une fois.",
    });
  }

  // ── 8. L'urgence : le coût d'attendre, pas une fausse rareté ──
  const urgency = losses.measured
    ? `Chaque jour d'attente coûte environ ${eur(losses.perDay)}. Un mois de réflexion, c'est ${eur(losses.perMonth)} — ` +
      `souvent plus que l'installation elle-même. L'urgence n'est pas commerciale, elle est arithmétique.`
    : "Il n'y a pas d'urgence artificielle. La seule urgence, c'est que la perte tourne pendant qu'on en parle — mesurons-la.";

  // ── 9. Payer quand le budget est contraint ──
  const payment: PaymentOption[] = [
    { label: "Paiement en plusieurs fois", detail: "L'installation étalée sur 2 ou 3 mensualités, sans frais." },
    { label: "Démarrer petit", detail: "Une seule brique d'abord (ex. l'accueil téléphonique seul), on étend ensuite si ça produit." },
    { label: "Palier d'abonnement réduit", detail: "On démarre au palier le plus bas et on monte seulement si le volume l'exige." },
    { label: "Décalage de démarrage", detail: "Signature maintenant, démarrage au mois suivant pour lisser la trésorerie." },
  ];
  if (signs.readiness < 50) {
    payment.push({
      label: "Rien tant que ce n'est pas mesuré",
      detail: "Tant qu'on n'a pas chiffré sa perte, on ne parle pas de paiement — c'est le meilleur moyen de perdre le dossier.",
    });
  }

  return {
    prospectId: p.id,
    accountName: account.name,
    intro,
    questions,
    budgetQuestions,
    marketStandard,
    losses,
    offer: { what, price: priceLine(account.id, p), ladder },
    /**
     * ⚠ Câblée ICI, dans le seul constructeur d'argumentaire, et pas dans un
     * écran : un export que rien ne consomme est mort, pas « prêt ». C'est le
     * défaut le plus fréquent de ce dépôt.
     */
    garantie:
      ladder.rungs.some((r) => r.id === "alpha-voice") || offre === "alpha-voice"
        ? { nom: GARANTIES[0].nom, promesse: GARANTIES[0].promesse, limite: GARANTIES[0].limite }
        : null,
    ourDuties,
    theirRights,
    objections,
    urgency,
    payment,
  };
}

/** L'argumentaire mis à plat pour un script (vocal ou écrit). */
export function argumentaireText(g: Argumentaire): string {
  const bullets = (arr: string[]) => arr.map((x) => `- ${x}`).join("\n");
  return [
    `# Argumentaire — ${g.accountName}`,
    "",
    "## 1. Se présenter",
    g.intro,
    "",
    "## 2. Questions qui font constater (poser, puis SE TAIRE)",
    bullets(g.questions),
    "",
    "## 2bis. Déblocage des fonds (APRÈS l'accord de principe)",
    bullets(g.budgetQuestions),
    "",
    "## 3. Ce qui se fait dans le marché",
    bullets(g.marketStandard),
    "",
    "## 4. Ce que ça coûte",
    g.losses.sentence,
    "",
    "## 5. Notre offre et son prix",
    g.offer.what,
    g.offer.price,
    "",
    "## 6. Nos devoirs",
    bullets(g.ourDuties),
    "",
    "## 6bis. Vos droits",
    bullets(g.theirRights),
    "",
    "## 7. Pourquoi il dirait non",
    g.objections.map((o) => `- ${o.says}\n  → il pense : ${o.means}\n  → réponse : ${o.answer}`).join("\n"),
    "",
    "## 8. Pourquoi attendre coûte plus cher",
    g.urgency,
    "",
    "## 9. Si le budget est contraint",
    bullets(g.payment.map((x) => `${x.label} : ${x.detail}`)),
  ].join("\n");
}
