# Autopilote de campagne — `/api/campaign/tick`

> Le déclencheur qui construit la file et lance les appels **sans que tu armes**.
> Trois verrous, aucun contournable. Lis-les avant de l'activer.

## Le danger qu'il évite, et comment

La cadence de rappel se déduit de la **timeline** du prospect. Un appel
automatique qui part **sans écrire son événement** est invisible au tick
suivant : la machine rappellerait la même personne toutes les heures.

Ce n'est pas une gêne technique, c'est du **harcèlement téléphonique**.

La règle est donc absolue, et testée :

```
ÉCRIRE L'ÉVÉNEMENT D'ABORD → DÉCLENCHER L'APPEL ENSUITE
```

Si l'écriture échoue, **l'appel ne part pas**. Un crash entre les deux coûte un
appel manqué ; l'ordre inverse coûterait un appel répété à chaque tick.
**On préfère perdre un appel que d'en répéter un.**

Double défense volontairement redondante : la file écarte déjà les prospects
hors cadence, **et** le tick revérifie qu'aucun n'a été touché dans l'heure.
En automatique, une seule ligne de défense ne suffit pas.

## Les trois verrous

| Verrou | Effet s'il manque |
|---|---|
| `CRON_SECRET` | **401.** Sans secret configuré, la route refuse de tourner — une route qui passe des appels réels ne s'ouvre pas au monde. |
| `CAMPAIGN_AUTOPILOT=on` | **Simulation.** La route rend ce qu'elle *aurait* fait. Déployer le code ne suffit jamais : il faut un second geste délibéré. |
| Supabase synchronisé | **412.** Le store vit dans le navigateur ; sans synchro, un cron serveur ne voit aucun prospect. La route le dit au lieu de rendre un succès vide. |

Plafond **dur** : `MAX_CALLS_PER_TICK = 5`, non contournable même en passant
`?max=999`. Et la **fenêtre horaire ne se force jamais** en automatique —
`force` n'existe pas sur cette route. Un humain peut décider d'appeler un
samedi ; une machine, non.

## Quelle URL utiliser ?

**Tu n'as pas besoin du sous-domaine pour que ça marche.** Vercel attribue déjà
une URL à ton projet, du type `alpha-sales-os-xxxx.vercel.app`. On l'appelle
`$APP` dans ce document.

Pour la trouver : dashboard Vercel → ton projet → l'URL affichée en haut
(« Domains » ou le bouton *Visit*). Ou en ligne de commande :

```bash
npx vercel ls
```

Pose-la une fois dans ton terminal pour coller les commandes plus bas :

```bash
export APP="https://ton-projet.vercel.app"
export CRON_SECRET="..."
```

Le jour où `alphasalesos.eagleyecorp.fr` existera (voir
`DEPLOIEMENT-DOMAINES.md`), **rien à changer dans le code** : tu remplaces
juste l'URL dans le nœud n8n. L'ancienne continue de fonctionner.

## Le planificateur : n8n, pas Vercel Cron

**Vercel Cron n'envoie que des requêtes GET.** Ici, `GET` renvoie l'**état de
la configuration** et ne déclenche rien — c'est volontaire : une requête GET ne
doit pas avoir d'effet de bord, encore moins passer des appels.

L'exécution est en **POST**. Utilise n8n (déjà branché dans l'app) :

**Nœud Schedule** — toutes les heures, 9h-11h et 14h-17h, du lundi au vendredi.
**Nœud HTTP Request** :

```
POST $APP/api/campaign/tick?accountId=eagleye&max=5
Header: Authorization: Bearer <CRON_SECRET>
```

## Mise en route — dans cet ordre

1. Poser `CRON_SECRET` sur Vercel (une chaîne longue et aléatoire).
2. Vérifier la config, **sans rien déclencher** :
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     $APP/api/campaign/tick
   ```
   Doit répondre `autopilot: "désarmé (simulation)"` et `supabase: "configuré"`.
3. **Simuler** un tick réel et lire `wouldCall` :
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     $APP/api/campaign/tick
   ```
   Regarde la liste. Ce sont de **vraies personnes** qui seront appelées.
4. Seulement si la liste te convient : poser `CAMPAIGN_AUTOPILOT=on`.
5. Brancher n8n.

## Couper en urgence

Retirer `CAMPAIGN_AUTOPILOT` (ou le passer à autre chose que `on`) sur Vercel.
Effet immédiat au tick suivant : retour en simulation, plus aucun appel.
Pas besoin de redéployer.

## Ce qui n'est pas encore fait

Le **résultat réel** de l'appel (décroché ? opposition ?) remonte par le journal
de session (transcription), pas par le tick. En attendant, l'événement écrit dit
« en attente du résultat » et la cadence le lit comme *sans réponse* — le
comportement prudent : elle continue au lieu de conclure à tort qu'il a répondu
et de laisser le dossier dormir.
