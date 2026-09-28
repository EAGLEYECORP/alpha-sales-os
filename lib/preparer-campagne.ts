import type { Prospect } from "@/lib/types";
import { eligibleColdMail, construireMailCold } from "@/lib/mail-autopilote";
import { verifieDivulgation, type ModeProduction } from "@/lib/signature-ia";

/**
 * ─────────────────────────────────────────────────────────────────────
 * PRÉPARER UNE CAMPAGNE À FROID — le PLAN, jamais l'envoi.
 *
 * Décidé le 28/09/2026. Pour qu'un agent (Claude Cowork) « fasse le taff », il
 * lui faut plus que lire le pipe et proposer : il doit pouvoir COMPOSER un lot
 * d'emails à froid prêt à partir. Ce module fait exactement ça, et s'arrête
 * là : il rend le TEXTE EXACT de chaque mail + un préflight, PLAFONNÉ au palier
 * d'envoi du jour. Il n'écrit rien, il n'envoie rien.
 *
 * ⚠⚠ POURQUOI ÇA S'ARRÊTE AU PLAN, ET PAS UN CRAN PLUS LOIN. Le serveur MCP est
 * asymétrique par conception : un agent qui orchestre un pipe réel doit pouvoir
 * se tromper sans que ça coûte un client. L'envoi reste derrière les gardes de
 * `/api/send` (palier, DKIM, mentions) et derrière l'armement de l'autopilote,
 * qu'un HUMAIN décide. Ce module PRÉPARE ; la garde EXÉCUTE. Ne jamais coudre
 * l'envoi ici : ce serait donner la gâchette à l'agent.
 *
 * ⚠ Le texte est le MÊME que l'autopilote (`construireMailCold`) : un promoteur
 * reçoit le même message, qu'il parte d'un plan d'agent ou du tick serveur.
 * L'angle est « acquéreurs refroidis » et la divulgation IA (art. 50) est dans
 * le corps — le préflight le VÉRIFIE plutôt que de le supposer.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le mode réel de ces mails : rédigés ET envoyés sans relecture → « autonome ». */
const MODE: ModeProduction = "autonome";

/** Une ligne prête à partir. AUCUNE adresse email — juste le texte à relire. */
export interface LigneCampagne {
  id: string;
  company: string;
  subject: string;
  body: string;
}

/** Une fiche écartée, avec la raison exacte (jamais décoratif). */
export interface LigneEcartee {
  id: string;
  company: string;
  raison: string;
}

export interface PlanCampagne {
  /** Ce qui partirait, dans la limite du palier du jour. */
  retenus: LigneCampagne[];
  /** Ce qui NE part pas, et pourquoi. */
  ecartes: LigneEcartee[];
  /** Combien seraient éligibles AVANT le plafond du palier. */
  eligiblesTotal: number;
  /** true si le palier du jour a coupé le lot (il en reste pour demain). */
  plafonneAuPalier: boolean;
  /** Le plafond appliqué (palier du jour, éventuellement resserré). `null` si non fourni. */
  plafond: number | null;
  /**
   * ⚠ Les ids des retenus dont le corps NE porte PAS la divulgation IA. Doit
   * être vide : un mail autonome sans l'aveu art. 50 est illégal. S'il ne l'est
   * pas, l'appelant REFUSE le lot — on ne « corrige » pas en douce.
   */
  divulgationManquante: string[];
  /** Rien ne part d'ici : dit en clair pour que l'agent ne s'y trompe pas. */
  envoiBranche: false;
  resume: string;
}

/**
 * Construit le plan à partir des prospects fournis (déjà chargés côté serveur,
 * scoping opérateur). `plafond` = le palier d'envoi du jour ; au-dessus, on
 * garde les fiches en trop pour un prochain tour plutôt que de les brûler.
 */
export function preparerCampagne(
  prospects: Prospect[],
  opts: { plafond?: number | null } = {},
): PlanCampagne {
  const plafond = opts.plafond ?? null;

  const eligibles: LigneCampagne[] = [];
  const ecartes: LigneEcartee[] = [];
  for (const p of prospects) {
    const e = eligibleColdMail(p);
    if (!e.ok) {
      ecartes.push({ id: p.id, company: p.company, raison: e.raison });
      continue;
    }
    const { subject, body } = construireMailCold(p);
    eligibles.push({ id: p.id, company: p.company, subject, body });
  }

  const eligiblesTotal = eligibles.length;
  const plafonneAuPalier = plafond !== null && eligiblesTotal > plafond;
  const retenus = plafonneAuPalier ? eligibles.slice(0, plafond as number) : eligibles;

  // Préflight art. 50 sur CE QUI PARTIRAIT (les retenus), avec la même fonction
  // que `/api/send` — sinon le plan dirait « OK » et l'envoi refuserait.
  const divulgationManquante = retenus
    .filter((l) => verifieDivulgation(l.body, "email", MODE).length > 0)
    .map((l) => l.id);

  const resume =
    `${retenus.length} prêt(s)` +
    (plafonneAuPalier
      ? ` (plafonné au palier du jour ${plafond} sur ${eligiblesTotal} éligibles — le reste part au prochain tour)`
      : ` sur ${eligiblesTotal} éligible(s)`) +
    `, ${ecartes.length} écarté(s). ` +
    (divulgationManquante.length
      ? `⚠ ${divulgationManquante.length} sans divulgation IA — lot À NE PAS envoyer tant que ce n'est pas corrigé.`
      : `Divulgation IA (art. 50) présente sur tous. Rien ne part d'ici : à faire approuver, l'envoi reste gardé côté serveur.`);

  return {
    retenus,
    ecartes,
    eligiblesTotal,
    plafonneAuPalier,
    plafond,
    divulgationManquante,
    envoiBranche: false,
    resume,
  };
}
