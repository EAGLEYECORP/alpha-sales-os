import type { VerticalPlaybook } from "./playbook";
import type { ProfilOperateur } from "./profil-operateur";
import type { CatalogueObjections } from "./live-assist";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SCRIPT D'APPEL DE L'INSCRIT — bâti sur SON offre, plus sur la nôtre.
 *
 * ══ CE QUI A ÉTÉ MESURÉ LE 21/10/2026, EN EXÉCUTANT LE VRAI CODE ══
 *
 * Un inscrit qui vend « un logiciel de paie » à des restaurants ouvrait
 * `/appels` et lisait, comme script d'appel :
 *
 *   « Je m'adresse aux métiers où le téléphone est le premier point de
 *     contact […] On installe un accueil qui décroche quand vous ne pouvez
 *     pas, prend la demande et vous en envoie le résumé. »
 *
 * C'est l'argumentaire d'ALPHA VOICE — le NÔTRE. Les verticales de
 * `lib/playbook.ts` ont été écrites pour qu'EAGLEYE vende Alpha à des métiers
 * (restaurants, garages, promoteurs…). Elles décrivent la douleur du prospect
 * VUE PAR NOTRE OFFRE. Servies à quelqu'un qui vend autre chose, elles lui
 * font prononcer notre pitch à ses propres prospects.
 *
 * Tant que la cible était UNE (les promoteurs, puis les commerces), ça ne se
 * voyait pas : l'unique utilisateur était nous. Le jour où Alpha s'ouvre à
 * n'importe quelle entreprise (décision du 21/10/2026), c'est le bloquant
 * numéro un — avant le permis, avant la démo.
 *
 * ══ CE QUE CE MODULE FAIT, ET CE QU'IL REFUSE DE FAIRE ══
 *
 * Il fabrique un script à partir de ce que l'inscrit a DIT de lui
 * (`ProfilOperateur` : ce qu'il vend, à qui, où). La MÉTHODE est fixe — elle
 * est la même pour tout métier : barrage → permission → ciblage → une seule
 * chose à la bascule → rendez-vous. Le CONTENU est le sien, mot pour mot.
 *
 * ⚠⚠ IL N'INVENTE RIEN SUR LE PROSPECT. Pas de douleur affirmée, pas de chiffre
 * de perte (`leak` absent : zéro donnée, zéro chiffre), pas de « vos confrères
 * font… ». La douleur se DEMANDE au diagnostic, elle ne s'affirme pas au
 * téléphone. Un script générique qui affirme une douleur fausse se fait
 * démonter à la deuxième phrase.
 *
 * ⚠ CE QUI MANQUE SE VOIT DANS LE SCRIPT. Un profil vide donne des crochets
 * (« [ce que vous vendez] ») et `manques` le nomme : un trou affiché se
 * comble en dix secondes, un trou rempli par défaut ne se voit jamais.
 *
 * ⚠ USAGE : AFFICHAGE ET ANGLE D'APPEL SEULEMENT. Cette verticale n'a pas
 * d'`offre` EAGLEYE et ne doit jamais entrer dans le routage d'offre
 * (`offreDeLaVerticale` la prendrait pour « alpha-voice », l'hypothèse
 * historique). Elle n'est pas dans `VERTICALS`, et c'est voulu.
 * ─────────────────────────────────────────────────────────────────────
 */

export const ID_SCRIPT_OPERATEUR = "operateur";

/** Ce qui s'affiche à la place d'un champ que l'inscrit n'a pas renseigné. */
const TROU = {
  metier: "[ce que vous vendez]",
  role: "[le poste que vous visez]",
  secteur: "[le secteur que vous visez]",
} as const;

export interface ScriptOperateur {
  vertical: VerticalPlaybook;
  /** Les champs du profil qui manquent pour que le script parle de lui. */
  manques: string[];
}

export function scriptOperateur(profil: ProfilOperateur | null | undefined): ScriptOperateur {
  const metier = profil?.metier.trim() ?? "";
  const role = profil?.cibleRole.trim() ?? "";
  const secteur = profil?.cibleSecteur.trim() ?? "";
  const zone = profil?.cibleZone.trim() ?? "";

  const manques: string[] = [];
  if (!metier) manques.push("ce que tu vends");
  if (!secteur) manques.push("le secteur que tu vises");
  if (!role) manques.push("le poste que tu cherches à joindre");

  const quoi = metier || TROU.metier;
  const qui = role || TROU.role;
  const ou = [secteur || TROU.secteur, zone].filter(Boolean).join(", ");

  const vertical: VerticalPlaybook = {
    id: ID_SCRIPT_OPERATEUR,
    label: metier ? `Ton offre — ${metier}` : "Ton offre (à renseigner)",
    // Écrit à partir de la méthode, sans un seul appel derrière : on le dit.
    preuve: "doctrine",
    sectors: [],
    criterion: `Les ${qui} (${ou}) pour qui ${quoi} est un sujet maintenant.`,
    structuralPain: `Ce que ${secteur || "ce secteur"} perd tant que le sujet n'est pas traité : demande-le au diagnostic, ne l'affirme pas.`,
    opener: [
      { label: "Barrage", line: `Bonjour, je cherche la bonne personne pour parler de ${quoi} — c'est vous, ou quelqu'un d'autre ?` },
      { label: "Permission", line: "Appel à froid, trente secondes : si ce n'est pas pour vous, vous me le dites et je raccroche." },
      { label: "Ciblage", line: `Je m'adresse aux ${qui} (${ou}). C'est bien votre cas ?` },
      {
        label: "Bascule",
        line: `Je propose ${quoi}. Avant d'en dire plus, une question : est-ce un sujet chez vous en ce moment ?`,
        note: "Une seule chose à la bascule. Le reste se montre en rendez-vous.",
      },
      { label: "CTA", line: "Si c'est un sujet : quinze minutes pour regarder votre cas — fin de semaine ou début de la prochaine ?" },
    ],
    diagnostic: [
      "Aujourd'hui, comment vous gérez ce sujet ?",
      "Qu'est-ce qui vous coûte le plus là-dedans : du temps, de l'argent, des clients ?",
      "Qui d'autre décide avec vous sur ce sujet ?",
    ],
    mirror: "Si je vous ai bien compris : [reprendre SES mots, pas les vôtres]. C'est bien ça ?",
    forbidden: [
      { regle: "Le prix à froid : il vient après un « oui, c'est un sujet », jamais avant." },
      { regle: "La liste de fonctionnalités : une seule chose à la bascule, le reste en rendez-vous." },
      { regle: "Des clients ou des résultats que vous ne pouvez pas montrer : ça se vérifie, et la confiance se perd en une question." },
      { regle: "Ce que vous savez de lui sans qu'il l'ait dit (ce qu'il a ouvert, ce que vous avez lu sur lui) : ça sonne fliqué." },
    ],
    objections: [
      { q: "Envoyez-moi un mail.", a: "Avec plaisir. Pour qu'il vous serve à quelque chose : c'est un sujet pour vous cette année, oui ou non ?" },
      { q: "On a déjà quelqu'un pour ça.", a: "Très bien, je ne vous demande pas d'en changer. Qu'est-ce qui vous ferait regarder ailleurs, un jour ?" },
      { q: "Je n'ai pas le temps.", a: "Je comprends. Je vous rappelle à un meilleur moment : plutôt jeudi ou lundi ?" },
      { q: "Ça coûte combien ?", a: "Ça dépend de votre cas, c'est l'objet des quinze minutes. Je préfère vous donner un chiffre juste qu'un chiffre au hasard." },
    ],
  };

  return { vertical, manques };
}

/**
 * Quel script servir à qui.
 *
 * ⚠ LE MAÎTRE GARDE NOS VERTICALES. Elles ont été écrites pour qu'EAGLEYE vende
 * Alpha, et c'est exactement ce que fait le compte maître. Tout autre compte
 * vend SON offre : il reçoit le script de son profil, quel que soit le métier
 * du prospect appelé.
 *
 * Le même verdict décide de ce que l'assistant d'appel souffle
 * (`catalogue`) : le script et les réponses aux objections doivent parler de
 * la MÊME offre, sinon l'un des deux fait dire notre pitch.
 *
 * `maitre` vient de `useDroits()`, qui est optimiste (maître tant que la
 * réponse n'est pas arrivée) : un inscrit voit nos verticales une fraction de
 * seconde au chargement. C'est un défaut d'affichage connu, pas une fuite —
 * ces scripts ne sont pas un secret, ils sont simplement hors sujet pour lui.
 */
export function scriptAServir(
  maitre: boolean,
  profil: ProfilOperateur | null | undefined,
  verticaleDuProspect: VerticalPlaybook | null,
): { vertical: VerticalPlaybook | null; manques: string[]; catalogue: CatalogueObjections } {
  if (maitre) return { vertical: verticaleDuProspect, manques: [], catalogue: "complet" };
  return { ...scriptOperateur(profil), catalogue: "universel" };
}
