/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CALCULATEUR DE DEAL — ce que CETTE affaire nous rapporte vraiment.
 *
 * ── POURQUOI IL EXISTE ──
 *
 * Le portefeuille porte une RÉFÉRENCE : ce qu'on prend d'habitude sur ce type
 * de deal. Mais aucune affaire ne ressemble à la précédente. Le taux suit le
 * levier qu'on garde, pas un barème — passer la main sur la technique juste
 * après la vision, c'est le plancher ; construire les démos soi-même et rester
 * le point d'entrée technique, c'est plus.
 *
 * Sans cet écran, on négociait au feeling et on découvrait après coup ce que
 * l'affaire rapportait réellement. Pire : les prévisions affichaient le barème
 * pendant que la réalité était ailleurs.
 *
 * ── CE QUE LE CALCUL FAIT, ET CE QU'IL NE FAIT PAS ──
 *
 * Il calcule l'ARGENT exactement : one-shot, mensuel, horizon, écart à la
 * référence, et ce que coûte chaque point de pourcentage.
 *
 * Il NE calcule PAS le taux. Cocher « j'ai construit les démos » ne donne pas
 * mathématiquement 25 % — ça se négocie avec un humain. Les leviers sont donc
 * des MUNITIONS affichées, pas une formule déguisée. Un calculateur qui
 * prétendrait dériver le taux d'une checklist mentirait sur la seule chose qui
 * compte dans un contrat.
 *
 * Pur, déterministe, sans réseau : il tourne dans un rendez-vous sans wifi.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface DealInput {
  /** Montant one-shot / setup de l'affaire (€ HT). */
  setupHT: number;
  /** Récurrent mensuel de l'affaire (€ HT). */
  monthlyHT: number;
  /** Ce qui nous revient sur le one-shot (%). */
  commissionPct: number;
  /** Ce qui nous revient sur le récurrent (%). */
  recurringPct: number;
  /**
   * Horizon de projection, en mois.
   *
   * 12 par défaut : c'est la seule durée qu'on puisse défendre devant un
   * client sans supposer qu'il reste. Projeter à 36 mois donne un chiffre
   * flatteur et faux — la rétention n'est pas encore mesurée.
   */
  horizonMois: number;
}

export interface DealLigne {
  label: string;
  /** Ce que le client paie. */
  brut: number;
  /** Ce qui nous revient. */
  part: number;
  /** Le taux appliqué à cette ligne. */
  pct: number;
}

export interface DealResult {
  lignes: DealLigne[];
  /** Ce que le client paie sur l'horizon. */
  brutTotal: number;
  /** Ce qui nous revient sur l'horizon. */
  partTotale: number;
  /** Ce qui nous revient chaque mois, une fois le setup encaissé. */
  partMensuelle: number;
  /** Part moyenne sur l'ensemble (setup + récurrent) — le vrai taux du deal. */
  tauxEffectifPct: number;
  /**
   * Ce que vaut UN point de pourcentage négocié en plus sur le one-shot,
   * sur l'horizon. C'est le chiffre qui rend la négociation concrète : « ce
   * point que tu lâches coûte 600 € ».
   */
  valeurDUnPointSetup: number;
  /** Idem sur le récurrent — souvent plus lourd, et toujours sous-estimé. */
  valeurDUnPointRecurrent: number;
}

const positif = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
const borne = (pct: number): number => Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));

/** Le calcul complet d'une structure de deal. */
export function calcDeal(input: DealInput): DealResult {
  const setup = positif(input.setupHT);
  const mensuel = positif(input.monthlyHT);
  const pctSetup = borne(input.commissionPct);
  const pctRec = borne(input.recurringPct);
  // Un horizon à zéro n'a pas de sens et diviserait par zéro plus bas.
  const mois = Math.max(1, Math.round(positif(input.horizonMois) || 12));

  const brutRecurrent = mensuel * mois;
  const partSetup = (setup * pctSetup) / 100;
  const partRecurrent = (brutRecurrent * pctRec) / 100;

  const lignes: DealLigne[] = [
    { label: "Installation (one-shot)", brut: setup, part: partSetup, pct: pctSetup },
    { label: `Abonnement × ${mois} mois`, brut: brutRecurrent, part: partRecurrent, pct: pctRec },
  ];

  const brutTotal = setup + brutRecurrent;
  const partTotale = partSetup + partRecurrent;

  return {
    lignes,
    brutTotal,
    partTotale,
    partMensuelle: (mensuel * pctRec) / 100,
    // Le taux EFFECTIF : celui qu'on obtient réellement une fois le one-shot
    // et le récurrent mélangés. Il diffère souvent des deux taux affichés, et
    // c'est lui qu'il faut comparer d'un deal à l'autre.
    tauxEffectifPct: brutTotal > 0 ? Math.round((partTotale / brutTotal) * 1000) / 10 : 0,
    valeurDUnPointSetup: setup / 100,
    valeurDUnPointRecurrent: brutRecurrent / 100,
  };
}

/**
 * L'écart entre ce deal et la référence du portefeuille.
 *
 * Un pourcentage seul ne dit rien : « 20 % », c'est bien ou mal ? La seule
 * lecture utile est la différence en EUROS avec ce qu'on prend d'habitude.
 */
export interface DealEcart {
  /** Ce qu'on aurait pris au barème, sur le même horizon. */
  partReference: number;
  /** Différence en euros. Négatif = on a lâché du terrain. */
  deltaEur: number;
  /** Formulation prête à afficher, jamais vide. */
  verdict: string;
}

export function ecartVsReference(
  input: DealInput,
  reference: { commissionPct: number; recurringPct: number }
): DealEcart {
  const deal = calcDeal(input);
  const ref = calcDeal({
    ...input,
    commissionPct: reference.commissionPct,
    recurringPct: reference.recurringPct,
  });
  const delta = Math.round(deal.partTotale - ref.partTotale);
  const eur = (n: number) => `${Math.abs(n).toLocaleString("fr-FR")} €`;

  const verdict =
    delta > 0
      ? `+${eur(delta)} de mieux que la référence sur ${Math.max(1, Math.round(input.horizonMois))} mois.`
      : delta < 0
        ? `−${eur(delta)} par rapport à la référence sur ${Math.max(1, Math.round(input.horizonMois))} mois. C'est acté, mais ça se compte.`
        : `Exactement la référence.`;

  return { partReference: ref.partTotale, deltaEur: delta, verdict };
}
