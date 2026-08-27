import { BRICKS, OUTBOUND_UNIT_CALLS, OUTBOUND_UNIT_HT, PACK_MONTHLY_HT, PACK_SETUP_HT } from "./bricks";
import { FIXED_COSTS, USD_TO_EUR, computeCosts, type CallVolumeInput } from "./voice-costs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE CHAQUE BRIQUE COÛTE, ET CE QU'ELLE DEVRAIT SE VENDRE.
 *
 * ⚠⚠ LA RÈGLE « PRIX = COÛT × 4 » NE MARCHE PAS SUR LA MOITIÉ DU CATALOGUE,
 * et il faut le dire avant de s'en servir.
 *
 * Elle est juste pour ce qui se consomme : téléphonie, minutes de voix,
 * jetons de modèle. Le coût monte avec l'usage, ×4 protège la marge.
 *
 * Elle est FAUSSE pour le logiciel. Le coût marginal du CRM pour un client
 * de plus est proche de zéro — l'hébergement est mutualisé sur TOUS les
 * clients. Quatre fois zéro fait zéro. Appliquée telle quelle, la règle dirait
 * de donner le CRM, le pilotage et le closer, c'est-à-dire six briques sur dix.
 *
 * Ce qu'une brique logicielle coûte VRAIMENT, c'est du TEMPS : l'installation
 * chez le client, et le support récurrent. Ce temps-là, on le facture. Le reste
 * du prix ne vient pas du coût mais de la VALEUR et du marché — deux choses
 * que ce module ne peut pas deviner et qu'il ne prétend donc pas connaître.
 *
 * ── LA DISCIPLINE, LA MÊME QUE PARTOUT ICI ──
 * Pas de taux d'heure inventé, pas de prix concurrent inventé. Les deux sont
 * des ENTRÉES obligatoires ; sans elles, le module rend `null` et dit ce qui
 * manque. Un prix inventé qu'on présente à un client est pire qu'un blanc :
 * on ne peut plus le défendre quand il demande d'où il sort.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qui fait le coût d'une brique. Trois natures, trois façons de chiffrer. */
export type NatureCout =
  /** Fournisseurs à l'usage : téléphonie, voix, jetons. Le ×4 s'applique. */
  | "consommation"
  /** Du temps : installation, paramétrage, support. Se facture au taux horaire. */
  | "temps"
  /** Coût marginal quasi nul (hébergement mutualisé). Le prix vient d'ailleurs. */
  | "logiciel";

export interface CoutBrique {
  brickId: string;
  nature: NatureCout;
  /**
   * Coût fournisseur par client et par mois, en €. 0 pour du logiciel pur.
   * ⚠ IGNORÉ quand `volumeDependant` est vrai — voir `consommationDe()`.
   */
  consommationMensuelleEur: number;
  /**
   * La consommation dépend du VOLUME d'appels, pas d'une constante.
   * `consommationDe()` interroge alors le modèle de coût réel.
   */
  volumeDependant?: boolean;
  /** Heures d'installation chez le client. */
  heuresSetup: number;
  /** Heures de support récurrent par mois. */
  heuresSupportMois: number;
  /** Ce qu'on ne sait pas, et qui rendrait le chiffre faux. */
  reserve: string;
}

/**
 * Les heures d'installation et de support, brique par brique.
 *
 * ⚠ CE SONT DES ESTIMATIONS DE CONCEPTION, pas des relevés : aucune
 * installation client n'a encore eu lieu. Elles se corrigent APRÈS la
 * première, en remplaçant les nombres ici — et le diff se voit.
 *
 * Le classement par nature, lui, n'est pas une estimation : il vient de ce que
 * la brique appelle réellement comme fournisseur.
 */
export const COUTS_BRIQUES: CoutBrique[] = [
  {
    brickId: "alpha-voice",
    nature: "consommation",
    /**
     * ⚠ CETTE VALEUR NE SERT PLUS — et pendant des semaines elle a menti.
     *
     * Le commentaire d'origine disait « calculé, pas posé : voir
     * `coutVoixMensuel` ». **Cette fonction n'a jamais existé dans le dépôt.**
     * Le variable ne s'ajoutait donc nulle part : `verdictBrique` chiffrait
     * Alpha Voice à 2 € de consommation, c'est-à-dire SANS COMPTER UN SEUL
     * APPEL. Sur la brique dont le coût est presque entièrement variable.
     *
     * Le vrai calcul existait à côté, dans `devisVoix` — encore deux modules
     * corrects qui ne se parlaient pas. `volumeDependant` les raccorde.
     * On garde le 2 € comme socle de repli si le modèle de volume échoue.
     */
    consommationMensuelleEur: 2,
    volumeDependant: true,
    heuresSetup: 12,
    heuresSupportMois: 2,
    reserve:
      "Le tarif Telnyx France n'est pas public et n'a jamais été relevé sur une facture réelle. " +
      "C'est la seule ligne de coût que je n'ai pas pu vérifier, et c'est la plus lourde.",
  },
  {
    brickId: "campagnes",
    nature: "consommation",
    // Rédaction des séquences par le modèle : quelques milliers de jetons par
    // prospect touché. Domine largement l'envoi lui-même (SMTP ≈ gratuit).
    consommationMensuelleEur: 8,
    heuresSetup: 6,
    heuresSupportMois: 1.5,
    reserve: "Dépend du volume d'envois du client — 8 € correspond à ~500 messages générés par mois.",
  },
  {
    brickId: "cerveau",
    nature: "logiciel",
    // La recherche est lexicale (BM25 fait main), sans base vectorielle et
    // sans appel externe. Le coût est celui du stockage : négligeable.
    consommationMensuelleEur: 0,
    heuresSetup: 5,
    heuresSupportMois: 1,
    reserve: "L'ingestion de gros volumes de documents peut demander du temps humain non compté ici.",
  },
  {
    brickId: "crm",
    nature: "logiciel",
    consommationMensuelleEur: 0,
    heuresSetup: 4,
    heuresSupportMois: 1,
    reserve: "Une reprise de données depuis un CRM existant n'est PAS comprise — elle se chiffre à part.",
  },
  {
    brickId: "audits",
    nature: "consommation",
    consommationMensuelleEur: 6,
    heuresSetup: 4,
    heuresSupportMois: 1,
    reserve: "~200 audits générés par mois. Au-delà, le poste jetons devient dominant.",
  },
  {
    brickId: "tracking",
    nature: "logiciel",
    consommationMensuelleEur: 0,
    heuresSetup: 3,
    heuresSupportMois: 0.5,
    reserve: "La configuration DNS dépend du registrar du client : de 20 minutes à une demi-journée.",
  },
  {
    brickId: "alpha-live",
    nature: "consommation",
    // Transcription en direct pendant les rendez-vous écoutés.
    consommationMensuelleEur: 5,
    heuresSetup: 4,
    heuresSupportMois: 1,
    reserve: "5 € ≈ 10 h de rendez-vous écoutés par mois. Un closer à plein temps coûterait davantage.",
  },
  {
    brickId: "closer",
    nature: "logiciel",
    consommationMensuelleEur: 2,
    heuresSetup: 3,
    heuresSupportMois: 0.5,
    reserve: "Le débrief vocal passe par la transcription serveur quand le navigateur ne la fait pas.",
  },
  {
    brickId: "agent-alpha",
    nature: "consommation",
    consommationMensuelleEur: 12,
    heuresSetup: 3,
    heuresSupportMois: 1,
    reserve: "Le poste le plus volatil : un opérateur qui discute toute la journée avec l'agent le fait tripler.",
  },
  {
    brickId: "pilotage",
    nature: "logiciel",
    consommationMensuelleEur: 0,
    heuresSetup: 2,
    heuresSupportMois: 0.5,
    reserve: "",
  },
];

/** Le multiple appliqué à la consommation. C'est la règle demandée. */
export const MULTIPLE_CONSOMMATION = 4;

export interface Hypotheses {
  /** Taux horaire chargé, en €. AUCUN défaut : c'est à toi de le poser. */
  tauxHoraireEur: number;
  /** Sur combien de mois on amortit l'installation dans le prix mensuel. */
  moisAmortissementSetup?: number;
}

export interface VerdictBrique {
  brickId: string;
  label: string;
  nature: NatureCout;
  /** Prix affiché aujourd'hui. */
  setupAfficheEur: number;
  mensuelAfficheEur: number;
  /** Coût mensuel réel (consommation + support). */
  coutMensuelEur: number;
  /** Coût d'installation (temps humain). */
  coutSetupEur: number;
  /**
   * Le plancher que la règle donne. `null` quand la règle ne s'applique pas :
   * ×4 d'un coût quasi nul ne dit rien d'utile.
   */
  plancherMensuelEur: number | null;
  /** Marge mensuelle au prix affiché, en € et en %. */
  margeMensuelleEur: number;
  margeMensuellePct: number;
  /** Combien de fois le coût le prix affiché représente. */
  multipleReel: number | null;
  verdict: "sous-facture" | "conforme" | "au-dessus" | "hors-regle";
  phrase: string;
  reserve: string;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Le verdict d'une brique : ce qu'elle coûte, ce qu'elle rapporte, et si la
 * règle ×4 est tenue.
 *
 * `hypotheses.tauxHoraireEur` est OBLIGATOIRE et n'a pas de valeur par défaut.
 * Un taux inventé se propagerait dans tous les prix du catalogue.
 */
export function verdictBrique(c: CoutBrique, h: Hypotheses): VerdictBrique | null {
  const brique = BRICKS.find((b) => b.id === c.brickId);
  if (!brique) return null;
  if (!(h.tauxHoraireEur > 0)) return null;

  const coutSupport = c.heuresSupportMois * h.tauxHoraireEur;
  const consommation = consommationDe(c);
  const coutMensuel = consommation + coutSupport;
  const coutSetup = c.heuresSetup * h.tauxHoraireEur;

  const margeMensuelleEur = brique.monthlyHT - coutMensuel;
  const margeMensuellePct = brique.monthlyHT > 0 ? Math.round((margeMensuelleEur / brique.monthlyHT) * 100) : 0;
  const multipleReel = coutMensuel > 0 ? arrondi(brique.monthlyHT / coutMensuel) : null;

  /**
   * ⚠ LE POINT QUI FAIT TOUTE LA DIFFÉRENCE.
   *
   * Sur une brique « logiciel », le coût de consommation est nul ou presque :
   * le plancher ×4 n'a aucun sens et le donner serait trompeur. On rend `null`
   * et on le DIT, au lieu de fabriquer un prix qui aurait l'air calculé.
   */
  const plancherMensuelEur =
    c.nature === "logiciel" && consommation <= 0
      ? null
      : arrondi(consommation * MULTIPLE_CONSOMMATION + coutSupport);

  let verdict: VerdictBrique["verdict"];
  let phrase: string;

  if (plancherMensuelEur === null) {
    verdict = "hors-regle";
    phrase =
      `${brique.label} — la règle ×4 ne s'applique pas : le coût marginal est quasi nul (hébergement mutualisé). ` +
      `Ce qui se facture ici, c'est le TEMPS : ${c.heuresSetup} h d'installation (${Math.round(coutSetup)} €) et ` +
      `${c.heuresSupportMois} h de support par mois (${Math.round(coutSupport)} €). Le reste du prix vient de la valeur ` +
      `et du marché, pas du coût — à arbitrer avec des prix concurrents relevés, pas devinés.`;
  } else if (brique.monthlyHT < plancherMensuelEur) {
    verdict = "sous-facture";
    phrase =
      `${brique.label} — SOUS-FACTURÉE. ${brique.monthlyHT} €/mois affichés pour un plancher de ` +
      `${Math.round(plancherMensuelEur)} € (consommation ${arrondi(consommation)} € ×${MULTIPLE_CONSOMMATION} ` +
      `+ support ${Math.round(coutSupport)} €). Il manque ${Math.round(plancherMensuelEur - brique.monthlyHT)} €.`;
  } else if (multipleReel !== null && multipleReel >= MULTIPLE_CONSOMMATION) {
    verdict = "conforme";
    phrase =
      `${brique.label} — ${brique.monthlyHT} €/mois pour ${Math.round(coutMensuel)} € de coût, soit ×${multipleReel}. ` +
      `La règle est tenue (marge ${margeMensuellePct} %).`;
  } else {
    verdict = "au-dessus";
    phrase =
      `${brique.label} — au-dessus du plancher (${Math.round(plancherMensuelEur)} €) mais seulement ×${multipleReel} ` +
      `du coût total support compris. La règle ×4 porte sur la consommation, pas sur le temps : ici c'est le support ` +
      `(${c.heuresSupportMois} h/mois) qui pèse, et il ne se multiplie pas — il se facture ou il se réduit.`;
  }

  return {
    brickId: c.brickId,
    label: brique.label,
    nature: c.nature,
    setupAfficheEur: brique.setupHT,
    mensuelAfficheEur: brique.monthlyHT,
    coutMensuelEur: arrondi(coutMensuel),
    coutSetupEur: arrondi(coutSetup),
    plancherMensuelEur,
    margeMensuelleEur: arrondi(margeMensuelleEur),
    margeMensuellePct,
    multipleReel,
    verdict,
    phrase,
    reserve: c.reserve,
  };
}

export interface AuditCatalogue {
  verdicts: VerdictBrique[];
  /** Somme des briques prises séparément. */
  sommeSetupEur: number;
  sommeMensuelEur: number;
  /** Le pack complet, tel qu'affiché. */
  packSetupEur: number;
  packMensuelEur: number;
  /** La remise que le pack représente, en %. */
  remiseSetupPct: number;
  remiseMensuelPct: number;
  /** Coût total de l'installation complète, en temps humain. */
  coutSetupCompletEur: number;
  heuresSetupCompletes: number;
  lecture: string[];
  manque: string[];
}

/**
 * L'audit du catalogue entier — et la question du pack complet.
 *
 * Le pack est une ANCRE : il se compare à la somme des briques, et cette
 * comparaison dit quelque chose au client, qu'on le veuille ou non.
 */
export function auditerCatalogue(h: Hypotheses): AuditCatalogue {
  const verdicts = COUTS_BRIQUES.map((c) => verdictBrique(c, h)).filter((v): v is VerdictBrique => v !== null);

  const sommeSetupEur = BRICKS.reduce((s, b) => s + b.setupHT, 0);
  const sommeMensuelEur = BRICKS.reduce((s, b) => s + b.monthlyHT, 0);
  const heuresSetupCompletes = COUTS_BRIQUES.reduce((s, c) => s + c.heuresSetup, 0);
  const coutSetupCompletEur = arrondi(heuresSetupCompletes * (h.tauxHoraireEur || 0));

  const remiseSetupPct = sommeSetupEur > 0 ? Math.round((1 - PACK_SETUP_HT / sommeSetupEur) * 100) : 0;
  const remiseMensuelPct = sommeMensuelEur > 0 ? Math.round((1 - PACK_MONTHLY_HT / sommeMensuelEur) * 100) : 0;

  const lecture: string[] = [];
  const manque: string[] = [];

  if (!(h.tauxHoraireEur > 0)) {
    manque.push(
      "Le taux horaire chargé — sans lui, aucun prix de brique logicielle ne peut être calculé, et six briques sur dix sont dans ce cas."
    );
    return {
      verdicts: [],
      sommeSetupEur,
      sommeMensuelEur,
      packSetupEur: PACK_SETUP_HT,
      packMensuelEur: PACK_MONTHLY_HT,
      remiseSetupPct,
      remiseMensuelPct,
      coutSetupCompletEur: 0,
      heuresSetupCompletes,
      lecture: ["Aucun calcul possible : le taux horaire n'est pas posé."],
      manque,
    };
  }

  lecture.push(
    `À la carte, les dix briques font ${sommeSetupEur} € de setup et ${sommeMensuelEur} €/mois. ` +
      `Le pack complet est à ${PACK_SETUP_HT} € et ${PACK_MONTHLY_HT} €/mois.`
  );

  /**
   * ⚠ UNE REMISE DE MOITIÉ DIT LE CONTRAIRE DE « ÉLITE ».
   *
   * C'est le point à trancher avant de mettre la grille en ligne : un pack à
   * moins de la moitié de la somme des briques n'annonce pas une offre haut
   * de gamme, il annonce que les briques à l'unité sont surévaluées. Le
   * client le calcule en dix secondes.
   */
  if (remiseSetupPct >= 40 || remiseMensuelPct >= 40) {
    lecture.push(
      `Le pack représente une remise de ${remiseSetupPct} % sur le setup et ${remiseMensuelPct} % sur le mensuel. ` +
        `À ce niveau-là, ce n'est plus un pack, c'est un aveu : le client en déduit que les briques à l'unité sont ` +
        `gonflées. Deux sorties cohérentes — baisser les prix à la carte, ou monter le pack. Pas les deux à la fois, ` +
        `et pas « on verra » : c'est la première chose qu'un acheteur compare.`
    );
  }

  const sous = verdicts.filter((v) => v.verdict === "sous-facture");
  const hors = verdicts.filter((v) => v.verdict === "hors-regle");

  for (const v of sous) lecture.push(v.phrase);
  if (hors.length) {
    lecture.push(
      `${hors.length} brique(s) sur ${verdicts.length} ont un coût marginal quasi nul : ` +
        `${hors.map((v) => v.label).join(", ")}. Leur prix ne se déduit d'aucun coût — il se décide face au marché.`
    );
  }

  lecture.push(
    `L'installation complète représente ${heuresSetupCompletes} h de travail, soit ${coutSetupCompletEur} € au taux posé. ` +
      `Le pack setup à ${PACK_SETUP_HT} € couvre ce temps ${arrondi(PACK_SETUP_HT / Math.max(1, coutSetupCompletEur))} fois.`
  );

  manque.push(
    "Les prix pratiqués par les concurrents — la règle « un peu moins que le marché » exige de connaître le marché, et aucun relevé n'existe dans ce dépôt.",
    "Les heures d'installation sont des estimations de conception : aucune installation client n'a eu lieu. À corriger après la première."
  );

  return {
    verdicts,
    sommeSetupEur,
    sommeMensuelEur,
    packSetupEur: PACK_SETUP_HT,
    packMensuelEur: PACK_MONTHLY_HT,
    remiseSetupPct,
    remiseMensuelPct,
    coutSetupCompletEur,
    heuresSetupCompletes,
    lecture,
    manque,
  };
}

// ─────────────────────────────────────────────────────────────────────
// ALPHA VOICE — le chiffrage d'un lot d'appels, jetons compris.
// ─────────────────────────────────────────────────────────────────────

/**
 * Les jetons d'un appel vocal — et pourquoi ils comptent moins qu'on ne croit.
 *
 * Un appel n'envoie pas UNE requête au modèle : à chaque tour de parole, tout
 * l'historique repart. C'est ce qui fait peur au premier calcul. Mais un appel
 * de trois minutes fait une dizaine de tours, pas mille, et les modèles
 * économiques sont à quelques centimes le million de jetons.
 *
 * ⚠ LES TARIFS DES MODÈLES CHANGENT et je n'ai pas pu les relever depuis cet
 * environnement (le proxy sortant bloque). Ceux-ci viennent de ma connaissance
 * d'entraînement : à VÉRIFIER sur la page de tarifs avant de s'en servir dans
 * un devis. Le rapport entre les modèles, lui, est stable.
 */
export interface TarifModele {
  id: string;
  label: string;
  /** USD par million de jetons en entrée. */
  usdEntreeParMillion: number;
  /** USD par million de jetons en sortie. */
  usdSortieParMillion: number;
  aVerifier: true;
}

export const TARIFS_MODELES: TarifModele[] = [
  { id: "gpt-4o-mini", label: "OpenAI gpt-4o-mini", usdEntreeParMillion: 0.15, usdSortieParMillion: 0.6, aVerifier: true },
  { id: "gpt-4o", label: "OpenAI gpt-4o", usdEntreeParMillion: 2.5, usdSortieParMillion: 10, aVerifier: true },
];

export interface ProfilAppel {
  /** Durée moyenne d'un appel décroché, en minutes. */
  minutes: number;
  /** Tours de parole du modèle sur la durée. */
  tours: number;
  /** Taille du script système, en jetons. */
  jetonsScript: number;
  /** Jetons produits par réponse. */
  jetonsReponse: number;
}

/**
 * Profil par défaut d'un appel de prospection — 2,85 min, dix tours.
 * Les 2,85 minutes viennent de la mesure de Zakaria sur ses appels réels.
 */
export const APPEL_TYPE: ProfilAppel = {
  minutes: 2.85,
  tours: 10,
  jetonsScript: 800,
  jetonsReponse: 60,
};

export interface CoutJetons {
  modele: string;
  jetonsEntreeParAppel: number;
  jetonsSortieParAppel: number;
  eurParAppel: number;
  eurPourLot: number;
  phrase: string;
}

export function coutJetons(p: ProfilAppel, tarif: TarifModele, appels: number): CoutJetons {
  // À chaque tour, le modèle relit le script ET l'historique accumulé. On
  // modélise l'historique comme une croissance linéaire : au tour k, il porte
  // en gros k × (une réponse + une réplique du prospect).
  const jetonsParEchange = p.jetonsReponse * 2;
  let entree = 0;
  for (let k = 0; k < p.tours; k++) entree += p.jetonsScript + k * jetonsParEchange;
  const sortie = p.tours * p.jetonsReponse;

  const usd = (entree / 1e6) * tarif.usdEntreeParMillion + (sortie / 1e6) * tarif.usdSortieParMillion;
  const eurParAppel = usd * USD_TO_EUR;
  const eurPourLot = eurParAppel * Math.max(0, appels);

  return {
    modele: tarif.label,
    jetonsEntreeParAppel: Math.round(entree),
    jetonsSortieParAppel: sortie,
    eurParAppel: arrondi(eurParAppel),
    eurPourLot: arrondi(eurPourLot),
    phrase:
      `${tarif.label} : ~${Math.round(entree).toLocaleString("fr-FR")} jetons en entrée et ${sortie} en sortie par appel, ` +
      `soit ${arrondi(eurParAppel * 100)} centimes l'appel et ${arrondi(eurPourLot)} € pour ${appels} appels. ` +
      `⚠ Tarif non vérifié depuis cet environnement — à confirmer sur la page de tarifs avant de le mettre dans un devis.`,
  };
}

export interface DevisVoix {
  appels: number;
  /** Coût fournisseur total (téléphonie + voix + jetons + fixe). */
  coutTotalEur: number;
  coutParAppelEur: number;
  /** Prix plancher selon la règle ×4. */
  plancherEur: number;
  /** Prix affiché aujourd'hui pour ce volume. */
  prixAfficheEur: number;
  margeEur: number;
  margePct: number;
  multipleReel: number;
  lecture: string[];
}

/**
 * Le devis d'un lot d'appels — celui qu'on pose sur la table.
 *
 * `prixAfficheEur` vient de la grille publique : il n'existe qu'UN prix, et ce
 * module le juge, il ne le remplace pas.
 */
export function devisVoix(
  appels: number,
  prixAfficheEur: number,
  volume: CallVolumeInput,
  tarif: TarifModele = TARIFS_MODELES[0],
  profil: ProfilAppel = APPEL_TYPE
): DevisVoix {
  const base = computeCosts(volume, prixAfficheEur);
  // Les jetons ne sont comptés que sur les appels DÉCROCHÉS : un téléphone
  // qui sonne dans le vide ne fait parler aucun modèle.
  const jetons = coutJetons(profil, tarif, base.answeredCalls);

  // `computeCosts` porte déjà une ligne LLM forfaitaire à la minute. On la
  // retire pour ne pas compter les jetons deux fois.
  const ligneLlm = base.lines.find((l) => l.id === "llm")?.eur ?? 0;
  const coutTotalEur = arrondi(base.totalEur - ligneLlm + jetons.eurPourLot);

  const fixe = FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0);
  const variable = coutTotalEur - fixe;
  // Le ×4 porte sur la CONSOMMATION. Le fixe, lui, est mutualisé sur tous les
  // clients : le multiplier reviendrait à facturer dix fois le même serveur.
  const plancherEur = arrondi(variable * MULTIPLE_CONSOMMATION + fixe);

  const margeEur = arrondi(prixAfficheEur - coutTotalEur);
  const margePct = prixAfficheEur > 0 ? Math.round((margeEur / prixAfficheEur) * 100) : 0;
  const multipleReel = coutTotalEur > 0 ? arrondi(prixAfficheEur / coutTotalEur) : 0;

  const lecture: string[] = [
    `${appels} appels composés, ${base.answeredCalls} décrochés, ${Math.round(base.conversationMinutes)} min de conversation.`,
    `Coût fournisseurs : ${coutTotalEur} € (dont ${fixe} € de fixe mutualisé et ${jetons.eurPourLot} € de jetons).`,
    jetons.phrase,
    `Prix affiché ${prixAfficheEur} € → marge ${margeEur} € (${margePct} %), soit ×${multipleReel} le coût.`,
  ];

  if (prixAfficheEur < plancherEur) {
    lecture.push(
      `⚠ SOUS LE PLANCHER. La règle ×4 sur la consommation demanderait ${plancherEur} €. ` +
        `Il manque ${arrondi(plancherEur - prixAfficheEur)} €.`
    );
  } else {
    lecture.push(
      `Plancher de la règle ×4 : ${plancherEur} €. Le prix affiché est ${arrondi(prixAfficheEur - plancherEur)} € au-dessus.`
    );
  }

  return {
    appels,
    coutTotalEur,
    coutParAppelEur: appels > 0 ? arrondi(coutTotalEur / appels) : 0,
    plancherEur,
    prixAfficheEur,
    margeEur,
    margePct,
    multipleReel,
    lecture,
  };
}

/** Le volume de référence du palier public : 1 000 appels. */
export const VOLUME_PALIER: CallVolumeInput = {
  calls: OUTBOUND_UNIT_CALLS,
  answerRatePct: 30,
  avgMinutesAnswered: APPEL_TYPE.minutes,
  avgMinutesUnanswered: 0.4,
};

export const PRIX_PALIER_HT = OUTBOUND_UNIT_HT;

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CONSOMMATION RÉELLE D'UNE BRIQUE — le raccord qui manquait.
 *
 * ⚠ `verdictBrique` lisait `consommationMensuelleEur` telle quelle. Sur Alpha
 * Voice, cette constante vaut 2 € : le prix du numéro loué. Le commentaire
 * promettait qu'une fonction `coutVoixMensuel` ajouterait le variable —
 * **elle n'a jamais existé**. La brique dont le coût est presque entièrement
 * variable était donc chiffrée SANS COMPTER UN SEUL APPEL, et l'audit du
 * catalogue rendait un verdict rassurant sur un coût faux.
 *
 * Le bon calcul existait à trois cents lignes de là, dans `devisVoix`.
 * Encore deux modules corrects qui ne se parlaient pas.
 *
 * On retient la part VARIABLE : le fixe (hébergement, supervision) est
 * mutualisé sur tous les clients et n'appartient à aucune brique.
 * ─────────────────────────────────────────────────────────────────────
 */
/**
 * ⚠ UN MODÈLE PAR BRIQUE, ET PAS UN DE PLUS.
 *
 * Trouvé en cassant le code exprès : marquer `campagnes` comme dépendante du
 * volume lui donnait silencieusement le coût de la VOIX. Un drapeau booléen
 * ne dit pas QUEL modèle s'applique — il dit seulement « pas la constante »,
 * ce qui laisse le résolveur choisir tout seul. On nomme donc le modèle.
 *
 * Une brique marquée sans modèle retombe sur sa constante (repli sûr), et un
 * test refuse cette situation : c'est une erreur de déclaration, pas un cas
 * légitime.
 */
const MODELES_VOLUME: Record<string, () => number> = {
  "alpha-voice": () => {
    const d = devisVoix(VOLUME_PALIER.calls, PRIX_PALIER_HT, VOLUME_PALIER);
    const fixe = FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0);
    return arrondi(d.coutTotalEur - fixe);
  },
};

/** Les briques pour lesquelles un modèle de volume existe vraiment. */
export const BRIQUES_A_MODELE_VOLUME = Object.keys(MODELES_VOLUME);

export function consommationDe(c: CoutBrique): number {
  if (!c.volumeDependant) return c.consommationMensuelleEur;
  const modele = MODELES_VOLUME[c.brickId];
  // Marquée « volume » sans modèle : on ne devine pas, on retombe sur le
  // socle. Le test `toute brique volumeDependant a un modèle` le signale.
  if (!modele) return c.consommationMensuelleEur;
  const variable = modele();
  // Repli : si le modèle rendait zéro ou moins (constantes vidées), on
  // retombe sur le socle plutôt que d'annoncer une brique gratuite.
  return variable > 0 ? variable : c.consommationMensuelleEur;
}
