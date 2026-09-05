/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI EST L'INSCRIT, ET QUI VEND-IL À QUI ?
 *
 * ── LE DÉFAUT QUE CE MODULE EXISTE POUR CORRIGER ──
 *
 * Le jeu de démonstration est huit commerces lyonnais : un bouchon, un pub,
 * une ambulance, une menuiserie. Il a été écrit quand le produit ne servait
 * qu'à ça, et il est bon — pour cette cible-là.
 *
 * Quelqu'un qui vend du logiciel à des DRH s'inscrit, ouvre son pipeline, et
 * voit « Le Bouchon des Canuts — 40 appels ratés pendant le coup de feu ».
 * Il ne se dit pas « ce sont des données d'exemple » : il se dit **« ce
 * produit n'est pas pour moi »**, et il ferme l'onglet. C'est la seule
 * seconde où on avait son attention, et on la dépense à lui montrer le
 * métier de quelqu'un d'autre.
 *
 * On lui demande donc quatre choses à l'inscription, et on fabrique une
 * démonstration qui ressemble à SON marché.
 *
 * ── CE QU'ON DEMANDE, ET CE QU'ON NE DEMANDE PAS ──
 *
 * ⚠ QUATRE CHAMPS, PAS DOUZE. Chaque question posée avant que la personne
 * ait vu la moindre valeur est une occasion d'abandonner. On ne demande que
 * ce dont la démonstration a BESOIN pour être crédible — le reste (SIRET,
 * effectif, budget) se remplit plus tard, ou jamais.
 *
 * ⚠⚠ ET RIEN N'EST OBLIGATOIRE. Un onboarding qui bloque produit des profils
 * remplis n'importe comment, ce qui est pire qu'un profil vide : un ICP faux
 * fabrique une démonstration hors sujet, et on ne saura jamais qu'elle l'est.
 * Sans réponse, on retombe sur le jeu écrit à la main, qui a au moins le
 * mérite d'être cohérent.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le poste de l'inscrit. Décide de ce qu'on lui montre en premier. */
export type PosteOperateur =
  /** Il vend seul, pour lui. Le cas majoritaire. */
  | "solo"
  /** Il pilote des commerciaux. Il lui faut la vue d'équipe. */
  | "responsable"
  /** Il dirige — il vend aussi, mais ce n'est pas son seul métier. */
  | "dirigeant";

export const POSTES: { id: PosteOperateur; label: string; aide: string }[] = [
  { id: "solo", label: "Je vends seul", aide: "Prospection, rendez-vous, closing — tout passe par moi." },
  { id: "responsable", label: "Je pilote une équipe", aide: "J'ai des commerciaux et je suis leurs chiffres." },
  { id: "dirigeant", label: "Je dirige l'entreprise", aide: "Je vends aussi, mais ce n'est pas mon seul métier." },
];

/**
 * Le profil, tel qu'il est stocké.
 *
 * ⚠ IL VIT DANS LES RÉGLAGES, DONC DANS LE NAVIGATEUR. Ne rien y mettre qui
 * ne puisse pas être lu par quiconque ouvre les outils de développement sur
 * cette machine. Un ICP est de la stratégie commerciale, pas un secret : il
 * est déjà visible dans chaque email qu'on envoie.
 */
export interface ProfilOperateur {
  poste: PosteOperateur;
  /** Ce que l'inscrit vend. Une ligne, en clair. */
  metier: string;
  /** À QUI il le vend — le secteur de sa cible. C'est le cœur de la démo. */
  cibleSecteur: string;
  /** Le poste qu'il cherche à joindre chez sa cible. */
  cibleRole: string;
  /** Où. Vide = pas de contrainte géographique. */
  cibleZone: string;
}

export const PROFIL_VIDE: ProfilOperateur = {
  poste: "solo",
  metier: "",
  cibleSecteur: "",
  cibleRole: "",
  cibleZone: "",
};

/**
 * Le profil est-il assez rempli pour fabriquer une démonstration crédible ?
 *
 * ⚠ LE SEUL CHAMP QUI DÉCIDE EST `cibleSecteur`, et c'est mesuré, pas
 * arbitraire : c'est lui qui fournit les noms d'entreprises, les douleurs et
 * le vocabulaire. Sans lui, on ne sait rien fabriquer. Avec lui seul, on sait
 * déjà faire quelque chose de plus juste que huit restaurants lyonnais.
 *
 * Exiger les quatre champs ferait retomber sur le jeu générique la moitié des
 * gens qui ont pourtant répondu à l'essentiel — c'est-à-dire punir ceux qui
 * ont commencé à remplir.
 */
export function profilExploitable(p: ProfilOperateur | undefined | null): boolean {
  return Boolean(p && p.cibleSecteur.trim().length >= 3);
}

/**
 * Le profil, nettoyé de ce qui vient d'un formulaire.
 *
 * ⚠ ON BORNE LA LONGUEUR. Ces chaînes partent dans les prompts IA et dans les
 * noms de fiches engendrées. Un champ de 40 000 caractères collé par accident
 * ferait exploser un budget de jetons — et le premier signe serait la facture.
 */
export function nettoyerProfil(brut: Partial<ProfilOperateur> | undefined | null): ProfilOperateur {
  const texte = (v: unknown, max = 120): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const poste = brut?.poste;
  return {
    poste: POSTES.some((p) => p.id === poste) ? (poste as PosteOperateur) : "solo",
    metier: texte(brut?.metier),
    cibleSecteur: texte(brut?.cibleSecteur, 80),
    cibleRole: texte(brut?.cibleRole, 80),
    cibleZone: texte(brut?.cibleZone, 80),
  };
}

/**
 * Une phrase qui redit à l'inscrit ce qu'on a compris de lui.
 *
 * ⚠ CE N'EST PAS DE LA DÉCORATION. Un ICP mal saisi produit une démonstration
 * hors sujet, et personne ne remonte jamais un formulaire pour vérifier ce
 * qu'il a tapé. Lui rendre sa propre phrase est le seul moment où l'erreur
 * peut se voir — au moment où elle se corrige en deux secondes.
 */
export function phraseProfil(p: ProfilOperateur): string {
  if (!profilExploitable(p)) return "Cible non renseignée — la démonstration reste générique.";
  const qui = p.cibleRole.trim() ? `des ${p.cibleRole.trim()}` : "des décideurs";
  const ou = p.cibleZone.trim() ? ` en ${p.cibleZone.trim()}` : "";
  const quoi = p.metier.trim() ? `${p.metier.trim()} ` : "";
  return `Tu vends ${quoi}à ${qui} dans ${p.cibleSecteur.trim()}${ou}.`;
}
