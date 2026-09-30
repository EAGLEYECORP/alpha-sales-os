import { ALPHA_VOICE_SETUP_HT, ALPHA_VOICE_PALIERS, ALPHA_VOICE_MINUTE_SUP_HT } from "./offres-publiques";
import type { KnowledgeNote } from "./knowledge";
// ⚠ Les deux modules sont SERVEUR (`tests/vitrine-fuite` → MODULES_SERVEUR) :
// l'import ne descend dans aucun bundle. Et `pct` vient de `calibration`, la
// seule définition du rendu d'un pourcentage — un second formateur ferait
// s'afficher « 7.7% » ici et « 7,7 % » ailleurs pour la même mesure.
import { JUILLET_REEL } from "./pipeline-juillet";
import { pct } from "./calibration";
// ⚠ Ces trois modules sont la SOURCE des notes ci-dessous : rien n'est recopié.
// La leçon de `sc-voix-tarifs` — une grille recopiée survit à la décision qui
// l'a changée, et c'est la seule source que le modèle peut citer.
import { INTERDICTIONS_SECTORIELLES } from "./secteurs-interdits";
import { SEGMENTS, SEGMENT_PRINCIPAL } from "./plan-traction";
import { EFFORT_RAPIDE_MAX_JOURS } from "./veille";
import { NUWACOM_THRESHOLD_HT } from "./accounts";
import { commercialFor } from "./accounts-commercial";
import { PACK_SETUP_HT, SOCLE_PLATEFORME_HT, PRIX_SIEGE_HT } from "./offres-publiques";
import { LOGEMENTS_MIN, SATURATION_LOGEMENTS, ZONE_CIBLE } from "./permis-construire";
import { RAPPELS_OFFSETS_H } from "./call-cadence";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SOCLE DU CERVEAU — la doctrine maison, en clair.
 *
 * ── POURQUOI CE FICHIER EST SÉPARÉ DE `lib/knowledge.ts` ──
 *
 * Ces notes sont le playbook : rituels de closing avec les adresses
 * partenaires, prix de setup, taux de commission par offre, seuil de routage.
 * Elles vivaient dans `lib/knowledge.ts`, importé par `lib/store.ts` — donc
 * par TOUTES les pages client. Mesuré sur le build : l'email d'expédition et
 * le panel de vente d'un partenaire étaient dans un chunk téléchargeable
 * sans mot de passe, alors même qu'on venait de les sortir de `lib/accounts`.
 *
 * Sortir une donnée d'un fichier ne sert à rien si la même phrase est recopiée
 * dans un autre que le navigateur télécharge aussi. C'est la leçon de cette
 * passe : il faut suivre le GRAPHE d'imports, pas les fichiers.
 *
 * Le socle est donc servi par `/api/knowledge/seed` (route interne) et fusionné
 * dans le store au premier chargement d'une session authentifiée. Les notes que
 * l'utilisateur écrit ensuite lui appartiennent et restent dans son navigateur
 * — ce module ne les voit jamais.
 *
 * ⚠ Ne JAMAIS l'importer depuis un composant client. Vérifié par
 * `tests/vitrine-fuite.test.ts`.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * L'espace insécable des milliers. ⚠ Vu au RENDU, jamais déduit : une note
 * engendrée écrivait « 1490 € HT » et « 1500 min ». Ces notes sont lues par un
 * humain en rendez-vous ET recopiées dans des emails par le modèle — un nombre
 * mal formaté dans un devis se remarque immédiatement.
 */
const euros = (n: number) => n.toLocaleString("fr-FR");

/**
 * ⚠⚠ LES QUATRE NOTES DU 10/08 ÉTAIENT RECOPIÉES À LA MAIN, ET TOUTES AVAIENT
 * DÉRIVÉ (relevé le 30/09/2026) : installation « 2 500 € » et abonnement « dès
 * 290 €/mois » (la grille est 10 000 € + socle + siège), un CAC, une LTV et un
 * « LTV:CAC 21:1 » calculés à zéro vente, un play qui visait le maître
 * d'ŒUVRE au lieu du maître d'OUVRAGE, sur une source qui ne couvre pas Lyon.
 * Le Cerveau alimente les prompts : l'IA pouvait citer ces prix dans un email.
 * Elles DÉRIVENT désormais des modules qui font foi, comme les notes plus bas.
 */
const ICP = commercialFor("eagleye").icp ?? {};

export const seedKnowledge: KnowledgeNote[] = [
  {
    id: "seed-offre",
    title: "Offre — Alpha Sales OS",
    body:
      "Un OS de vente : prospection, qualification, relances, scripts, suivi, pipeline, mesure. " +
      "Les humains closent, Alpha fait tourner la machine — la livraison et la poignée de main " +
      "restent au client.\n\n" +
      `Grille du pack complet : installation **${euros(PACK_SETUP_HT)} € HT** (faite à la main), puis ` +
      `**${euros(SOCLE_PLATEFORME_HT)} € HT/mois** de socle + **${euros(PRIX_SIEGE_HT)} € HT/mois par utilisateur**. ` +
      "Alpha Voice se facture à l'usage, hors formule.\n\n" +
      "⚠ Ces prix sont des DÉCISIONS : aucune vente ne les a validés. Cadrage obligatoire avant tout " +
      "devis, et jamais de prix avant la démo.\n\n" +
      "Voir [[Chiffres — preuve de concept]] et [[Routage d'offre]].",
    tags: ["offre", "alpha-sales-os"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-chiffres",
    title: "Chiffres — preuve de concept",
    body:
      "**Zéro vente à ce jour.** Aucun taux de signature, aucun CAC, aucune durée de vie client " +
      "n'a été observé chez nous : toute projection en euros inventerait le seul maillon qui " +
      "manque.\n\n" +
      "Ce qui est MESURÉ : le pipe de juillet 2026 (voir [[Juillet 2026 — ce que le mois a réellement " +
      "produit]]) et le coût à la minute d'Alpha Voice (voir [[Alpha Voice — grille tarifaire]]).\n" +
      "Ce qui est DÉCIDÉ : les prix, les seuils de tri, les paliers de campagne.\n\n" +
      "La preuve de concept, ce sera la première signature — pas un tableau.",
    tags: ["chiffres", "economie"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-routage",
    title: "Routage d'offre",
    body:
      "L'offre suit la VERTICALE du prospect, lue sur son tag (jamais sur un mot de ses notes) :\n\n" +
      "- Maître d'ouvrage à permis actif → **Alpha Sales OS** : sa perte, ce sont des acquéreurs " +
      "déjà rencontrés que personne n'a rappelés — jamais « vous ratez des appels ».\n" +
      "- Métiers où le téléphone est le canal d'entrée (garage, cabinet, restauration…) → **Alpha Voice**.\n" +
      "- Invisible en ligne, CONSTATÉ (pas de site, peu d'avis relevés) → **Visibilité / Growth**.\n\n" +
      "Un signal MESURÉ peut contredire la verticale ; un champ vide, jamais. " +
      "Voir [[Play — Permis de construire]].",
    tags: ["doctrine", "routage"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "seed-permis",
    title: "Play — Permis de construire",
    body:
      "ICP à déclencheur : le **maître d'OUVRAGE professionnel** (promoteur, SCCV, aménageur) dont le " +
      `permis de construire est actif, en ${ZONE_CIBLE}. Pas le maître d'œuvre : lui conçoit, il ne vend pas.\n\n` +
      "Source : Sitadel (`scripts/permis-sitadel.mjs`), trié par `lib/permis-construire.ts` — particuliers, " +
      "bailleurs sociaux et personnes publiques sortent par exclusion, ils n'ont rien à vendre.\n\n" +
      `Sous ${LOGEMENTS_MIN} logements, l'offre n'est pas proportionnée. À partir de ${SATURATION_LOGEMENTS}, ` +
      "il y a plus de contacts acquéreurs que de bras : c'est la douleur qu'on vend. Les deux seuils sont des " +
      "DÉCISIONS, aucune vente ne les a validés.\n\n" +
      "Le permis sert à CHOISIR qui on contacte, jamais à ouvrir la conversation : ni permis, ni adresse, " +
      "ni nombre de lots à froid. Canal : LinkedIn. Voir [[Routage d'offre]].",
    tags: ["play", "prospection", "permis"],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PIPE DE JUILLET 2026 — RAPATRIÉ, PAS JETÉ.
 *
 * ⚠ Ces notes appartenaient au compte d'un revendeur. Le compte a disparu
 * avec l'accord ; les CHIFFRES, eux, sont à nous — c'est nous qui avons passé
 * les 132 appels. C'est aussi la seule mesure `mesure-maison` du dépôt (voir
 * `lib/references.ts` : la seule catégorie qui mérite le mot « vérité »).
 *
 * Les supprimer parce qu'un partenariat s'arrête aurait effacé la seule chose
 * que ce dépôt sait pour l'avoir constatée, et laissé les hypothèses seules.
 * Elles passent donc sous EAGLEYE, qui porte désormais l'offre.
 *
 * Ce qui a été SUPPRIMÉ, en revanche : le rituel de closing du revendeur
 * (email d'expédition, panel de vente). Ce n'est plus un chemin, c'est une
 * fausse piste — et l'agent le lirait comme une consigne.
 * ─────────────────────────────────────────────────────────────────────
 */
export const seedTerrain: KnowledgeNote[] = [
  {
    id: "sc-juillet-chiffres",
    accountId: "eagleye",
    title: "Juillet 2026 — ce que le mois a réellement produit",
    body:
      `${JUILLET_REEL.prospectsTravailles} prospects travaillés · ${JUILLET_REEL.univers} dans l'univers · ` +
      `${JUILLET_REEL.appels} appels · ${JUILLET_REEL.audits} audits · ${JUILLET_REEL.sms} SMS.\n` +
      `Résultat : ${JUILLET_REEL.rdvObtenus} RDV obtenus, ${JUILLET_REEL.opportunites} opportunités, ` +
      `${JUILLET_REEL.pipelineInstall.toLocaleString("fr-FR")} € de pipeline installation, **${JUILLET_REEL.gagnes} gagné**.\n\n` +
      // ⚠ DEUX taux, deux dénominateurs. La note annonçait « travaillés → RDV :
      // 11,8 % » — or 11,8 % c'est 6/51, l'univers QUALIFIÉ, pas 6/78. Le
      // Cerveau alimente les prompts, et les prompts écrivent de vrais emails :
      // c'était la seule source de ce taux que le modèle pouvait citer.
      `Sur fichier BRUT (travaillés) : ${pct(JUILLET_REEL.tauxBrutRdv)} → c'est le taux qui sert à ` +
      `dimensionner un export.\n` +
      `Sur fichier QUALIFIÉ (univers) : ${pct(JUILLET_REEL.tauxQualifieRdv)} → il suppose qu'un tri a ` +
      `déjà eu lieu. Les confondre fait payer la qualification deux fois.\n\n` +
      "La lecture qui compte : voir [[Juillet 2026 — une piste : l'audit écrit]].",
    tags: ["terrain", "chiffres", "juillet-2026"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-juillet-lecon",
    accountId: "eagleye",
    title: "Juillet 2026 — une piste : l'audit écrit",
    body:
      "Par secteur (prospects · appels · audits · opportunités) :\n\n" +
      "- Auto-école : 3 · 7 · 2 · **3**\n" +
      "- Immobilier : 8 · 10 · 4 · **2**\n" +
      "- Garage/Carrosserie : 18 · 34 · 1 · **2**\n" +
      "- Médical/Dentaire : 10 · 13 · 5 · 0\n" +
      "- Dépannage/Plomberie : 14 · **26** · **0** · **0**\n" +
      "- Ambulance : 8 · 14 · 1 · 0\n\n" +
      /*
       * ⚠ CETTE NOTE AFFIRMAIT « le meilleur ratio, de loin » et « là où un audit
       * est parti, le taux monte » (corrigé le 30/09/2026). Sur 3 prospects, un
       * dossier de plus ou de moins renverse le classement — et la ligne
       * médicale (5 audits, 0 opportunité) contredisait déjà la « leçon ». Le
       * Cerveau alimente les prompts : une hypothèse écrite comme une loi se
       * fait recopier comme une loi. « Jamais un taux nu », appliqué ici.
       */
      "**Ce que ça suggère — une HYPOTHÈSE, pas une mesure** : la plomberie (26 appels, " +
      "aucun audit écrit) n'a rien produit, et plusieurs secteurs où un audit est parti " +
      "ont produit des opportunités. Mais les effectifs sont minuscules (3 à 18 prospects " +
      "par secteur) : un dossier de plus ou de moins renverse le classement, et la ligne " +
      "médicale (5 audits, 0 opportunité) ne va déjà pas dans ce sens. Aucune " +
      "comparaison entre secteurs ne tient à cette taille.\n\n" +
      "Ce qu'on en garde, comme DÉCISION de méthode et non comme résultat : aucun " +
      "prospect ne va en séquence sans audit écrit. À revérifier quand les effectifs " +
      "le permettront.",
    tags: ["terrain", "doctrine", "audit"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-voix-tarifs",
    accountId: "eagleye",
    /**
     * ⚠⚠ CETTE NOTE PORTAIT LA GRILLE DU REVENDEUR MORT, ET LE CERVEAU ALIMENTE
     * LES PROMPTS QUI ÉCRIVENT DE VRAIS EMAILS (12/09/2026).
     *
     * Elle annonçait « Installation : 990 € HT » puis les cinq paliers
     * 59/115/169/219/319 — la grille publique de l'ancien partenaire, remplacée
     * le 02/09/2026 par 149/349. Et elle affirmait « le PRIX n'a pas encore été
     * décidé par nous », ce qui était faux depuis dix jours : son `updatedAt`
     * portait justement le 02/09. Quelqu'un a touché la date le jour de la
     * décision sans toucher au contenu.
     *
     * Le Cerveau est la seule source de prix que l'IA peut citer. Il tenait
     * donc deux générations de retard, et il le disait avec assurance.
     *
     * ⚠ LA GRILLE EST DÉSORMAIS DÉRIVÉE DES CONSTANTES, pas recopiée. Une
     * note recopiée redevient fausse au prochain changement de prix — c'est
     * exactement ce qui vient d'arriver, deux fois.
     */
    title: "Alpha Voice — grille tarifaire",
    body:
      `Installation : **${euros(ALPHA_VOICE_SETUP_HT)} € HT**.\n\n` +
      "Abonnement mensuel, deux paliers :\n" +
      ALPHA_VOICE_PALIERS.map(
        (p) => `- ${p.nom} — ${euros(p.minutes)} min, ${euros(p.prixHT)} €/mois (${p.appels})`
      ).join("\n") +
      `\n- Au-delà du forfait : ${ALPHA_VOICE_MINUTE_SUP_HT.toFixed(2).replace(".", ",")} €/min, ` +
      "pas de coupure, pas de palier à revendre.\n\n" +
      "⚠ **Le coût est MESURÉ, les prix sont des DÉCISIONS.** Coût de revient relevé : " +
      "0,0563 €/min, plus un socle fixe d'environ 57 €/mois. Marges : ~81 % sur Essentiel, " +
      "~76 % sur Intensif. Aucune vente n'a validé ces prix.\n\n" +
      `L'installation est passée de 990 à ${euros(ALPHA_VOICE_SETUP_HT)} € le 12/09/2026 : le marché ` +
      "français de l'installation d'agent vocal commencerait vers 1 500 € et monterait au-delà de 11 000 € " +
      "(voir `lib/marche.ts` — source SECONDAIRE : des guides publiés par des agences qui vendent ce " +
      "service), et nous étions SOUS ce plancher. Un prix sous le moins cher du marché " +
      "ne se lit pas « bonne affaire », il se lit « ce n'est pas le même produit ».\n\n" +
      "Jamais de prix avant la démo. Voir [[Cadence de relance téléphonique]].",
    tags: ["tarifs", "alpha-voice"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-cadence",
    accountId: "eagleye",
    title: "Cadence de relance téléphonique",
    /**
     * ⚠ Elle disait « 5 rappels sur 2 jours (3 h, 8 h, 24 h, 32 h, 48 h) »,
     * tranché à 3 le 02/09/2026 dans `lib/call-cadence.ts` — et un test
     * EXIGEAIT la phrase fausse. Dérivée du code désormais (30/09/2026).
     */
    body:
      `Après le premier appel sans réponse → **${RAPPELS_OFFSETS_H.length} rappels** ` +
      `(${RAPPELS_OFFSETS_H.map((h) => `${h} h`).join(", ")} après le premier appel), ` +
      "chacun calé sur une fenêtre d'appel ouverte et sur un créneau différent.\n\n" +
      `Soit **${RAPPELS_OFFSETS_H.length + 1} contacts** au total : au plafond de 4 sollicitations sur ` +
      "30 jours du décret n° 2022-1313, jamais au-dessus.\n\n" +
      "**Dès qu'il répond** : Alpha Voice ARRÊTE d'appeler et met à jour le pipeline. L'humain n'est " +
      "appelé que sur un intérêt qualifié — un « non » ou un « rappelez-moi » se consigne sans mobiliser personne.\n\n" +
      "Opposition (« ne me rappelez plus ») ou numéro invalide : arrêt DÉFINITIF immédiat, " +
      "prioritaire sur la cadence.",
    tags: ["doctrine", "cadence"],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE LE CERVEAU IGNORAIT, ET POURQUOI C'ÉTAIT DANGEREUX (13/09/2026).
 *
 * Mesuré en croisant les notes contre les modules : le socle ne connaissait ni
 * les INTERDICTIONS SECTORIELLES, ni l'ICP en cours, ni la règle de routage
 * par faisabilité. Or le Cerveau alimente les prompts, et les prompts écrivent
 * de VRAIS emails et de VRAIS scripts d'appel.
 *
 * Conséquence concrète : un modèle à qui on demande « écris une approche pour
 * un organisme de formation » aurait rédigé un démarchage CPF — interdit — en
 * toute bonne foi, parce que rien dans sa mémoire ne disait le contraire.
 * `auditScript` l'aurait refusé APRÈS coup ; le Cerveau, lui, l'aurait
 * suggéré. Deux contrôles, et celui qui parle en premier était muet.
 *
 * ⚠ LES TROIS NOTES DÉRIVENT DES MODULES. La leçon de `sc-voix-tarifs` : une
 * grille recopiée dans une prose survit à la décision qui l'a changée, et
 * c'est la seule source de vérité que le modèle peut citer.
 * ─────────────────────────────────────────────────────────────────────
 */
export const seedOperationnel: KnowledgeNote[] = [
  {
    id: "sc-secteurs-interdits",
    accountId: "eagleye",
    title: "Secteurs où le démarchage est INTERDIT — à vérifier avant toute approche",
    body:
      "Avant d'écrire une approche à froid, vérifier le secteur. Dans ceux-ci, la prospection " +
      "commerciale est interdite ou verrouillée en France :\n\n" +
      INTERDICTIONS_SECTORIELLES.map(
        (i) =>
          `· **${i.label}** — ${i.texte} : ` +
          `${i.portee === "interdiction" ? "prospection INTERDITE" : "accord PRÉALABLE et explicite exigé"}.\n` +
          `  Ce qui reste possible : ${i.alternative}`,
      ).join("\n") +
      "\n\n⚠ Ces références ne sont PAS vérifiées par un juriste — à confirmer avant d'engager. " +
      "Mais dans le doute on n'écrit pas : `auditScript` refusera le script, et le client prendrait l'amende.\n\n" +
      "Le rappel d'un lead CONSENTI (formulaire, comparateur, demande entrante) n'est pas du démarchage : " +
      "c'est là qu'est le volume dans ces secteurs, et c'est là qu'Alpha Voice sert le plus.",
    tags: ["conformite", "interdits", "prospection"],
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-icp-courant",
    accountId: "eagleye",
    /**
     * ⚠⚠ ELLE ANNONÇAIT « Intérim & recrutement » (relevé le 30/09/2026) : elle
     * dérivait de `SEGMENT_PRINCIPAL` (`lib/plan-traction.ts`), resté sur un
     * avatar qui n'est pas le nôtre. Dériver ne protège que si la SOURCE est la
     * bonne. Elle lit désormais l'ICP du compte maître (`accounts-commercial`)
     * et les seuils du tri (`permis-construire`) — les deux endroits que le
     * code applique réellement.
     */
    title: `ICP en cours — ${ICP.label ?? "maître d'ouvrage à permis actif"}`,
    body:
      `**${ICP.label ?? ""}**\n\n` +
      `Qui : ${ICP.buyer ?? ""}.\n` +
      `Où : ${ICP.geo ?? ZONE_CIBLE}\n` +
      `Taille : ${ICP.companySize ?? ""}. Au-delà de ${SATURATION_LOGEMENTS} logements, la demande sature — ` +
      "c'est là que la douleur existe.\n\n" +
      "Écarté d'office :\n" +
      (ICP.disqualifiers ?? []).map((d) => `· ${d}`).join("\n") +
      "\n\nCanaux :\n" +
      (ICP.channels ?? []).map((c) => `· ${c}`).join("\n") +
      "\n\n⚠ Un seul avatar à la fois. Zéro permis converti à ce jour : les seuils et la zone sont des " +
      "DÉCISIONS, à revoir quand dix affaires les auront contredits.",
    tags: ["icp", "ciblage"],
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    source: "playbook",
  },
  {
    id: "sc-routage-faisabilite",
    accountId: "eagleye",
    title: "Routage d'un chantier — DEUX questions, pas une",
    body:
      "Un dossier se route sur deux critères distincts, et ils peuvent se contredire.\n\n" +
      "1. **Peut-on le FAIRE ?** Si un outil libre ou nous-mêmes le livrons en " +
      `${EFFORT_RAPIDE_MAX_JOURS} jours-homme ou moins, c'est pour nous (100 %). Sinon → plateforme partenaire, ` +
      "**quel que soit le montant** : aucun prix ne rend faisable ce qu'on ne sait pas livrer.\n" +
      `2. **Doit-on le PRENDRE ?** Au-delà de ${NUWACOM_THRESHOLD_HT.toLocaleString("fr-FR")} € HT, ` +
      "c'est le seuil de sous-traitance (15 %, puis 100 % de la maintenance).\n\n" +
      "⚠ Quand les deux se contredisent — faisable vite MAIS au-dessus du seuil — on ne tranche pas tout seul. " +
      "C'est un arbitrage humain, et ce qui manque n'est pas un calcul : c'est de savoir si on a la CAPACITÉ de " +
      "porter un chantier de cette taille en plus du reste.\n\n" +
      "⚠ L'effort se compte sur les bornes HAUTES, et une seule brique à construire sort du régime rapide même " +
      "courte : ce n'est pas sa durée qui coûte, c'est son incertitude.",
    tags: ["routage", "partenaire", "chiffrage"],
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    source: "playbook",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ UNE NOTE CORRIGÉE ICI N'ATTEIGNAIT AUCUN NAVIGATEUR (30/09/2026).
 *
 * Le socle ne se sème qu'UNE fois (`knowledgeSeeded`). La grille morte d'Alpha
 * Voice, corrigée le 12/09, est donc restée dans tous les navigateurs déjà
 * semés — et c'est le navigateur qui alimente le prompt. Corriger le code
 * donnait l'impression d'avoir corrigé le Cerveau.
 *
 * Les dates qu'a PORTÉES le socle, relevées dans l'historique git. Une note
 * encore datée de l'une d'elles n'a jamais été touchée par l'utilisateur
 * (`upsertNote` date une édition à la seconde près) : on peut la remplacer
 * sans rien lui prendre. Une note éditée, on la garde — c'est la sienne.
 * ─────────────────────────────────────────────────────────────────────
 */
export const DATES_SOCLE_ANTERIEURES: readonly string[] = [
  "2026-08-01T00:00:00.000Z",
  "2026-08-10T00:00:00.000Z",
  "2026-09-02T00:00:00.000Z",
  "2026-09-12T00:00:00.000Z",
  "2026-09-13T00:00:00.000Z",
];

/** Le socle complet, dans l'ordre d'insertion. */
export const SEED_NOTES: KnowledgeNote[] = [...seedKnowledge, ...seedTerrain, ...seedOperationnel];
