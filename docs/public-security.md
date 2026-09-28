# Signaler une faille

Ce dépôt est un **extrait de documentation**. Il ne contient pas de code
exécutable et n'est pas un logiciel à déployer.

## Comment signaler

Si tu as trouvé une faille sur un service opéré par EAGLEYE CORP, écris à
l'adresse de sécurité publiée sur `eagleyecorp.fr`, ou par message privé au
compte GitHub qui publie ce dépôt.

Merci de **ne pas divulguer publiquement avant correction**, et de laisser un
délai raisonnable pour corriger. Une réponse est envoyée sous quelques jours
ouvrés.

## Ce qui est utile dans un signalement

- ce que tu as observé, et l'URL ou l'endpoint concerné ;
- les étapes pour le reproduire ;
- l'impact que tu estimes réaliste.

Une preuve de concept qui **modifie ou exfiltre des données réelles** n'est pas
la bienvenue : arrête-toi à la démonstration.

## Périmètre

Les services en ligne d'EAGLEYE CORP. Ce dépôt de documentation lui-même n'a
pas de surface d'attaque — mais si tu y trouves une donnée qui n'aurait jamais
dû être publiée, c'est exactement le genre de signalement qui compte, et il est
traité en priorité.

## Ce qui est déjà couvert, par classe

Le produit traite ces classes de menace comme des exigences de conception, pas
comme des correctifs :

| Classe | Approche |
|---|---|
| XSS | échappement systématique avant rendu, y compris sur la sortie des modèles ; aperçus rendus en cadre isolé |
| CSRF | routes internes en même origine uniquement, JSON strict |
| Redirection ouverte | on ne redirige que vers une URL stockée à l'émission, jamais depuis la requête |
| SSRF | liste d'autorisation d'hôtes sur les récupérations distantes |
| Injection SQL | client paramétré, aucune requête concaténée |
| Cloisonnement | isolation par ligne au niveau base, jamais au niveau applicatif seul |
| Fuite de secrets | clés serveur uniquement, sondes publiques réduites au strict minimum |
| Injection de prompt | le contenu entrant est traité comme **donnée non fiable** ; l'IA n'a aucun outil d'écriture |
| Abus d'envoi | limitation de débit, mentions obligatoires vérifiées sur ce qui part réellement, refus plutôt qu'ajout silencieux |

> ⚠ Ce tableau dit les **classes traitées**, pas l'état d'un déploiement à un
> instant donné. L'état d'un déploiement — versions, avis de sécurité en cours,
> configuration — se traite en privé, avec la personne qui l'opère. Le publier
> ne protégerait personne et servirait surtout à qui cherche par où entrer.
