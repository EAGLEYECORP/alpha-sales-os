# Sécurité d'usage — l'humain garde la main
**Art. 14 (supervision humaine) et art. 50 (transparence) · chaque règle cite `fichier#symbole`**

## 1. Ce que la machine ne fait jamais seule

| Situation | Ce qu'ALPHA fait | Où |
|---|---|---|
| Le prospect parle de prix (sans prix déclaré), veut signer (sans lien déclaré), doute, négocie | N'envoie rien ; tag `reponse-a-traiter` + étape datée pour l'humain | `lib/reponses-inscrit.ts#deciderReponse` · `lib/reponses-inscrit.ts#TAG_A_TRAITER` |
| Réponse aux créneaux qui n'en choisit aucun clairement | Ne réserve pas une heure mal comprise : remonte | `lib/reponses-inscrit.ts#classerReponse` |
| « Ne me recontactez plus » | Arrêt définitif, sur tous les canaux | `lib/voice-script.ts#aRefuseTouteRelance` |
| Plafond légal de sollicitations atteint | Plus de rappel | `lib/call-cadence.ts#plafondRappels` |
| Hors jours ouvrés et heures utiles | Lit, n'écrit pas | `lib/conformite.ts#fenetreOuverte` |

Ce qui attend un humain est rassemblé en un seul endroit, la bande « ALPHA a
besoin de toi » : `lib/presence-alpha.ts#attendentUnHumain`.

## 2. Transparence (art. 50)

- Appel : `lib/voice-script.ts#auditScript` refuse un script sans divulgation.
- Écrit autonome : `lib/signature-ia.ts#verifieDivulgation`, appelée avant tout envoi.
- Preuve : `tests/art50-disclosure.test.ts`.

## 3. Contenu hostile

Tout texte qui vient de l'extérieur est encadré comme donnée
(`lib/untrusted.ts#wrapUntrusted`) et l'IA de l'app n'a aucun outil d'écriture.
Détail menace par menace : `docs/ARTICLE_15.md`. Preuve : `tests/prompt-injection.test.ts`.

## 4. Arrêter la machine

- Pilote de l'onglet : bouton « Arrêter ALPHA » (`/autopilote`).
- Pilote serveur : « Arrêter dans le cloud » ; l'interrupteur est relu à chaque passage.
