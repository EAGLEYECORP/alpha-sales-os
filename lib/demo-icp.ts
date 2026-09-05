import type { Prospect } from "./types";
import { prospectDefaults, PREFIXE_DEMO } from "./seed";

import { profilExploitable, type ProfilOperateur } from "./profil-operateur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA DÉMONSTRATION FABRIQUÉE DEPUIS L'ICP DE L'INSCRIT.
 *
 * Huit commerces lyonnais ne parlent qu'à qui vend à des commerces lyonnais.
 * Ici on produit des fiches qui ressemblent au marché que l'inscrit vient de
 * décrire — même secteur, même poste visé, même zone.
 *
 * ══ CE QUI GOUVERNE TOUT CE FICHIER : ON FABRIQUE DE FAUX PROSPECTS ══
 *
 * C'est une chose dangereuse à faire, et il faut le dire avant d'écrire la
 * première ligne. Trois risques, dans l'ordre de gravité :
 *
 *  1. **Quelqu'un appelle ou écrit à une fiche inventée.** Si le nom et le
 *     numéro ont l'air vrais, ils finiront composés — par l'inscrit qui teste,
 *     par l'agent vocal lancé trop vite, par un collègue. Au mieux c'est un
 *     numéro mort ; au pire c'est le numéro de quelqu'un.
 *
 *  2. **La fiche inventée devient un chiffre.** Elle entre dans le pipe
 *     pondéré, dans les taux, dans le plan du matin. Un tableau de bord qui
 *     compte des prospects imaginaires ment sur exactement ce qu'il existe
 *     pour mesurer.
 *
 *  3. **On invente une entreprise qui existe.** « Cabinet Martin » dans le
 *     conseil, à Lyon : il y en a un. C'est le risque qu'aucune prudence de
 *     rédaction ne supprime — seule la structure le peut.
 *
 * ══ LES QUATRE GARANTIES, ET ELLES SONT STRUCTURELLES ══
 *
 * Aucune ne repose sur le soin apporté à la rédaction, parce que le soin ne
 * survit pas à la sixième session.
 *
 *  · **Identifiant préfixé `demo-`** — `isDemoProspect` répond vrai sur la
 *    forme, pas sur l'appartenance à une liste. C'est ce qui fait refuser
 *    `/api/send` (409) et griser la barre d'envoi.
 *
 *  · **Téléphone dans la tranche 06 39 98 XX XX** — bloc RÉSERVÉ par l'ARCEP
 *    aux œuvres audiovisuelles (décision n° 2018-0881). Ces numéros ne
 *    peuvent ni appeler, ni être appelés, ni être attribués. Un numéro
 *    « plausible » inventé à la main, lui, appartient à quelqu'un.
 *
 *  · **Adresse sur `example.com`** — domaine réservé à jamais par la
 *    RFC 2606. `estAdresseDeDemo` le reconnaît sur le domaine, donc même
 *    quand l'identifiant n'arrive pas jusqu'au serveur.
 *
 *  · **Nom d'entreprise marqué `(démo)`** — visible à l'écran, dans les
 *    exports, dans les captures. Ça ne protège de rien techniquement : ça
 *    protège l'humain qui regarde, et c'est le seul des quatre qui parle à
 *    quelqu'un qui n'est pas développeur.
 *
 * ══ POURQUOI C'EST DÉTERMINISTE ══
 *
 * Même profil ⇒ mêmes fiches, toujours. Une démonstration qui change à
 * chaque rendu ne se lit pas comme « c'est un exemple » : elle se lit comme
 * une perte de données. On a déjà payé ça ailleurs — un écran qui se vide
 * une seconde ressemble trait pour trait à une panne.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * ── LES DATES SONT CALÉES SUR LE JOUR, ET CE N'EST PAS UN DÉTAIL ──
 *
 * ⚠ LE DÉTERMINISME ANNONCÉ PLUS HAUT ÉTAIT FAUX, et le test l'a attrapé
 * une fois sur dix.
 *
 * `daysAgo`/`daysAhead` (lib/utils) construisent depuis `Date.now()`, à la
 * MILLISECONDE. Deux appels successifs de `demoDepuisProfil` rendaient donc
 * des fiches différentes — mêmes noms, mêmes numéros, dates décalées de
 * quelques millisecondes. Conséquence réelle, au-delà du test : à chaque
 * rendu React, les objets changent d'identité, ce qui remonte des écritures
 * inutiles dans le store et fait clignoter les listes.
 *
 * Le pire est que ça ne se voyait presque jamais : deux appels tombent
 * généralement dans la même milliseconde. Un test qui échoue une fois sur
 * dix se relance, passe, et on l'oublie.
 *
 * On snappe donc à MINUIT du jour visé. Une fiche de démonstration n'a
 * aucun besoin d'une précision à la milliseconde, et « il y a 3 jours »
 * reste vrai toute la journée.
 */
const jourDecale = (n: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

/** Combien de fiches on fabrique. Assez pour que les écrans respirent. */
export const FICHES_DEMO = 6;

/**
 * Le bloc de numéros réservé par l'ARCEP à la fiction (décision 2018-0881).
 * Ni appelable, ni attribuable. C'est la seule façon honnête d'écrire un
 * numéro de téléphone dans un jeu de démonstration.
 */
const RACINE_FICTION = "06 39 98";

/** Domaine réservé par la RFC 2606 : il ne sera jamais attribué. */
const DOMAINE_FICTION = "example.com";

/**
 * Un hachage stable, 32 bits, sur la chaîne du profil.
 *
 * ⚠ Ce n'est PAS de la cryptographie et ça ne prétend pas l'être : on veut
 * seulement que deux profils différents donnent des fiches différentes, et
 * qu'un même profil donne toujours les mêmes. `Math.random()` ferait
 * exactement l'inverse.
 */
function graine(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Prénoms et noms neutres — aucun n'évoque une personne publique. */
const PRENOMS = ["Camille", "Samir", "Léa", "Thomas", "Nadia", "Hugo", "Inès", "Marc"];
const NOMS = ["Ferrand", "Delcourt", "Vasseur", "Amrani", "Rousset", "Bonnet", "Leclerc", "Mahé"];

/**
 * Les formes d'entreprise. Volontairement GÉNÉRIQUES et suffixées : on
 * combine un mot de forme et le secteur saisi, jamais un nom propre inventé.
 * « Groupe Logistique 3 (démo) » ne peut se confondre avec aucune société ;
 * « Transports Berthier » le pourrait.
 */
const FORMES = ["Groupe", "Maison", "Atelier", "Cabinet", "Société", "Compagnie"];

/** Les étapes du pipe, réparties pour que chaque écran ait de quoi montrer. */
const ETAPES: Prospect["stage"][] = ["prospect", "contact", "audit", "demo", "offre", "redzone"];

/**
 * Ce qui bloque, formulé depuis le poste visé.
 *
 * ⚠ On ne fabrique PAS de douleur sectorielle : prétendre savoir ce qui fait
 * mal à un DAF de la logistique serait de l'invention déguisée en donnée, et
 * l'inscrit — qui, lui, le sait — verrait immédiatement que c'est faux. On
 * écrit des obstacles de VENTE, qui sont vrais partout, et on laisse le
 * secteur au décor.
 */
const OBSTACLES = [
  "Ne répond pas au téléphone — trois tentatives, aucun retour",
  "Intéressé, mais « on en reparle au prochain trimestre »",
  "Le budget existe, la décision est ailleurs",
  "A déjà un prestataire, contrat en cours",
  "Demande un écrit avant tout rendez-vous",
  "Rendez-vous pris, à confirmer",
];

/**
 * Fabrique le jeu de démonstration à partir du profil.
 *
 * Rend `null` si le profil n'est pas exploitable — et ce `null` est le
 * message : l'appelant retombe alors sur le jeu écrit à la main, qui est
 * cohérent, plutôt que sur des fiches construites à partir de rien.
 */
export function demoDepuisProfil(profil: ProfilOperateur): Prospect[] | null {
  if (!profilExploitable(profil)) return null;

  const secteur = profil.cibleSecteur.trim();
  const role = profil.cibleRole.trim() || "décideur";
  const zone = profil.cibleZone.trim();
  const g = graine(`${secteur}|${role}|${zone}|${profil.poste}`);

  return Array.from({ length: FICHES_DEMO }, (_, i) => {
    // Décalages dérivés de la graine : stables, et différents d'un profil
    // à l'autre. `i` seul donnerait les mêmes six fiches à tout le monde.
    const p = (n: number, mod: number) => (g + i * n) % mod;

    const prenom = PRENOMS[p(7, PRENOMS.length)];
    const nom = NOMS[p(13, NOMS.length)];
    const forme = FORMES[p(5, FORMES.length)];
    const stage = ETAPES[i % ETAPES.length];

    /**
     * ⚠ « (démo) » EST DANS LE NOM, pas dans un champ à côté. Un marqueur
     * rangé ailleurs disparaît au premier export CSV, à la première copie
     * dans un email, à la première capture d'écran envoyée à un collègue —
     * c'est-à-dire exactement là où la confusion coûte quelque chose.
     */
    const company = `${forme} ${secteur} ${i + 1} (démo)`;

    return {
      ...prospectDefaults,
      id: `${PREFIXE_DEMO}${g.toString(36)}-${i}`,
      name: `${prenom} ${nom}`,
      company,
      /**
       * ⚠ `Sector` EST UNE UNION FERMÉE — restaurant, pub, ambulance,
       * artisan, autre. Elle date du marché d'origine et ne connaît aucun
       * des secteurs qu'un inscrit peut saisir. On ne l'élargit pas ici :
       * ce champ ROUTE (segments, scripts, tri), et y glisser du texte
       * libre casserait chaque module qui l'aiguille. Le secteur réel vit
       * donc dans le nom, les tags et les notes — visible partout où un
       * humain regarde, inerte partout où le code décide.
       */
      sector: "autre",
      city: zone || "—",
      // Tranche ARCEP réservée à la fiction : injoignable par construction.
      phone: `${RACINE_FICTION} ${String(p(11, 90) + 10)} ${String(p(17, 90) + 10)}`,
      email: `contact${i + 1}@${DOMAINE_FICTION}`,
      stage,
      /**
       * ⚠ AUCUNE VALEUR MONÉTAIRE INVENTÉE. Les fiches écrites à la main
       * portent des montants (« 290 €/mois, 1 800 € de setup ») parce
       * qu'elles décrivent NOTRE offre, dont on connaît le prix. Ici on ne
       * sait rien de ce que l'inscrit vend : poser un chiffre le ferait
       * entrer dans le pipe pondéré et dans ses prévisions. Une démo qui
       * annonce « 34 000 € de pipe » à quelqu'un qui n'a rien vendu est un
       * mensonge que son tableau de bord répétera tous les matins.
       */
      monthlyValue: 0,
      setupValue: 0,
      probability: 0,
      ignoranceTax: 0,
      tags: ["demo", secteur.toLowerCase(), role.toLowerCase()],
      nextStep: { date: jourDecale(1 + (i % 4)), action: OBSTACLES[i % OBSTACLES.length] },
      events: [
        {
          id: `${PREFIXE_DEMO}e-${i}`,
          date: jourDecale(-(3 + i * 2)),
          kind: "visite",
          summary: `Fiche de démonstration — ${role} dans ${secteur}. Remplace-la par une vraie fiche quand tu importes ton fichier.`,
        },
      ],
      notes:
        `Fiche FABRIQUÉE pour te montrer les écrans avec ton marché à toi, pas avec des restaurants lyonnais. ` +
        `Le numéro est dans une tranche réservée à la fiction (ARCEP) et l'adresse sur un domaine réservé ` +
        `(RFC 2606) : ni l'un ni l'autre ne peut joindre qui que ce soit, même par accident.`,
    } as Prospect;
  });
}
