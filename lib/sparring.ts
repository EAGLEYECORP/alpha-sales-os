import { verticalById, verticalForSector } from "./playbook";
import { clipDoctrine } from "./identity";
import { reglagesSansNotreIdentite } from "./identite-inscrit";
import type { Sector } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SPARRING — l'IA joue le prospect, un coach commente. Pur, serveur.
 *
 * ⚠⚠ MESURÉ LE 22/10/2026 : le prospect simulé était, pour TOUT compte, « un
 * patron de commerce local » à qui « un commercial de l'agence (ses services
 * aux commerces) » proposait « un audit gratuit de 20 minutes » — NOTRE premier
 * rendez-vous, sur NOTRE marché d'avant. La douleur et les objections venaient
 * de nos verticales (appels manqués, page Facebook), et le moteur local
 * corrigeait vers « une preuve locale » et « un créneau d'audit ». Un inscrit
 * qui vend un logiciel de paie s'entraînait donc à vendre notre offre.
 *
 * Le maître garde son sparring à l'identique (`tests/sparring-inscrit` le
 * compare mot pour mot). Un non-maître joue contre un décideur qui objecte à
 * SON offre ; notre marque et notre ancienne offre, si un vieux navigateur les
 * envoie encore, sont effacées (`reglagesSansNotreIdentite`), jamais devinées.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface SparringRequest {
  prospect: {
    company: string;
    name: string;
    sector: string;
    pitch: string;
    objections: string[];
  };
  history: { role: "closer" | "prospect"; text: string }[];
  businessRules: string;
  /** verticale du playbook terrain (défaut : déduite du secteur) */
  verticalId?: string;
  /** Nom de l'agence + ce qu'elle vend (white-label). */
  agencyName?: string;
  offerLine?: string;
}

export interface SparringReply {
  prospect: string;
  coach: string;
  status: "continue" | "gagne" | "perdu";
}

const PRIX = /€|euro|prix|tarif/i;

function historique(body: SparringRequest): string {
  return body.history
    .map((m) => `${m.role === "closer" ? "COMMERCIAL" : "PROSPECT"}: ${m.text}`)
    .join("\n");
}

/** Ce que l'inscrit dit vendre, sans ce qui serait à nous. */
function sonIdentite(body: SparringRequest): { agence: string; offre: string } {
  const patch = reglagesSansNotreIdentite({ agencyName: body.agencyName, offer: { whatYouSell: body.offerLine } });
  return {
    agence: (patch?.agencyName ?? body.agencyName ?? "").trim(),
    offre: (patch?.offer?.whatYouSell ?? body.offerLine ?? "").trim(),
  };
}

export function promptSparring(body: SparringRequest, maitre: boolean): string {
  const hist = historique(body);
  if (!maitre) return promptInscrit(body, hist);

  // Le playbook terrain rend le sparring réaliste : le prospect joué par
  // l'IA sort les VRAIES objections entendues sur le terrain, et le coach
  // corrige selon la méthode maison (pas selon des généralités de vente).
  const v =
    verticalById(body.verticalId ?? "") ?? verticalForSector(body.prospect.sector as Sector);
  const fieldBlock = v
    ? `\nVerticale : ${v.label}. Douleur structurelle : ${v.structuralPain}\nObjections RÉELLES de ce métier (sers-t'en en priorité, dans tes mots) : ${v.objections.map((o) => `« ${o.q} »`).join(" ; ")}\nLe coach corrige selon la méthode maison : permission d'abord, ciblage par critère jamais par volume, observation posée en question, deux questions puis silence, une seule capacité à la bascule, CTA en choix fermé, jamais de chiffre € ni de note Google à froid.`
    : "";

  const agency = body.agencyName?.trim() || "l'agence";
  const offer = body.offerLine?.trim() || "ses services aux commerces";
  return `Tu joues un patron de commerce local sceptique et pressé : ${body.prospect.name}, gérant de ${body.prospect.company} (${body.prospect.sector}).${fieldBlock}
Un commercial de ${agency} (${offer}) essaie de te convaincre d'accepter un audit gratuit de 20 minutes.
Reste DANS LE PERSONNAGE : méfiant mais juste. S'il répond bien (douleur, preuve, next step daté, zéro jargon), tu t'adoucis. S'il pitche le produit, parle prix trop tôt ou reste vague, tu durcis.
Contexte réel du prospect : ${body.prospect.pitch || "une organisation dont la vente repose sur des personnes, sans système qui suit"}.
Ses objections favorites : ${body.prospect.objections.join(" ; ") || "pas le temps, trop cher, j'ai déjà ce qu'il faut"}.
Règles de vente de l'agence (le coach s'y réfère) : ${clipDoctrine(body.businessRules)}

Conversation jusqu'ici :
${hist}

Réponds UNIQUEMENT en JSON strict, rien d'autre :
{"prospect":"ta réplique en personnage (1-2 phrases, ton parlé, français)","coach":"1 conseil bref et concret au commercial sur sa DERNIÈRE réponse","status":"continue|gagne|perdu"}
status="gagne" si le commercial vient d'obtenir un RDV d'audit daté ; "perdu" si après 5+ échanges il n'y arrive toujours pas ; sinon "continue".`;
}

/**
 * ⚠ Aucune verticale ici : leur douleur structurelle et leurs objections
 * « réelles » sont celles entendues sur NOTRE offre. Les objections du
 * prospect viennent de SA fiche ; à défaut, des objections que n'importe quel
 * décideur oppose à n'importe quelle offre.
 */
function promptInscrit(body: SparringRequest, hist: string): string {
  const { agence, offre } = sonIdentite(body);
  const qui = agence ? `de ${agence}` : "d'une entreprise";
  const quoi = offre ? `, qui propose ${offre},` : "";
  return `Tu joues un décideur sceptique et pressé : ${body.prospect.name || "le responsable"}, chez ${body.prospect.company}.
Un commercial ${qui}${quoi} essaie d'obtenir de toi un rendez-vous daté.
Reste DANS LE PERSONNAGE : méfiant mais juste. S'il te demande la permission, te pose de vraies questions sur ta situation et propose une étape claire et datée, sans jargon, tu t'adoucis. S'il récite son offre, parle prix trop tôt ou reste vague, tu durcis.
N'invente aucun fait sur son offre : tu n'en sais que ce qu'il en dit.
Contexte réel du prospect : ${body.prospect.pitch || "une organisation qui n'a rien demandé et qui a déjà ses habitudes"}.
Ses objections favorites : ${body.prospect.objections.join(" ; ") || "pas le temps, pas le budget, on a déjà quelqu'un pour ça"}.
Méthode de vente (le coach s'y réfère) : ${clipDoctrine(body.businessRules)}
Le coach corrige selon cette méthode : permission d'abord, observation posée en question, deux questions puis silence, une seule chose à la bascule, créneau en choix fermé, jamais de prix à froid.

Conversation jusqu'ici :
${hist}

Réponds UNIQUEMENT en JSON strict, rien d'autre :
{"prospect":"ta réplique en personnage (1-2 phrases, ton parlé, français)","coach":"1 conseil bref et concret au commercial sur sa DERNIÈRE réponse","status":"continue|gagne|perdu"}
status="gagne" si le commercial vient d'obtenir un rendez-vous daté ; "perdu" si après 5+ échanges il n'y arrive toujours pas ; sinon "continue".`;
}

/** Moteur local : objections en boucle, verdict simple sur la qualité des réponses. */
export function moteurLocalSparring(body: SparringRequest, maitre: boolean): SparringReply {
  const closerTurns = body.history.filter((m) => m.role === "closer");
  const last = closerTurns.at(-1)?.text ?? "";
  const round = closerTurns.length;
  if (!maitre) return moteurLocalInscrit(body, closerTurns, last, round);

  const objs = body.prospect.objections.length
    ? body.prospect.objections
    : ["J'ai pas le temps là.", "C'est trop cher ces trucs.", "J'ai déjà une page Facebook, ça suffit."];

  const good =
    last.length > 50 &&
    !PRIX.test(last) && // pas de prix au téléphone
    /(audit|20 min|passe|mardi|jeudi|rdv|rendez-vous|chiffre|mesure|gratuit)/i.test(last);

  const coach = good
    ? "Bien : tu ramènes vers un créneau daté sans pitcher. Continue comme ça."
    : PRIX.test(last)
      ? "⛔ Tu as parlé prix avant la démo. Recentre : douleur → preuve → créneau d'audit."
      : "Trop court ou trop vague. Structure : sa douleur, une preuve locale, DEUX créneaux au choix.";

  if (round >= 4) {
    const wins = closerTurns.filter(
      (m) => m.text.length > 50 && /(audit|rdv|mardi|jeudi|créneau|gratuit)/i.test(m.text)
    ).length;
    if (wins >= 2)
      return { prospect: "Bon… d'accord. 20 minutes, pas plus. Passez mardi à 15h.", coach: "RDV daté obtenu — c'est exactement l'objectif. Rien de plus à vendre aujourd'hui.", status: "gagne" };
    return { prospect: "Écoutez, j'ai du travail. Laissez tomber.", coach: "Perdu : jamais 2 réponses orientées créneau. Objectif unique du premier contact : un RDV daté.", status: "perdu" };
  }

  const reply = good
    ? ["Mouais… et concrètement, ça donne quoi chez quelqu'un comme moi ?", "Admettons. Mais je vous préviens, j'ai déjà été déçu.", "20 minutes, vous dites ? Et vous vendez quoi au juste derrière ?"][round % 3]
    : `${objs[round % objs.length]}`;

  return { prospect: reply, coach, status: "continue" };
}

/**
 * Même mécanique, sans « audit », sans « preuve locale », sans « gratuit » :
 * ce qu'on récompense est un créneau daté obtenu sans prix, quelle que soit
 * l'offre. « Une preuve » n'est pas demandée — à zéro client, elle se fabrique.
 */
function moteurLocalInscrit(
  body: SparringRequest,
  closerTurns: SparringRequest["history"],
  last: string,
  round: number
): SparringReply {
  const objs = body.prospect.objections.length
    ? body.prospect.objections
    : ["J'ai pas le temps là.", "On n'a pas le budget pour ça.", "On a déjà quelqu'un pour ça."];
  const creneau = /(rdv|rendez-vous|créneau|mardi|jeudi|lundi|mercredi|vendredi|\d{1,2}\s*h)/i;
  const question = /\?/;

  const good = last.length > 50 && !PRIX.test(last) && (creneau.test(last) || question.test(last));
  const coach = good
    ? "Bien : tu poses une question ou tu proposes un créneau daté, sans réciter ton offre."
    : PRIX.test(last)
      ? "⛔ Tu as parlé prix avant la démonstration. Recentre : une question sur sa situation, puis DEUX créneaux au choix."
      : "Trop court ou trop vague. Demande la permission, pose UNE question sur sa situation, propose DEUX créneaux au choix.";

  if (round >= 4) {
    const wins = closerTurns.filter((m) => m.text.length > 50 && !PRIX.test(m.text) && creneau.test(m.text)).length;
    if (wins >= 2)
      return { prospect: "Bon… d'accord. Vingt minutes, pas plus. Mardi à 15h.", coach: "Rendez-vous daté obtenu — c'est exactement l'objectif. Rien de plus à vendre aujourd'hui.", status: "gagne" };
    return { prospect: "Écoutez, j'ai du travail. Laissez tomber.", coach: "Perdu : jamais deux créneaux proposés. Objectif unique du premier contact : un rendez-vous daté.", status: "perdu" };
  }

  const reply = good
    ? ["Mouais… et concrètement, ça change quoi pour nous ?", "Admettons. Mais je vous préviens, on a déjà été déçus.", "Et vous proposez quoi, au juste ?"][round % 3]
    : `${objs[round % objs.length]}`;
  return { prospect: reply, coach, status: "continue" };
}
