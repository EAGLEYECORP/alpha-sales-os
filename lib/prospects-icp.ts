/**
 * ─────────────────────────────────────────────────────────────────────
 * Prospects ICP Alpha Voice — consolidés depuis les feuilles de prospection
 * réelles de Zakaria (Google Sheets, juillet 2026) :
 *   · la feuille « artisans Lyon 6 & 7 », en deux listes A/B ;
 *   · la feuille « contacts Lyon 6 enrichis », classés fit Fort → Faible.
 *
 * ⚠ Ces deux feuilles portaient dans leur NOM la marque du revendeur avec qui
 * l'accord est mort le 02/09/2026. On désigne donc ici leur CONTENU (ce qui
 * identifie réellement une liste) et plus leur intitulé de fichier — les
 * fichiers, eux, sont chez Zakaria et ce module n'en dépend pas : le CSV
 * ci-dessous est figé, il ne relit aucune feuille.
 *
 * ICP = le cœur de cible d'Alpha Voice : un métier où le TÉLÉPHONE est
 * le premier point de contact et où personne n'est dédié à le prendre —
 * l'artisan sous un capot, le moniteur en leçon, la praticienne en cabine,
 * la régie qui croule sous les appels locataires. L'appel manqué y part
 * droit chez le concurrent.
 *
 * Filtrage appliqué (honnête) : ne sont RETENUS que les prospects encore
 * vivants et joignables. Sont ÉCARTÉS ceux dont la feuille dit clairement
 * qu'ils sont morts — fermé définitivement, départ en retraite, numéro non
 * attribué, « ne fait plus que de l'achat-revente », ou déjà équipés d'IA.
 * Écartés aussi les doublons du CRM existant (Les Clés d'Alexia).
 *
 * Le métier est répété dans `notes` : c'est ce que lit `verticalForProspect`
 * pour rattacher la fiche à la bonne verticale du playbook (garage, auto-
 * école, immobilier…) malgré le petit enum `Sector`. L'accroche terrain de
 * la feuille devient le premier `problems[]` — elle nourrit l'audit cadeau.
 *
 * Chargé depuis Réglages → « Prospects ICP (Alpha Voice) ». Import fusionnant
 * (ajoute / met à jour), il n'efface rien.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Format CSV (délimiteur `;`, champs entre guillemets) directement digéré
 * par `csvToProspects`. En-têtes mappés par `HEADER_MAP` de lib/csv.ts.
 */
export const PROSPECTS_ICP_CSV = `company;name;sector;city;phone;email;stage;problems;notes
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Quand vous êtes sous un capot, qui décroche ?";"garage. L7 — 50 Rue Saint-Michel. Créneau conseillé 7h30–8h ou 14h. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Fermé le dimanche — mais les pannes non. Ces appels partent où ?";"garage. L7 — 14 Rue du Général de Miribel. Numéro à confirmer. Un RDV aurait été pris — à vérifier. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Entre midi et 14h et le week-end, le standard est muet.";"garage / pièces auto. L7 — 208 Gde Rue de la Guillotière. À rappeler (éviter 12h–14h). Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Sous un capot, personne ne décroche = un RDV chez le voisin.";"garage mécanique et carrosserie. L7 — 106 Rue André Bollier. Pas de site web. Source : feuille de sourcing terrain (liste B)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Ouvert tard, un seul standard : les appels du soir, captés ?";"garage. L7. Contacté 2× au téléphone, dit ne pas en avoir besoin — à convaincre EN PHYSIQUE, le potentiel est réel (il a rappelé). Source : feuille de sourcing terrain (liste B)."
"***NOM-RETIRE***";"";"artisan";"Meyzieu";"***TEL-RETIRE***";"";"prospect";"Seul au garage : décrocher pendant une intervention, impossible.";"garage. Meyzieu — 4 bis av. Docteur Schweitzer. Répond et intervient seul — à creuser. Source : feuille de sourcing terrain."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Seul sur le terrain : décrocher ET travailler, impossible.";"électricien. L7 — 20 Bd des Tchécoslovaques. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Un seul téléphone : combien d'appels simultanés perdus ?";"électricien. L7 — ≈40 rue Bancel. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"À l'atelier, pas au bureau : les devis sonnent dans le vide.";"menuisier. L7 — 29 Rue Sébastien Gryphe. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Un devis demandé samedi, pas rappelé lundi = client parti.";"menuisier. L7 — 18 Rue d'Anvers. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 6";"***TEL-RETIRE***";"";"prospect";"Vous répondez 24/7 — mais deux appels en même temps ?";"serrurier. L6 — 45 rue de Sèze. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 7";"***TEL-RETIRE***";"";"prospect";"Sur chantier toute la journée, les prospects réno vont à la concurrence.";"rénovation. L7 — 25 Rue Michel Félizat. Source : feuille de sourcing terrain (liste A)."
"***NOM-RETIRE***";"";"artisan";"Lyon 6";"***TEL-RETIRE***";"***EMAIL-RETIRE***";"prospect";"Vos techniciens en intervention — qui prend les demandes d'entretien ?";"chauffagiste. L6 — 108 Rue de Sèze. A un email : cible email + appel. Source : feuille de sourcing terrain (liste B)."
"***NOM-RETIRE***";"";"autre";"Lyon 6";"***TEL-RETIRE***";"***EMAIL-RETIRE***";"prospect";"Gestion locative = téléphone saturé : combien d'appels locataires ratés ?";"régie immobilière (gestion, gros volume d'appels). L6 — 14 Rue Tronchet. Aussi location ***TEL-RETIRE*** / transaction ***TEL-RETIRE***. Source : Sheet Lyon 6 enrichi (fit Fort)."
"***NOM-RETIRE***";"";"autre";"Lyon 6";"***TEL-RETIRE***";"***EMAIL-RETIRE***";"prospect";"Quatre métiers sur une seule ligne : le standard déborde.";"agence immobilière (transaction + location + gestion + syndic). L6 — 6 Place Kléber. Source : Sheet Lyon 6 enrichi (fit Fort)."
"***NOM-RETIRE***";"";"autre";"Lyon 6";"***TEL-RETIRE***";"***EMAIL-RETIRE***";"prospect";"Moniteur en leçon = personne ne décroche pour les inscriptions.";"auto-école. L6 — 20 Rue Vauban. PROSPECT ACTIF, kit d'approche déjà prêt. A un email. Source : Sheet Lyon 6 enrichi (fit Fort)."
"***NOM-RETIRE***";"";"autre";"Lyon 6";"***TEL-RETIRE***";"";"prospect";"Un labo = le téléphone ne s'arrête jamais : combien basculent sur répondeur ?";"laboratoire médical d'analyses, cabinet à très gros volume d'appels. L6 — 69 Cours Vitton. Chaîne : vérifier si la décision est locale. Source : Sheet Lyon 6 enrichi (fit Moyen)."
"***NOM-RETIRE***";"";"autre";"Lyon 6";"***TEL-RETIRE***";"";"prospect";"Les praticiennes sont en cabine : qui prend les RDV qui appellent ?";"spa / institut de beauté, sur RDV, 5/5 (79 avis). L6 — 57 Rue Pierre Corneille. Aussi ***TEL-RETIRE***. Décideuses = les praticiennes, souvent en soin. Source : Sheet Lyon 6 enrichi (fit Fort)."
"***NOM-RETIRE***";"";"autre";"Lyon 6";"***TEL-RETIRE***";"";"prospect";"Le patron a les mains dans les cheveux : les RDV téléphoniques tombent.";"salon de coiffure. L6 — 60 Cours Vitton. Manque : email + nom du gérant (à récupérer en repérage). Source : Sheet Lyon 6 enrichi (fit Fort)."
"***NOM-RETIRE***";"";"autre";"Lyon Presqu'île";"***TEL-RETIRE***";"";"prospect";"Walk-ins et coups de rush : les appels non pris partent chez le voisin.";"bar à ongles / institut, 4.3/417 avis, réservations de dernière minute = gros volume tél. Cordeliers (presqu'île). Réserve en ligne → angle complémentaire, pas concurrent. Source : Sheet Lyon 6 enrichi (fit Fort*)."`;

/** Nombre de fiches ICP embarquées (pour l'UI). */
export const PROSPECTS_ICP_COUNT = PROSPECTS_ICP_CSV.trim().split("\n").length - 1;
