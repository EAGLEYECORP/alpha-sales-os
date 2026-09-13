import type { Prospect } from "./types";
import { NUWACOM_THRESHOLD_HT } from "./accounts";
import { SATURATION_LOGEMENTS } from "./permis-construire";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ESCALIER — le check que subit CHAQUE prospect, dans cet ordre.
 *
 * Ce n'est pas un aiguillage (« une seule offre gagne »), c'est une
 * CASCADE : un même prospect peut déclencher plusieurs marches, et chaque
 * marche revient au compte qui sait la porter.
 *
 *   1. VISIBILITÉ ........... besoin détecté → EAGLEYE le gère (100 % : c'est
 *        notre société, il n'y a personne à qui reverser).
 *   2. VOLUME DE DEMANDES ... très élevé → ALPHA VOICE (EAGLEYE, 100 %).
 *   3. AUTOMATISATION ....... demande en plus → EAGLEYE (100 %).
 *        └─ argument de vente : Alpha Voice est le POINT D'ENTRÉE. Il capte
 *           l'information exacte sur chaque personne qui appelle. Quand on
 *           automatise ensuite, les données sont déjà là → moins de setup à
 *           payer. C'est ce qui rend l'ordre des marches vendable.
 *
 * ⚠ LA MARCHE 2 A CHANGÉ DE MAIN, PAS DE NATURE. Elle partait chez un
 * revendeur, à 30 % + 10 % du mensuel ; l'accord est mort. Le besoin ne meurt
 * pas avec lui — un commerce qui ne décroche pas perd le client — et Alpha
 * Voice fait ce travail. L'escalier garde donc ses quatre marches, et celle-ci
 * rapporte maintenant 100 % au lieu de 30 %.
 *   4. TROP GROS ............ parties qu'EAGLEYE ne peut pas porter →
 *        NUWACOM. Le gros devis justifie les 15 %, et la maintenance
 *        mensuelle qui suit revient à 100 % chez nous.
 *
 * Déterministe, sans clé, sans réseau : ça tourne à l'import sur tout un lot.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Marches, dans l'ordre imposé. */
export type RungId = "visibilite" | "alpha-voice" | "automatisation" | "gros-chantier";

/**
 * Seuil « volume de demandes très élevé » qui déclenche Alpha Voice
 * (appels/demandes manqués par semaine). Ajustable : c'est un curseur
 * commercial, pas une vérité — remonte-le si tu veux être plus sélectif.
 */
export const HIGH_DEMAND_PER_WEEK = 5;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SEUIL DE SATURATION CÔTÉ MAÎTRISE D'OUVRAGE — en lots à commercialiser.
 *
 * ⚠ IMPORTÉ, PAS RECOPIÉ. `SATURATION_LOGEMENTS` vit dans
 * `lib/permis-construire.ts`, qui l'explique et le date. Le réécrire ici
 * créerait deux définitions de « croule-t-il sous la demande ? » : l'import
 * dirait « demande faible » pendant que l'escalier proposerait la marche, et
 * c'est l'opérateur qui découvrirait la contradiction devant le prospect.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Rung {
  id: RungId;
  label: string;
  /** Compte qui porte CETTE marche. */
  accountId: string;
  accountName: string;
  /** Pourquoi elle s'est déclenchée — des faits, pas des adjectifs. */
  evidence: string[];
  /** L'argument à dire au prospect pour cette marche. */
  pitch: string;
  /**
   * ⚠ CE QUI NOUS REVIENT N'EST PLUS ÉCRIT ICI, ET C'EST UNE FUITE RÉELLE
   * QUI L'A FAIT SORTIR — pas une préférence de rangement.
   *
   * Ce module est atteint par le navigateur (`argumentaire` →
   * `components/prospects/master-panel`). Tout ce qu'un composant client
   * importe finit dans un chunk de `_next/static/**`, et ce chemin est
   * EXCLU du middleware : servi 200, sans cookie, sans mot de passe.
   *
   * Mesuré sur le build : `commissionPct:30` / `recurringPct:10` à côté du
   * nom d'un partenaire, et `commissionPct:15` à côté de « Nuwacom ». Autrement dit
   * notre part chez chaque partenaire, téléchargeable par ce partenaire —
   * alors que le taux Nuwacom est précisément ce qui se négocie APRÈS le
   * cadrage (CLAUDE.md).
   *
   * Aggravant : dans toute l'application, RIEN ne lisait ces deux champs.
   * Seuls des tests les touchaient. Ils voyageaient jusqu'au navigateur pour
   * personne.
   *
   * L'économie de chaque compte vit dans `lib/accounts-commercial.ts`, qui
   * ne descend pas dans le navigateur et qui n'est servi qu'au compte
   * maître (`/api/catalogue`). C'était déjà une deuxième copie des mêmes
   * nombres ; il n'en reste qu'une.
   *
   * L'escalier dit QUELLE marche et QUEL compte. Combien elle nous rapporte
   * se demande au serveur.
   */
}

export interface LadderResult {
  /** Les marches déclenchées, DANS L'ORDRE de l'escalier. */
  rungs: Rung[];
  /** La marche par laquelle on ENTRE (la première déclenchée). */
  entry: Rung | null;
  /** Comptes concernés par ce prospect (souvent plusieurs). */
  accountIds: string[];
  /** Récit d'une ligne pour la fiche / la salle de contrôle. */
  summary: string;
}

const filled = (v: string | undefined | null): boolean => {
  const t = (v ?? "").trim().toLowerCase();
  return t.length > 0 && t !== "n/a" && t !== "na" && t !== "-" && t !== "inconnu";
};

/** Site absent / obsolète, peu d'avis, réseaux morts → trou de visibilité. */
function visibilityEvidence(p: Prospect): string[] {
  const a = p.deepAudit ?? {};
  const out: string[] = [];
  const site = (a.websiteState ?? "").trim().toLowerCase();
  if (filled(a.websiteState)) {
    if (site === "aucun" || site === "aucune" || site === "non") out.push("aucun site");
    else if (/obsol|2014|vieux|datant/.test(site)) out.push(`site ${a.websiteState}`);
  }
  if (a.googleReviews !== undefined && a.googleReviews < 10) out.push(`${a.googleReviews} avis Google seulement`);
  if (a.googleRating !== undefined && a.googleRating < 4) out.push(`note Google ${a.googleRating}/5`);
  const social = (a.socialState ?? "").trim().toLowerCase();
  if (filled(a.socialState) && /aucun|faible|inactif|abandon/.test(social)) out.push("réseaux inactifs");
  return out;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PROSPECT CROULE-T-IL SOUS LES DEMANDES ? — deux FAMILLES, pas une.
 *
 * ⚠⚠ CE DÉTECTEUR ÉTAIT AVEUGLE AU MARCHÉ QU'ON PROSPECTE. Il ne lisait que
 * `missedCallsPerWeek` : le cadrage « appels manqués », que la verticale
 * maîtrise d'ouvrage **INTERDIT** explicitement (« Vous ratez des appels :
 * faux ici, et ça prouve qu'on n'a pas compris le métier »). Sur une fiche
 * issue d'un permis, ce champ est vide — la marche ne se déclenchait donc
 * jamais, et le silence ressemblait à « ce prospect n'a pas de problème de
 * volume ».
 *
 * ⚠⚠ ET LA PREUVE SEULE NE SUFFISAIT PAS. Le `pitch` de la marche était FIGÉ
 * sur « chaque appel manqué est un client qui appelle le concurrent » — la
 * phrase exacte que l'interdit refuse. Brancher la détection sans toucher au
 * pitch aurait produit le pire résultat possible : la marche se déclenche à
 * raison, et sert la phrase qui fait raccrocher. **La preuve et la phrase
 * doivent venir de la même source**, sinon l'une des deux ment.
 * ─────────────────────────────────────────────────────────────────────
 */
type FamilleDemande = "appels" | "lots";

interface SignalDemande {
  famille: FamilleDemande;
  evidence: string[];
}

function demandEvidence(p: Prospect): SignalDemande | null {
  const a = p.deepAudit ?? {};

  /**
   * Les lots d'abord : quand les deux signaux existent, c'est le métier du
   * prospect qui tranche, et un maître d'ouvrage n'entend jamais parler
   * d'appels manqués. L'ordre n'est pas une préférence, c'est un interdit.
   */
  const lots = a.lotsACommercialiser ?? 0;
  if (lots >= SATURATION_LOGEMENTS) {
    return {
      famille: "lots",
      // ⚠ La PREUVE peut citer les lots : elle est lue par l'opérateur.
      // Le PITCH ne le peut pas — la verticale interdit de l'annoncer à froid.
      evidence: [`${lots} lots à commercialiser — plus de contacts acquéreurs qu'une ou deux personnes n'en rappellent`],
    };
  }

  const out: string[] = [];
  const missed = a.missedCallsPerWeek ?? 0;
  if (missed >= HIGH_DEMAND_PER_WEEK) out.push(`${missed} appels manqués/semaine`);
  if (filled(a.currentProcess) && /d[ée]croche|standard|accueil|entre deux|seul/i.test(a.currentProcess))
    out.push(`process actuel : ${a.currentProcess}`);
  return out.length ? { famille: "appels", evidence: out } : null;
}

/**
 * Ce qui se PRONONCE sur la marche 2, selon ce qui l'a déclenchée.
 *
 * ⚠ La variante « lots » ne cite ni lot, ni permis, ni adresse : la verticale
 * refuse de les annoncer à froid (« la donnée est publique, mais l'annoncer
 * sonne fliqué »). Elle nomme la PERTE, qui est la sienne et qu'il reconnaît.
 */
const PITCH_DEMANDE: Record<FamilleDemande, { label: string; pitch: string }> = {
  appels: {
    label: "Alpha Voice (accueil & relance téléphone)",
    pitch: "« Chaque appel manqué est un client qui appelle le concurrent. On répond à votre place, 24/7. »",
  },
  lots: {
    label: "Alpha Voice (relance des contacts acquéreurs)",
    pitch:
      "« Entre deux points hebdo, personne ne peut dire quels acquéreurs intéressés n'ont pas été relancés " +
      "depuis trois semaines. On tient cette liste à jour, et on les rappelle. »",
  },
};

/**
 * L'escalier complet pour un prospect.
 * `automationWanted` : le prospect a exprimé un besoin d'automatisation en
 * plus (détecté au cadrage / à l'appel). On ne l'invente pas depuis des
 * signaux — c'est une DEMANDE, elle vient de la conversation.
 */
export function buildLadder(p: Prospect, opts: { automationWanted?: boolean } = {}): LadderResult {
  const rungs: Rung[] = [];

  // ── Marche 1 : visibilité → EAGLEYE ──
  const vis = visibilityEvidence(p);
  if (vis.length) {
    rungs.push({
      id: "visibilite",
      label: "Visibilité (site, présence, avis)",
      accountId: "eagleye",
      accountName: "EAGLEYE CORP",
      evidence: vis,
      pitch: "« On vous rend visible là où vos clients cherchent — puis on transforme ce trafic. »",
    });
  }

  // ── Marche 2 : volume de demandes très élevé → Alpha Voice (EAGLEYE) ──
  const dem = demandEvidence(p);
  if (dem) {
    const { label, pitch } = PITCH_DEMANDE[dem.famille];
    rungs.push({
      id: "alpha-voice",
      label,
      accountId: "eagleye",
      accountName: "EAGLEYE CORP",
      evidence: dem.evidence,
      pitch,
    });
  }

  // ── Marche 3 : automatisation en plus → EAGLEYE ──
  // L'argument dépend de la présence d'Alpha Voice en amont : s'il est là, le
  // setup coûte MOINS cher parce que la donnée d'entrée est déjà captée.
  if (opts.automationWanted) {
    const enAmont = rungs.some((r) => r.id === "alpha-voice");
    rungs.push({
      id: "automatisation",
      label: "Automatisation / digitalisation",
      accountId: "eagleye",
      accountName: "EAGLEYE CORP",
      evidence: ["demande d'automatisation exprimée"],
      pitch: enAmont
        ? "« Alpha Voice est votre point d'entrée : il capte l'information exacte sur chaque personne qui vous " +
          "appelle. Quand on automatise ensuite, on a déjà toutes les données et le process est cartographié — " +
          "vous payez donc MOINS de setup que si on partait de zéro. »"
        : "« On automatise le process là où il vous coûte du temps — en partant de vos vraies données, pas d'un modèle. »",
    });
  }

  // ── Marche 4 : trop gros pour nous → Nuwacom ──
  const dealValue = (p.setupValue ?? 0) + (p.monthlyValue ?? 0) * 12;
  if (dealValue > NUWACOM_THRESHOLD_HT) {
    rungs.push({
      id: "gros-chantier",
      label: `Gros chantier (> ${NUWACOM_THRESHOLD_HT.toLocaleString("fr-FR")} €) — plateforme Nuwacom`,
      accountId: "nuwacom",
      accountName: "Nuwacom",
      evidence: [`volume du deal estimé ${dealValue.toLocaleString("fr-FR")} € — trop lourd pour nous`],
      pitch:
        "« Sur un chantier de cette taille, on s'appuie sur une plateforme éprouvée — et on reste votre " +
        "interlocuteur unique sur la maintenance. »",
    });
  }

  const accountIds = Array.from(new Set(rungs.map((r) => r.accountId)));
  const entry = rungs[0] ?? null;
  const summary = rungs.length
    ? `${rungs.length} marche(s) : ${rungs.map((r) => `${r.label} → ${r.accountName}`).join(" · ")}`
    : "Aucune marche déclenchée — fiche trop pauvre, il faut d'abord la qualifier.";

  return { rungs, entry, accountIds, summary };
}

/** Le bloc d'argumentaire à injecter dans un script (vocal ou écrit). */
/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ CETTE FONCTION EST UNE FRONTIÈRE, PAS UN FORMATEUR.
 *
 * Son unique consommateur est `briefForScript`, c'est-à-dire le PROMPT d'un
 * appel en direct. Tout ce qu'elle rend se retrouve sous les yeux du modèle
 * pendant qu'il parle à quelqu'un.
 *
 * ── CE QUI PASSAIT ──
 *
 * Elle recopiait les marches telles quelles. Sur un deal estimé à 48 k, le
 * prompt d'un premier appel de prospection contenait, mot pour mot :
 *
 *   « 1. Gros chantier (> 40 000 €) — plateforme Nuwacom — volume du deal
 *      estimé 48 000 € — trop lourd pour nous »
 *
 * Soit : notre seuil de routage, notre estimation de SON budget, le nom du
 * partenaire, et un jugement interne. Pendant que la règle dure du même
 * script dit « tu ne donnes aucun prix ». Un modèle à qui on demande
 * « combien ça coûte ? » a le chiffre trois lignes plus haut.
 *
 * ── LA RÈGLE ──
 *
 * Ce qui décrit la situation DU PROSPECT passe (« 9 appels manqués par
 * semaine » : c'est son chiffre, il le connaît). Ce qui décrit NOTRE
 * arbitrage ne passe pas : montants, seuils, jugements sur la taille du
 * deal. Le filtre est volontairement large — retirer une ligne utile ne
 * coûte rien, en laisser passer une coûte un prix annoncé au téléphone.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Un montant, sous les formes qu'on écrit vraiment (48 000 €, 40k, 2 400 euros). */
const MONTANT = /\d[\d\s   ]*(?:€|k€|euros?|\bk\b)/i;

/** Ce qui relève de NOTRE arbitrage et n'a rien à faire dans un prompt d'appel. */
const ARBITRAGE_INTERNE = /trop lourd pour nous|pour nous\b|on passe la main|plancher|commission/i;

const prospectSafe = (s: string): boolean => !MONTANT.test(s) && !ARBITRAGE_INTERNE.test(s);

export function ladderPitch(l: LadderResult): string {
  if (!l.rungs.length) return "";
  return l.rungs
    .map((r, i) => {
      // Le libellé peut porter le seuil (« Gros chantier (> 40 000 €) ») : on
      // retire la parenthèse plutôt que la marche, sinon l'agent perd le fait
      // qu'une marche existe.
      const label = r.label.replace(/\s*\([^)]*\)/g, "").trim();
      const faits = r.evidence.filter(prospectSafe);
      const tete = faits.length ? `${label} — ${faits.join(", ")}` : label;
      return `${i + 1}. ${tete}\n   ${r.pitch}`;
    })
    .join("\n");
}
