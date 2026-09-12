import type { OffrePublique } from "./offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'APPORTEUR D'AFFAIRES — celui qui nous amène un client, et ce qu'il touche.
 *
 * ══ LE MODÈLE, ET CE QU'IL N'EST PAS ══
 *
 * ⚠ LE SENS DE L'ARGENT EST L'INVERSE DE L'AUTRE 30 %, et les confondre coûte
 * cher. Le dépôt porte déjà un « 30 % » : `REV_SHARE`, ce qu'on FACTURE à un
 * client sur le chiffre d'affaires qu'on lui génère. Ici c'est le contraire :
 * ce que NOUS PAYONS à quelqu'un qui nous amène un client.
 *
 * Le socle gratuit reste gratuit, sans contrepartie et sans créance. On ne
 * prend rien sur ce qu'un utilisateur gratuit gagne avec l'outil : il n'y a
 * ni contrat, ni base mesurable, ni moyen d'encaisser — et surtout, le socle
 * annonce « tes données, ton organisation ». Y accrocher une créance rendrait
 * cette phrase fausse, et le premier qui le lit le dirait publiquement.
 *
 * ══ CE QUI EST MESURÉ, ET CE QUI EST DÉCIDÉ ══
 *
 * Le coût à la minute (0,0563 €) est MESURÉ. Les taux ci-dessous sont des
 * DÉCISIONS : aucune vente ne les a validés, aucun apporteur n'a encore été
 * payé. Ce qui suit est le raisonnement, pas une preuve.
 *
 * ── POURQUOI PAS « 30 % DU MENSUEL, À VIE » ──
 *
 * Sur Alpha Voice Essentiel (149 €/mois, coût variable mesuré 28,15 €) :
 *
 *   marge brute .................. 120,85 €   (81 %)
 *   commission à 30 % ............  44,70 €
 *   marge après commission .......  76,15 €   (51 %)
 *   socle fixe mutualisé .........  57,00 €/mois
 *
 * Ça passe — de justesse, et pour un client. À vie, ça veut dire qu'un
 * apporteur qui amène dix clients touche 447 €/mois pour toujours sans rien
 * faire de plus, et qu'on a cédé 30 % du récurrent définitivement. Sur cinq
 * ans, un client Essentiel rapporte 8 940 € ; on en donnerait 2 682 € pour
 * une mise en relation.
 *
 * ── CE QU'ON FAIT À LA PLACE, ET POURQUOI C'EST MIEUX POUR LES DEUX ──
 *
 * Le produit a des frais d'INSTALLATION significatifs (1 490 € Alpha Voice,
 * 2 500 € omnicanale, 10 000 € Business). Ils sont encaissés une fois, ils ne
 * grèvent aucun récurrent, et ils font déjà une belle commission.
 *
 *   · 30 % du SETUP, une fois ....... 447 € sur Alpha Voice, 750 € omnicanale
 *   · 10 % du MENSUEL, 12 mois ...... 14,90 €/mois × 12 = 178,80 € en plus
 *
 * Total sur un Essentiel : **475,80 € pour une mise en relation.** C'est
 * motivant, c'est payé vite, et le récurrent reste entier après un an.
 *
 * ⚠ LES 12 MOIS NE SONT PAS UNE RADINERIE, C'EST UN ALIGNEMENT. Une
 * commission qui court un an donne à l'apporteur un intérêt direct à ce que
 * le client RESTE — donc à ne pas nous amener n'importe qui pour toucher le
 * setup. Une commission uniquement sur le setup récompenserait la signature
 * et se désintéresserait de la suite ; c'est comme ça qu'on se retrouve avec
 * des clients mal qualifiés et un taux de résiliation qu'on ne comprend pas.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Part du setup versée à l'apporteur, une seule fois. DÉCISION. */
export const TAUX_SETUP = 0.3;
/** Part du mensuel versée à l'apporteur, chaque mois pendant `MOIS_COMMISSIONNES`. */
export const TAUX_MENSUEL = 0.1;
/** Combien de mois court la commission récurrente. */
export const MOIS_COMMISSIONNES = 12;

/**
 * ── LA CONDITION QUI N'EST PAS TECHNIQUE, ET QUI BLOQUE LE PAIEMENT ──
 *
 * ⚠ ON NE PEUT PAS VERSER UNE COMMISSION À QUELQU'UN QUI NE PEUT PAS
 * FACTURER, et le risque n'est pas le sien : il est à NOUS.
 *
 * Payer un particulier sans facture, c'est du travail dissimulé
 * (art. L.8221-1 du Code du travail). Nous serions l'entreprise donneuse
 * d'ordre — donc la partie sanctionnée — et la charge ne serait pas
 * déductible. Il faut donc que l'apporteur ait un SIRET : auto-entrepreneur
 * suffit, ça se crée en une journée et gratuitement.
 *
 * ⚠⚠ ET LE PIÈGE, SUR UNE OFFRE FAITE À UN RÉSEAU LINKEDIN : la plupart des
 * contacts sont SALARIÉS. Un salarié peut être apporteur d'affaires, mais il
 * doit vérifier deux choses dans son contrat — la clause d'exclusivité et
 * l'obligation de loyauté — surtout si nous vendons sur le marché de son
 * employeur. Ce n'est pas notre responsabilité juridique, c'est notre
 * responsabilité de le DIRE avant qu'il se lance.
 *
 * D'où l'état `sans-statut` : on suit son apport, on affiche ce qu'il aurait
 * gagné, et on ne promet aucune date de versement. Afficher un montant sans
 * dire qu'il est bloqué serait la promesse la plus facile à casser du produit.
 */
export type StatutApporteur =
  /** Pas de SIRET connu : on compte, on ne verse pas. */
  | "sans-statut"
  /** SIRET fourni mais le contrat d'apport n'est pas signé. */
  | "sans-contrat"
  /** Tout est là : la commission peut se facturer. */
  | "verse";

export interface Apporteur {
  /** Son compte Alpha (`auth.users.id`). */
  id: string;
  /** SIRET à 14 chiffres, ou `null`. */
  siret: string | null;
  /** Le contrat d'apport d'affaires est-il signé ? */
  contratSigne: boolean;
}

/**
 * La FORME du SIRET, et rien de plus.
 *
 * ⚠ ON NE VALIDE PAS L'EXISTENCE DE L'ENTREPRISE ICI, et il faut le dire :
 * un SIRET bien formé peut être inventé, radié, ou appartenir à quelqu'un
 * d'autre. La seule vérification qui vaut est l'annuaire officiel, et elle
 * demande un appel réseau qu'un module pur ne fait pas. Ce contrôle-ci
 * attrape les fautes de frappe ; il ne prouve rien.
 *
 * La clé de Luhn est vérifiée parce qu'elle attrape gratuitement la majorité
 * des saisies erronées — un chiffre inversé, un caractère en trop.
 */
export function siretBienForme(brut: string | null | undefined): boolean {
  const s = (brut ?? "").replace(/\s/g, "");
  if (!/^\d{14}$/.test(s)) return false;
  let somme = 0;
  for (let i = 0; i < 14; i++) {
    // Luhn : on double un chiffre sur deux en partant de la droite.
    const pair = (14 - i) % 2 === 0;
    let n = Number(s[i]) * (pair ? 2 : 1);
    if (n > 9) n -= 9;
    somme += n;
  }
  return somme % 10 === 0;
}

export function statutApporteur(a: Apporteur): StatutApporteur {
  if (!siretBienForme(a.siret)) return "sans-statut";
  if (!a.contratSigne) return "sans-contrat";
  return "verse";
}

export const peutEtreVerse = (a: Apporteur): boolean => statutApporteur(a) === "verse";

export interface Commission {
  /** Sur les frais d'installation, une fois. */
  setupEur: number;
  /** Par mois, pendant `moisCommissionnes`. */
  mensuelEur: number;
  moisCommissionnes: number;
  /** Ce que l'apport rapporte AU TOTAL si le client reste l'année. */
  totalEur: number;
  /** Une phrase qui dit ce que c'est, sans promettre de date. */
  phrase: string;
}

/**
 * Ce qu'un apport rapporte, pour une offre donnée.
 *
 * ⚠ SUR UNE OFFRE « DEVIS », ON NE REND PAS ZÉRO — on rend zéro ET on le dit.
 * `os-complet` n'a ni prix ni setup connus : la commission se fixera au
 * cadrage. Afficher « 0 € » sans réserve ferait croire à un apporteur qu'un
 * dossier à 40 000 € ne lui rapporte rien, et il arrêterait d'en amener.
 */
export function commissionPour(offre: OffrePublique): Commission {
  /**
   * ⚠ SUR UNE CADENCE « ÉCHELONNÉE », `prixHT` N'EST PAS UN MENSUEL — et le
   * confondre a produit un chiffre absurde avant qu'on le regarde.
   *
   * Sur Business, `prixHT` vaut 10 000 € : c'est le prix TOTAL de
   * l'installation, encaissé en un acompte plus dix mensualités. Le récurrent
   * qui prend le relais est `plan.abonnementHT` (1 000 €/mois). Traiter
   * `prixHT` comme un mensuel donnait 1 000 €/mois de commission pendant
   * douze mois, soit **12 000 € pour un apport** — plus que l'installation
   * elle-même.
   *
   * ⚠⚠ ET LE TEST QUI DEVAIT L'ATTRAPER NE L'A PAS FAIT : il comparait la
   * commission à un « encaissement de l'an 1 » calculé avec la MÊME erreur
   * (10 000 × 12 = 120 000 €). Un garde qui reprend l'hypothèse fausse du
   * code qu'il surveille valide l'erreur au lieu de la voir. Trouvé en
   * imprimant les chiffres, pas en relisant.
   */
  const echelonne = offre.cadence === "echelonne" && offre.plan;
  const setup = echelonne ? (offre.prixHT ?? 0) : (offre.setupHT ?? 0);
  const mensuel = echelonne ? offre.plan!.abonnementHT : (offre.prixHT ?? 0);

  const setupEur = Math.round(setup * TAUX_SETUP * 100) / 100;
  const mensuelEur = Math.round(mensuel * TAUX_MENSUEL * 100) / 100;

  /**
   * ⚠ UNE OFFRE À PAIEMENT UNIQUE N'A PAS DE COMMISSION « MENSUELLE »
   * PENDANT DOUZE MOIS — elle n'est payée qu'une fois. Compter douze mois
   * dessus multiplierait la commission par douze sur un encaissement unique.
   * Le lifetime à 4 900 € rapporterait 5 880 € à l'apporteur, soit plus que
   * ce que le client a payé.
   */
  const recurrent = offre.cadence === "mensuel" || offre.cadence === "echelonne";
  const mois = recurrent ? MOIS_COMMISSIONNES : 1;
  const totalEur = Math.round((setupEur + mensuelEur * mois) * 100) / 100;

  const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;
  const phrase =
    offre.cadence === "devis"
      ? `${offre.nom} se chiffre au cadrage : ta commission se fixe avec le devis, elle n'est pas nulle.`
      : recurrent
        ? `${eur(setupEur)} à l'installation, puis ${eur(mensuelEur)} par mois pendant ${mois} mois — ${eur(totalEur)} si le client reste l'année.`
        : `${eur(totalEur)}, une fois — ${offre.nom} est un paiement unique.`;

  return { setupEur, mensuelEur, moisCommissionnes: mois, totalEur, phrase };
}

/**
 * Ce qu'on AFFICHE à l'apporteur, selon son statut.
 *
 * ⚠ LE MONTANT S'AFFICHE TOUJOURS, LA DATE DE VERSEMENT JAMAIS SANS STATUT.
 * Cacher le montant à quelqu'un sans SIRET le priverait de la seule
 * information qui le décidera à en créer un. Mais afficher un montant en
 * laissant croire qu'il va arriver serait la promesse la plus facile à casser
 * du produit — et elle se casserait devant quelqu'un qui a déjà fait le
 * travail.
 */
export function messageVersement(a: Apporteur): string {
  switch (statutApporteur(a)) {
    case "sans-statut":
      return (
        "Pour être payé, il te faut un numéro SIRET — auto-entrepreneur suffit, c'est gratuit et ça prend une " +
        "journée. Sans facture, nous n'avons pas le droit de te verser quoi que ce soit : ce n'est pas une " +
        "formalité, c'est du travail dissimulé, et c'est NOUS qui serions en tort. Ton apport est compté en " +
        "attendant, rien n'est perdu."
      );
    case "sans-contrat":
      return (
        "Ton SIRET est enregistré. Il reste le contrat d'apport d'affaires à signer — il dit le taux, la durée " +
        "et ce qui compte comme apport. Une fois signé, tu factures et on paie."
      );
    case "verse":
      return "Tu peux facturer tes commissions dès que le client a réglé. On ne verse jamais avant d'avoir encaissé.";
  }
}
